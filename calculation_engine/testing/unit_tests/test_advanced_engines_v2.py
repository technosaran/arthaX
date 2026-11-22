"""
Unit Tests for Advanced Financial Calculation Engines v2:
DebtPayoffEngine and FinancialStressTestEngine.
"""

from decimal import Decimal
from calculation_engine.modules.debt_engine import DebtPayoffEngine
from calculation_engine.modules.stress_test_engine import FinancialStressTestEngine


def test_debt_payoff_avalanche_vs_snowball():
    engine = DebtPayoffEngine()
    debts = [
        {
            "id": "card_1",
            "name": "HDFC Credit Card",
            "principal": 100000.0,
            "interest_rate_apr": 36.0,
            "minimum_payment": 5000.0,
        },
        {
            "id": "loan_1",
            "name": "Personal Loan",
            "principal": 200000.0,
            "interest_rate_apr": 14.0,
            "minimum_payment": 6000.0,
        },
        {
            "id": "card_2",
            "name": "ICICI Card",
            "principal": 30000.0,
            "interest_rate_apr": 42.0,
            "minimum_payment": 2000.0,
        },
    ]

    res = engine.calculate({"debts": debts, "monthly_extra_payment": 5000.0})

    assert res["debts_count"] == 3
    assert Decimal(res["total_debt"]) == Decimal("330000.00")
    assert "strategies" in res
    assert "avalanche" in res["strategies"]
    assert "snowball" in res["strategies"]
    assert "minimum_only" in res["strategies"]

    avalanche = res["strategies"]["avalanche"]
    snowball = res["strategies"]["snowball"]
    min_only = res["strategies"]["minimum_only"]

    # Avalanche must pay less or equal total interest than Snowball
    assert Decimal(avalanche["total_interest_paid"]) <= Decimal(snowball["total_interest_paid"])
    # Both accelerated strategies must finish substantially faster than minimum only
    assert avalanche["months_to_debt_free"] < min_only["months_to_debt_free"]
    assert snowball["months_to_debt_free"] < min_only["months_to_debt_free"]
    assert Decimal(avalanche["interest_saved"]) > Decimal("0.00")
    assert res["recommended_strategy"] in ("AVALANCHE", "SNOWBALL")


def test_debt_payoff_empty():
    engine = DebtPayoffEngine()
    res = engine.calculate({"debts": []})
    assert res["debts_count"] == 0
    assert res["total_debt"] == "0.00"
    assert res["recommended_strategy"] == "NONE"


def test_stress_test_engine_resilience():
    engine = FinancialStressTestEngine()
    inputs = {
        "liquid_cash": 600000.0,            # 6 months mandatory expenses
        "semi_liquid_assets": 2500000.0,    # Investments
        "monthly_income": 150000.0,
        "monthly_mandatory_expenses": 70000.0,
        "monthly_discretionary_expenses": 30000.0,
        "total_debt": 200000.0,
        "emergency_shock_amount": 300000.0,
    }

    res = engine.calculate(inputs)

    assert "resilience_score" in res
    assert 0 <= res["resilience_score"] <= 100
    assert res["resilience_tier"] in ("FORTIFIED", "ROBUST", "VULNERABLE", "CRITICAL")
    assert "baseline" in res
    assert "scenarios" in res

    scenarios = res["scenarios"]
    assert "job_loss_6_months" in scenarios
    assert "market_crash_40_pct" in scenarios
    assert "emergency_medical_shock" in scenarios
    assert "stagflation_3_years" in scenarios
    assert "black_swan_event" in scenarios

    # With 6L cash and 70k mandatory expenses (pruned ~77.5k), job loss runway should be ~7.7 months
    assert scenarios["job_loss_6_months"]["survives_without_selling_assets"] is True
    assert scenarios["job_loss_6_months"]["months_of_cash_runway"] > 6.0


def test_stress_test_engine_critical_liquidity():
    engine = FinancialStressTestEngine()
    inputs = {
        "liquid_cash": 20000.0,             # Very low liquidity
        "semi_liquid_assets": 50000.0,
        "monthly_income": 80000.0,
        "monthly_mandatory_expenses": 60000.0,
        "monthly_discretionary_expenses": 20000.0,
        "total_debt": 500000.0,             # High debt
        "emergency_shock_amount": 200000.0,
    }

    res = engine.calculate(inputs)

    # Score should be low, flagging vulnerability
    assert res["resilience_score"] < 60
    assert res["resilience_tier"] in ("VULNERABLE", "CRITICAL")
    assert res["scenarios"]["job_loss_6_months"]["survives_without_selling_assets"] is False
    assert len(res["recommendations"]) > 0
