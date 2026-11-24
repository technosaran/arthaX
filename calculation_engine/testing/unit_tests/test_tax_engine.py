"""
Unit tests for the Indian Capital Gains Tax & Tax-Loss Harvesting Engine.
Tests Union Budget 2024 / FY 2024-25 statutory rules, FIFO lot matching,
Section 115BBH crypto rules, and harvesting calculations.
"""

from datetime import datetime, timedelta
from decimal import Decimal
from calculation_engine.modules.tax_engine import TaxEngine


def test_fifo_lot_matching():
    """
    Test strict FIFO lot matching:
    Buy 100 shares @ 100 on 2023-01-01
    Buy 50 shares @ 150 on 2023-06-01
    Sell 120 shares @ 200 on 2024-02-01
    Expected:
      Lot 1: 100 shares from 1st buy (Proceeds = 20,000, Cost = 10,000, Gain = 10,000, Holding = 396 days -> LTCG)
      Lot 2: 20 shares from 2nd buy (Proceeds = 4,000, Cost = 3,000, Gain = 1,000, Holding = 245 days -> STCG)
    """
    engine = TaxEngine()
    buy_lots = [
        {"symbol": "TCS", "quantity": 100, "price": 100.0, "buy_date": "2023-01-01"},
        {"symbol": "TCS", "quantity": 50, "price": 150.0, "buy_date": "2023-06-01"},
    ]
    sell_orders = [
        {"symbol": "TCS", "quantity": 120, "price": 200.0, "sell_date": "2024-02-01"},
    ]

    matched_sales = engine.match_lots_fifo(buy_lots, sell_orders)
    assert len(matched_sales) == 2

    # First matched lot (100 shares)
    assert matched_sales[0]["quantity"] == 100.0
    assert matched_sales[0]["buy_amount"] == 10000.00
    assert matched_sales[0]["sell_amount"] == 20000.00
    assert matched_sales[0]["gain"] == 10000.00
    assert matched_sales[0]["holding_days"] == 396

    # Second matched lot (20 shares)
    assert matched_sales[1]["quantity"] == 20.0
    assert matched_sales[1]["buy_amount"] == 3000.00
    assert matched_sales[1]["sell_amount"] == 4000.00
    assert matched_sales[1]["gain"] == 1000.00
    assert matched_sales[1]["holding_days"] == 245


def test_budget_2024_equity_tax_calculation():
    """
    Test Budget 2024 Equity rates:
    STCG rate = 20% (Sec 111A)
    LTCG rate = 12.5% on gains exceeding ₹1,25,000 (Sec 112A)
    """
    engine = TaxEngine()
    inputs = {
        "assessment_year": "2025-2026",
        "tax_slab_rate": 0.30,
        "transactions": [
            # Buy and Sell > 1 year -> LTCG of ₹2,25,000
            {"symbol": "INFY", "type": "BUY", "quantity": 1000, "price": 1000.0, "date": "2023-01-01", "asset_class": "equity"},
            {"symbol": "INFY", "type": "SELL", "quantity": 1000, "price": 1225.0, "date": "2024-05-01", "asset_class": "equity"},
            # Buy and Sell < 1 year -> STCG of ₹50,000
            {"symbol": "RELIANCE", "type": "BUY", "quantity": 100, "price": 2000.0, "date": "2024-01-01", "asset_class": "equity"},
            {"symbol": "RELIANCE", "type": "SELL", "quantity": 100, "price": 2500.0, "date": "2024-04-01", "asset_class": "equity"},
        ],
        "unrealized_holdings": []
    }

    result = engine.execute(inputs)
    assert result["metadata"]["status"] == "SUCCESS"
    data = result["data"]

    realized = data["realized"]
    assert realized["equityLtcgGain"] == 225000.00
    # Taxable LTCG = 2,25,000 - 1,25,000 = 1,00,000
    assert realized["equityLtcgTaxable"] == 100000.00
    # LTCG Tax = 1,00,000 * 12.5% = 12,500
    assert realized["equityLtcgTax"] == 12500.00

    # STCG = 50,000; STCG Tax = 50,000 * 20% = 10,000
    assert realized["equityStcgGain"] == 50000.00
    assert realized["equityStcgTax"] == 10000.00

    assert realized["totalEstimatedTax"] == 22500.00


def test_crypto_sec_115bbh_no_loss_offset():
    """
    Test Section 115BBH for Virtual Digital Assets:
    Flat 30% (+4% cess = 31.2%) on gains.
    Losses CANNOT offset other crypto gains or equity gains.
    """
    engine = TaxEngine()
    inputs = {
        "assessment_year": "2025-2026",
        "tax_slab_rate": 0.30,
        "transactions": [
            # Winning trade: Gain of ₹1,00,000
            {"symbol": "BTCUSDT", "type": "BUY", "quantity": 1, "price": 2000000.0, "date": "2024-01-01", "asset_class": "crypto"},
            {"symbol": "BTCUSDT", "type": "SELL", "quantity": 1, "price": 2100000.0, "date": "2024-02-01", "asset_class": "crypto"},
            # Losing trade: Loss of ₹50,000
            {"symbol": "ETHUSDT", "type": "BUY", "quantity": 1, "price": 250000.0, "date": "2024-01-01", "asset_class": "crypto"},
            {"symbol": "ETHUSDT", "type": "SELL", "quantity": 1, "price": 200000.0, "date": "2024-03-01", "asset_class": "crypto"},
        ],
        "unrealized_holdings": []
    }

    result = engine.execute(inputs)
    assert result["metadata"]["status"] == "SUCCESS"
    data = result["data"]

    realized = data["realized"]
    assert realized["cryptoGain"] == 100000.00
    assert realized["cryptoLosses"] == 50000.00
    # Under Sec 115BBH, tax is 31.2% on gross gain of ₹1,00,000 without deducting the ₹50,000 loss
    assert realized["cryptoTax"] == 31200.00


def test_tax_loss_harvesting_opportunities():
    """
    Test tax-loss harvesting opportunity identification and savings estimation.
    """
    engine = TaxEngine()
    stcg_buy_date = (datetime.now() - timedelta(days=60)).strftime("%Y-%m-%d")
    ltcg_buy_date = (datetime.now() - timedelta(days=400)).strftime("%Y-%m-%d")

    inputs = {
        "assessment_year": "2025-2026",
        "tax_slab_rate": 0.30,
        "transactions": [],
        "unrealized_holdings": [
            {
                "id": "h1",
                "symbol": "HDFCBANK",
                "asset_class": "equity",
                "buy_date": stcg_buy_date,
                "invested_amount": 100000.0,
                "current_value": 80000.0, # Loss of ₹20,000 (STCL -> save 20% = ₹4,000)
            },
            {
                "id": "h2",
                "symbol": "TCS",
                "asset_class": "equity",
                "buy_date": ltcg_buy_date,
                "invested_amount": 200000.0,
                "current_value": 160000.0, # Loss of ₹40,000 (LTCL -> save 12.5% = ₹5,000)
            },
            {
                "id": "h3",
                "symbol": "BTC",
                "asset_class": "crypto",
                "buy_date": stcg_buy_date,
                "invested_amount": 50000.0,
                "current_value": 30000.0, # Crypto loss cannot be harvested
            }
        ]
    }

    result = engine.execute(inputs)
    assert result["metadata"]["status"] == "SUCCESS"
    data = result["data"]

    opportunities = data["harvestingOpportunities"]
    assert len(opportunities) == 3

    # Total harvestable loss should exclude crypto (20,000 + 40,000 = 60,000)
    assert data["totalHarvestableLoss"] == 60000.00
    # Potential tax savings = 4,000 + 5,000 = 9,000
    assert data["totalPotentialTaxSavings"] == 9000.00

    # Ensure statutory disclaimer is present
    assert "disclaimer" in data
    assert "Chartered Accountant" in data["disclaimer"]


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
