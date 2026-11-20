"""
Financial Calculation Engine - Bank Ingestion Unit Tests
Tests SBI, Indian Bank, Generic CSV parsers, password generators, and validation formulas.
"""

from decimal import Decimal
from datetime import date
import pytest

from calculation_engine.bank_ingestion.models import (
    StatementMetadata,
    ParsedTransactionItem,
)
from calculation_engine.bank_ingestion.statement_validator import (
    validate_statement_math,
    validate_statement_continuity,
)
from calculation_engine.bank_ingestion.pdf_decryptor import (
    generate_candidate_passwords,
    compute_file_hash,
)
from calculation_engine.bank_ingestion.sbi_adapter import SbiBankAdapter
from calculation_engine.bank_ingestion.indian_bank_adapter import IndianBankAdapter
from calculation_engine.bank_ingestion.generic_csv_adapter import GenericCsvBankAdapter
from calculation_engine.bank_ingestion.parser_registry import parser_registry


# ---------------------------------------------------------------------------
# 1. Statement Mathematical Validation Tests
# ---------------------------------------------------------------------------
def test_statement_math_validation_success():
    meta = StatementMetadata(
        bank_name="SBI",
        statement_period_start=date(2026, 11, 1),
        statement_period_end=date(2026, 11, 30),
        opening_balance=Decimal("10000.00"),
        closing_balance=Decimal("25000.00"),
    )
    txs = [
        ParsedTransactionItem(
            transaction_date=date(2026, 11, 5),
            amount=Decimal("20000.00"),
            direction="CREDIT",
            original_narration="Salary Nov",
            normalized_narration="Salary Nov",
        ),
        ParsedTransactionItem(
            transaction_date=date(2026, 11, 10),
            amount=Decimal("5000.00"),
            direction="DEBIT",
            original_narration="Rent payment",
            normalized_narration="Rent payment",
        ),
    ]
    val = validate_statement_math(meta, txs)
    assert val.is_valid is True
    assert val.calculated_closing_balance == Decimal("25000.00")
    assert val.discrepancy_amount == Decimal("0.00")
    assert len(val.errors) == 0


def test_statement_math_validation_discrepancy_detected():
    meta = StatementMetadata(
        bank_name="SBI",
        statement_period_start=date(2026, 11, 1),
        statement_period_end=date(2026, 11, 30),
        opening_balance=Decimal("10000.00"),
        closing_balance=Decimal("30000.00"),  # Intentionally incorrect
    )
    txs = [
        ParsedTransactionItem(
            transaction_date=date(2026, 11, 5),
            amount=Decimal("20000.00"),
            direction="CREDIT",
            original_narration="Salary Nov",
            normalized_narration="Salary Nov",
        ),
        ParsedTransactionItem(
            transaction_date=date(2026, 11, 10),
            amount=Decimal("5000.00"),
            direction="DEBIT",
            original_narration="Rent payment",
            normalized_narration="Rent payment",
        ),
    ]
    val = validate_statement_math(meta, txs)
    assert val.is_valid is False
    assert val.discrepancy_amount == Decimal("5000.00")
    assert len(val.errors) > 0


def test_statement_continuity_check():
    valid, err = validate_statement_continuity(Decimal("25000.00"), Decimal("25000.00"))
    assert valid is True
    assert err is None

    broken, err2 = validate_statement_continuity(Decimal("25000.00"), Decimal("26000.00"))
    assert broken is False
    assert "continuity break" in err2


# ---------------------------------------------------------------------------
# 2. Password Generation Rule Tests
# ---------------------------------------------------------------------------
def test_candidate_password_generation():
    # SBI: DOB 15/08/1995 -> 1508 + last 5 mobile 98765 -> 150898765
    cands = generate_candidate_passwords(
        dob_ddmmyyyy="15081995",
        mobile_last5="98765",
        pan="ABCDE1234F",
        account_number="12345678901",
    )
    assert "150898765" in cands
    assert "ABCDE1234F" in cands
    assert "12345678901" in cands
    assert "150819958765" in cands


# ---------------------------------------------------------------------------
# 3. SBI CSV Adapter Tests
# ---------------------------------------------------------------------------
def test_sbi_csv_parsing():
    sbi_csv_content = b"""Account Name : Tech Professional
Account Number : 00000012345678901
IFS Code : SBIN0001234
Txn Date,Value Date,Description,Ref No./Cheque No.,Branch Code,Debit,Credit,Balance
01/11/2026,01/11/2026,TRANSFER TO UPI/SWIGGY/swiggy@icici,UPI/998877,0,450.00,,49550.00
05/11/2026,05/11/2026,SALARY CREDIT NOV 2026 CMS/112233,CMS/112233,0,,100000.00,149550.00
10/11/2026,10/11/2026,TRANSFER TO HDFC SAVINGS INTER_ACCOUNT,NEFT/4455,0,25000.00,,124550.00
"""
    adapter = SbiBankAdapter()
    assert adapter.can_parse(sbi_csv_content, "sbi_statement.csv") is True

    result = adapter.parse(sbi_csv_content, "sbi_statement.csv")
    assert result.success is True
    assert len(result.transactions) == 3
    assert result.metadata.bank_name == "SBI"
    assert result.metadata.opening_balance == Decimal("50000.00")
    assert result.metadata.closing_balance == Decimal("124550.00")
    assert result.validation.total_credits == Decimal("100000.00")
    assert result.validation.total_debits == Decimal("25450.00")
    # Verify math: 50000 + 100000 - 25450 = 124550
    assert result.validation.is_valid is True


# ---------------------------------------------------------------------------
# 4. Indian Bank CSV Adapter Tests
# ---------------------------------------------------------------------------
def test_indian_bank_csv_parsing():
    ind_csv_content = b"""INDIAN BANK
Account No : 9876543210
Date,Particulars,Cheque No,Withdrawals(Dr),Deposits(Cr),Balance
02/11/2026,TRANSFER TO UPI/ZOMATO/zomato@axis,UPI/112233,350.00,,19650.00
07/11/2026,INTEREST CREDIT QUARTERLY,,0.00,150.00,19800.00
"""
    adapter = IndianBankAdapter()
    assert adapter.can_parse(ind_csv_content, "indian_bank_nov.csv") is True

    result = adapter.parse(ind_csv_content, "indian_bank_nov.csv")
    assert result.success is True
    assert len(result.transactions) == 2
    assert result.metadata.bank_name == "INDIAN_BANK"
    assert result.metadata.opening_balance == Decimal("20000.00")
    assert result.metadata.closing_balance == Decimal("19800.00")
    assert result.validation.total_credits == Decimal("150.00")
    assert result.validation.total_debits == Decimal("350.00")
    assert result.validation.is_valid is True


# ---------------------------------------------------------------------------
# 5. Generic CSV Adapter & Registry Tests
# ---------------------------------------------------------------------------
def test_generic_csv_adapter_and_registry():
    hdfc_csv_content = b"""Date,Narration,Chq / Ref No,Debit Amount,Credit Amount,Closing Balance
2026-11-01,AMAZON INDIA SHOPPING,REF100,2499.00,,7501.00
2026-11-04,REFUND AMAZON RETURN,REF101,,2499.00,10000.00
"""
    result = parser_registry.parse_statement(hdfc_csv_content, "hdfc_export.csv")
    assert result.success is True
    assert len(result.transactions) == 2
    assert result.metadata.opening_balance == Decimal("10000.00")
    assert result.metadata.closing_balance == Decimal("10000.00")
    assert result.validation.is_valid is True
