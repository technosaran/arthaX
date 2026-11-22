"""
Unit Tests: Expense Engine
Tests category aggregation, refunds, deduplication, transfer exclusions, and averages.
"""

import pytest
from calculation_engine.modules.expense_engine import ExpenseEngine
from calculation_engine.testing.test_fixtures.fixtures import (
    NORMAL_EXPENSES,
    REFUND_EXPENSES,
    DUPLICATE_EXPENSES,
    INTERNAL_TRANSFER_EXPENSES,
    LARGE_AMOUNT_TRANSACTIONS,
    LEAP_YEAR_EXPENSES,
)


@pytest.fixture
def engine():
    return ExpenseEngine()


def test_normal_expense_aggregation(engine):
    res = engine.calculate({"transactions": NORMAL_EXPENSES})
    # 3450.50 + 1800.00 + 1250.75 + 2000.00 = 8501.25
    assert res["total_gross_expense"] == "8501.25"
    assert res["total_net_expense"] == "8501.25"
    assert res["total_refunds"] == "0.00"
    assert len(res["category_breakdown"]) == 4


def test_refunds_and_reversals(engine):
    res = engine.calculate({"transactions": REFUND_EXPENSES})
    # 5000 + 250 = 5250 gross, 5000 refund -> net = 250.00
    assert res["total_gross_expense"] == "5250.00"
    assert res["total_refunds"] == "5000.00"
    assert res["total_net_expense"] == "250.00"


def test_duplicate_prevention(engine):
    res = engine.calculate({"transactions": DUPLICATE_EXPENSES})
    # dup-1 appears twice with same ID. Should only count once.
    # 1500 + 350 = 1850.00
    assert res["duplicate_transactions_prevented"] == 1
    assert res["total_net_expense"] == "1850.00"


def test_internal_transfers_excluded(engine):
    res = engine.calculate({"transactions": INTERNAL_TRANSFER_EXPENSES})
    # 10,000 transfer_out and 5,000 family_support must be excluded
    # Only 1200.00 is a valid expense
    assert res["internal_transfers_excluded"] == 2
    assert res["transfers_excluded_amount"] == "15000.00"
    assert res["total_net_expense"] == "1200.00"


def test_large_amounts(engine):
    res = engine.calculate({"transactions": [LARGE_AMOUNT_TRANSACTIONS[0]]})
    assert res["total_net_expense"] == "25000000.00"


def test_leap_year_expenses(engine):
    res = engine.calculate({"transactions": LEAP_YEAR_EXPENSES, "target_month": "2024-02"})
    assert res["target_month_expenses"] == "25000.00"
    assert res["total_net_expense"] == "28000.00"


def test_empty_transactions(engine):
    res = engine.calculate({"transactions": []})
    assert res["total_net_expense"] == "0.00"
    assert res["category_breakdown"] == []
