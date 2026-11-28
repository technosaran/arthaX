"""
Financial Calculation Engine - Parser, UPI, Classifier & Gmail Sync Overhaul Tests
"""

from datetime import date
from decimal import Decimal
from unittest.mock import patch

from calculation_engine.bank_ingestion.generic_csv_adapter import GenericCsvBankAdapter
from calculation_engine.bank_ingestion.gmail_service import GmailStatementIngestor
from calculation_engine.intelligence.classifier import classifier
from calculation_engine.intelligence.models import TransactionClassificationInput
from calculation_engine.intelligence.upi_parser import parse_upi_narration


def test_upi_parser_supports_sbi_hdfc_kotak_formats():
    sbi = parse_upi_narration("TO TRANSFER-UPI/DR/631982736122/ZOMATO/ICIC/zomato@icici/ORDER")
    assert sbi is not None
    assert sbi["channel"] == "UPI"
    assert sbi["reference_number"] == "631982736122"
    assert sbi["vpa"] == "zomato@icici"
    assert sbi["counterparty_name"] == "Zomato"

    hdfc = parse_upi_narration("UPI-BLINKIT-blinkit@icici-ICIC0000123-412345678901-GROCERIES")
    assert hdfc is not None
    assert hdfc["reference_number"] == "412345678901"
    assert hdfc["vpa"] == "blinkit@icici"
    assert hdfc["counterparty_name"] == "Blinkit"


def test_classifier_eliminates_return_false_positive_and_covers_indian_rules():
    ticket = classifier.classify(
        TransactionClassificationInput(
            amount=Decimal("6500.00"),
            direction="DEBIT",
            original_narration="POS DEBIT RETURN FLIGHT TICKET INDIGO",
            transaction_date=date(2026, 11, 12),
        )
    )
    assert ticket.is_refund is False
    assert ticket.transaction_type != "REFUND"
    assert ticket.category == "Travel"

    sip = classifier.classify(
        TransactionClassificationInput(
            amount=Decimal("10000.00"),
            direction="DEBIT",
            original_narration="ACH/PPFAS MUTUAL FUND SIP FOLIO 12345",
            transaction_date=date(2026, 11, 5),
        )
    )
    assert sip.category == "Investments"
    assert sip.transaction_type == "INVESTMENT_PURCHASE"

    interest = classifier.classify(
        TransactionClassificationInput(
            amount=Decimal("412.50"),
            direction="CREDIT",
            original_narration="INT.PD: 01-07-2026 TO 30-09-2026",
            transaction_date=date(2026, 10, 1),
            bank_name="SBI",
        )
    )
    assert interest.category == "Interest & Dividends"
    assert interest.transaction_type == "INTEREST_INCOME"


def test_generic_csv_adapter_handles_bom_semicolon_and_single_amount_dr_cr():
    csv_single_amt = (
        "\ufeff"
        "HDFC Bank Statement\n"
        "Txn Date;Description;Amount;DR/CR;Balance\n"
        "01/11/2026;Salary Credit;50000.00;CR;60000.00\n"
        "05/11/2026;Swiggy UPI Order;450.00;DR;59550.00\n"
    ).encode("utf-8")

    adapter = GenericCsvBankAdapter()
    res = adapter.parse(csv_single_amt, "statement.csv")
    assert res.bank_name == "HDFC"
    assert len(res.transactions) == 2
    assert res.transactions[0].direction == "CREDIT"
    assert res.transactions[1].direction == "DEBIT"
    assert res.transactions[1].amount == Decimal("450.00")
    assert res.validation.is_valid is True


def test_gmail_service_deduplicates_mime_parts_and_propagates_transfers():
    ingestor = GmailStatementIngestor(access_token="mock-token")
    dup_payload = {
        "payload": {
            "parts": [
                {
                    "filename": "SBI.pdf",
                    "mimeType": "application/pdf",
                    "body": {"attachmentId": "att_1", "size": 1024},
                },
                {
                    "filename": "SBI.pdf",
                    "mimeType": "application/pdf",
                    "body": {"attachmentId": "att_1", "size": 1024},
                },
            ]
        }
    }
    parts = ingestor.extract_attachment_parts(dup_payload)
    assert len(parts) == 1

    # Verify cross-statement transfer back-propagation marks both legs is_transfer=True
    sbi_csv = (
        "Date,Description,Debit,Credit,Balance\n"
        "02/11/2026,TRANSFER TO HDFC UTR1234567890,10000.00,,40000.00\n"
    ).encode("utf-8")
    hdfc_csv = (
        "Date,Description,Debit,Credit,Balance\n"
        "02/11/2026,TRANSFER FROM SBI UTR1234567890,,10000.00,25000.00\n"
    ).encode("utf-8")

    with patch.object(ingestor, "search_all_messages", return_value=[{"id": "m_sbi"}, {"id": "m_hdfc"}]):
        def _detail(mid):
            if mid == "m_sbi":
                return {
                    "payload": {
                        "headers": [{"name": "From", "value": "alerts@sbi.co.in"}, {"name": "Subject", "value": "SBI Statement"}],
                        "parts": [{"filename": "sbi.csv", "mimeType": "text/csv", "body": {"attachmentId": "a1", "size": len(sbi_csv)}}],
                    }
                }
            return {
                "payload": {
                    "headers": [{"name": "From", "value": "alerts@hdfcbank.net"}, {"name": "Subject", "value": "HDFC Statement"}],
                    "parts": [{"filename": "hdfc.csv", "mimeType": "text/csv", "body": {"attachmentId": "a2", "size": len(hdfc_csv)}}],
                }
            }

        with patch.object(ingestor, "fetch_message_detail", side_effect=_detail):
            with patch.object(ingestor, "download_attachment", side_effect=[sbi_csv, hdfc_csv]):
                res = ingestor.sync_statements()
                assert res["success"] is True
                assert res["transfers_matched"] == 1
                assert res["statements"][0]["transactions"][0]["is_transfer"] is True
                assert res["statements"][1]["transactions"][0]["is_transfer"] is True
