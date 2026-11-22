"""
Unit Tests: Reconciliation Engine
Tests forensic audit of financial data, detecting duplicate transactions,
category mismatches, negative asset balances, and net worth discrepancies.
"""

import pytest
from calculation_engine.modules.reconciliation_engine import ReconciliationEngine


@pytest.fixture
def engine():
    return ReconciliationEngine()


def test_clean_reconciliation_pass(engine):
    payload = {
        "accounts": [
            {"id": "a-1", "name": "Savings", "balance": "50000.00", "classification": "asset"},
        ],
        "expenses": [
            {"id": "e-1", "amount": "1200.00", "category": "Food", "account_id": "a-1"},
            {"id": "e-2", "amount": "800.00", "category": "Transport", "account_id": "a-1"},
        ],
        "income": [
            {"id": "i-1", "amount": "50000.00", "category": "Salary", "account_id": "a-1"},
        ],
        "reported_net_worth": "50000.00",
    }

    res = engine.calculate(payload)
    assert res["reconciliation_status"] == "PASS"
    assert res["discrepancies_count"] == 0
    assert res["warnings_count"] == 0


def test_detects_duplicates_and_net_worth_mismatch(engine):
    payload = {
        "accounts": [
            {"id": "a-1", "name": "Overdraft Checking", "balance": "-1500.00", "classification": "asset"},
            {"id": "a-2", "name": "Credit Card", "balance": "10000.00", "classification": "liability"},
        ],
        "expenses": [
            {"id": "dup-1", "amount": "1000.00", "category": "Food"},
            {"id": "dup-1", "amount": "1000.00", "category": "Food"},
        ],
        "income": [],
        "reported_net_worth": "50000.00",  # Dashboard mistakenly reports 50,000 when actual is negative
    }

    res = engine.calculate(payload)
    assert res["reconciliation_status"] == "FAIL"
    assert res["discrepancies_count"] >= 2
    # Verify warning on negative asset balance
    assert res["warnings_count"] >= 1
    assert any(w["check_name"] == "UNEXPECTED_NEGATIVE_ASSET_BALANCE" for w in res["warnings"])
    assert any(d["check_name"] == "REPORTED_VS_CALCULATED_NET_WORTH_MISMATCH" for d in res["discrepancies"])
