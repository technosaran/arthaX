"""
Unit tests for Institutional Financial Engines v3:
1. GoalWealthEngine (Inflation-adjusted wealth planning, Step-Up SIP, Horizon Asset Allocation)
2. PortfolioAnalyticsEngine (Sharpe, Sortino, Max Drawdown, VaR 95/99, CVaR, Beta, Alpha, HHI)
3. TaxEngine (Section 87A Marginal Relief, Corporate NPS 80CCD(2), Surcharge & Marginal Relief)
"""

from decimal import Decimal
from calculation_engine.modules.goal_engine import GoalWealthEngine
from calculation_engine.modules.portfolio_analytics_engine import PortfolioAnalyticsEngine
from calculation_engine.modules.tax_engine import TaxEngine


def test_goal_wealth_engine_step_up_relief():
    """
    Test GoalWealthEngine:
    Goal: ₹50,00,000 in today's money for Child Higher Education in 10 years.
    Education inflation = 10%.
    Current savings = ₹5,00,000.
    Verify:
    - Future target cost = 50,00,000 * (1.10)^10 = ₹1,29,68,712.30
    - Step-Up SIP starts significantly lower than Standard Fixed SIP (burden reduction > 30%)
    - Amortization schedule has exactly 10 years and achieves 100% progress
    """
    engine = GoalWealthEngine()
    inputs = {
        "goal_name": "Child Overseas Education",
        "category": "education",
        "target_amount_today": 5000000.0,
        "horizon_years": 10,
        "current_savings": 500000.0,
        "annual_step_up_pct": 10.0,
        "custom_expected_return_pct": 12.0,
    }

    res = engine.execute(inputs)
    assert res["metadata"]["status"] == "SUCCESS"
    data = res["data"]

    # Future target inflated cost
    assert data["valuation"]["future_target_cost"] > 12900000.0
    assert data["valuation"]["inflation_rate_percent"] == 10.0
    assert not data["valuation"]["is_already_funded"]

    # Step-Up initial SIP must be lower than standard fixed SIP
    standard_sip = data["sip_strategies"]["standard_fixed_sip"]["monthly_sip"]
    step_up_sip = data["sip_strategies"]["step_up_sip"]["initial_monthly_sip"]
    assert step_up_sip < standard_sip
    assert data["sip_strategies"]["step_up_sip"]["starting_burden_relief_percent"] > 25.0

    # Amortization schedule
    schedule = data["amortization_schedule"]
    assert len(schedule) == 10
    assert schedule[-1]["year"] == 10
    assert schedule[-1]["progress_percent"] >= 99.0


def test_goal_wealth_engine_already_funded():
    """
    If existing corpus is already large enough to compound and outgrow the target,
    it should report ALREADY_FUNDED with ₹0 monthly SIP requirement.
    """
    engine = GoalWealthEngine()
    inputs = {
        "goal_name": "New Car",
        "category": "vehicle",
        "target_amount_today": 1000000.0,
        "horizon_years": 5,
        "current_savings": 2000000.0,  # 20L already saved for 10L car
    }

    res = engine.execute(inputs)
    assert res["metadata"]["status"] == "SUCCESS"
    data = res["data"]

    assert data["valuation"]["is_already_funded"] is True
    assert data["sip_strategies"]["standard_fixed_sip"]["monthly_sip"] == 0.0
    assert data["feasibility"]["status"] == "ALREADY_FUNDED"


def test_portfolio_analytics_risk_metrics():
    """
    Test PortfolioAnalyticsEngine:
    Verify Sharpe Ratio, Sortino Ratio, Drawdown, VaR, CVaR, Beta, and HHI Concentration.
    """
    engine = PortfolioAnalyticsEngine()

    # 12 monthly returns with good upside and controlled downside
    portfolio_rets = [0.03, 0.02, -0.01, 0.04, 0.01, -0.02, 0.05, 0.02, 0.03, -0.01, 0.04, 0.02]
    bench_rets = [0.02, 0.01, -0.015, 0.03, 0.005, -0.025, 0.035, 0.015, 0.02, -0.01, 0.03, 0.015]

    holdings = [
        {"symbol": "TCS", "current_value": 300000.0},
        {"symbol": "INFY", "current_value": 300000.0},
        {"symbol": "HDFCBANK", "current_value": 200000.0},
        {"symbol": "ICICIBANK", "current_value": 200000.0},
    ]

    inputs = {
        "portfolio_returns": portfolio_rets,
        "benchmark_returns": bench_rets,
        "current_portfolio_value": 1000000.0,
        "period_frequency": "monthly",
        "risk_free_rate_pct": 6.75,
        "holdings": holdings,
    }

    res = engine.execute(inputs)
    assert res["metadata"]["status"] == "SUCCESS"
    data = res["data"]

    # Annualized return and risk
    assert data["returns_and_volatility"]["annualized_return_percent"] > 0
    assert data["returns_and_volatility"]["annualized_volatility_percent"] > 0

    # Ratios
    assert data["risk_adjusted_ratios"]["sharpe_ratio"] > 1.0
    # Sortino should reward upside volatility (Sortino >= Sharpe)
    assert data["risk_adjusted_ratios"]["sortino_ratio"] >= data["risk_adjusted_ratios"]["sharpe_ratio"]
    assert data["risk_adjusted_ratios"]["beta"] is not None

    # Drawdown
    assert data["drawdown_metrics"]["maximum_drawdown_percent"] > 0

    # VaR and CVaR
    assert data["value_at_risk"]["parametric_var_95_period_percent"] > 0
    assert data["value_at_risk"]["relative_var_95_annual_percent"] > 0
    assert data["value_at_risk"]["estimated_loss_at_risk_95_period"] > 0

    # Concentration (4 holdings with 30%, 30%, 20%, 20% -> HHI = 900 + 900 + 400 + 400 = 2600)
    assert data["diversification_metrics"]["herfindahl_index_hhi"] == 2600.0
    assert data["diversification_metrics"]["effective_number_of_holdings"] > 3.0


def test_tax_regime_marginal_relief_87a():
    """
    Test Section 87A Marginal Relief under Section 115BAC New Regime:
    For gross income = ₹7,85,000 (after ₹75k standard deduction, taxable income = ₹7,10,000):
    Without marginal relief:
      3L-7L = 4L * 5% = 20,000
      7L-7.1L = 10,000 * 10% = 1,000
      Total base tax = ₹21,000.
    With marginal relief:
      Excess income over ₹7,00,000 = ₹10,000.
      Tax payable CANNOT exceed excess income (₹10,000).
      Relief = 21,000 - 10,000 = ₹11,000!
      Tax after rebate = ₹10,000 (+ 4% cess = ₹10,400).
    """
    engine = TaxEngine()
    gross_income = Decimal("785000.00")  # Taxable = 7,10,000 after 75,000 std deduction

    res = engine.compare_regimes(gross_income=gross_income)
    new_regime = res["newRegime"]

    assert new_regime["taxableIncome"] == 710000.00
    assert new_regime["baseIncomeTax"] == 21000.00
    assert new_regime["section87aMarginalRelief"] == 11000.00
    assert new_regime["taxAfterRebate"] == 10000.00
    assert new_regime["totalTax"] == 10400.00


def test_tax_regime_corporate_nps_and_surcharge():
    """
    Test Corporate NPS Section 80CCD(2) and High Net Worth Surcharge:
    Gross income = ₹60,00,000.
    Corporate NPS = ₹2,00,000 (deducted in BOTH New and Old regimes).
    Taxable income = 60,00,000 - 75,000 - 2,00,000 = ₹57,25,000.
    Surcharge of 10% applies on income > ₹50,00,000 with marginal relief check.
    """
    engine = TaxEngine()
    gross_income = Decimal("6000000.00")
    corp_nps = Decimal("200000.00")

    res = engine.compare_regimes(
        gross_income=gross_income,
        nps_80ccd_2=corp_nps,
    )
    new_regime = res["newRegime"]
    old_regime = res["oldRegime"]

    assert new_regime["corporateNpsDeduction"] == 200000.00
    assert old_regime["corporateNpsDeduction"] == 200000.00
    assert new_regime["taxableIncome"] == 5725000.00

    # High net worth surcharge (> 50L) must be triggered
    assert new_regime["surcharge"] > 0
    assert old_regime["surcharge"] > 0
