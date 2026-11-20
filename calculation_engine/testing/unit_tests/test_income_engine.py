"""
Unit Tests: Income Engine
Tests income source aggregation, transfer_in exclusion, and net cash flow analysis.
"""

from decimal import Decimal
import pytest
from calculation_engine.modules.income_engine import IncomeEngine


@pytest.fixture
def engine():
    return IncomeEngine()


def test_income_aggregation_and_cash_flow(engine):
    income_records = [
        {"id": "i-1", "title": "Tech Salary", "amount": "120000.00", "category": "Salary", "received_date": "2026-11-01"},
        {"id": "i-2", "title": "Stock Dividend", "amount": "4500.00", "category": "Dividend", "received_date": "2026-11-15"},
        {"id": "i-3", "title": "Freelance Design", "amount": "25000.00", "category": "Freelance", "received_date": "2026-11-20"},
        # Internal transfer into account - must be excluded
        {"id": "i-4", "title": "Transfer from Savings", "amount": "10000.00", "transaction_type": "transfer_in"},
    ]

    expense_records = [
        {"id": "e-1", "title": "Rent & Food", "amount": "45000.00", "expense_date": "2026-11-05"},
    ]

    res = engine.calculate({
        "income_records": income_records,
        "expense_records": expense_records,
        "target_month": "2026-11",
    })

    # Total income: 120000 + 4500 + 25000 = 149500.00
    assert res["total_income"] == "149500.00"
    assert res["transfers_excluded"] == 1
    assert len(res["sources_breakdown"]) == 3

    # Cash flow: 149500 - 45000 = 104500.00
    cf = res["cash_flow_analysis"]
    assert cf["net_cash_flow"] == "104500.00"
    assert cf["is_positive_cash_flow"] is True
    # Savings rate: (104500 / 149500) * 100 = 69.90%
    assert cf["savings_rate_percent"] == 69.90


def test_zero_income_with_expenses(engine):
    res = engine.calculate({
        "income_records": [],
        "expense_records": [{"amount": "20000.00"}],
    })
    assert res["total_income"] == "0.00"
    cf = res["cash_flow_analysis"]
    assert cf["net_cash_flow"] == "-20000.00"
    assert cf["is_positive_cash_flow"] is False
    assert cf["savings_rate_percent"] == 0.00
