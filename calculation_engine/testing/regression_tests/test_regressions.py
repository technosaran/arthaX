"""
Regression Tests: Financial Calculation Determinism & Precision
Guarantees identical inputs produce identical outputs (bit-for-bit determinism),
tests boundary conditions, and prevents financial regression.
"""

from decimal import Decimal
import pytest
from calculation_engine.modules.expense_engine import ExpenseEngine
from calculation_engine.modules.networth_engine import NetWorthEngine
from calculation_engine.modules.portfolio_engine import calculate_cagr, calculate_xirr
from datetime import date


def test_determinism_invariant():
    """
    Financial Rule: All financial calculations must be deterministic.
    Identical inputs and calculation versions must produce identical results across 50 iterations.
    """
    engine = ExpenseEngine()
    payload = {
        "transactions": [
            {"id": "t1", "amount": "1234.56", "category": "Food"},
            {"id": "t2", "amount": "9876.54", "category": "Bills"},
            {"id": "t3", "amount": "500.00", "category": "Transport"},
        ]
    }

    baseline = engine.calculate(payload)
    for _ in range(50):
        iter_res = engine.calculate(payload)
        assert iter_res == baseline


def test_net_worth_boundary_zero_and_negatives():
    engine = NetWorthEngine()
    # Zero assets and zero liabilities
    res_zero = engine.calculate({"accounts": []})
    assert res_zero["net_worth"] == "0.00"
    assert res_zero["total_assets"] == "0.00"
    assert res_zero["total_liabilities"] == "0.00"

    # Deep negative net worth (insolvent)
    res_debt = engine.calculate({
        "accounts": [
            {"name": "Home Loan", "balance": "5000000.00", "classification": "liability"},
            {"name": "Savings", "balance": "200000.00", "classification": "asset"},
        ]
    })
    # 200,000 - 5,000,000 = -4,800,000.00
    assert res_debt["net_worth"] == "-4800000.00"
    assert res_debt["is_solvent"] is False


def test_xirr_determinism_and_stability():
    cash_flows = [
        (date(2023, 1, 1), Decimal("-500000.00")),
        (date(2023, 7, 1), Decimal("25000.00")),
        (date(2024, 1, 1), Decimal("30000.00")),
        (date(2024, 12, 31), Decimal("620000.00")),
    ]
    r1 = calculate_xirr(cash_flows)
    r2 = calculate_xirr(cash_flows)
    assert r1 is not None
    assert r1 == r2
