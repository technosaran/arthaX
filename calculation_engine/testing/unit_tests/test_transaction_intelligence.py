"""
Financial Calculation Engine - Transaction Intelligence Unit Tests
Tests classification waterfall, UPI parsing, merchant resolution, refunds, and transfer matching.
"""

from decimal import Decimal
from datetime import date

from calculation_engine.intelligence.models import TransactionClassificationInput
from calculation_engine.intelligence.classifier import classifier
from calculation_engine.intelligence.upi_parser import parse_upi_narration
from calculation_engine.intelligence.transfer_matcher import match_internal_transfers


# ---------------------------------------------------------------------------
# 1. UPI Narration Parser Tests
# ---------------------------------------------------------------------------
def test_upi_parser_extracts_vpa_and_rrn():
    raw = "UPI/P2M/631982736122/SWIGGY/swiggy@icici/PAYTOORDER"
    res = parse_upi_narration(raw)
    assert res is not None
    assert res["channel"] == "UPI"
    assert res["mode"] == "P2M"
    assert res["vpa"] == "swiggy@icici"
    assert res["reference_number"] == "631982736122"
    assert res["counterparty_name"] == "SWIGGY"


def test_upi_parser_handles_p2p():
    raw = "UPI/P2P/123456789012/Rahul Sharma/rahul@okhdfcbank/Dinner split"
    res = parse_upi_narration(raw)
    assert res is not None
    assert res["mode"] == "P2P"
    assert res["vpa"] == "rahul@okhdfcbank"
    assert res["counterparty_name"] == "Rahul Sharma"


# ---------------------------------------------------------------------------
# 2. Classifier Waterfall Tests
# ---------------------------------------------------------------------------
def test_salary_classification():
    inp = TransactionClassificationInput(
        amount=Decimal("120000.00"),
        direction="CREDIT",
        original_narration="SALARY CREDIT NOV 2026 CMS/0019283746 ACME CORP",
        transaction_date=date(2026, 11, 1),
    )
    res = classifier.classify(inp)
    assert res.category == "Salary"
    assert res.transaction_type == "SALARY"
    assert res.confidence >= Decimal("0.9500")


def test_refund_classification_never_confused_with_income():
    inp = TransactionClassificationInput(
        amount=Decimal("2499.00"),
        direction="CREDIT",
        original_narration="REFUND AMAZON PAY RETAIL RETURN 12345",
        transaction_date=date(2026, 11, 4),
    )
    res = classifier.classify(inp)
    assert res.transaction_type == "REFUND"
    assert res.is_refund is True
    assert res.merchant_name == "Amazon"
    assert res.category == "Shopping"
    assert res.confidence >= Decimal("0.9500")


def test_merchant_upi_food_dining():
    inp = TransactionClassificationInput(
        amount=Decimal("450.00"),
        direction="DEBIT",
        original_narration="UPI/P2M/6319827361/SWIGGY/swiggy@icici/FOODORDER",
        transaction_date=date(2026, 11, 5),
    )
    res = classifier.classify(inp)
    assert res.merchant_name == "Swiggy"
    assert res.category == "Food & Dining"
    assert res.transaction_type == "FOOD_DINING"
    assert res.channel == "UPI"
    assert res.confidence >= Decimal("0.9000")


def test_atm_cash_withdrawal():
    inp = TransactionClassificationInput(
        amount=Decimal("10000.00"),
        direction="DEBIT",
        original_narration="ATM WDL NFS/ATM/S1NB00123/BANGALORE",
        transaction_date=date(2026, 11, 8),
    )
    res = classifier.classify(inp)
    assert res.category == "Cash & ATM"
    assert res.transaction_type == "ATM_WITHDRAWAL"
    assert res.channel == "ATM"
    assert res.confidence >= Decimal("0.9800")


def test_bank_charges_classification():
    inp = TransactionClassificationInput(
        amount=Decimal("17.70"),
        direction="DEBIT",
        original_narration="CONSOLIDATED SMS CHARGES Q3 2026",
        transaction_date=date(2026, 11, 10),
    )
    res = classifier.classify(inp)
    assert res.category == "Bank Charges"
    assert res.transaction_type == "BANK_CHARGES"
    assert res.confidence >= Decimal("0.9500")


# ---------------------------------------------------------------------------
# 3. Internal Transfer Matcher Tests
# ---------------------------------------------------------------------------
def test_transfer_matcher_detects_twin_legs():
    txs = [
        {
            "id": "tx_deb_1",
            "account_id": "acc_sbi_1",
            "amount": Decimal("25000.00"),
            "direction": "DEBIT",
            "date": date(2026, 11, 1),
            "narration": "TRANSFER TO HDFC INTER_ACCOUNT",
        },
        {
            "id": "tx_cred_1",
            "account_id": "acc_hdfc_2",
            "amount": Decimal("25000.00"),
            "direction": "CREDIT",
            "date": date(2026, 11, 2),  # Next day settlement
            "narration": "TRANSFER FROM SBI SAVINGS",
        },
    ]
    matches = match_internal_transfers(txs)
    assert len(matches) == 1
    m = matches[0]
    assert m.matched is True
    assert m.debit_tx_id == "tx_deb_1"
    assert m.credit_tx_id == "tx_cred_1"
    assert m.amount == Decimal("25000.00")
    assert m.from_account_id == "acc_sbi_1"
    assert m.to_account_id == "acc_hdfc_2"
    assert m.days_difference == 1


def test_transfer_matcher_ignores_same_account():
    # An adjustment on the same account is NOT an inter-account transfer
    txs = [
        {
            "id": "tx_deb_1",
            "account_id": "acc_sbi_1",
            "amount": Decimal("1000.00"),
            "direction": "DEBIT",
            "date": date(2026, 11, 1),
        },
        {
            "id": "tx_cred_1",
            "account_id": "acc_sbi_1",
            "amount": Decimal("1000.00"),
            "direction": "CREDIT",
            "date": date(2026, 11, 1),
        },
    ]
    matches = match_internal_transfers(txs)
    assert len(matches) == 0
