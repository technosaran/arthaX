"""
Financial Calculation Engine - Gmail Statement Ingestion Service
Discovers bank statement emails via Google Gmail API, downloads attachments,
performs incremental checkpointing, and orchestrates ingestion.
"""

import base64
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple

from .parser_registry import parser_registry
from .models import StatementParseResult


logger = logging.getLogger("arthax.gmail_ingestion")

# Targeted Gmail search query for statement discovery
DEFAULT_GMAIL_STATEMENT_QUERY = (
    "(from:sbi.co.in OR from:indianbank.co.in OR from:hdfcbank.net OR from:icicibank.com "
    "OR from:axisbank.com OR from:kotak.com OR from:camsonline.com OR from:kfintech.com) "
    "AND (subject:statement OR subject:e-statement OR subject:\"account statement\" OR subject:\"eCAS\") "
    "AND has:attachment"
)


class GmailStatementIngestor:
    def __init__(self, access_token: Optional[str] = None):
        self.access_token = access_token

    def build_query(self, custom_query: Optional[str] = None, after_date: Optional[str] = None) -> str:
        q = custom_query or DEFAULT_GMAIL_STATEMENT_QUERY
        if after_date:
            q += f" after:{after_date}"
        return q

    def process_raw_attachments(
        self,
        attachments: List[Dict[str, Any]],
        password_candidates: Optional[List[str]] = None,
    ) -> List[StatementParseResult]:
        """
        Processes a list of raw attachments:
        [ { "filename": "sbi_nov26.pdf", "content_bytes": b"..." }, ... ]
        """
        results: List[StatementParseResult] = []
        for att in attachments:
            fname = att.get("filename", "statement.pdf")
            content = att.get("content_bytes", b"")
            if not content:
                continue

            try:
                res = parser_registry.parse_statement(content, fname, password_candidates)
                results.append(res)
            except Exception as e:
                logger.error(f"Error parsing attachment {fname}: {e}")
                results.append(
                    parser_registry.adapters[0]._build_empty_failure(
                        fname,
                        "unknown",
                        f"Exception during attachment ingestion: {str(e)}",
                    )
                )

        return results

    def compute_sync_checkpoint(
        self,
        new_history_id: Optional[str],
        items_processed: int,
    ) -> Dict[str, Any]:
        """Returns structured JSON checkpoint state for database persistence."""
        return {
            "last_sync_timestamp": datetime.now(timezone.utc).isoformat(),
            "history_id": new_history_id,
            "items_processed": items_processed,
            "status": "COMPLETED",
        }
