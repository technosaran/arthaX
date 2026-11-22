"""
Financial Calculation Engine - Portfolio Rebalancing & Comprehensive Health Score Engine
Evaluates asset allocation drift against target benchmarks, generates actionable rebalancing orders,
and calculates a multi-dimensional 0-100 Portfolio Health Index with prioritized remediation steps.
"""

from decimal import Decimal
import math
from typing import List, Dict, Any, Optional
from ..core.precision import (
    to_decimal,
    quantize_currency,
    safe_divide,
    safe_percentage,
    DEFAULT_CURRENCY,
)
from ..core.base_calculator import BaseCalculator


class RebalancingEngine(BaseCalculator):
    CALCULATION_TYPE = "REBALANCING"

    # Default Balanced Allocation Benchmark
    DEFAULT_TARGET_ALLOCATION = {
        "equity": Decimal("60.0"),
        "debt": Decimal("20.0"),
        "gold": Decimal("10.0"),
        "cash": Decimal("10.0"),
        "crypto": Decimal("0.0"),
    }

    def calculate(self, inputs: Dict[str, Any], context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Inputs:
            portfolio: {
                equity: float,
                debt: float,
                gold: float,
                cash: float,
                crypto: float,
            }
            target_allocation: Optional Dict[str, float] (must sum to ~100)
            liabilities: Optional float (default: 0)
            monthly_expenses: Optional float (default: 0)
            monthly_income: Optional float (default: 0)
            currency: string (default: INR)
        """
        raw_portfolio = inputs.get("portfolio", {})
        currency = str(inputs.get("currency", DEFAULT_CURRENCY))
        liabilities_dec = to_decimal(inputs.get("liabilities", 0))
        monthly_exp_dec = to_decimal(inputs.get("monthly_expenses", 0))
        monthly_inc_dec = to_decimal(inputs.get("monthly_income", 0))

        equity_val = max(Decimal("0.00"), to_decimal(raw_portfolio.get("equity", 0)))
        debt_val = max(Decimal("0.00"), to_decimal(raw_portfolio.get("debt", 0)))
        gold_val = max(Decimal("0.00"), to_decimal(raw_portfolio.get("gold", 0)))
        cash_val = max(Decimal("0.00"), to_decimal(raw_portfolio.get("cash", 0)))
        crypto_val = max(Decimal("0.00"), to_decimal(raw_portfolio.get("crypto", 0)))

        total_assets = equity_val + debt_val + gold_val + cash_val + crypto_val

        # 1. Resolve Target Allocation
        raw_target = inputs.get("target_allocation", {})
        target_allocation: Dict[str, Decimal] = {}
        target_sum = Decimal("0.00")

        for asset in ["equity", "debt", "gold", "cash", "crypto"]:
            if asset in raw_target:
                pct = max(Decimal("0.00"), to_decimal(raw_target[asset]))
                target_allocation[asset] = pct
                target_sum += pct
            else:
                target_allocation[asset] = self.DEFAULT_TARGET_ALLOCATION.get(asset, Decimal("0.00"))
                target_sum += target_allocation[asset]

        # Normalize targets to 100% if sum deviates
        if target_sum > Decimal("0.00") and target_sum != Decimal("100.00"):
            for k in target_allocation:
                target_allocation[k] = quantize_currency((target_allocation[k] / target_sum) * Decimal("100.00"))

        # 2. Compute Current Allocations & Drift
        current_allocation: Dict[str, Decimal] = {}
        drift_percentage: Dict[str, Decimal] = {}
        rebalance_orders: List[Dict[str, Any]] = []

        total_drift_abs = Decimal("0.00")

        asset_values = {
            "equity": equity_val,
            "debt": debt_val,
            "gold": gold_val,
            "cash": cash_val,
            "crypto": crypto_val,
        }

        for asset, val in asset_values.items():
            curr_pct = safe_percentage(val, total_assets) if total_assets > Decimal("0.00") else Decimal("0.00")
            current_allocation[asset] = curr_pct

            tgt_pct = target_allocation.get(asset, Decimal("0.00"))
            drift_pct = curr_pct - tgt_pct
            drift_percentage[asset] = drift_pct
            total_drift_abs += abs(drift_pct)

            # Target Value in Rupee Terms
            target_val = (total_assets * tgt_pct) / Decimal("100.00")
            delta_val = target_val - val

            # Generate rebalancing action (only if drift > 1.5% to avoid micro-transactions)
            if abs(drift_pct) >= Decimal("1.50") and abs(delta_val) >= Decimal("100.00"):
                action = "BUY" if delta_val > Decimal("0.00") else "SELL"
                rebalance_orders.append({
                    "asset": asset,
                    "action": action,
                    "current_amount": float(quantize_currency(val)),
                    "target_amount": float(quantize_currency(target_val)),
                    "adjustment_amount": float(quantize_currency(abs(delta_val))),
                    "current_percentage": float(curr_pct),
                    "target_percentage": float(tgt_pct),
                    "drift_percentage": float(drift_pct),
                    "priority": "HIGH" if abs(drift_pct) >= Decimal("5.00") else "MEDIUM",
                })

        # Sort rebalance orders: SELLs first (to generate liquidity), then BUYs
        rebalance_orders.sort(key=lambda x: (0 if x["action"] == "SELL" else 1, -abs(x["drift_percentage"])))

        # 3. Multi-Dimensional Portfolio Health Score (0 - 100)
        # Pillar 1: Allocation Balance Score (0 - 25)
        # Perfect balance (drift < 4%) = 25; severe drift (> 30%) = 5
        balance_score = max(Decimal("0.00"), Decimal("25.00") - (total_drift_abs / Decimal("2.00")))
        balance_score = min(Decimal("25.00"), balance_score)

        # Pillar 2: Liquidity & Emergency Buffer Score (0 - 25)
        # Recommended: 6 months of expenses in cash/bank savings
        emergency_months = safe_divide(cash_val, monthly_exp_dec) if monthly_exp_dec > Decimal("0.00") else Decimal("6.00")
        if emergency_months >= Decimal("6.00"):
            liquidity_score = Decimal("25.00")
        elif emergency_months >= Decimal("3.00"):
            liquidity_score = Decimal("18.00")
        elif emergency_months >= Decimal("1.00"):
            liquidity_score = Decimal("10.00")
        else:
            liquidity_score = Decimal("4.00")

        # Pillar 3: Solvency & Debt-to-Asset Score (0 - 25)
        # Debt-to-asset < 15% = 25; 15-30% = 18; 30-50% = 10; > 50% = 2
        debt_ratio = safe_percentage(liabilities_dec, total_assets) if total_assets > Decimal("0.00") else Decimal("0.00")
        if debt_ratio <= Decimal("10.00"):
            solvency_score = Decimal("25.00")
        elif debt_ratio <= Decimal("25.00"):
            solvency_score = Decimal("20.00")
        elif debt_ratio <= Decimal("40.00"):
            solvency_score = Decimal("12.00")
        elif debt_ratio <= Decimal("60.00"):
            solvency_score = Decimal("6.00")
        else:
            solvency_score = Decimal("2.00")

        # Pillar 4: Savings Velocity Score (0 - 25)
        # Monthly savings rate: (Income - Expenses) / Income
        savings_amt = max(Decimal("0.00"), monthly_inc_dec - monthly_exp_dec)
        savings_rate = safe_percentage(savings_amt, monthly_inc_dec) if monthly_inc_dec > Decimal("0.00") else Decimal("20.00")
        if savings_rate >= Decimal("30.00"):
            velocity_score = Decimal("25.00")
        elif savings_rate >= Decimal("20.00"):
            velocity_score = Decimal("20.00")
        elif savings_rate >= Decimal("10.00"):
            velocity_score = Decimal("14.00")
        elif savings_rate >= Decimal("0.00"):
            velocity_score = Decimal("8.00")
        else:
            velocity_score = Decimal("2.00")

        overall_health_score = int(round(balance_score + liquidity_score + solvency_score + velocity_score))
        overall_health_score = max(0, min(100, overall_health_score))

        if overall_health_score >= 85:
            health_tier = "EXCEPTIONAL"
            summary_eval = "Your portfolio demonstrates institutional-grade diversification, ample liquidity, and robust solvency."
        elif overall_health_score >= 70:
            health_tier = "HEALTHY"
            summary_eval = "Your portfolio is resilient with sound fundamentals. Minor rebalancing will optimize risk-adjusted returns."
        elif overall_health_score >= 50:
            health_tier = "MODERATE"
            summary_eval = "Your asset allocation has drifted or your emergency runway is slightly lean. Review rebalancing recommendations."
        elif overall_health_score >= 35:
            health_tier = "NEEDS_ATTENTION"
            summary_eval = "Significant allocation imbalance or debt exposure detected. Immediate defensive realignment advised."
        else:
            health_tier = "CRITICAL"
            summary_eval = "High financial vulnerability due to depleted emergency cash or heavy debt burden. Prioritize liquid stabilization."

        # 4. Actionable Remediation Checklist
        checklist = []
        if emergency_months < Decimal("6.00"):
            shortfall = max(Decimal("0.00"), (monthly_exp_dec * Decimal("6.00")) - cash_val)
            checklist.append({
                "type": "EMERGENCY_RUNWAY",
                "severity": "HIGH",
                "title": "Build 6-Month Emergency Runway",
                "description": f"Current cash reserves cover {float(emergency_months):.1f} months. Add ₹{float(quantize_currency(shortfall)):,.2f} to liquid savings to insulate against market downturns.",
            })

        if debt_ratio > Decimal("30.00"):
            checklist.append({
                "type": "DEBT_REDUCTION",
                "severity": "HIGH",
                "title": "Deleverage Outstanding Liabilities",
                "description": f"Debt accounts for {float(debt_ratio):.1f}% of total assets. Consider aggressively retiring high-interest debt before allocating to speculative assets.",
            })

        for order in rebalance_orders:
            if order["priority"] == "HIGH":
                checklist.append({
                    "type": "REBALANCE_TRADE",
                    "severity": "MEDIUM",
                    "title": f"{order['action']} {order['asset'].capitalize()}",
                    "description": f"{order['asset'].capitalize()} has drifted by {order['drift_percentage']:+.1f}% from target. Execute {order['action']} of ₹{order['adjustment_amount']:,.2f}.",
                })

        # 4. Tax-Free Cash Flow / Infusion Rebalancing
        # Calculates new capital injection to bring underweight assets to target without selling
        tax_free_orders = []
        total_infusion_required = Decimal("0.00")

        if total_assets > Decimal("0.00"):
            # Find the minimum required new total assets where no asset needs to be sold
            new_total_candidates = []
            for asset, val in asset_values.items():
                tgt = target_allocation.get(asset, Decimal("0.00"))
                if tgt > Decimal("0.00"):
                    # Required total if this asset is not sold: val / (tgt / 100)
                    candidate_total = (val * Decimal("100.00")) / tgt
                    new_total_candidates.append(candidate_total)

            if new_total_candidates:
                required_new_total = max(new_total_candidates)
                for asset, val in asset_values.items():
                    tgt = target_allocation.get(asset, Decimal("0.00"))
                    target_rupees_new = (required_new_total * tgt) / Decimal("100.00")
                    buy_amt = max(Decimal("0.00"), target_rupees_new - val)
                    if buy_amt > Decimal("100.00"):
                        tax_free_orders.append({
                            "asset": asset,
                            "action": "BUY",
                            "injection_amount": float(quantize_currency(buy_amt)),
                            "post_injection_value": float(quantize_currency(val + buy_amt)),
                            "target_allocation_percent": float(tgt),
                        })
                        total_infusion_required += buy_amt

        return {
            "currency": currency,
            "total_portfolio_value": float(quantize_currency(total_assets)),
            "health_score": overall_health_score,
            "health_tier": health_tier,
            "summary_evaluation": summary_eval,
            "score_breakdown": {
                "allocation_balance_score": float(balance_score),
                "liquidity_buffer_score": float(liquidity_score),
                "solvency_score": float(solvency_score),
                "savings_velocity_score": float(velocity_score),
            },
            "metrics": {
                "emergency_fund_months": float(emergency_months),
                "debt_to_asset_ratio_percent": float(debt_ratio),
                "savings_rate_percent": float(savings_rate),
                "total_drift_percentage": float(total_drift_abs),
            },
            "current_allocation": {k: float(v) for k, v in current_allocation.items()},
            "target_allocation": {k: float(v) for k, v in target_allocation.items()},
            "drift_percentage": {k: float(v) for k, v in drift_percentage.items()},
            "rebalance_orders": rebalance_orders,
            "tax_free_cash_rebalancing": {
                "description": "Restore target allocation by deploying new capital without selling any assets or triggering capital gains taxes.",
                "total_new_capital_required": float(quantize_currency(total_infusion_required)),
                "allocation_orders": tax_free_orders,
            },
            "remediation_checklist": checklist,
        }
