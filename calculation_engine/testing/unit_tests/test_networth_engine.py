"""
Unit Tests: Net Worth Engine
Tests the core Net Worth = Total Assets - Total Liabilities formula,
multi-asset valuations, negative balances, and benchmark verification.
"""

from decimal import Decimal
import pytest
from calculation_engine.modules.networth_engine import NetWorthEngine
from calculation_engine.testing.test_fixtures.fixtures import (
    BENCHMARK_NET_WORTH_INPUT,
    EXPECTED_BENCHMARK_NET_WORTH,
)


@pytest.fixture
def engine():
    return NetWorthEngine()


def test_benchmark_net_worth(engine):
    """
    Benchmark Requirement from Master Prompt:
    Assets = ₹100,000, Liabilities = ₹15,000 -> Expected Net Worth = ₹85,000
    """
    res = engine.calculate(BENCHMARK_NET_WORTH_INPUT)
    assert res["total_assets"] == "100000.00"
    assert res["total_liabilities"] == "15000.00"
    assert res["net_worth"] == "85000.00"
    assert Decimal(res["net_worth"]) == EXPECTED_BENCHMARK_NET_WORTH
    assert res["is_solvent"] is True


def test_comprehensive_multi_asset_net_worth(engine):
    payload = {
        "accounts": [
            {"id": "a-1", "name": "HDFC Savings", "balance": "250000.00", "classification": "asset", "type": "Bank"},
            {"id": "a-2", "name": "Cash in Hand", "balance": "15000.00", "classification": "asset", "type": "Cash"},
            {"id": "a-3", "name": "HDFC Credit Card", "balance": "35000.00", "classification": "liability", "type": "Credit Card"},
        ],
        "stocks": [
            {"symbol": "RELIANCE", "quantity": "50", "current_price": "2950.00"},  # 147,500.00
            {"symbol": "TCS", "quantity": "25", "current_price": "4100.00"},       # 102,500.00
        ],
        "mutual_funds": [
            {"scheme_name": "Parag Parikh Flexi Cap", "units": "1500.25", "current_nav": "82.40"},  # 123,620.60
        ],
        "bonds": [
            {"name": "REC Bond", "quantity": "10", "current_price": "10500.00"},  # 105,000.00
        ],
        "bullion": [
            {"metal": "GOLD", "weight_grams": "20.000", "current_rate_per_gram": "8000.00"},  # 160,000.00
        ],
        "crypto": [
            {"asset": "BTC", "total_quantity": "0.05", "current_price_usd": "95000.00", "total_value_usd": "4750.00"}, # 4750 * 84 = 399,000
        ],
        "usd_inr_rate": "84.00",
    }

    res = engine.calculate(payload)

    # Liquid accounts: 250,000 + 15,000 = 265,000.00
    assert res["total_liquid_accounts"] == "265000.00"
    # Liabilities: 35,000.00
    assert res["total_liabilities"] == "35000.00"

    # Total investments:
    # Stocks: 147500 + 102500 = 250,000
    # MF: 1500.25 * 82.40 = 123,620.60
    # Bonds: 105,000
    # Bullion: 160,000
    # Crypto: 4750 * 84 = 399,000
    # Total investments = 250000 + 123620.60 + 105000 + 160000 + 399000 = 1,037,620.60
    assert res["total_investments"] == "1037620.60"

    # Total assets = 265000 + 1037620.60 = 1,302,620.60
    assert res["total_assets"] == "1302620.60"

    # Net worth = 1302620.60 - 35000 = 1,267,620.60
    assert res["net_worth"] == "1267620.60"
    assert res["is_solvent"] is True


def test_overdraft_negative_bank_balance(engine):
    payload = {
        "accounts": [
            # Overdrawn account
            {"name": "Checking Overdraft", "balance": "-5000.00", "classification": "asset", "type": "Bank"},
            {"name": "Cash", "balance": "10000.00", "classification": "asset", "type": "Cash"},
        ]
    }
    res = engine.calculate(payload)
    # Total assets: 10000 - 5000 = 5000.00
    assert res["total_assets"] == "5000.00"
    assert res["net_worth"] == "5000.00"
