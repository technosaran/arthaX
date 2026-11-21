"""
Financial Calculation Engine - Gmail Statement Ingestion Service
Discovers bank statement emails via Google Gmail REST API, downloads attachments,
performs incremental checkpointing, identifies banks, decrypts protected PDFs,
validates balances, classifies transactions, and detects transfers.
"""

import base64
import json
import logging
import re
import time
import urllib.request
import urllib.error
import urllib.parse
from datetime import datetime, timezone, date
from decimal import Decimal
from typing import Dict, Any, List, Optional, Tuple

from .parser_registry import parser_registry
from .models import StatementParseResult
from .pdf_decryptor import compute_file_hash
from ..intelligence import classifier, match_internal_transfers, TransactionClassificationInput


logger = logging.getLogger("arthax.gmail_ingestion")

# Targeted Gmail search query for statement discovery across major Indian banks and brokers
DEFAULT_GMAIL_STATEMENT_QUERY = (
    "(from:sbi.co.in OR from:indianbank.co.in OR from:hdfcbank.net OR from:icicibank.com "
    "OR from:axisbank.com OR from:kotak.com OR from:camsonline.com OR from:kfintech.com) "
    "AND (subject:statement OR subject:e-statement OR subject:\"account statement\" OR subject:\"eCAS\") "
    "AND has:attachment"
)

GMAIL_API_BASE_URL = "https://gmail.googleapis.com/gmail/v1/users/me"


def detect_bank_from_metadata(sender: str, subject: str, filename: str = "") -> str:
    """
    Detects bank identifier from email headers, subject, and attachment filename.
    """
    combined = f"{sender} {subject} {filename}".lower()
    if "sbi" in combined or "state bank of india" in combined or "sbin" in combined:
        return "SBI"
    if "indianbank" in combined or "indian bank" in combined or "indbank" in combined:
        return "INDIAN_BANK"
    if "hdfc" in combined:
        return "HDFC"
    if "icici" in combined:
        return "ICICI"
    if "axis" in combined:
        return "AXIS"
    if "kotak" in combined:
        return "KOTAK"
    if "cams" in combined or "kfintech" in combined or "ecas" in combined:
        return "MUTUAL_FUND_CAS"
    return "GENERIC"


class GmailStatementIngestor:
    def __init__(self, access_token: Optional[str] = None):
        self.access_token = access_token

    def build_query(self, custom_query: Optional[str] = None, after_date: Optional[str] = None) -> str:
        q = custom_query or DEFAULT_GMAIL_STATEMENT_QUERY
        if after_date:
            q += f" after:{after_date}"
        return q

    def _make_api_request(self, endpoint_url: str, max_retries: int = 3) -> Dict[str, Any]:
        """
        Performs authenticated HTTP GET to Gmail API using standard library urllib
        with exponential backoff retries for transient failures (HTTP 429, 500, 502, 503, 504).
        """
        if not self.access_token:
            raise ValueError("Gmail API access token is required")

        req = urllib.request.Request(
            endpoint_url,
            headers={
                "Authorization": f"Bearer {self.access_token}",
                "Accept": "application/json",
            },
        )

        for attempt in range(max_retries + 1):
            try:
                with urllib.request.urlopen(req, timeout=15) as resp:
                    data = resp.read()
                    return json.loads(data.decode("utf-8"))
            except urllib.error.HTTPError as err:
                err_body = err.read().decode("utf-8", errors="ignore")
                is_retryable = err.code in (429, 500, 502, 503, 504)
                if is_retryable and attempt < max_retries:
                    backoff = 0.25 * (2 ** attempt)
                    logger.warning(
                        f"Gmail API HTTP {err.code} on {endpoint_url}. Retrying in {backoff:.2f}s (attempt {attempt+1}/{max_retries})..."
                    )
                    time.sleep(backoff)
                    continue
                logger.error(f"Gmail API HTTP error {err.code}: {err_body}")
                raise RuntimeError(f"Gmail API error {err.code}: {err_body}")
            except Exception as e:
                if attempt < max_retries:
                    backoff = 0.25 * (2 ** attempt)
                    time.sleep(backoff)
                    continue
                logger.error(f"Gmail API request failure: {str(e)}")
                raise

    def search_messages(
        self,
        max_results: int = 15,
        query: Optional[str] = None,
        page_token: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Searches user mailbox for statement emails matching query.
        Returns list of message summaries.
        """
        msgs, _ = self.search_messages_page(max_results=max_results, query=query, page_token=page_token)
        return msgs

    def search_messages_page(
        self,
        max_results: int = 15,
        query: Optional[str] = None,
        page_token: Optional[str] = None,
    ) -> Tuple[List[Dict[str, Any]], Optional[str]]:
        """
        Searches user mailbox and returns a tuple: (messages, next_page_token).
        """
        q = self.build_query(query)
        encoded_q = urllib.parse.quote(q)
        url = f"{GMAIL_API_BASE_URL}/messages?q={encoded_q}&maxResults={min(max_results, 50)}"
        if page_token:
            url += f"&pageToken={urllib.parse.quote(page_token)}"
        res = self._make_api_request(url)
        return res.get("messages", []), res.get("nextPageToken")

    def search_all_messages(
        self,
        max_total_messages: int = 50,
        query: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Paginates through Gmail messages up to max_total_messages using page tokens.
        """
        all_messages: List[Dict[str, Any]] = []
        page_token: Optional[str] = None

        while len(all_messages) < max_total_messages:
            batch_size = min(max_total_messages - len(all_messages), 25)
            msgs, next_token = self.search_messages_page(max_results=batch_size, query=query, page_token=page_token)
            if not msgs:
                break
            all_messages.extend(msgs)
            page_token = next_token
            if not page_token:
                break

        return all_messages

    def fetch_message_detail(self, message_id: str) -> Dict[str, Any]:
        """Fetches full MIME message payload for a given message ID."""
        url = f"{GMAIL_API_BASE_URL}/messages/{message_id}?format=full"
        return self._make_api_request(url)

    def extract_attachment_parts(self, message_payload: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Recursively traverses MIME message structure to find PDF and CSV attachments."""
        attachments: List[Dict[str, Any]] = []

        def _traverse_parts(parts: List[Dict[str, Any]]):
            for part in parts:
                filename = part.get("filename", "")
                mime_type = part.get("mimeType", "")
                body = part.get("body", {})
                attachment_id = body.get("attachmentId")

                is_target_file = (
                    filename.lower().endswith(".pdf")
                    or filename.lower().endswith(".csv")
                    or "pdf" in mime_type.lower()
                    or "csv" in mime_type.lower()
                )

                if is_target_file and attachment_id:
                    attachments.append({
                        "filename": filename or "statement.pdf",
                        "mimeType": mime_type,
                        "attachmentId": attachment_id,
                        "size": body.get("size", 0),
                    })

                sub_parts = part.get("parts", [])
                if sub_parts:
                    _traverse_parts(sub_parts)

        payload = message_payload.get("payload", {})
        parts = payload.get("parts", [])
        if parts:
            _traverse_parts(parts)
        else:
            # Single-part payload
            fn = payload.get("filename", "")
            att_id = payload.get("body", {}).get("attachmentId")
            if fn and att_id:
                attachments.append({
                    "filename": fn,
                    "mimeType": payload.get("mimeType", ""),
                    "attachmentId": att_id,
                    "size": payload.get("body", {}).get("size", 0),
                })

        return attachments

    def download_attachment(self, message_id: str, attachment_id: str) -> bytes:
        """Downloads attachment raw bytes and URL-safe base64 decodes them."""
        url = f"{GMAIL_API_BASE_URL}/messages/{message_id}/attachments/{attachment_id}"
        res = self._make_api_request(url)
        raw_b64 = res.get("data", "")
        if not raw_b64:
            return b""
        # Decode RFC 4648 URL-safe base64
        return base64.urlsafe_b64decode(raw_b64.encode("utf-8"))

    def process_raw_attachments(
        self,
        attachments: List[Dict[str, Any]],
        password_candidates: Optional[List[str]] = None,
        email_metadata: Optional[Dict[str, Any]] = None,
    ) -> List[StatementParseResult]:
        """
        Processes a list of raw attachments:
        [ { "filename": "sbi_nov26.pdf", "content_bytes": b"...", "message_id": "..." }, ... ]
        """
        results: List[StatementParseResult] = []
        for att in attachments:
            fname = att.get("filename", "statement.pdf")
            content = att.get("content_bytes", b"")
            if not content:
                continue

            try:
                res = parser_registry.parse_statement(content, fname, password_candidates)
                if email_metadata:
                    res.metadata.raw_metadata["email_metadata"] = email_metadata
                results.append(res)
            except Exception as e:
                logger.error(f"Error parsing attachment {fname}: {e}")
                err_res = parser_registry.adapters[0]._build_empty_failure(
                    fname,
                    "unknown",
                    f"Exception during attachment ingestion: {str(e)}",
                )
                results.append(err_res)

        return results

    def sync_statements(
        self,
        password_candidates: Optional[List[str]] = None,
        after_date: Optional[str] = None,
        max_messages: int = 10,
        custom_query: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Full end-to-end automated pipeline:
        Gmail search (paginated) -> message detail -> attachment extract -> download -> parse -> classify -> transfer match.
        Never marks sync successful if individual statements failed.
        """
        messages = self.search_all_messages(
            max_total_messages=max_messages,
            query=self.build_query(custom_query, after_date),
        )

        if not messages:
            return {
                "success": True,
                "status": "COMPLETED",
                "has_failures": False,
                "failed_count": 0,
                "failed_statements": [],
                "messages_scanned": 0,
                "statements_processed": 0,
                "total_transactions_extracted": 0,
                "transfers_matched": 0,
                "statements": [],
                "checkpoint": self.compute_sync_checkpoint(None, 0, status="COMPLETED"),
            }

        parsed_statements: List[Dict[str, Any]] = []
        failed_statements: List[Dict[str, Any]] = []
        total_transactions = 0
        all_transactions_for_matching: List[Dict[str, Any]] = []

        for msg_summary in messages:
            msg_id = msg_summary.get("id")
            if not msg_id:
                continue

            try:
                msg_detail = self.fetch_message_detail(msg_id)
            except Exception as err:
                logger.warning(f"Failed to fetch message detail for {msg_id}: {err}")
                failed_statements.append({
                    "success": False,
                    "message_id": msg_id,
                    "error_code": "MESSAGE_FETCH_FAILED",
                    "errors": [f"Failed to fetch message details: {str(err)}"],
                })
                continue

            # Extract email headers
            headers = msg_detail.get("payload", {}).get("headers", [])
            header_map = {h.get("name", "").lower(): h.get("value", "") for h in headers}
            sender = header_map.get("from", "")
            subject = header_map.get("subject", "")
            email_date = header_map.get("date", "")

            email_meta = {
                "message_id": msg_id,
                "sender": sender,
                "subject": subject,
                "date": email_date,
            }

            attachments = self.extract_attachment_parts(msg_detail)
            for att_meta in attachments:
                att_id = att_meta.get("attachmentId")
                fn = att_meta.get("filename", "statement.pdf")
                if not att_id:
                    continue

                try:
                    content_bytes = self.download_attachment(msg_id, att_id)
                    if not content_bytes:
                        continue

                    file_hash = compute_file_hash(content_bytes)
                    detected_bank = detect_bank_from_metadata(sender, subject, fn)

                    parse_res = parser_registry.parse_statement(
                        content=content_bytes,
                        filename=fn,
                        passwords=password_candidates,
                    )

                    # Enrich transactions with Transaction Intelligence
                    enriched_txs = []
                    for tx in parse_res.transactions:
                        classification = classifier.classify(
                            TransactionClassificationInput(
                                amount=tx.amount,
                                direction=tx.direction,
                                original_narration=tx.original_narration,
                                transaction_date=tx.transaction_date,
                                transaction_reference=tx.transaction_reference,
                            )
                        )
                        tx_dict = tx.model_dump()
                        tx_dict["category"] = classification.category
                        tx_dict["transaction_type"] = classification.transaction_type
                        tx_dict["classification_confidence"] = float(classification.confidence)
                        tx_dict["classification_reason"] = classification.reason
                        tx_dict["merchant_name"] = classification.merchant_name
                        tx_dict["merchant_category"] = classification.merchant_category
                        tx_dict["counterparty_name"] = classification.counterparty_name
                        tx_dict["counterparty_identifier"] = classification.counterparty_identifier
                        tx_dict["channel"] = classification.channel
                        tx_dict["is_refund"] = classification.is_refund
                        enriched_txs.append(tx_dict)
                        all_transactions_for_matching.append(tx_dict)

                    stmt_dict = parse_res.model_dump()
                    stmt_dict["transactions"] = enriched_txs
                    stmt_dict["email_metadata"] = email_meta
                    stmt_dict["detected_bank"] = detected_bank
                    stmt_dict["file_hash"] = file_hash
                    parsed_statements.append(stmt_dict)
                    total_transactions += len(enriched_txs)

                    if not parse_res.success:
                        failed_statements.append({
                            "success": False,
                            "file_name": fn,
                            "file_hash": file_hash,
                            "errors": parse_res.errors,
                            "email_metadata": email_meta,
                        })

                except Exception as parse_err:
                    logger.error(f"Error processing attachment {fn} from msg {msg_id}: {parse_err}")
                    fail_info = {
                        "success": False,
                        "file_name": fn,
                        "errors": [str(parse_err)],
                        "email_metadata": email_meta,
                        "transactions": [],
                    }
                    parsed_statements.append(fail_info)
                    failed_statements.append(fail_info)

        # Match internal transfers across all extracted transactions
        transfer_matches = match_internal_transfers(all_transactions_for_matching)

        has_failures = len(failed_statements) > 0
        overall_status = "FAILED" if (has_failures and len(failed_statements) == len(parsed_statements)) else ("PARTIAL_FAILURE" if has_failures else "COMPLETED")
        overall_success = not has_failures

        return {
            "success": overall_success,
            "status": overall_status,
            "has_failures": has_failures,
            "failed_count": len(failed_statements),
            "failed_statements": failed_statements,
            "messages_scanned": len(messages),
            "statements_processed": len(parsed_statements),
            "total_transactions_extracted": total_transactions,
            "transfers_matched": len(transfer_matches),
            "statements": parsed_statements,
            "checkpoint": self.compute_sync_checkpoint(
                None,
                len(parsed_statements),
                status=overall_status,
            ),
        }

    def compute_sync_checkpoint(
        self,
        new_history_id: Optional[str],
        items_processed: int,
        status: str = "COMPLETED",
    ) -> Dict[str, Any]:
        """Returns structured JSON checkpoint state for database persistence."""
        return {
            "last_sync_timestamp": datetime.now(timezone.utc).isoformat(),
            "history_id": new_history_id,
            "items_processed": items_processed,
            "status": status,
        }
