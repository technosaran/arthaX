from decimal import Decimal
from calculation_engine.modules.fire_engine import FireEngine
from calculation_engine.modules.rebalancing_engine import RebalancingEngine
from calculation_engine.modules.tax_engine import TaxEngine


def test_fire_engine_targets_and_timeline():
    engine = FireEngine()
    inputs = {
        "current_net_worth": 2500000.0,  # 25 Lakhs
        "annual_expenses": 600000.0,     # 50k / month = 6 Lakhs
        "annual_savings": 600000.0,      # 50k / month saved
        "current_age": 30,
        "expected_annual_return_pct": 12.0,
        "expected_inflation_pct": 6.0,
        "safe_withdrawal_rate_pct": 3.5,
    }
    result = engine.calculate(inputs)
    
    assert result["currency"] == "INR"
    assert result["current_net_worth"] == 2500000.0
    assert result["annual_expenses"] == 600000.0
    
    # 600,000 / 0.035 = ~17,142,857.14
    assert result["fire_targets"]["standard_fire"] > 15000000.0
    assert result["fire_targets"]["lean_fire"] < result["fire_targets"]["standard_fire"]
    assert result["fire_targets"]["fat_fire"] > result["fire_targets"]["standard_fire"]
    
    # Timeline
    assert result["timeline"]["years_to_fire"] is not None
    assert result["timeline"]["years_to_fire"] > 0
    assert result["timeline"]["projected_fire_age"] >= 30
    
    # Monte Carlo simulation
    mc = result["monte_carlo_resilience"]
    assert mc["simulated_paths"] == 1000
    assert mc["survival_rate_percent"] >= 0.0


def test_rebalancing_engine_and_health_score():
    engine = RebalancingEngine()
    inputs = {
        "portfolio": {
            "equity": 800000.0,   # 80%
            "debt": 100000.0,     # 10%
            "gold": 50000.0,      # 5%
            "cash": 50000.0,      # 5%
            "crypto": 0.0,
        },
        "target_allocation": {
            "equity": 60.0,
            "debt": 20.0,
            "gold": 10.0,
            "cash": 10.0,
            "crypto": 0.0,
        },
        "liabilities": 100000.0,
        "monthly_expenses": 40000.0,
        "monthly_income": 100000.0,
    }
    result = engine.calculate(inputs)
    
    assert result["total_portfolio_value"] == 1000000.0
    assert 0 <= result["health_score"] <= 100
    assert result["health_tier"] in ["EXCEPTIONAL", "HEALTHY", "MODERATE", "NEEDS_ATTENTION", "CRITICAL"]
    
    # Rebalance orders: Equity is at 80% (target 60%), so it should recommend SELL Equity
    orders = result["rebalance_orders"]
    assert len(orders) > 0
    equity_order = next((o for o in orders if o["asset"] == "equity"), None)
    assert equity_order is not None
    assert equity_order["action"] == "SELL"
    assert equity_order["adjustment_amount"] == 200000.0  # 800k - 600k = 200k


def test_old_vs_new_tax_regime_comparator():
    engine = TaxEngine()
    # Income: 12 Lakhs, 80C: 1.5L, 80D: 25k, NPS: 50k
    res = engine.compare_regimes(
        gross_income=Decimal("1200000.00"),
        deductions_80c=Decimal("150000.00"),
        deductions_80d=Decimal("25000.00"),
        nps_80ccd_1b=Decimal("50000.00"),
        home_loan_interest_24b=Decimal("0.00"),
        hra_exemption=Decimal("0.00"),
    )
    
    assert "recommendedRegime" in res
    assert res["recommendedRegime"] in ["NEW_REGIME", "OLD_REGIME", "EQUAL"]
    assert res["newRegime"]["grossIncome"] == 1200000.0
    assert res["newRegime"]["standardDeduction"] == 75000.0  # Union Budget 2024
    assert res["oldRegime"]["standardDeduction"] == 50000.0
    assert res["savingsAmount"] >= 0.0
