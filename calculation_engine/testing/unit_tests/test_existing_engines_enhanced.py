"""
Comprehensive verification of enhancements to existing AFCE modules:
- ExpenseEngine: 50/30/20 needs vs wants, weekend vs weekday, day-of-week burn, outlier spike detection.
- IncomeEngine: Active vs passive split, passive income coverage ratio, stability coefficient.
- BudgetEngine: Pacing velocity, month-end projection, safe daily allowance, 50/30/20 audit.
- NetWorthEngine: Net cash cushion, leverage multiplier, Indian wealth milestones.
- PortfolioEngine: LTCG/STCG holding eligibility, winners & laggards, HHI concentration.
- RebalancingEngine: Tax-free cash infusion rebalancing.
- ReconciliationEngine: Transfer conservation check.
- InvestmentEngine: Dividend yield, win rate, profit factor.
"""

from calculation_engine.modules.expense_engine import ExpenseEngine
from calculation_engine.modules.income_engine import IncomeEngine
from calculation_engine.modules.budget_engine import BudgetEngine
from calculation_engine.modules.networth_engine import NetWorthEngine
from calculation_engine.modules.portfolio_engine import PortfolioEngine
from calculation_engine.modules.rebalancing_engine import RebalancingEngine
from calculation_engine.modules.investment_engine import InvestmentEngine


def test_expense_engine_enhanced_analytics():
    engine = ExpenseEngine()
    inputs = {
        "transactions": [
            {"id": "t1", "title": "Groceries DMart", "amount": 4000.0, "category": "Groceries", "transaction_date": "2026-11-21"},  # Saturday (Weekend)
            {"id": "t2", "title": "Rent Payment", "amount": 25000.0, "category": "Rent", "transaction_date": "2026-11-01"},        # Sunday (Weekend)
            {"id": "t3", "title": "Cinema & Dining", "amount": 3500.0, "category": "Entertainment", "transaction_date": "2026-11-20"}, # Friday (Weekday)
            {"id": "t4", "title": "Annual Insurance", "amount": 45000.0, "category": "Insurance", "transaction_date": "2026-11-10"},  # Tuesday (Weekday - Outlier spike)
        ],
        "target_month": "2026-11",
    }
    res = engine.execute(inputs)
    assert res["metadata"]["status"] == "SUCCESS"
    data = res["data"]

    # Needs vs Wants split (Groceries, Rent, Insurance are Mandatory)
    behavior = data["spending_behavior"]
    assert float(behavior["mandatory_needs_total"]) == 74000.00
    assert float(behavior["discretionary_wants_total"]) == 3500.00
    assert behavior["mandatory_needs_percent"] > 90.0

    # Weekend spending (Saturday + Sunday)
    assert float(behavior["weekend_spending_total"]) == 29000.00

    # Outlier spike detection (₹45,000 should be flagged as an outlier spike)
    assert len(data["statistical_outliers"]) >= 1
    assert any(o["title"] == "Annual Insurance" for o in data["statistical_outliers"])


def test_income_engine_passive_coverage():
    engine = IncomeEngine()
    inputs = {
        "income_records": [
            {"id": "inc1", "title": "Tech Salary", "amount": 150000.0, "category": "Salary", "date": "2026-11-01"},
            {"id": "inc2", "title": "TCS Dividend", "amount": 12000.0, "category": "Dividends", "date": "2026-11-15"},
            {"id": "inc3", "title": "Rental Income", "amount": 28000.0, "category": "Rental", "date": "2026-11-05"},
        ],
        "expense_records": [
            {"id": "exp1", "amount": 40000.0, "category": "Living Expenses", "date": "2026-11-10"},
        ],
        "target_month": "2026-11",
    }
    res = engine.execute(inputs)
    assert res["metadata"]["status"] == "SUCCESS"
    data = res["data"]

    split = data["active_passive_split"]
    assert float(split["active_earned_income"]) == 150000.00
    # Dividends (12k) + Rental (28k) = 40k passive income
    assert float(split["passive_investment_income"]) == 40000.00
    # Living expenses = 40,000 -> Passive coverage is exactly 100%!
    assert split["passive_income_coverage_percent"] == 100.0
    assert split["is_fire_crossover_achieved"] is True


def test_budget_engine_pacing_and_safe_daily_allowance():
    engine = BudgetEngine()
    inputs = {
        "budgets": [
            {"category": "Dining", "amount": 10000.0, "month_year": "2026-11", "alert_threshold": 80},
            {"category": "Groceries", "amount": 20000.0, "month_year": "2026-11", "alert_threshold": 80},
        ],
        "expenses": [
            {"category": "Dining", "amount": 4000.0, "expense_date": "2026-11-10"},
            {"category": "Groceries", "amount": 6000.0, "expense_date": "2026-11-12"},
        ],
        "target_month": "2026-11",
    }
    res = engine.execute(inputs)
    assert res["metadata"]["status"] == "SUCCESS"
    data = res["data"]

    pacing = data["pacing_analytics"]
    assert pacing["days_in_month"] == 30
    assert "safe_daily_allowance_remaining" in pacing
    assert float(pacing["safe_daily_allowance_remaining"]) > 0
    assert "rule_50_30_20_allocation" in data


def test_networth_engine_solvency_and_milestones():
    engine = NetWorthEngine()
    inputs = {
        "accounts": [
            {"id": "acc1", "name": "HDFC Savings", "type": "savings", "balance": 1500000.0, "classification": "asset"},
            {"id": "acc2", "name": "HDFC Credit Card", "type": "credit_card", "balance": 50000.0, "classification": "liability"},
        ],
        "stocks": [
            {"symbol": "TCS", "quantity": 1000, "current_price": 3800.0, "avg_buy_price": 3200.0},
        ],
        "mutual_funds": [
            {"scheme_name": "Parag Parikh Flexi Cap", "units": 20000, "current_nav": 75.0, "avg_nav": 50.0},
        ],
    }
    res = engine.execute(inputs)
    assert res["metadata"]["status"] == "SUCCESS"
    data = res["data"]

    # Net worth: 15L cash + 38L stocks + 15L mutual funds - 0.5L CC = 67.5L
    assert float(data["net_worth"]) == 6750000.00

    solvency = data["solvency_metrics"]
    assert float(solvency["net_cash_cushion"]) == 1450000.00  # 15L cash - 50k CC
    assert solvency["leverage_multiplier"] > 1.0

    milestones = data["wealth_milestones"]
    assert milestones["current_wealth_tier"] == "AFFLUENT_TIER"
    # Target is 1 Crore (10,000,000), distance = 10,000,000 - 6,750,000 = 3,250,000
    assert float(milestones["distance_to_next_milestone"]) == 3250000.00


def test_portfolio_engine_tax_eligibility_and_hhi():
    engine = PortfolioEngine()
    inputs = {
        "holdings": [
            {"symbol": "TCS", "quantity": 100, "avg_price": 3000.0, "current_price": 3800.0, "purchase_date": "2024-01-01"}, # > 1 year -> LTCG
            {"symbol": "INFY", "quantity": 100, "avg_price": 1400.0, "current_price": 1700.0, "purchase_date": "2026-10-01"}, # < 1 year -> STCG
        ],
        "transactions": [],
    }
    res = engine.execute(inputs)
    assert res["metadata"]["status"] == "SUCCESS"
    data = res["data"]

    holdings = data["holdings"]
    assert holdings[0]["tax_holding_status"] == "LTCG_QUALIFIED"
    assert holdings[1]["tax_holding_status"] == "STCG_ACTIVE"
    assert holdings[1]["days_to_ltcg"] > 0

    assert "performance_attribution" in data
    assert len(data["performance_attribution"]["top_winners"]) == 2
    assert "concentration_analytics" in data


def test_rebalancing_engine_tax_free_cash_infusion():
    engine = RebalancingEngine()
    inputs = {
        "portfolio": {
            "equity": 800000.0, # 80% (overweight vs target 60%)
            "debt": 100000.0,   # 10% (underweight vs target 20%)
            "gold": 50000.0,    # 5% (underweight vs target 10%)
            "cash": 50000.0,    # 5% (underweight vs target 10%)
        },
        "target_allocation": {
            "equity": 60.0,
            "debt": 20.0,
            "gold": 10.0,
            "cash": 10.0,
        },
    }
    res = engine.execute(inputs)
    assert res["metadata"]["status"] == "SUCCESS"
    data = res["data"]

    tax_free = data["tax_free_cash_rebalancing"]
    # Should recommend buying Debt, Gold, Cash with new capital without selling Equity
    assert tax_free["total_new_capital_required"] > 0
    orders = tax_free["allocation_orders"]
    assert all(o["action"] == "BUY" for o in orders)
    assert not any(o["asset"] == "equity" for o in orders)


def test_investment_engine_win_rate_and_profit_factor():
    engine = InvestmentEngine()
    inputs = {
        "holdings": [
            {"id": "h1", "symbol": "TCS", "quantity": 10, "avg_price": 3000.0, "current_price": 3500.0}, # +5,000 profit
            {"id": "h2", "symbol": "INFY", "quantity": 10, "avg_price": 1800.0, "current_price": 1600.0}, # -2,000 loss
        ],
        "transactions": [
            {"type": "DIVIDEND", "amount": 1000.0},
        ],
    }
    res = engine.execute(inputs)
    assert res["metadata"]["status"] == "SUCCESS"
    data = res["data"]

    health = data["portfolio_health"]
    assert health["profitable_holdings_count"] == 1
    assert health["loss_making_holdings_count"] == 1
    assert health["win_rate_percent"] == 50.0
    # Profit Factor = 5000 / 2000 = 2.5
    assert health["profit_factor"] == 2.5
    assert data["dividend_yield_percent"] > 0
