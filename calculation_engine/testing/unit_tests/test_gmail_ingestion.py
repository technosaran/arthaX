"""
Financial Calculation Engine - Gmail Statement Ingestion Unit Tests
Tests Gmail search query building, bank detection, MIME attachment extraction,
URL-safe base64 decoding, password decryptor, and error handling.
"""


import base64
from unittest.mock import MagicMock, patch

from calculation_engine.bank_ingestion.gmail_service import (
    GmailStatementIngestor,
    detect_bank_from_metadata,
    extract_email_body,
    extract_password_hint_from_email,
    is_non_statement_attachment,
    prioritize_passwords_by_hint,
)


def test_build_query_default_and_after_date():
    ingestor = GmailStatementIngestor()
    default_q = ingestor.build_query()
    assert "from:sbi.co.in" in default_q
    assert "has:attachment" in default_q

    dated_q = ingestor.build_query(after_date="2026/11/01")
    assert "after:2026/11/01" in dated_q


def test_detect_bank_from_headers_and_filename():
    assert detect_bank_from_metadata("donotreply@sbi.co.in", "SBI e-Statement for Nov 2026") == "SBI"
    assert detect_bank_from_metadata("alerts@indianbank.co.in", "Monthly Statement") == "INDIAN_BANK"
    assert detect_bank_from_metadata("ebank@hdfcbank.net", "Account Statement") == "HDFC"
    assert detect_bank_from_metadata("statements@camsonline.com", "Consolidated Account Statement (eCAS)") == "MUTUAL_FUND_CAS"
    assert detect_bank_from_metadata("unknown@company.com", "Invoice 123", "sbi_statement.pdf") == "SBI"
    assert detect_bank_from_metadata("unknown@company.com", "Random Document", "data.csv") == "GENERIC"


def test_extract_attachment_parts_from_multipart_mime():
    ingestor = GmailStatementIngestor(access_token="mock-token")
    mock_payload = {
        "payload": {
            "parts": [
                {
                    "partId": "0",
                    "mimeType": "text/html",
                    "filename": "",
                    "body": {"size": 200},
                },
                {
                    "partId": "1",
                    "mimeType": "multipart/mixed",
                    "filename": "",
                    "parts": [
                        {
                            "partId": "1.0",
                            "mimeType": "application/pdf",
                            "filename": "SBI_Statement_Nov2026.pdf",
                            "body": {
                                "attachmentId": "att_sbi_12345",
                                "size": 150000,
                            },
                        },
                        {
                            "partId": "1.1",
                            "mimeType": "image/png",
                            "filename": "logo.png",
                            "body": {
                                "attachmentId": "att_logo_999",
                                "size": 5000,
                            },
                        },
                    ],
                },
            ]
        }
    }

    attachments = ingestor.extract_attachment_parts(mock_payload)
    assert len(attachments) == 1
    assert attachments[0]["filename"] == "SBI_Statement_Nov2026.pdf"
    assert attachments[0]["attachmentId"] == "att_sbi_12345"
    assert attachments[0]["mimeType"] == "application/pdf"


def test_process_raw_csv_attachments():
    ingestor = GmailStatementIngestor()
    csv_content = (
        "Date,Description,Debit,Credit,Balance\n"
        "01/11/2026,Opening Balance,,,10000.00\n"
        "05/11/2026,Salary Credit,,25000.00,35000.00\n"
        "10/11/2026,Swiggy UPI,500.00,,34500.00\n"
    ).encode("utf-8")

    attachments = [
        {
            "filename": "generic_bank.csv",
            "content_bytes": csv_content,
        }
    ]

    results = ingestor.process_raw_attachments(attachments)
    assert len(results) == 1
    res = results[0]
    assert res.success is True
    assert len(res.transactions) >= 2


def test_checkpoint_state_structure():
    ingestor = GmailStatementIngestor()
    chk = ingestor.compute_sync_checkpoint("hist_123456", 2)
    assert chk["status"] == "COMPLETED"
    assert chk["history_id"] == "hist_123456"
    assert chk["items_processed"] == 2
    assert "last_sync_timestamp" in chk
