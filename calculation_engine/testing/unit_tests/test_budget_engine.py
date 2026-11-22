"""
Unit Tests: Budget Engine
Tests category tracking, overspending detection, thresholds, and rollover calculations.
"""

import pytest
from calculation_engine.modules.budget_engine import BudgetEngine


@pytest.fixture
def engine():
    return BudgetEngine()


def test_budget_utilization_and_overspending(engine):
    budgets = [
        {"category": "Food & Dining", "amount": "10000.00", "alert_threshold": 80},
        {"category": "Shopping", "amount": "5000.00", "alert_threshold": 75},
        {"category": "Fuel", "amount": "4000.00", "alert_threshold": 80},
    ]

    expenses = [
        # Food: 8500 spent (85% utilization -> warning, not over)
        {"category": "Food & Dining", "amount": "8500.00", "expense_date": "2026-11-05"},
        # Shopping: 6500 spent (over budget by 1500)
        {"category": "Shopping", "amount": "6500.00", "expense_date": "2026-11-08"},
        # Fuel: 2000 spent (50% utilization -> on track)
        {"category": "Fuel", "amount": "2000.00", "expense_date": "2026-11-12"},
        # Unbudgeted Entertainment: 1500 spent
        {"category": "Entertainment", "amount": "1500.00", "expense_date": "2026-11-15"},
    ]

    res = engine.calculate({
        "budgets": budgets,
        "expenses": expenses,
        "rollover_enabled": True,
    })

    # Total budgeted: 10000 + 5000 + 4000 = 19000.00
    assert res["total_budgeted"] == "19000.00"
    # Budgeted spent: 8500 + 6500 + 2000 = 17000.00
    assert res["total_spent_budgeted"] == "17000.00"
    # Unbudgeted spent: 1500.00
    assert res["unbudgeted_spent"] == "1500.00"
    # Total actual: 18500.00
    assert res["total_actual_spent"] == "18500.00"

    # Category counts
    assert res["overspent_categories_count"] == 1  # Shopping
    assert res["warning_categories_count"] == 1    # Food
    assert res["on_track_categories_count"] == 1   # Fuel

    # Overspent amount: Shopping was over by 1500
    assert res["total_overspent_amount"] == "1500.00"

    # Rollover surplus: Fuel has 2000 remaining; Food has 1500 remaining -> 3500.00
    assert res["rollover_surplus_available"] == "3500.00"
