"""
Unit Tests: Portfolio Engine
Tests CAGR, XIRR with dated cash flows, and weighted average price calculations.
"""

from datetime import date
from decimal import Decimal
import pytest
from calculation_engine.modules.portfolio_engine import (
    PortfolioEngine,
    calculate_cagr,
    calculate_xirr,
)


@pytest.fixture
def engine():
    return PortfolioEngine()


def test_calculate_cagr():
    # 100,000 to 200,000 in 3 years
    # (200000 / 100000) ** (1/3) - 1 = 2 ** 0.3333333 - 1 = 0.25992 (25.99%)
    cagr = calculate_cagr(Decimal("100000.00"), Decimal("200000.00"), Decimal("3.0"))
    assert cagr is not None
    assert round(float(cagr) * 100, 2) == 25.99

    # Edge cases
    assert calculate_cagr(Decimal("0"), Decimal("100"), Decimal("1")) is None
    assert calculate_cagr(Decimal("100"), Decimal("0"), Decimal("1")) is None
    assert calculate_cagr(Decimal("100"), Decimal("200"), Decimal("0")) is None


def test_calculate_xirr():
    # Simple case: invest 100,000 on 2024-01-01, receive 110,000 on 2025-01-01 (exactly 366 leap year days or ~1 year)
    flows = [
        (date(2024, 1, 1), Decimal("-100000.00")),
        (date(2025, 1, 1), Decimal("110000.00")),
    ]
    rate = calculate_xirr(flows)
    assert rate is not None
    # Approx 9.97% - 10.0% annualized
    assert 9.9 <= float(rate) * 100 <= 10.1

    # Multi-period SIP flows
    sip_flows = [
        (date(2024, 1, 1), Decimal("-10000.00")),
        (date(2024, 2, 1), Decimal("-10000.00")),
        (date(2024, 3, 1), Decimal("-10000.00")),
        (date(2024, 12, 31), Decimal("35000.00")),  # Current terminal value
    ]
    sip_xirr = calculate_xirr(sip_flows)
    assert sip_xirr is not None
    assert float(sip_xirr) > 0.10  # Healthy positive IRR


def test_portfolio_engine_execution(engine):
    holdings = [
        {"symbol": "TCS", "quantity": "10", "avg_price": "3500.00", "current_price": "4200.00", "purchase_date": "2024-01-01"},
    ]
    transactions = [
        {"type": "BUY", "amount": "35000.00", "transaction_date": "2024-01-01"},
    ]
    res = engine.calculate({
        "holdings": holdings,
        "transactions": transactions,
        "current_valuation": "42000.00",
    })

    assert res["total_invested"] == "35000.00"
    assert res["current_valuation"] == "42000.00"
    assert res["total_pnl"] == "7000.00"
    assert res["absolute_return_percent"] == 20.00
    assert res["xirr_percent"] is not None
