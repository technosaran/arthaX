"""
Financial Calculation Engine - Indian Capital Gains Tax & Tax-Loss Harvesting Engine
Compliant with Income Tax Act, 1961 and Union Budget 2024 / Finance (No. 2) Act, 2024 reforms.
Supports FIFO lot matching, multi-asset classes, loss set-off rules, and tax harvesting opportunities.
"""

from datetime import datetime, date
from decimal import Decimal
import math
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict, deque

from ..core.precision import (
    to_decimal,
    quantize_currency,
    safe_divide,
    safe_percentage,
    DEFAULT_CURRENCY,
)
from ..core.validators import parse_iso_date
from ..core.base_calculator import BaseCalculator


# Union Budget 2024 / FY 2024-25 (AY 2025-26) Statutory Rules
BUDGET_2024_TAX_RULES = {
    "version": "Union Budget 2024 (Finance No. 2 Act, 2024)",
    "effective_date": "2024-07-23",
    "equity": {
        "holding_threshold_days": 365,
        "stcg_rate": Decimal("0.20"),       # Sec 111A (revised from 15% to 20%)
        "ltcg_rate": Decimal("0.125"),      # Sec 112A (revised from 10% to 12.5%)
        "ltcg_exemption_limit": Decimal("125000.00"), # Sec 112A (increased from 1L to 1.25L)
    },
    "debt_mutual_funds": {
        # Specified mutual funds post April 1, 2023 (Sec 50AA)
        "tax_treatment": "SLAB_RATE",
    },
    "bullion": {
        "holding_threshold_days": 730,      # 24 months
        "stcg_rate": "SLAB_RATE",
        "ltcg_rate": Decimal("0.125"),      # 12.5% without indexation
    },
    "bonds_listed": {
        "holding_threshold_days": 365,      # 12 months
        "stcg_rate": "SLAB_RATE",
        "ltcg_rate": Decimal("0.125"),      # 12.5% without indexation
    },
    "crypto_vda": {
        # Section 115BBH: Flat 30% tax, no expense deductions except acquisition cost, zero loss set-off
        "flat_rate": Decimal("0.30"),
        "cess_rate": Decimal("0.04"),       # 4% health & education cess
        "effective_rate": Decimal("0.312"), # 31.2%
        "allow_loss_setoff": False,
    },
    "fno_derivatives": {
        # Section 43(5): Non-speculative business income
        "tax_treatment": "SLAB_RATE",
    },
}

DISCLAIMER_TEXT = (
    "Estimated Indian capital gains tax analysis based on Union Budget 2024 provisions. "
    "Calculations are simulated for personal portfolio planning and tax-loss harvesting only. "
    "They do not constitute certified tax filings under the Income Tax Department. "
    "Please consult a certified Chartered Accountant or tax advisor before filing ITR."
)


class TaxEngine(BaseCalculator):
    CALCULATION_TYPE = "TAX"

    def match_lots_fifo(
        self,
        buy_lots: List[Dict[str, Any]],
        sell_orders: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """
        Executes strict First-In, First-Out (FIFO) matching between purchase lots and sell orders.
        buy_lots: [{ symbol, quantity, price, buy_date, id }]
        sell_orders: [{ symbol, quantity, price, sell_date, id }]
        Returns matched realized trades with exact purchase dates and cost bases.
        """
        # Group buys by symbol and sort chronologically
        inventory = defaultdict(deque)
        sorted_buys = sorted(
            buy_lots,
            key=lambda b: parse_iso_date(b.get("buy_date") or b.get("transaction_date") or b.get("date") or b.get("created_at")) or date.min
        )

        for b in sorted_buys:
            sym = str(b.get("symbol") or b.get("symbol_or_name") or "").strip().upper()
            qty = to_decimal(b.get("quantity", 0))
            price = to_decimal(b.get("price") or b.get("avg_buy_price", 0))
            b_date = parse_iso_date(b.get("buy_date") or b.get("transaction_date") or b.get("date") or b.get("created_at")) or date.today()
            if sym and qty > Decimal("0") and price > Decimal("0"):
                inventory[sym].append({
                    "lot_id": b.get("id"),
                    "symbol": sym,
                    "remaining_qty": qty,
                    "buy_price": price,
                    "buy_date": b_date,
                    "asset_class": b.get("asset_class", "equity"),
                })

        sorted_sells = sorted(
            sell_orders,
            key=lambda s: parse_iso_date(s.get("sell_date") or s.get("transaction_date") or s.get("date") or s.get("created_at")) or date.min
        )

        realized_trades = []

        for s in sorted_sells:
            sym = str(s.get("symbol") or s.get("symbol_or_name") or "").strip().upper()
            sell_qty = to_decimal(s.get("quantity", 0))
            sell_price = to_decimal(s.get("price", 0))
            s_date = parse_iso_date(s.get("sell_date") or s.get("transaction_date") or s.get("date") or s.get("created_at")) or date.today()
            asset_class = s.get("asset_class", "equity")

            if not sym or sell_qty <= Decimal("0") or sell_price <= Decimal("0"):
                continue

            unfilled_sell = sell_qty
            queue = inventory[sym]

            while unfilled_sell > Decimal("0") and queue:
                current_lot = queue[0]
                matched_qty = min(unfilled_sell, current_lot["remaining_qty"])

                buy_amt = matched_qty * current_lot["buy_price"]
                sell_amt = matched_qty * sell_price
                gain = sell_amt - buy_amt
                holding_days = (s_date - current_lot["buy_date"]).days

                realized_trades.append({
                    "symbol": sym,
                    "asset_class": asset_class or current_lot["asset_class"],
                    "quantity": float(matched_qty),
                    "buy_price": float(current_lot["buy_price"]),
                    "sell_price": float(sell_price),
                    "buy_amount": float(buy_amt),
                    "sell_amount": float(sell_amt),
                    "gain": float(gain),
                    "buy_date": current_lot["buy_date"].isoformat(),
                    "sell_date": s_date.isoformat(),
                    "holding_days": holding_days,
                })

                current_lot["remaining_qty"] -= matched_qty
                unfilled_sell -= matched_qty

                if current_lot["remaining_qty"] <= Decimal("0"):
                    queue.popleft()

            # If sell could not be matched with historical buys, record with available cost or zero basis
            if unfilled_sell > Decimal("0"):
                cost_estimate = unfilled_sell * sell_price * Decimal("0.85") # fallback flag
                gain = (unfilled_sell * sell_price) - cost_estimate
                realized_trades.append({
                    "symbol": sym,
                    "asset_class": asset_class,
                    "quantity": float(unfilled_sell),
                    "buy_price": float(sell_price * Decimal("0.85")),
                    "sell_price": float(sell_price),
                    "buy_amount": float(cost_estimate),
                    "sell_amount": float(unfilled_sell * sell_price),
                    "gain": float(gain),
                    "buy_date": s_date.isoformat(),
                    "sell_date": s_date.isoformat(),
                    "holding_days": 0,
                    "is_estimated_cost_basis": True,
                })

        return realized_trades

    def calculate(self, inputs: Dict[str, Any], context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Calculates capital gains tax liability and harvesting opportunities.
        Inputs:
            assessment_year: string (default "2025-26")
            tax_slab_rate: float (default 0.30)
            realized_trades: List[Dict] (or matched FIFO from buy_lots + sell_orders)
            buy_lots: Optional List[Dict] for FIFO matching
            sell_orders: Optional List[Dict] for FIFO matching
            unrealized_holdings: List[Dict] [{ id, symbol, asset_class, buy_date, invested_amount, current_value }]
        """
        ay: str = inputs.get("assessment_year", "2025-26")
        slab_rate_dec: Decimal = to_decimal(inputs.get("tax_slab_rate", "0.30"))
        now = datetime.now()

        # 1. Determine realized trades (either directly supplied or matched via FIFO)
        realized_trades = inputs.get("realized_trades", [])
        buy_lots = inputs.get("buy_lots", [])
        sell_orders = inputs.get("sell_orders", [])

        if not realized_trades and not (buy_lots and sell_orders) and inputs.get("transactions"):
            txs = inputs.get("transactions", [])
            buy_lots = [t for t in txs if str(t.get("type", "")).upper() == "BUY"]
            sell_orders = [t for t in txs if str(t.get("type", "")).upper() == "SELL"]

        if not realized_trades and (buy_lots and sell_orders):
            realized_trades = self.match_lots_fifo(buy_lots, sell_orders)

        # 2. Categorize Realized Gains & Losses
        equity_ltcg_gain = Decimal("0.00")
        equity_stcg_gain = Decimal("0.00")
        debt_gain = Decimal("0.00")
        bullion_ltcg_gain = Decimal("0.00")
        bullion_stcg_gain = Decimal("0.00")
        bonds_ltcg_gain = Decimal("0.00")
        bonds_stcg_gain = Decimal("0.00")
        crypto_gain = Decimal("0.00")
        crypto_losses = Decimal("0.00")
        fno_income = Decimal("0.00")

        for trade in realized_trades:
            net_gain = to_decimal(trade.get("gain", 0))
            if "gain" not in trade and "sell_amount" in trade and "buy_amount" in trade:
                net_gain = to_decimal(trade.get("sell_amount", 0)) - to_decimal(trade.get("buy_amount", 0))

            holding_days = trade.get("holding_days")
            if holding_days is None:
                b_dt = parse_iso_date(trade.get("buy_date"))
                s_dt = parse_iso_date(trade.get("sell_date"))
                holding_days = (s_dt - b_dt).days if (s_dt and b_dt) else 0

            asset = str(trade.get("asset_class") or "equity").lower()

            if asset in ("equity", "stock", "mutual_fund", "equity_mf"):
                if holding_days >= 365:
                    equity_ltcg_gain += net_gain
                else:
                    equity_stcg_gain += net_gain
            elif asset in ("debt_fund", "debt_mf", "specified_mutual_fund"):
                debt_gain += net_gain
            elif asset in ("bullion", "gold", "silver"):
                if holding_days >= 730:
                    bullion_ltcg_gain += net_gain
                else:
                    bullion_stcg_gain += net_gain
            elif asset in ("bond", "bonds", "bonds_listed"):
                if holding_days >= 365:
                    bonds_ltcg_gain += net_gain
                else:
                    bonds_stcg_gain += net_gain
            elif asset in ("crypto", "cryptocurrency", "vda", "bitcoin", "ethereum"):
                if net_gain > Decimal("0.00"):
                    crypto_gain += net_gain
                else:
                    crypto_losses += abs(net_gain)
            elif asset in ("fno", "derivative", "option", "future"):
                fno_income += net_gain

        # 3. Inter-Asset Loss Set-Off Rules (Sections 70 & 71)
        # STCL can offset both STCG and LTCG.
        # LTCL can ONLY offset LTCG.
        # Crypto losses cannot offset any gains (Sec 115BBH).
        adjusted_equity_ltcg = equity_ltcg_gain
        adjusted_equity_stcg = equity_stcg_gain

        # If STCG is net negative (STCL) and LTCG is positive, offset STCL against LTCG
        if adjusted_equity_stcg < Decimal("0.00") and adjusted_equity_ltcg > Decimal("0.00"):
            offset_amt = min(abs(adjusted_equity_stcg), adjusted_equity_ltcg)
            adjusted_equity_ltcg -= offset_amt
            adjusted_equity_stcg += offset_amt

        # 4. Tax Liability Computation (Union Budget 2024)
        ltcg_exemption = BUDGET_2024_TAX_RULES["equity"]["ltcg_exemption_limit"]
        taxable_equity_ltcg = max(Decimal("0.00"), adjusted_equity_ltcg - ltcg_exemption)
        equity_ltcg_tax = taxable_equity_ltcg * BUDGET_2024_TAX_RULES["equity"]["ltcg_rate"]
        equity_stcg_tax = max(Decimal("0.00"), adjusted_equity_stcg) * BUDGET_2024_TAX_RULES["equity"]["stcg_rate"]

        debt_tax = max(Decimal("0.00"), debt_gain) * slab_rate_dec
        bullion_ltcg_tax = max(Decimal("0.00"), bullion_ltcg_gain) * Decimal("0.125")
        bullion_stcg_tax = max(Decimal("0.00"), bullion_stcg_gain) * slab_rate_dec
        bonds_ltcg_tax = max(Decimal("0.00"), bonds_ltcg_gain) * Decimal("0.125")
        bonds_stcg_tax = max(Decimal("0.00"), bonds_stcg_gain) * slab_rate_dec
        fno_tax = max(Decimal("0.00"), fno_income) * slab_rate_dec

        # Crypto flat 30% (+4% cess = 31.2%) on gross gains
        crypto_tax = crypto_gain * BUDGET_2024_TAX_RULES["crypto_vda"]["effective_rate"]

        total_realized_gains = (
            equity_ltcg_gain
            + equity_stcg_gain
            + debt_gain
            + bullion_ltcg_gain
            + bullion_stcg_gain
            + bonds_ltcg_gain
            + bonds_stcg_gain
            + crypto_gain
            + fno_income
        )

        total_estimated_tax = (
            equity_ltcg_tax
            + equity_stcg_tax
            + debt_tax
            + bullion_ltcg_tax
            + bullion_stcg_tax
            + bonds_ltcg_tax
            + bonds_stcg_tax
            + crypto_tax
            + fno_tax
        )

        # 5. Analyze Unrealized Holdings for Tax-Loss Harvesting Opportunities
        unrealized_holdings: List[Dict[str, Any]] = inputs.get("unrealized_holdings", [])
        harvesting_opportunities = []
        total_harvestable_loss = Decimal("0.00")
        total_potential_tax_savings = Decimal("0.00")

        for holding in unrealized_holdings:
            inv = to_decimal(holding.get("invested_amount", 0))
            cur = to_decimal(holding.get("current_value", 0))

            if cur < inv and inv > Decimal("0.00"):
                loss = inv - cur
                b_dt = parse_iso_date(holding.get("buy_date"))
                holding_days = (now.date() - b_dt).days if b_dt else 0
                months = round(holding_days / 30.4, 1)

                asset = str(holding.get("asset_class") or "equity").lower()
                is_equity = asset in ("equity", "stock", "mutual_fund", "equity_mf")
                is_crypto = asset in ("crypto", "cryptocurrency", "vda")
                is_debt = asset in ("debt", "debt_fund", "debt_mf")

                if is_crypto:
                    # Under Sec 115BBH, crypto losses cannot be harvested to offset any gains
                    tax_rate = Decimal("0.00")
                    gain_type = "VDA_LOSS_UNOFFSETTABLE"
                    potential_savings = Decimal("0.00")
                    rec = "Under Section 115BBH, Virtual Digital Asset (Crypto) losses cannot be set off against any gains or carried forward."
                elif is_debt:
                    tax_rate = slab_rate_dec
                    gain_type = "SLAB"
                    potential_savings = loss * tax_rate
                    rec = f"Harvest ₹{loss:,.2f} debt fund loss to offset other capital gains and save up to ₹{potential_savings:,.2f}."
                else:
                    is_long_term = (holding_days >= 365) if is_equity else (holding_days >= 730)
                    gain_type = "LTCG" if is_long_term else "STCG"
                    tax_rate = Decimal("0.125") if is_long_term else (Decimal("0.20") if is_equity else slab_rate_dec)
                    potential_savings = loss * tax_rate
                    rec = f"Harvest ₹{loss:,.2f} loss to offset taxable {gain_type} gains and save ~₹{potential_savings:,.2f} in taxes."

                harvesting_opportunities.append({
                    "id": str(holding.get("id") or holding.get("symbol") or "holding"),
                    "symbol": str(holding.get("symbol") or holding.get("name") or "Asset"),
                    "assetClass": holding.get("asset_class", "equity"),
                    "buyDate": holding.get("buy_date") or "",
                    "investedAmount": float(quantize_currency(inv)),
                    "currentValue": float(quantize_currency(cur)),
                    "unrealizedLoss": float(quantize_currency(loss)),
                    "holdingPeriodMonths": months,
                    "gainType": gain_type,
                    "potentialTaxSavings": float(quantize_currency(potential_savings)),
                    "effectiveTaxRate": float(quantize_currency(tax_rate * Decimal("100"))),
                    "recommendation": rec,
                })

                if not is_crypto:
                    total_harvestable_loss += loss
                    total_potential_tax_savings += potential_savings

        # Sort opportunities by potential tax savings descending
        harvesting_opportunities.sort(key=lambda x: x["potentialTaxSavings"], reverse=True)

        advice = []
        if taxable_equity_ltcg > Decimal("0.00"):
            advice.append(
                f"Your equity LTCG of ₹{equity_ltcg_gain:,.2f} exceeds the Section 112A ₹1.25 Lakh exemption limit by ₹{taxable_equity_ltcg:,.2f}. Consider harvesting available long-term losses before March 31st to reduce tax liability."
            )
        elif equity_ltcg_gain > Decimal("0.00"):
            rem = ltcg_exemption - equity_ltcg_gain
            advice.append(
                f"You have ₹{rem:,.2f} in remaining tax-free LTCG exemption under Section 112A for AY {ay}."
            )

        if equity_stcg_gain > Decimal("0.00") and total_harvestable_loss > Decimal("0.00"):
            advice.append(
                f"You have ₹{equity_stcg_gain:,.2f} in taxable STCG (taxed at 20%). You can harvest available short-term losses to directly neutralize this liability."
            )

        if crypto_losses > Decimal("0.00"):
            advice.append(
                f"Note: You have ₹{crypto_losses:,.2f} in cryptocurrency losses. Section 115BBH strictly prohibits setting off crypto losses against capital gains from stocks, mutual funds, or other crypto."
            )

        return {
            "disclaimer": DISCLAIMER_TEXT,
            "assessmentYear": ay,
            "taxSlabRate": float(slab_rate_dec),
            "taxRulesVersion": BUDGET_2024_TAX_RULES["version"],
            "realized": {
                "equityLtcgGain": float(quantize_currency(equity_ltcg_gain)),
                "equityLtcgTaxable": float(quantize_currency(taxable_equity_ltcg)),
                "equityLtcgTax": float(quantize_currency(equity_ltcg_tax)),
                "equityStcgGain": float(quantize_currency(equity_stcg_gain)),
                "equityStcgTax": float(quantize_currency(equity_stcg_tax)),
                "debtGain": float(quantize_currency(debt_gain)),
                "debtTax": float(quantize_currency(debt_tax)),
                "bullionLtcgGain": float(quantize_currency(bullion_ltcg_gain)),
                "bullionLtcgTax": float(quantize_currency(bullion_ltcg_tax)),
                "bullionStcgGain": float(quantize_currency(bullion_stcg_gain)),
                "bullionStcgTax": float(quantize_currency(bullion_stcg_tax)),
                "bondsLtcgGain": float(quantize_currency(bonds_ltcg_gain)),
                "bondsLtcgTax": float(quantize_currency(bonds_ltcg_tax)),
                "bondsStcgGain": float(quantize_currency(bonds_stcg_gain)),
                "bondsStcgTax": float(quantize_currency(bonds_stcg_tax)),
                "cryptoGain": float(quantize_currency(crypto_gain)),
                "cryptoLosses": float(quantize_currency(crypto_losses)),
                "cryptoTax": float(quantize_currency(crypto_tax)),
                "fnoIncome": float(quantize_currency(fno_income)),
                "fnoTax": float(quantize_currency(fno_tax)),
                "totalRealizedGains": float(quantize_currency(total_realized_gains)),
                "totalEstimatedTax": float(quantize_currency(total_estimated_tax)),
            },
            "harvestingOpportunities": harvesting_opportunities,
            "totalHarvestableLoss": float(quantize_currency(total_harvestable_loss)),
            "totalPotentialTaxSavings": float(quantize_currency(total_potential_tax_savings)),
            "advice": advice,
        }
