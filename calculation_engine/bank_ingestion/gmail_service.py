"""
Financial Calculation Engine - Gmail Statement Ingestion Service
Discovers bank statement emails via Google Gmail REST API, downloads attachments,
performs incremental checkpointing, identifies banks, decrypts protected PDFs,
validates balances, classifies transactions, and detects transfers.
"""

import base64
import html
import json
import logging
import re
import time
import urllib.request
import urllib.error
import urllib.parse
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple

from .parser_registry import parser_registry
from .models import StatementParseResult
from .pdf_decryptor import compute_file_hash, prioritize_passwords_by_hint
from ..intelligence import classifier, match_internal_transfers, TransactionClassificationInput


logger = logging.getLogger("arthax.gmail_ingestion")

# Non-statement keywords for identifying informational leaflets, brochures, disclosures, etc.
NON_STATEMENT_KEYWORDS = [
    "terms",
    "condition",
    "mitc",
    "charges",
    "tariff",
    "schedule",
    "brochure",
    "guideline",
    "fair_practice",
    "security_tips",
    "advisory",
    "welcome",
    "disclosure",
    "policy",
    "faq",
    "user_guide",
    "form16",
    "interest_cert",
    "tds",
    "circular",
    "leaflet",
    "notice",
]


def is_non_statement_attachment(filename: str) -> bool:
    """
    Checks for non-statement indicators in filename (case-insensitive).
    Banks frequently attach informational pamphlets (e.g. Terms_and_Conditions.pdf, MITC.pdf,
    Schedule_of_Charges.pdf, Fair_Practice_Code.pdf, Security_Tips.pdf, Brochure.pdf, Welcome_Kit.pdf,
    Form16A.pdf, Interest_Cert.pdf).
    Returns True if the attachment is an informational leaflet and should NOT be parsed as a bank statement.
    """
    if not filename:
        return False

    fn_lower = filename.lower()
    fn_normalized = re.sub(r'[\s\-_]+', '_', fn_lower)
    fn_alphanumeric = re.sub(r'[^a-z0-9]', '', fn_lower)

    for kw in NON_STATEMENT_KEYWORDS:
        kw_lower = kw.lower()
        kw_norm = re.sub(r'[\s\-_]+', '_', kw_lower)
        kw_alpha = re.sub(r'[^a-z0-9]', '', kw_lower)

        if kw_lower in fn_lower or kw_norm in fn_normalized or kw_alpha in fn_alphanumeric:
            return True

    return False


def extract_email_body(payload: Dict[str, Any]) -> str:
    """
    Recursively extracts and decodes text/plain and text/html bodies from MIME payload.
    Handles URL-safe base64 decoding and cleans HTML tags with regex.
    """
    plain_parts: List[str] = []
    html_parts: List[str] = []

    def _decode_body_data(data_str: str) -> str:
        if not data_str:
            return ""
        pad = len(data_str) % 4
        if pad:
            data_str += "=" * (4 - pad)
        try:
            raw_bytes = base64.urlsafe_b64decode(data_str.encode("utf-8"))
            return raw_bytes.decode("utf-8", errors="replace")
        except Exception as e:
            logger.warning(f"Failed to decode message body data: {e}")
            return ""

    def _traverse(part: Dict[str, Any]):
        mime_type = part.get("mimeType", "").lower()
        body = part.get("body", {})
        raw_data = body.get("data")

        if raw_data:
            if "text/plain" in mime_type:
                decoded = _decode_body_data(raw_data)
                if decoded.strip():
                    plain_parts.append(decoded.strip())
            elif "text/html" in mime_type:
                decoded = _decode_body_data(raw_data)
                if decoded.strip():
                    cleaned = re.sub(r'<[^>]+>', ' ', decoded)
                    cleaned = html.unescape(cleaned)
                    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
                    if cleaned:
                        html_parts.append(cleaned)

        for sub_part in part.get("parts", []):
            _traverse(sub_part)

    _traverse(payload)

    if plain_parts and html_parts:
        plain_combined = "\n".join(plain_parts)
        html_combined = "\n".join(html_parts)
        if html_combined.lower() in plain_combined.lower():
            return plain_combined
        elif plain_combined.lower() in html_combined.lower():
            return html_combined
        return f"{plain_combined}\n{html_combined}".strip()
    elif plain_parts:
        return "\n".join(plain_parts).strip()
    elif html_parts:
        return "\n".join(html_parts).strip()
    return ""


def extract_password_hint_from_email(snippet: str = "", body: str = "") -> Dict[str, Any]:
    """
    Inspects email snippet and body text for password instructions:
    - Detects keywords: password, to open, protected, format, ddmm, mobile, pan, account number, @
    - Identifies specific rule indicators:
      * YONO SBI rule: presence of dob / ddmm AND @ AND mobile / phone
      * Standard SBI / Indian Bank rule: dob / ddmm AND mobile (without @)
      * PAN rule: pan / permanent account number
      * Account number rule: account number / a/c no
      * Name rule: name / first 4 letters
    - Returns dictionary with detected rules, boolean flags, keywords, and extracted hint text.
    """
    snippet_str = snippet or ""
    body_str = body or ""
    combined = f"{snippet_str} {body_str}".strip()
    combined_lower = combined.lower()

    # Detect keywords
    keywords_found: List[str] = []

    if "password" in combined_lower or "passcode" in combined_lower:
        keywords_found.append("password")
    if "to open" in combined_lower or "to unlock" in combined_lower:
        keywords_found.append("to open")
    if "protected" in combined_lower or "encrypted" in combined_lower:
        keywords_found.append("protected")
    if "format" in combined_lower:
        keywords_found.append("format")
    if "ddmm" in combined_lower or "dd-mm" in combined_lower or "dd/mm" in combined_lower:
        keywords_found.append("ddmm")
    if "mobile" in combined_lower or "phone" in combined_lower:
        keywords_found.append("mobile")
    if re.search(r'\bpan\b', combined_lower) or "permanent account number" in combined_lower:
        keywords_found.append("pan")
    if "account number" in combined_lower or "account no" in combined_lower or re.search(r'\ba/c\s*(?:no|number)\b', combined_lower):
        keywords_found.append("account number")
    if "@" in combined:
        keywords_found.append("@")

    # Rule indicators
    has_dob = any(k in combined_lower for k in ("dob", "ddmm", "date of birth"))
    has_mobile = any(k in combined_lower for k in ("mobile", "phone"))
    has_at = "@" in combined

    # YONO SBI rule: presence of dob / ddmm AND @ AND mobile / phone
    is_yono_sbi = bool(has_dob and has_at and has_mobile)

    # Standard SBI / Indian Bank rule: dob / ddmm AND mobile (without @)
    is_dob_mobile = bool(has_dob and has_mobile and not has_at)

    # PAN rule: pan / permanent account number
    is_pan = bool(re.search(r'\bpan\b', combined_lower) or "permanent account number" in combined_lower)

    # Account number rule: account number / a/c no
    is_account_number = bool(
        "account number" in combined_lower
        or "account no" in combined_lower
        or re.search(r'\ba/c\s*(?:no|number)\b', combined_lower)
    )

    # Name rule: name / first 4 letters
    is_name = bool(
        "first 4 letters" in combined_lower
        or "first 4 characters" in combined_lower
        or "first four letters" in combined_lower
        or ("name" in combined_lower and any(w in combined_lower for w in ("first", "letters", "characters")))
    )

    rules_detected: List[str] = []
    if is_yono_sbi:
        rules_detected.append("yono_sbi")
    if is_dob_mobile:
        rules_detected.append("dob_mobile")
        rules_detected.append("standard_sbi")
    if is_pan:
        rules_detected.append("pan")
    if is_account_number:
        rules_detected.append("account_number")
    if is_name:
        rules_detected.append("name")

    # Extract hint sentences
    sentences = re.split(r'[\r\n]+|(?:(?<=[.!?])\s+)', combined)
    relevant_sentences: List[str] = []
    for s in sentences:
        s_clean = s.strip()
        if not s_clean:
            continue
        s_lower = s_clean.lower()
        if any(k in s_lower for k in ("password", "to open", "protected", "passcode", "format", "ddmm", "dob", "pan", "secret")):
            if s_clean not in relevant_sentences:
                relevant_sentences.append(s_clean)

    hint_text = " ".join(relevant_sentences[:5]).strip()
    if not hint_text and snippet_str:
        hint_text = snippet_str.strip()

    has_password_hint = bool(
        rules_detected
        or relevant_sentences
        or any(k in combined_lower for k in ("password", "to open", "protected", "passcode"))
    )

    return {
        "has_password_hint": has_password_hint,
        "hint_text": hint_text,
        "rules_detected": rules_detected,
        "keywords_found": keywords_found,
        "is_yono_sbi": is_yono_sbi,
        "is_dob_mobile": is_dob_mobile,
        "is_standard_sbi": is_dob_mobile,
        "is_pan": is_pan,
        "is_account_number": is_account_number,
        "is_name": is_name,
    }


def detect_bank_from_metadata(
    sender: str,
    subject: str,
    filename: str = "",
    body: str = "",
    snippet: str = "",
) -> str:
    """
    Detects bank identifier from email headers, subject, attachment filename, and body/snippet.
    Prioritizes headers/filename, falling back to body/snippet if generic.
    """
    def _match(text: str) -> str:
        combined = text.lower()
        if "sbi" in combined or "state bank of india" in combined or "sbin" in combined or "yonobysbi" in combined or "yono" in combined:
            return "SBI"
        if "indianbank" in combined or "indian bank" in combined or "indbank" in combined:
            return "INDIAN_BANK"
        if "hdfc" in combined:
            return "HDFC"
        if "icici" in combined:
            return "ICICI"
        if "axis" in combined or "utib" in combined:
            return "AXIS"
        if "kotak" in combined or "kkbk" in combined:
            return "KOTAK"
        if "pnb" in combined or "punjab national bank" in combined:
            return "PNB"
        if "baroda" in combined or "bob" in combined:
            return "BANK_OF_BARODA"
        if "canara" in combined:
            return "CANARA_BANK"
        if "union bank" in combined or "unionbank" in combined:
            return "UNION_BANK"
        if "standard chartered" in combined or "scbl" in combined:
            return "STANDARD_CHARTERED"
        if "indusind" in combined:
            return "INDUSIND"
        if "idfc" in combined:
            return "IDFC_FIRST"
        if "federal" in combined:
            return "FEDERAL_BANK"
        if "cams" in combined or "kfintech" in combined or "ecas" in combined:
            return "MUTUAL_FUND_CAS"
        return "GENERIC"

    primary = _match(f"{sender} {subject} {filename}")
    if primary != "GENERIC":
        return primary

    if body or snippet:
        secondary = _match(f"{snippet} {body}")
        if secondary != "GENERIC":
            return secondary

    return "GENERIC"


# Comprehensive Gmail search query for statement discovery across major banks
DEFAULT_GMAIL_STATEMENT_QUERY = (
    "(subject:statement OR subject:estatement OR subject:e-statement OR subject:passbook "
    "OR subject:\"account statement\" OR subject:\"statement of account\" OR subject:\"bank statement\" "
    "OR subject:eCAS OR subject:\"consolidated account statement\" "
    "OR from:sbi.co.in OR from:sbi.bank.in OR from:alerts.sbi.bank.in OR from:onlinesbi.sbi OR from:sbicard.com "
    "OR from:hdfcbank.net OR from:hdfcbank.com OR from:hdfcbank.bank.in OR from:hdfcbankcard.com "
    "OR from:icicibank.com OR from:icicibank.bank.in OR from:icicibankltd.com "
    "OR from:axisbank.com OR from:axis.bank.in OR from:axisbank.net "
    "OR from:kotak.com OR from:kotakbank.com OR from:kotak.bank.in "
    "OR from:pnb.co.in OR from:pnbindia.in "
    "OR from:bankofbaroda.com OR from:bankofbaroda.co.in OR from:bobfinancial.com "
    "OR from:canarabank.com OR from:unionbankofindia.co.in OR from:idbibank.co.in "
    "OR from:indianbank.co.in OR from:indianbank.in OR from:indbankonline.com "
    "OR from:indusind.com OR from:indusindbank.com OR from:idfcfirstbank.com OR from:federalbank.co.in "
    "OR from:yesbank.in OR from:yes.bank.in OR from:rblbank.com OR from:aubank.in "
    "OR from:sc.com OR from:hsbc.co.in OR from:citibank.co.in OR from:americanexpress.com "
    "OR from:camsonline.com OR from:kfintech.com) "
    "-from:reportsmailer.zerodha.net -from:zerodha.com -from:cdslstatement.com -from:nsdl.co.in "
    "has:attachment (filename:pdf OR filename:csv)"
)

GMAIL_API_BASE_URL = "https://gmail.googleapis.com/gmail/v1/users/me"


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
        with exponential backoff retries for transient failures (HTTP 429, 500, 502, 503, 504
        and Google rateLimitExceeded / userRateLimitExceeded 403 errors).
        """
        if not self.access_token:
            raise ValueError("Gmail API access token is required")

        req = urllib.request.Request(
            endpoint_url,
            headers={
                "Authorization": f"Bearer {self.access_token}",
                "Accept": "application/json",
                "User-Agent": "ArthaX-Financial-Engine/2.0 (Google-Gmail-API)",
            },
        )

        for attempt in range(max_retries + 1):
            try:
                with urllib.request.urlopen(req, timeout=15) as resp:
                    data = resp.read()
                    return json.loads(data.decode("utf-8"))
            except urllib.error.HTTPError as err:
                err_body = err.read().decode("utf-8", errors="ignore")
                is_rate_limit_403 = err.code == 403 and any(
                    r in err_body for r in ("rateLimitExceeded", "userRateLimitExceeded", "quotaExceeded")
                )
                is_retryable = err.code in (429, 500, 502, 503, 504) or is_rate_limit_403
                if is_retryable and attempt < max_retries:
                    backoff = (0.25 * (2 ** attempt)) + (0.05 * attempt)
                    logger.warning(
                        f"Gmail API HTTP {err.code} on {endpoint_url}. Retrying in {backoff:.2f}s (attempt {attempt+1}/{max_retries})..."
                    )
                    time.sleep(backoff)
                    continue
                logger.error(f"Gmail API HTTP error {err.code}: {err_body}")
                raise RuntimeError(f"Gmail API error {err.code}: {err_body}")
            except Exception as e:
                if attempt < max_retries:
                    backoff = (0.25 * (2 ** attempt)) + (0.05 * attempt)
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

    def extract_email_body(self, message_payload: Dict[str, Any]) -> str:
        """Extracts and decodes plain/HTML text from message payload."""
        return extract_email_body(message_payload)

    def extract_attachment_parts(self, message_payload: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Recursively traverses MIME message structure to find PDF and CSV attachments (including inline data)."""
        attachments: List[Dict[str, Any]] = []
        seen_keys = set()

        def _append_unique(att_dict: Dict[str, Any]):
            key = (att_dict.get("attachmentId") or "", att_dict.get("filename", "").lower(), att_dict.get("size", 0))
            if key in seen_keys:
                return
            seen_keys.add(key)
            attachments.append(att_dict)

        def _decode_data(data_str: str) -> bytes:
            if not data_str:
                return b""
            pad = len(data_str) % 4
            if pad:
                data_str += "=" * (4 - pad)
            return base64.urlsafe_b64decode(data_str.encode("utf-8"))

        def _traverse_parts(parts: List[Dict[str, Any]]):
            for part in parts:
                filename = part.get("filename", "")
                mime_type = part.get("mimeType", "")
                body = part.get("body", {})
                attachment_id = body.get("attachmentId")
                raw_data = body.get("data")

                is_target_file = (
                    filename.lower().endswith(".pdf")
                    or filename.lower().endswith(".csv")
                    or "pdf" in mime_type.lower()
                    or "csv" in mime_type.lower()
                )

                if is_target_file and (attachment_id or raw_data):
                    att_dict: Dict[str, Any] = {
                        "filename": filename or "statement.pdf",
                        "mimeType": mime_type,
                        "size": body.get("size", 0),
                    }
                    if attachment_id:
                        att_dict["attachmentId"] = attachment_id
                    if raw_data:
                        try:
                            decoded = _decode_data(raw_data)
                            att_dict["data"] = decoded
                            if not att_dict["size"]:
                                att_dict["size"] = len(decoded)
                        except Exception as e:
                            logger.warning(f"Failed to decode inline attachment data: {e}")
                    _append_unique(att_dict)

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
            mime_type = payload.get("mimeType", "")
            body = payload.get("body", {})
            att_id = body.get("attachmentId")
            raw_data = body.get("data")
            is_target_file = (
                fn.lower().endswith(".pdf")
                or fn.lower().endswith(".csv")
                or "pdf" in mime_type.lower()
                or "csv" in mime_type.lower()
            )
            if is_target_file and (att_id or raw_data):
                att_dict = {
                    "filename": fn or "statement.pdf",
                    "mimeType": mime_type,
                    "size": body.get("size", 0),
                }
                if att_id:
                    att_dict["attachmentId"] = att_id
                if raw_data:
                    try:
                        decoded = _decode_data(raw_data)
                        att_dict["data"] = decoded
                        if not att_dict["size"]:
                            att_dict["size"] = len(decoded)
                    except Exception as e:
                        logger.warning(f"Failed to decode inline attachment data: {e}")
                _append_unique(att_dict)

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
        password_hints = None
        if email_metadata:
            snippet = email_metadata.get("snippet", "")
            body = email_metadata.get("email_body", "")
            password_hints = extract_password_hint_from_email(snippet=snippet, body=body)
            email_metadata["password_hints"] = password_hints

        for att in attachments:
            fname = att.get("filename", "statement.pdf")
            content = att.get("content_bytes", b"")
            if not content:
                continue

            # Intelligent Attachment Filtering: Skip non-statement brochures, terms, and notices
            if is_non_statement_attachment(fname):
                logger.info(f"Skipping non-statement informational attachment {fname}")
                continue

            try:
                prioritized_passwords = prioritize_passwords_by_hint(password_candidates, password_hints)
                res = parser_registry.parse_statement(
                    content=content,
                    filename=fname,
                    passwords=prioritized_passwords,
                    metadata=email_metadata,
                    password_hints=password_hints,
                )
                if email_metadata:
                    res.metadata.raw_metadata["email_metadata"] = email_metadata
                    res.raw_metadata["email_metadata"] = email_metadata
                if password_hints:
                    res.raw_metadata["password_hints"] = password_hints
                results.append(res)
            except Exception as e:
                logger.error(f"Error parsing attachment {fname}: {e}")
                fallback_gen = GenericPdfBankAdapter() if fname.lower().endswith(".pdf") else GenericCsvBankAdapter()
                err_res = fallback_gen._build_empty_failure(
                    fname,
                    "unknown",
                    f"Exception during attachment ingestion: {str(e)}",
                )
                if email_metadata:
                    err_res.raw_metadata["email_metadata"] = email_metadata
                if password_hints:
                    err_res.raw_metadata["password_hints"] = password_hints
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
        tx_by_id: Dict[str, Dict[str, Any]] = {}

        # Fetch full MIME details concurrently (bounded at 4 workers) for fast sync turnaround
        msg_ids = [m["id"] for m in messages if m.get("id")]
        fetched_details: Dict[str, Tuple[Optional[Dict[str, Any]], Optional[str]]] = {}

        def _fetch_one(mid: str) -> Tuple[str, Optional[Dict[str, Any]], Optional[str]]:
            try:
                return mid, self.fetch_message_detail(mid), None
            except Exception as exc:
                return mid, None, str(exc)

        if len(msg_ids) > 1:
            from concurrent.futures import ThreadPoolExecutor
            with ThreadPoolExecutor(max_workers=min(4, len(msg_ids))) as pool:
                for mid, detail, err_str in pool.map(_fetch_one, msg_ids):
                    fetched_details[mid] = (detail, err_str)
        elif len(msg_ids) == 1:
            mid, detail, err_str = _fetch_one(msg_ids[0])
            fetched_details[mid] = (detail, err_str)

        for msg_summary in messages:
            msg_id = msg_summary.get("id")
            if not msg_id:
                continue

            msg_detail, fetch_err = fetched_details.get(msg_id, (None, "Missing detail"))
            if fetch_err or msg_detail is None:
                logger.warning(f"Failed to fetch message detail for {msg_id}: {fetch_err}")
                failed_statements.append({
                    "success": False,
                    "message_id": msg_id,
                    "error_code": "MESSAGE_FETCH_FAILED",
                    "errors": [f"Failed to fetch message details: {fetch_err}"],
                })
                continue

            # Extract email headers
            headers = msg_detail.get("payload", {}).get("headers", [])
            header_map = {h.get("name", "").lower(): h.get("value", "") for h in headers}
            sender = header_map.get("from", "")
            subject = header_map.get("subject", "")
            email_date = header_map.get("date", "")

            # Skip non-bank broker and depository statement emails (handled by dedicated broker integrations)
            sender_lower = sender.lower()
            if any(b in sender_lower for b in ("zerodha", "reportsmailer", "cdslstatement", "nsdl.co")):
                logger.info(f"Skipping non-bank broker/depository message {msg_id} from {sender}")
                continue

            # Extract email snippet and body text
            snippet = msg_detail.get("snippet", "")
            payload = msg_detail.get("payload", {})
            email_body = self.extract_email_body(payload)

            # Detect password hints from snippet and body
            password_hints = extract_password_hint_from_email(snippet=snippet, body=email_body)

            email_meta = {
                "message_id": msg_id,
                "sender": sender,
                "subject": subject,
                "date": email_date,
                "snippet": snippet,
                "email_body": email_body,
                "password_hints": password_hints,
            }

            attachments = self.extract_attachment_parts(msg_detail)
            for att_meta in attachments:
                att_id = att_meta.get("attachmentId")
                fn = att_meta.get("filename", "statement.pdf")
                inline_bytes = att_meta.get("data")
                if not att_id and not inline_bytes:
                    continue

                # Skip non-bank broker reports (e.g. securities holdings, funds ledgers, margin statements)
                fn_lower = fn.lower()
                if any(nb in fn_lower for nb in ("-funds.pdf", "-securities.pdf", "margin-statement", "cas_statement")):
                    logger.info(f"Skipping non-bank broker attachment {fn} from msg {msg_id}")
                    continue

                # Intelligent Attachment Filtering: Skip non-statement brochures, terms, and notices
                if is_non_statement_attachment(fn):
                    logger.info(f"Skipping non-statement informational attachment {fn} from msg {msg_id}")
                    continue

                try:
                    if inline_bytes:
                        content_bytes = inline_bytes
                    else:
                        content_bytes = self.download_attachment(msg_id, att_id)

                    if not content_bytes:
                        continue

                    file_hash = compute_file_hash(content_bytes)
                    detected_bank = detect_bank_from_metadata(
                        sender, subject, fn, body=email_body, snippet=snippet
                    )

                    prioritized_passwords = prioritize_passwords_by_hint(password_candidates, password_hints)

                    parse_res = parser_registry.parse_statement(
                        content=content_bytes,
                        filename=fn,
                        passwords=prioritized_passwords,
                        bank_hint=detected_bank,
                        metadata=email_meta,
                        password_hints=password_hints,
                    )

                    # Enrich transactions with Transaction Intelligence
                    enriched_txs = []
                    acct_key = f"{parse_res.bank_name or detected_bank}:{parse_res.metadata.account_number_masked or msg_id}"
                    for idx, tx in enumerate(parse_res.transactions):
                        classification = classifier.classify(
                            TransactionClassificationInput(
                                amount=tx.amount,
                                direction=tx.direction,
                                original_narration=tx.original_narration,
                                transaction_date=tx.transaction_date,
                                transaction_reference=tx.transaction_reference,
                                bank_name=parse_res.bank_name or detected_bank,
                            )
                        )
                        tx_dict = tx.model_dump()
                        tx_uid = f"{msg_id}:{att_id or 'inline'}:{idx}"
                        tx_dict["id"] = tx_uid
                        tx_dict["account_id"] = acct_key
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
                        tx_dict["is_transfer"] = classification.is_transfer
                        enriched_txs.append(tx_dict)
                        tx_by_id[tx_uid] = tx_dict
                        all_transactions_for_matching.append(tx_dict)

                    stmt_dict = parse_res.model_dump()
                    stmt_dict["transactions"] = enriched_txs
                    stmt_dict["email_metadata"] = email_meta
                    stmt_dict["password_hints"] = password_hints
                    stmt_dict["detected_bank"] = detected_bank
                    stmt_dict["file_hash"] = file_hash
                    stmt_dict["message_id"] = msg_id
                    stmt_dict["attachment_id"] = att_id or "inline"
                    parsed_statements.append(stmt_dict)
                    total_transactions += len(enriched_txs)

                    if not parse_res.success:
                        failed_statements.append({
                            "success": False,
                            "file_name": fn,
                            "file_hash": file_hash,
                            "message_id": msg_id,
                            "attachment_id": att_id or "inline",
                            "errors": parse_res.errors,
                            "email_metadata": email_meta,
                            "password_hints": password_hints,
                        })

                except Exception as parse_err:
                    logger.error(f"Error processing attachment {fn} from msg {msg_id}: {parse_err}")
                    fail_info = {
                        "success": False,
                        "file_name": fn,
                        "message_id": msg_id,
                        "attachment_id": att_id,
                        "errors": [str(parse_err)],
                        "email_metadata": email_meta,
                        "password_hints": password_hints,
                        "transactions": [],
                    }
                    parsed_statements.append(fail_info)
                    failed_statements.append(fail_info)

        # Match internal transfers across all extracted transactions and propagate flag
        transfer_matches = match_internal_transfers(all_transactions_for_matching)
        for tm in transfer_matches:
            for tid in (tm.debit_tx_id, tm.credit_tx_id):
                if tid in tx_by_id:
                    tx_by_id[tid]["is_transfer"] = True
                    tx_by_id[tid]["transaction_type"] = "INTERNAL_TRANSFER"
                    tx_by_id[tid]["category"] = "Transfer"

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
