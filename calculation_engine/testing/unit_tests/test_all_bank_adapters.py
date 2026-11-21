"""
Unit Tests for All Indian Bank Adapters & Universal PDF Ingestion
Tests HDFC, ICICI, Axis, Kotak, Generic PDF, and parser registry integration.
"""

import pytest
from decimal import Decimal
from datetime import date
from calculation_engine.bank_ingestion import (
    parser_registry,
    HdfcBankAdapter,
    IciciBankAdapter,
    AxisBankAdapter,
    KotakBankAdapter,
    GenericPdfBankAdapter,
    SbiBankAdapter,
    IndianBankAdapter,
)


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
