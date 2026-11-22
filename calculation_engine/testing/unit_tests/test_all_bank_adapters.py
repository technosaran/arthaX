"""
Unit Tests for All Indian Bank Adapters & Universal PDF Ingestion
Tests HDFC, ICICI, Axis, Kotak, Generic PDF, and parser registry integration.
"""

import pytest
import base64
from decimal import Decimal
from datetime import date
import pymupdf

from calculation_engine.bank_ingestion import (
    parser_registry,
    HdfcBankAdapter,
    IciciBankAdapter,
    AxisBankAdapter,
    KotakBankAdapter,
)
from calculation_engine.bank_ingestion.sbi_adapter import (
    parse_amount,
    parse_date,
    InvalidAmountError,
)
from calculation_engine.bank_ingestion.gmail_service import GmailStatementIngestor


def create_mock_pdf_statement(text: str, password: str = None) -> bytes:
    """Helper to generate an in-memory PDF statement, optionally encrypted."""
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_text((50, 50), text)
    if password:
        b = doc.tobytes(
            encryption=pymupdf.PDF_ENCRYPT_AES_256,
            owner_pw=password,
            user_pw=password,
            permissions=pymupdf.PDF_PERM_ACCESSIBILITY | pymupdf.PDF_PERM_PRINT,
        )
    else:
        b = doc.tobytes()
    doc.close()
    return b


def test_hdfc_csv_parsing():
    adapter = HdfcBankAdapter()
    csv_content = (
        "HDFC BANK LTD - ACCOUNT STATEMENT\n"
        "Account Number: 50100412345678\n"
        "IFSC Code: HDFC0000001\n"
        "Opening Balance: 10000.00\n"
        "\n"
        "Date,Narration,Chq/Ref No,Value Dt,Withdrawal Amt,Deposit Amt,Closing Balance\n"
        "10/11/2026,UPI-SWIGGY-123456,REF1001,10/11/2026,450.00,,9550.00\n"
        "12/11/2026,SALARY CREDIT NOV,REF1002,12/11/2026,,75000.00,84550.00\n"
        "15/11/2026,ATM WITHDRAWAL,REF1003,15/11/2026,5000.00,,79550.00\n"
    ).encode("utf-8")

    assert adapter.can_parse(csv_content, "hdfc_statement.csv")
    result = adapter.parse(csv_content, "hdfc_statement.csv")

    assert result.success is True
    assert result.bank_name == "HDFC"
    assert len(result.transactions) == 3
    assert result.metadata.opening_balance == Decimal("10000.00")
    assert result.metadata.closing_balance == Decimal("79550.00")
    assert result.validation.is_valid is True
    assert result.transactions[0].direction == "DEBIT"
    assert result.transactions[0].amount == Decimal("450.00")
    assert result.transactions[1].direction == "CREDIT"
    assert result.transactions[1].amount == Decimal("75000.00")


def test_icici_csv_parsing():
    adapter = IciciBankAdapter()
    csv_content = (
        "ICICI Bank Statement\n"
        "Account Number: 001105123456\n"
        "IFSC: ICIC0000011\n"
        "Opening Balance: 5000.00\n"
        "\n"
        "Transaction Date,Value Date,Cheque Number,Transaction Remarks,Withdrawal Amount (INR ),Deposit Amount (INR ),Balance (INR )\n"
        "01/11/2026,01/11/2026,CHQ001,UPI/ZOMATO/ORDER,250.00,,4750.00\n"
        "05/11/2026,05/11/2026,CHQ002,NEFT CLIENT PAYMENT,,15000.00,19750.00\n"
    ).encode("utf-8")

    assert adapter.can_parse(csv_content, "icici_nov.csv")
    result = adapter.parse(csv_content, "icici_nov.csv")

    assert result.success is True
    assert result.bank_name == "ICICI"
    assert len(result.transactions) == 2
    assert result.validation.is_valid is True
    assert result.transactions[0].direction == "DEBIT"
    assert result.transactions[0].amount == Decimal("250.00")
    assert result.transactions[1].direction == "CREDIT"
    assert result.transactions[1].amount == Decimal("15000.00")


def test_axis_csv_parsing():
    adapter = AxisBankAdapter()
    csv_content = (
        "AXIS BANK STATEMENT OF ACCOUNT\n"
        "Account No: 918010012345678\n"
        "Opening Balance: 20000.00\n"
        "\n"
        "Tran Date,Value Date,Transaction Particulars,Chq No,Amount,DR/CR,Balance\n"
        "02/11/2026,02/11/2026,UPI/AMAZON/ORDER,REF9901,1200.00,DR,18800.00\n"
        "08/11/2026,08/11/2026,DIVIDEND TATA MOTORS,REF9902,3000.00,CR,21800.00\n"
    ).encode("utf-8")

    assert adapter.can_parse(csv_content, "axis_stmt.csv")
    result = adapter.parse(csv_content, "axis_stmt.csv")

    assert result.success is True
    assert result.bank_name == "AXIS"
    assert len(result.transactions) == 2
    assert result.validation.is_valid is True
    assert result.transactions[0].direction == "DEBIT"
    assert result.transactions[0].amount == Decimal("1200.00")
    assert result.transactions[1].direction == "CREDIT"
    assert result.transactions[1].amount == Decimal("3000.00")


def test_kotak_csv_parsing():
    adapter = KotakBankAdapter()
    csv_content = (
        "KOTAK MAHINDRA BANK ACCOUNT STATEMENT\n"
        "CRN: 123456789\n"
        "Opening Balance: 15000.00\n"
        "\n"
        "Date,Description,Chq / Ref No,Amount,Dr / Cr,Balance\n"
        "04/11/2026,UPI-UBER-RIDE,REF8811,350.00,DR,14650.00\n"
        "09/11/2026,INTEREST CREDIT,REF8812,500.00,CR,15150.00\n"
    ).encode("utf-8")

    assert adapter.can_parse(csv_content, "kotak_nov.csv")
    result = adapter.parse(csv_content, "kotak_nov.csv")

    assert result.success is True
    assert result.bank_name == "KOTAK"
    assert len(result.transactions) == 2
    assert result.validation.is_valid is True
    assert result.transactions[0].direction == "DEBIT"
    assert result.transactions[0].amount == Decimal("350.00")
    assert result.transactions[1].direction == "CREDIT"
    assert result.transactions[1].amount == Decimal("500.00")


def test_parser_registry_integration():
    """Verify registry routes statements to the correct specialized adapter."""
    hdfc_csv = (
        "HDFC BANK LTD\n"
        "Date,Narration,Chq/Ref No,Value Dt,Withdrawal Amt,Deposit Amt,Closing Balance\n"
        "01/11/2026,UPI-PAY,REF1,01/11/2026,100.00,,900.00\n"
    ).encode("utf-8")

    res = parser_registry.parse_statement(hdfc_csv, "hdfc_nov.csv")
    assert res.success is True
    assert res.bank_name == "HDFC"
    assert len(res.transactions) == 1

    kotak_csv = (
        "KOTAK MAHINDRA BANK\n"
        "Date,Description,Chq / Ref No,Amount,Dr / Cr,Balance\n"
        "01/11/2026,FEE,REF1,50.00,DR,950.00\n"
    ).encode("utf-8")

    res_kotak = parser_registry.parse_statement(kotak_csv, "kotak_nov.csv")
    assert res_kotak.success is True
    assert res_kotak.bank_name == "KOTAK"
    assert len(res_kotak.transactions) == 1


def test_hdfc_pdf_parsing():
    adapter = HdfcBankAdapter()
    text = (
        "HDFC BANK STATEMENT\n"
        "Account Number: 50100412345678\n"
        "HDFC0000001\n"
        "Opening Balance: 10000.00\n"
        "Closing Balance: 84550.00\n"
        "\n"
        "10/11/2026 UPI SWIGGY ORDER 450.00 9550.00\n"
        "12/11/2026 SALARY CREDIT 75000.00 84550.00\n"
    )
    pdf_bytes = create_mock_pdf_statement(text)

    assert adapter.can_parse(pdf_bytes, "hdfc_statement.pdf")
    result = adapter.parse(pdf_bytes, "hdfc_statement.pdf")

    assert result.success is True
    assert result.bank_name == "HDFC"
    assert len(result.transactions) == 2
    assert result.validation.is_valid is True
    assert result.transactions[0].direction == "DEBIT"
    assert result.transactions[0].amount == Decimal("450.00")
    assert result.transactions[1].direction == "CREDIT"
    assert result.transactions[1].amount == Decimal("75000.00")

    # Encrypted PDF test
    enc_bytes = create_mock_pdf_statement(text, password="SecretHDFC@123")
    res_enc = adapter.parse(enc_bytes, "hdfc_stmt.pdf", passwords=["SecretHDFC@123"])
    assert res_enc.success is True
    assert len(res_enc.transactions) == 2


def test_icici_pdf_parsing():
    adapter = IciciBankAdapter()
    text = (
        "ICICI BANK STATEMENT\n"
        "Account Number: 001105123456\n"
        "ICIC0000011\n"
        "Opening Balance: 5000.00\n"
        "Closing Balance: 19750.00\n"
        "\n"
        "01/11/2026 UPI ZOMATO ORDER 250.00 4750.00 DR\n"
        "05/11/2026 NEFT CLIENT PAYMENT 15000.00 19750.00 CR\n"
    )
    pdf_bytes = create_mock_pdf_statement(text)

    assert adapter.can_parse(pdf_bytes, "icici_statement.pdf")
    result = adapter.parse(pdf_bytes, "icici_statement.pdf")

    assert result.success is True
    assert result.bank_name == "ICICI"
    assert len(result.transactions) == 2
    assert result.validation.is_valid is True

    # Encrypted PDF test
    enc_bytes = create_mock_pdf_statement(text, password="SecretICICI@123")
    res_enc = adapter.parse(enc_bytes, "icici_stmt.pdf", passwords=["SecretICICI@123"])
    assert res_enc.success is True
    assert len(res_enc.transactions) == 2


def test_axis_pdf_parsing():
    adapter = AxisBankAdapter()
    text = (
        "AXIS BANK STATEMENT\n"
        "Account Number: 918010012345678\n"
        "UTIB0000001\n"
        "Opening Balance: 20000.00\n"
        "Closing Balance: 21800.00\n"
        "\n"
        "02/11/2026 UPI AMAZON ORDER 1200.00 18800.00 DR\n"
        "08/11/2026 DIVIDEND TATA MOTORS 3000.00 21800.00 CR\n"
    )
    pdf_bytes = create_mock_pdf_statement(text)

    assert adapter.can_parse(pdf_bytes, "axis_statement.pdf")
    result = adapter.parse(pdf_bytes, "axis_statement.pdf")

    assert result.success is True
    assert result.bank_name == "AXIS"
    assert len(result.transactions) == 2
    assert result.validation.is_valid is True

    # Encrypted PDF test
    enc_bytes = create_mock_pdf_statement(text, password="SecretAXIS@123")
    res_enc = adapter.parse(enc_bytes, "axis_stmt.pdf", passwords=["SecretAXIS@123"])
    assert res_enc.success is True
    assert len(res_enc.transactions) == 2


def test_kotak_pdf_parsing():
    adapter = KotakBankAdapter()
    text = (
        "KOTAK MAHINDRA BANK STATEMENT\n"
        "CRN: 123456789\n"
        "KKBK0000001\n"
        "Opening Balance: 15000.00\n"
        "Closing Balance: 15150.00\n"
        "\n"
        "04/11/2026 UPI UBER RIDE 350.00 14650.00 DR\n"
        "09/11/2026 INTEREST CREDIT 500.00 15150.00 CR\n"
    )
    pdf_bytes = create_mock_pdf_statement(text)

    assert adapter.can_parse(pdf_bytes, "kotak_statement.pdf")
    result = adapter.parse(pdf_bytes, "kotak_statement.pdf")

    assert result.success is True
    assert result.bank_name == "KOTAK"
    assert len(result.transactions) == 2
    assert result.validation.is_valid is True

    # Encrypted PDF test
    enc_bytes = create_mock_pdf_statement(text, password="SecretKotak@123")
    res_enc = adapter.parse(enc_bytes, "kotak_stmt.pdf", passwords=["SecretKotak@123"])
    assert res_enc.success is True
    assert len(res_enc.transactions) == 2


def test_enhanced_amount_parsing():
    # Currency prefixes and symbols
    assert parse_amount("Rs. 1,250.00") == Decimal("1250.00")
    assert parse_amount("Rs.1,250.00") == Decimal("1250.00")
    assert parse_amount("Rs 1,250.00") == Decimal("1250.00")
    assert parse_amount("Rs1,250.00") == Decimal("1250.00")
    assert parse_amount("INR 1,250.00") == Decimal("1250.00")
    assert parse_amount("INR1,250.00") == Decimal("1250.00")
    assert parse_amount("₹ 1,250.00") == Decimal("1250.00")
    assert parse_amount("₹1,250.00") == Decimal("1250.00")

    # Accounting negative in parentheses
    assert parse_amount("(1,250.00)") == Decimal("1250.00")
    assert parse_amount("( 1,250.00 )") == Decimal("1250.00")
    assert parse_amount("(Rs. 1,250.00)") == Decimal("1250.00")
    assert parse_amount("Rs. (1,250.00)") == Decimal("1250.00")

    # Trailing indicators with/without spaces and parens
    assert parse_amount("1,250.00(Dr)") == Decimal("1250.00")
    assert parse_amount("1,250.00 (Dr)") == Decimal("1250.00")
    assert parse_amount("1,250.00(dr)") == Decimal("1250.00")
    assert parse_amount("1,250.00 Dr") == Decimal("1250.00")
    assert parse_amount("1,250.00Dr") == Decimal("1250.00")
    assert parse_amount("1,250.00(Cr)") == Decimal("1250.00")
    assert parse_amount("1,250.00 (Cr)") == Decimal("1250.00")
    assert parse_amount("1,250.00(cr)") == Decimal("1250.00")
    assert parse_amount("1,250.00 Cr") == Decimal("1250.00")
    assert parse_amount("1,250.00Cr") == Decimal("1250.00")

    # Combined accounting parens and indicators
    assert parse_amount("(1,250.00 Dr)") == Decimal("1250.00")
    assert parse_amount("(1,250.00 (Dr))") == Decimal("1250.00")
    assert parse_amount("(1,250.00 Cr)") == Decimal("1250.00")

    # Placeholders
    assert parse_amount(None) == Decimal("0.00")
    assert parse_amount("") == Decimal("0.00")
    assert parse_amount("-") == Decimal("0.00")
    assert parse_amount("--") == Decimal("0.00")
    assert parse_amount("NA") == Decimal("0.00")
    assert parse_amount("Nil") == Decimal("0.00")

    # Rejection of invalid strings
    with pytest.raises(InvalidAmountError):
        parse_amount("NaN")
    with pytest.raises(InvalidAmountError):
        parse_amount("Infinity")
    with pytest.raises(InvalidAmountError):
        parse_amount("-Infinity")
    with pytest.raises(InvalidAmountError):
        parse_amount("12.34.56.78")
    with pytest.raises(InvalidAmountError):
        parse_amount("CORRUPTED_AMOUNT_123XYZ")


def test_enhanced_date_parsing():
    # Dot separators
    assert parse_date("14.11.2026") == date(2026, 11, 14)
    assert parse_date("14.Nov.2026") == date(2026, 11, 14)
    assert parse_date("14.nov.2026") == date(2026, 11, 14)
    assert parse_date("14.11.26") == date(2026, 11, 14)

    # Dates with timestamps
    assert parse_date("14/11/2026 12:34:56") == date(2026, 11, 14)
    assert parse_date("14-11-2026 12:34:56") == date(2026, 11, 14)
    assert parse_date("14.11.2026 12:34:56") == date(2026, 11, 14)
    assert parse_date("14 November 2026 12:34:56") == date(2026, 11, 14)

    # Full month names
    assert parse_date("14 November 2026") == date(2026, 11, 14)
    assert parse_date("14-November-2026") == date(2026, 11, 14)
    assert parse_date("14 NOVEMBER 2026") == date(2026, 11, 14)
    assert parse_date("November 14, 2026") == date(2026, 11, 14)

    # Standard formats
    assert parse_date("14/11/2026") == date(2026, 11, 14)
    assert parse_date("14-11-2026") == date(2026, 11, 14)
    assert parse_date("14-Nov-2026") == date(2026, 11, 14)
    assert parse_date("2026-11-14") == date(2026, 11, 14)


def test_parser_registry_preserves_best_candidate_on_math_discrepancy():
    """Verify registry preserves extracted transactions and validation errors when math discrepancy is found."""
    hdfc_csv_bad_math = (
        "HDFC BANK LTD - ACCOUNT STATEMENT\n"
        "Account Number: 50100412345678\n"
        "IFSC Code: HDFC0000001\n"
        "Opening Balance: 10000.00\n"
        "\n"
        "Date,Narration,Chq/Ref No,Value Dt,Withdrawal Amt,Deposit Amt,Closing Balance\n"
        "10/11/2026,UPI-SWIGGY-123456,REF1001,10/11/2026,450.00,,9550.00\n"
        "12/11/2026,SALARY CREDIT NOV,REF1002,12/11/2026,,75000.00,99999.00\n"
    ).encode("utf-8")

    res = parser_registry.parse_statement(hdfc_csv_bad_math, "hdfc_discrepancy.csv")
    assert res.success is False
    assert res.bank_name == "HDFC"
    assert len(res.transactions) == 2
    assert res.validation is not None
    assert res.validation.is_valid is False
    assert res.validation.discrepancy_amount != Decimal("0.00")
    assert len(res.errors) > 0
    assert any("discrepancy" in e.lower() for e in res.errors)


def test_gmail_extract_inline_attachments():
    """Verify GmailStatementIngestor captures inline base64 attachments without attachmentId."""
    ingestor = GmailStatementIngestor()
    csv_bytes = b"Date,Description,Debit,Credit,Balance\n01/11/2026,Deposit,,1000.00,1000.00\n"
    encoded_b64 = base64.urlsafe_b64encode(csv_bytes).decode("utf-8")

    payload = {
        "payload": {
            "parts": [
                {
                    "filename": "statement_inline.csv",
                    "mimeType": "text/csv",
                    "body": {
                        "data": encoded_b64,
                        "size": len(csv_bytes),
                    },
                }
            ]
        }
    }

    attachments = ingestor.extract_attachment_parts(payload)
    assert len(attachments) == 1
    assert attachments[0]["filename"] == "statement_inline.csv"
    assert attachments[0]["data"] == csv_bytes
    assert "attachmentId" not in attachments[0]
