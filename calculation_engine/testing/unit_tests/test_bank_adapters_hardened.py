"""
Financial Calculation Engine - Bank Adapters Hardening Unit Tests
Verifies that bank adapters (SBI, Indian Bank, Generic CSV) strictly reject NaN, Infinity,
and malformed amount formats, record parsing errors, and never silently convert corrupted
amounts into 0.00.
"""

from decimal import Decimal
import pytest

from calculation_engine.bank_ingestion.sbi_adapter import (
    parse_amount,
    InvalidAmountError,
    SbiBankAdapter,
)
from calculation_engine.bank_ingestion.indian_bank_adapter import IndianBankAdapter


def test_parse_amount_valid_values():
    assert parse_amount("100.50") == Decimal("100.50")
    assert parse_amount("₹1,25,000.75") == Decimal("125000.75")
    assert parse_amount("500.00 Cr") == Decimal("500.00")
    assert parse_amount("250.25 Dr") == Decimal("250.25")
    assert parse_amount(1500) == Decimal("1500.00")
    assert parse_amount(Decimal("99.99")) == Decimal("99.99")


def test_parse_amount_valid_placeholders():
    # Legitimate empty / placeholder cells return 0.00
    assert parse_amount(None) == Decimal("0.00")
    assert parse_amount("") == Decimal("0.00")
    assert parse_amount("-") == Decimal("0.00")
    assert parse_amount("--") == Decimal("0.00")
    assert parse_amount("NA") == Decimal("0.00")
    assert parse_amount("Nil") == Decimal("0.00")


def test_parse_amount_rejects_nan_and_infinity():
    with pytest.raises(InvalidAmountError):
        parse_amount("NaN")

    with pytest.raises(InvalidAmountError):
        parse_amount(float("nan"))

    with pytest.raises(InvalidAmountError):
        parse_amount("Infinity")

    with pytest.raises(InvalidAmountError):
        parse_amount("-Infinity")


def test_parse_amount_rejects_corrupted_strings():
    with pytest.raises(InvalidAmountError) as exc:
        parse_amount("CORRUPTED_AMOUNT_123XYZ")
    assert "Invalid monetary amount format" in str(exc.value)

    with pytest.raises(InvalidAmountError):
        parse_amount("12.34.56.78")


def test_sbi_csv_detects_malformed_amount_in_row():
    adapter = SbiBankAdapter()
    # CSV where Row 1 has valid amount, but Row 2 has a corrupted debit amount
    corrupt_csv = (
        "Txn Date,Value Date,Description,Ref No./Cheque No.,Branch Code,Debit,Credit,Balance\n"
        "01/11/2026,01/11/2026,Valid Salary Credit,,0001,,50000.00,50000.00\n"
        "05/11/2026,05/11/2026,Corrupted ATM Wdl,,0001,CORRUPTED_AMOUNT,,45000.00\n"
        "10/11/2026,10/11/2026,Valid Grocery Debit,,0001,1500.00,,43500.00\n"
    ).encode("utf-8")

    result = adapter.parse(corrupt_csv, "sbi_statement.csv")
    assert result.success is False  # Marked invalid due to corrupted row
    assert result.validation.is_valid is False
    assert any("Row 2" in err and "CORRUPTED_AMOUNT" in err for err in result.validation.errors)
    # The valid transactions were still extracted safely
    assert len(result.transactions) == 2


def test_indian_bank_csv_detects_malformed_amount():
    adapter = IndianBankAdapter()
    corrupt_csv = (
        "Date,Particulars,Cheque No,Withdrawals(Dr),Deposits(Cr),Balance\n"
        "01/11/2026,Opening Deposit,, ,20000.00,20000.00\n"
        "03/11/2026,Corrupted Transfer,,,MALFORMED_VAL,20000.00\n"
    ).encode("utf-8")

    result = adapter.parse(corrupt_csv, "indian_bank_statement.csv")
    assert result.success is False
    assert result.validation.is_valid is False
    assert any("Row 2" in err and "MALFORMED_VAL" in err for err in result.validation.errors)
