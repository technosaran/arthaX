"""
Financial Calculation Engine - Hardened Gmail Service Unit Tests
Verifies pagination with pageToken, exponential retry on 429/503 errors,
and accurate partial/failed status reporting when statements fail.
"""

from unittest.mock import MagicMock, patch
import urllib.error

from calculation_engine.bank_ingestion.gmail_service import GmailStatementIngestor


def test_search_messages_page_with_token():
    ingestor = GmailStatementIngestor(access_token="test_token")
    mock_response = {
        "messages": [{"id": "msg_1"}, {"id": "msg_2"}],
        "nextPageToken": "page_token_abc123",
        "resultSizeEstimate": 2,
    }

    with patch.object(ingestor, "_make_api_request", return_value=mock_response) as mock_req:
        msgs, next_token = ingestor.search_messages_page(max_results=2, page_token="prev_token_xyz")
        assert len(msgs) == 2
        assert next_token == "page_token_abc123"
        # Verify pageToken was passed in URL
        assert "pageToken=prev_token_xyz" in mock_req.call_args[0][0]


def test_search_all_messages_pagination():
    ingestor = GmailStatementIngestor(access_token="test_token")

    def mock_page(max_results=15, query=None, page_token=None):
        if page_token is None:
            return [{"id": "m1"}, {"id": "m2"}], "token_page_2"
        elif page_token == "token_page_2":
            return [{"id": "m3"}], None
        return [], None

    with patch.object(ingestor, "search_messages_page", side_effect=mock_page):
        all_msgs = ingestor.search_all_messages(max_total_messages=10)
        assert len(all_msgs) == 3
        assert [m["id"] for m in all_msgs] == ["m1", "m2", "m3"]


def test_make_api_request_retries_on_http_429():
    ingestor = GmailStatementIngestor(access_token="test_token")

    # Simulate 429 HTTPError twice, then 200 Success
    error_429 = urllib.error.HTTPError(
        url="http://gmail.test",
        code=429,
        msg="Too Many Requests",
        hdrs={},
        fp=MagicMock(read=lambda: b'{"error": "rate_limited"}'),
    )

    success_resp = MagicMock()
    success_resp.read.return_value = b'{"messages": [{"id": "msg_ok"}]}'
    success_resp.__enter__.return_value = success_resp

    with patch("urllib.request.urlopen", side_effect=[error_429, error_429, success_resp]) as mock_open:
        with patch("time.sleep") as mock_sleep:
            res = ingestor._make_api_request("http://gmail.test")
            assert "messages" in res
            assert mock_open.call_count == 3
            assert mock_sleep.call_count == 2


def test_sync_statements_reports_partial_failure_when_statement_fails():
    ingestor = GmailStatementIngestor(access_token="test_token")

    with patch.object(ingestor, "search_all_messages", return_value=[{"id": "msg_fail"}]):
        with patch.object(ingestor, "fetch_message_detail", return_value={
            "payload": {
                "headers": [{"name": "Subject", "value": "SBI Statement"}],
                "parts": [{
                    "filename": "sbi_protected.pdf",
                    "mimeType": "application/pdf",
                    "body": {"attachmentId": "att_fail_1", "size": 1000},
                }]
            }
        }):
            with patch.object(ingestor, "download_attachment", return_value=b"mock_pdf_bytes"):
                # Mock parser_registry to return a password required failure
                mock_failed_res = MagicMock()
                mock_failed_res.success = False
                mock_failed_res.errors = ["PASSWORD_REQUIRED", "Password missing"]
                mock_failed_res.transactions = []
                mock_failed_res.model_dump.return_value = {
                    "success": False,
                    "bank_name": "SBI",
                    "errors": ["PASSWORD_REQUIRED", "Password missing"],
                    "transactions": [],
                }

                with patch("calculation_engine.bank_ingestion.gmail_service.parser_registry.parse_statement", return_value=mock_failed_res):
                    result = ingestor.sync_statements()
                    # Sync must NOT be marked successful when statement failed!
                    assert result["success"] is False
                    assert result["status"] in ("FAILED", "PARTIAL_FAILURE")
                    assert result["has_failures"] is True
                    assert result["failed_count"] == 1
                    assert result["checkpoint"]["status"] in ("FAILED", "PARTIAL_FAILURE")
