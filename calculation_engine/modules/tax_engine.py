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

        # Optional: Include Income Tax Old vs New Regime Comparison if gross income provided
        regime_comparison = None
        gross_salary = inputs.get("gross_salary") or inputs.get("annual_income")
        if gross_salary is not None and to_decimal(gross_salary) > Decimal("0.00"):
            regime_comparison = self.compare_regimes(
                gross_income=to_decimal(gross_salary),
                deductions_80c=to_decimal(inputs.get("deductions_80c", 0)),
                deductions_80d=to_decimal(inputs.get("deductions_80d", 0)),
                nps_80ccd_1b=to_decimal(inputs.get("nps_80ccd_1b", 0)),
                home_loan_interest_24b=to_decimal(inputs.get("home_loan_interest_24b", 0)),
                hra_exemption=to_decimal(inputs.get("hra_exemption", 0)),
                other_deductions=to_decimal(inputs.get("other_deductions", 0)),
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
            "regimeComparison": regime_comparison,
            "advice": advice,
        }

    def _calculate_new_regime_base_tax(self, taxable_income: Decimal) -> Decimal:
        """Calculates New Regime (Section 115BAC) slab tax before rebate, surcharge and cess."""
        if taxable_income <= Decimal("300000.00"):
            return Decimal("0.00")
        tax = Decimal("0.00")
        rem = taxable_income
        # 3L - 7L (4 Lakhs @ 5% = 20,000)
        s1 = min(rem - Decimal("300000.00"), Decimal("400000.00"))
        if s1 > Decimal("0.00"):
            tax += s1 * Decimal("0.05")
        # 7L - 10L (3 Lakhs @ 10% = 30,000)
        if rem > Decimal("700000.00"):
            s2 = min(rem - Decimal("700000.00"), Decimal("300000.00"))
            tax += s2 * Decimal("0.10")
        # 10L - 12L (2 Lakhs @ 15% = 30,000)
        if rem > Decimal("1000000.00"):
            s3 = min(rem - Decimal("1000000.00"), Decimal("200000.00"))
            tax += s3 * Decimal("0.15")
        # 12L - 15L (3 Lakhs @ 20% = 60,000)
        if rem > Decimal("1200000.00"):
            s4 = min(rem - Decimal("1200000.00"), Decimal("300000.00"))
            tax += s4 * Decimal("0.20")
        # > 15L @ 30%
        if rem > Decimal("1500000.00"):
            s5 = rem - Decimal("1500000.00")
            tax += s5 * Decimal("0.30")
        return tax

    def _calculate_old_regime_base_tax(self, taxable_income: Decimal) -> Decimal:
        """Calculates Old Regime slab tax before rebate, surcharge and cess."""
        if taxable_income <= Decimal("250000.00"):
            return Decimal("0.00")
        tax = Decimal("0.00")
        rem = taxable_income
        # 2.5L - 5L (2.5 Lakhs @ 5% = 12,500)
        s1 = min(rem - Decimal("250000.00"), Decimal("250000.00"))
        if s1 > Decimal("0.00"):
            tax += s1 * Decimal("0.05")
        # 5L - 10L (5 Lakhs @ 20% = 100,000)
        if rem > Decimal("500000.00"):
            s2 = min(rem - Decimal("500000.00"), Decimal("500000.00"))
            tax += s2 * Decimal("0.20")
        # > 10L @ 30%
        if rem > Decimal("1000000.00"):
            s3 = rem - Decimal("1000000.00")
            tax += s3 * Decimal("0.30")
        return tax

    def _calculate_surcharge_with_marginal_relief(
        self,
        taxable_income: Decimal,
        base_tax: Decimal,
        is_new_regime: bool,
    ) -> Tuple[Decimal, Decimal]:
        """
        Calculates Surcharge on high net worth incomes and applies statutory Marginal Relief.
        Returns (final_surcharge, marginal_relief_amount).
        """
        if taxable_income <= Decimal("5000000.00"):
            return Decimal("0.00"), Decimal("0.00")

        base_calc = self._calculate_new_regime_base_tax if is_new_regime else self._calculate_old_regime_base_tax

        # 1. Determine nominal surcharge rate
        if taxable_income <= Decimal("10000000.00"):
            nominal_rate = Decimal("0.10")
            threshold = Decimal("5000000.00")
            tax_at_threshold = base_calc(threshold)
            prior_surcharge_at_threshold = Decimal("0.00")
        elif taxable_income <= Decimal("20000000.00"):
            nominal_rate = Decimal("0.15")
            threshold = Decimal("10000000.00")
            tax_at_threshold = base_calc(threshold)
            prior_surcharge_at_threshold = tax_at_threshold * Decimal("0.10")
        elif taxable_income <= Decimal("50000000.00"):
            nominal_rate = Decimal("0.25")
            threshold = Decimal("20000000.00")
            tax_at_threshold = base_calc(threshold)
            prior_surcharge_at_threshold = tax_at_threshold * Decimal("0.15")
        else:
            # > 5 Crores: New Regime caps surcharge at 25%; Old Regime charges 37%
            nominal_rate = Decimal("0.25") if is_new_regime else Decimal("0.37")
            threshold = Decimal("50000000.00")
            tax_at_threshold = base_calc(threshold)
            prior_surcharge_at_threshold = tax_at_threshold * Decimal("0.25")

        nominal_surcharge = base_tax * nominal_rate

        # Marginal Relief Rule:
        # Total (tax + surcharge) shall not exceed (tax + surcharge on threshold) + (income - threshold)
        max_payable = (tax_at_threshold + prior_surcharge_at_threshold) + (taxable_income - threshold)
        total_under_nominal = base_tax + nominal_surcharge

        if total_under_nominal > max_payable:
            surcharge_relief = total_under_nominal - max_payable
            final_surcharge = max(Decimal("0.00"), nominal_surcharge - surcharge_relief)
            return quantize_currency(final_surcharge), quantize_currency(surcharge_relief)
        else:
            return quantize_currency(nominal_surcharge), Decimal("0.00")

    def compare_regimes(
        self,
        gross_income: Decimal,
        deductions_80c: Decimal = Decimal("0.00"),
        deductions_80d: Decimal = Decimal("0.00"),
        nps_80ccd_1b: Decimal = Decimal("0.00"),
        nps_80ccd_2: Decimal = Decimal("0.00"),
        home_loan_interest_24b: Decimal = Decimal("0.00"),
        hra_exemption: Decimal = Decimal("0.00"),
        other_deductions: Decimal = Decimal("0.00"),
    ) -> Dict[str, Any]:
        """
        Comprehensive Union Budget 2024 Old vs New Tax Regime Comparator.
        Calculates tax liability under both regimes with Section 87A rebate,
        Section 87A marginal relief, Section 80CCD(2) Corporate NPS deductions,
        and High-Net-Worth Surcharge with Marginal Relief.
        """
        cess_rate = Decimal("0.04")

        # ---------------------------------------------------------
        # 1. New Tax Regime (Section 115BAC - Union Budget 2024)
        # ---------------------------------------------------------
        # Standard deduction ₹75,000 + Section 80CCD(2) employer NPS
        new_std_deduction = Decimal("75000.00")
        new_taxable_income = max(Decimal("0.00"), gross_income - new_std_deduction - nps_80ccd_2)

        new_base_tax = self._calculate_new_regime_base_tax(new_taxable_income)
        new_marginal_relief_87a = Decimal("0.00")
        new_rebate_87a = Decimal("0.00")

        # Section 87A Rebate & Marginal Relief
        if new_taxable_income <= Decimal("700000.00"):
            new_rebate_87a = new_base_tax
            new_tax_after_87a = Decimal("0.00")
        else:
            # Proviso to Section 87A: tax payable shall not exceed (taxable_income - 7,00,000)
            excess_income_over_7l = new_taxable_income - Decimal("700000.00")
            if new_base_tax > excess_income_over_7l:
                new_marginal_relief_87a = new_base_tax - excess_income_over_7l
                new_tax_after_87a = excess_income_over_7l
            else:
                new_tax_after_87a = new_base_tax

        # Surcharge on High Net Worth Incomes
        new_surcharge, new_surcharge_relief = self._calculate_surcharge_with_marginal_relief(
            new_taxable_income, new_tax_after_87a, is_new_regime=True
        )

        new_tax_with_surcharge = new_tax_after_87a + new_surcharge
        new_cess = quantize_currency(new_tax_with_surcharge * cess_rate)
        new_total_tax = new_tax_with_surcharge + new_cess

        # ---------------------------------------------------------
        # 2. Old Tax Regime
        # ---------------------------------------------------------
        old_std_deduction = Decimal("50000.00")
        capped_80c = min(deductions_80c, Decimal("150000.00"))
        capped_80d = min(deductions_80d, Decimal("100000.00"))
        capped_nps = min(nps_80ccd_1b, Decimal("50000.00"))
        capped_24b = min(home_loan_interest_24b, Decimal("200000.00"))

        total_old_deductions = (
            old_std_deduction
            + capped_80c
            + capped_80d
            + capped_nps
            + nps_80ccd_2
            + capped_24b
            + hra_exemption
            + other_deductions
        )

        old_taxable_income = max(Decimal("0.00"), gross_income - total_old_deductions)
        old_base_tax = self._calculate_old_regime_base_tax(old_taxable_income)
        old_rebate_87a = Decimal("0.00")

        # Section 87A Rebate for Old Regime (up to 5L)
        if old_taxable_income <= Decimal("500000.00"):
            old_rebate_87a = min(old_base_tax, Decimal("12500.00"))
            old_tax_after_87a = Decimal("0.00")
        else:
            old_tax_after_87a = old_base_tax

        # Surcharge on High Net Worth Incomes (Old Regime)
        old_surcharge, old_surcharge_relief = self._calculate_surcharge_with_marginal_relief(
            old_taxable_income, old_tax_after_87a, is_new_regime=False
        )

        old_tax_with_surcharge = old_tax_after_87a + old_surcharge
        old_cess = quantize_currency(old_tax_with_surcharge * cess_rate)
        old_total_tax = old_tax_with_surcharge + old_cess

        # ---------------------------------------------------------
        # 3. Recommendation & Savings
        # ---------------------------------------------------------
        tax_difference = abs(old_total_tax - new_total_tax)
        if new_total_tax < old_total_tax:
            recommended_regime = "NEW_REGIME"
            savings_amount = old_total_tax - new_total_tax
            advice_summary = (
                f"New Tax Regime saves ₹{savings_amount:,.2f} in taxes under Union Budget 2024 provisions "
                f"(₹75,000 standard deduction, revised Section 115BAC slabs, and 87A relief)."
            )
        elif old_total_tax < new_total_tax:
            recommended_regime = "OLD_REGIME"
            savings_amount = new_total_tax - old_total_tax
            advice_summary = (
                f"Old Tax Regime saves ₹{savings_amount:,.2f} due to high deductions "
                f"(₹{total_old_deductions:,.2f} total claimed across 80C, 80D, HRA, and Home Loan)."
            )
        else:
            recommended_regime = "EQUAL"
            savings_amount = Decimal("0.00")
            advice_summary = "Both tax regimes yield the exact same tax liability."

        return {
            "recommendedRegime": recommended_regime,
            "savingsAmount": float(quantize_currency(savings_amount)),
            "advice": advice_summary,
            "newRegime": {
                "grossIncome": float(quantize_currency(gross_income)),
                "standardDeduction": float(quantize_currency(new_std_deduction)),
                "corporateNpsDeduction": float(quantize_currency(nps_80ccd_2)),
                "taxableIncome": float(quantize_currency(new_taxable_income)),
                "baseIncomeTax": float(quantize_currency(new_base_tax)),
                "section87aRebate": float(quantize_currency(new_rebate_87a)),
                "section87aMarginalRelief": float(quantize_currency(new_marginal_relief_87a)),
                "taxAfterRebate": float(quantize_currency(new_tax_after_87a)),
                "surcharge": float(quantize_currency(new_surcharge)),
                "surchargeMarginalRelief": float(quantize_currency(new_surcharge_relief)),
                "cess": float(quantize_currency(new_cess)),
                "totalTax": float(quantize_currency(new_total_tax)),
                "effectiveRatePercent": float(safe_percentage(new_total_tax, gross_income)),
            },
            "oldRegime": {
                "grossIncome": float(quantize_currency(gross_income)),
                "standardDeduction": float(quantize_currency(old_std_deduction)),
                "corporateNpsDeduction": float(quantize_currency(nps_80ccd_2)),
                "totalDeductions": float(quantize_currency(total_old_deductions)),
                "taxableIncome": float(quantize_currency(old_taxable_income)),
                "baseIncomeTax": float(quantize_currency(old_base_tax)),
                "section87aRebate": float(quantize_currency(old_rebate_87a)),
                "taxAfterRebate": float(quantize_currency(old_tax_after_87a)),
                "surcharge": float(quantize_currency(old_surcharge)),
                "surchargeMarginalRelief": float(quantize_currency(old_surcharge_relief)),
                "cess": float(quantize_currency(old_cess)),
                "totalTax": float(quantize_currency(old_total_tax)),
                "effectiveRatePercent": float(safe_percentage(old_total_tax, gross_income)),
            },
        }
