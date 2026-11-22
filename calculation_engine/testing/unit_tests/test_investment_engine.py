"""
Unit Tests: Investment Engine
Tests invested capital, valuation, realized & unrealized P&L, dividends, and allocation.
"""

import pytest
from calculation_engine.modules.investment_engine import InvestmentEngine


@pytest.fixture
def engine():
    return InvestmentEngine()


def test_investment_metrics_and_dividends(engine):
    holdings = [
        {"id": "h-1", "symbol": "INFY", "quantity": "100", "avg_price": "1400.00", "current_price": "1850.00", "asset_class": "equity"},
        {"id": "h-2", "symbol": "HDFC MF", "quantity": "500", "avg_price": "40.00", "current_price": "35.00", "asset_class": "mutual_fund"},
    ]

    transactions = [
        # Dividend received
        {"type": "DIVIDEND", "amount": "2500.00"},
        # Past realized trade (sold with 5000 profit)
        {"type": "SELL", "pnl": "5000.00", "amount": "30000.00"},
    ]

    res = engine.calculate({"holdings": holdings, "transactions": transactions})

    # Holding 1: invested 140,000, current 185,000 (gain 45,000)
    # Holding 2: invested 20,000, current 17,500 (loss 2,500)
    # Total invested = 160,000.00
    # Total current value = 202,500.00
    # Unrealized PnL = 42,500.00
    assert res["total_invested"] == "160000.00"
    assert res["total_current_value"] == "202500.00"
    assert res["total_unrealized_pnl"] == "42500.00"
    assert res["total_realized_pnl"] == "5000.00"
    assert res["total_dividends_interest"] == "2500.00"

    # Total return = 42500 + 5000 + 2500 = 50,000.00
    assert res["total_absolute_return"] == "50000.00"
    # Unrealized return %: (42500 / 160000) * 100 = 26.56%
    assert res["total_return_percent"] == 26.56
    assert res["is_profit"] is True
