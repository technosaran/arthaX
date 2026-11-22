"""
Financial Calculation Engine - Debt Payoff & Amortization Optimization Engine
Calculates Debt Avalanche vs Debt Snowball strategies, rollover acceleration,
total interest savings, payoff timelines, and month-by-month repayment schedules.
"""

from datetime import date
from decimal import Decimal
from typing import List, Dict, Any, Optional
from collections import deque
import math

from ..core.precision import (
    to_decimal,
    quantize_currency,
    safe_divide,
    safe_percentage,
    DEFAULT_CURRENCY,
)
from ..core.base_calculator import BaseCalculator


class DebtPayoffEngine(BaseCalculator):
    CALCULATION_TYPE = "DEBT_PAYOFF"

    def calculate(self, inputs: Dict[str, Any], context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Inputs:
            debts: List[Dict[str, Any]] with schema:
                [{
                    "id": str,
                    "name": str,
                    "principal": float/Decimal,
                    "interest_rate_apr": float/Decimal (e.g. 14.5 for 14.5%),
                    "minimum_payment": float/Decimal,
                    "category": Optional[str] (e.g. "Credit Card", "Personal Loan", "Home Loan", "Auto Loan")
                }]
            monthly_extra_payment: Optional float/Decimal (extra prepayment budget per month, default: 0)
            currency: Optional str (default: INR)
        """
        raw_debts = inputs.get("debts", [])
        extra_monthly_budget = max(Decimal("0.00"), to_decimal(inputs.get("monthly_extra_payment", 0)))
        currency = str(inputs.get("currency", DEFAULT_CURRENCY))

        if not raw_debts:
            return {
                "currency": currency,
                "total_debt": "0.00",
                "monthly_minimum_payment": "0.00",
                "monthly_extra_payment": str(quantize_currency(extra_monthly_budget)),
                "debts_count": 0,
                "strategies": {},
                "comparison": {},
                "recommended_strategy": "NONE",
                "recommendation_summary": "No active debts provided.",
            }

        # Normalize and validate debt records
        normalized_debts = []
        total_initial_principal = Decimal("0.00")
        total_monthly_min = Decimal("0.00")

        for d in raw_debts:
            prin = max(Decimal("0.00"), to_decimal(d.get("principal", 0)))
            apr = max(Decimal("0.00"), to_decimal(d.get("interest_rate_apr", 0)))
            min_pay = max(Decimal("0.00"), to_decimal(d.get("minimum_payment", 0)))
            
            # If minimum payment is not provided, estimate standard 2.5% of principal or monthly interest + 1%
            monthly_interest = prin * ((apr / Decimal("100.0")) / Decimal("12.0"))
            if min_pay <= Decimal("0.00"):
                min_pay = max(monthly_interest + (prin * Decimal("0.01")), prin * Decimal("0.025"))
            
            # Ensure minimum payment covers at least monthly interest to avoid negative amortization
            min_pay = max(min_pay, quantize_currency(monthly_interest + Decimal("1.00")))

            total_initial_principal += prin
            total_monthly_min += min_pay

            normalized_debts.append({
                "id": str(d.get("id") or d.get("name") or f"debt_{len(normalized_debts) + 1}"),
                "name": str(d.get("name") or "Unnamed Debt"),
                "principal": prin,
                "apr": apr,
                "monthly_rate": (apr / Decimal("100.0")) / Decimal("12.0"),
                "minimum_payment": min_pay,
                "category": str(d.get("category") or "Personal Debt"),
            })

        # Run simulations
        avalanche_res = self._simulate_strategy(normalized_debts, extra_monthly_budget, strategy="AVALANCHE")
        snowball_res = self._simulate_strategy(normalized_debts, extra_monthly_budget, strategy="SNOWBALL")
        min_only_res = self._simulate_strategy(normalized_debts, Decimal("0.00"), strategy="MINIMUM_ONLY")

        # Compare outcomes
        interest_saved_avalanche = max(Decimal("0.00"), min_only_res["total_interest_paid"] - avalanche_res["total_interest_paid"])
        interest_saved_snowball = max(Decimal("0.00"), min_only_res["total_interest_paid"] - snowball_res["total_interest_paid"])
        months_saved_avalanche = max(0, min_only_res["months_to_payoff"] - avalanche_res["months_to_payoff"])
        months_saved_snowball = max(0, min_only_res["months_to_payoff"] - snowball_res["months_to_payoff"])

        avalanche_vs_snowball_diff = snowball_res["total_interest_paid"] - avalanche_res["total_interest_paid"]

        # Formulate intelligent recommendation
        if avalanche_vs_snowball_diff > Decimal("10000.00"):
            recommended_strategy = "AVALANCHE"
            summary = (
                f"Debt Avalanche is strongly recommended. It saves an extra {currency} {quantize_currency(avalanche_vs_snowball_diff)} "
                f"in interest compared to Snowball and eliminates all debt {avalanche_res['months_to_payoff']} months from now."
            )
        elif avalanche_vs_snowball_diff > Decimal("2000.00"):
            recommended_strategy = "AVALANCHE"
            summary = (
                f"Debt Avalanche is mathematically optimal, saving {currency} {quantize_currency(avalanche_vs_snowball_diff)} more in interest. "
                f"However, Debt Snowball pays off your first loan in {snowball_res.get('first_debt_payoff_months', 0)} months if you prefer psychological wins."
            )
        else:
            recommended_strategy = "SNOWBALL"
            summary = (
                f"Debt Snowball is recommended for momentum. The interest difference is negligible "
                f"({currency} {quantize_currency(avalanche_vs_snowball_diff)}), but Snowball delivers faster initial wins by clearing "
                f"your smallest balance in {snowball_res.get('first_debt_payoff_months', 0)} months."
            )

        return {
            "currency": currency,
            "total_debt": str(quantize_currency(total_initial_principal)),
            "monthly_minimum_payment": str(quantize_currency(total_monthly_min)),
            "monthly_extra_payment": str(quantize_currency(extra_monthly_budget)),
            "debts_count": len(normalized_debts),
            "strategies": {
                "avalanche": {
                    "strategy_name": "Debt Avalanche (Highest APR First)",
                    "months_to_debt_free": avalanche_res["months_to_payoff"],
                    "years_to_debt_free": round(avalanche_res["months_to_payoff"] / 12.0, 1),
                    "total_interest_paid": str(quantize_currency(avalanche_res["total_interest_paid"])),
                    "total_amount_paid": str(quantize_currency(avalanche_res["total_amount_paid"])),
                    "interest_saved": str(quantize_currency(interest_saved_avalanche)),
                    "months_saved": months_saved_avalanche,
                    "first_debt_cleared_months": avalanche_res.get("first_debt_payoff_months", 0),
                    "payoff_order": avalanche_res["payoff_order"],
                },
                "snowball": {
                    "strategy_name": "Debt Snowball (Lowest Balance First)",
                    "months_to_debt_free": snowball_res["months_to_payoff"],
                    "years_to_debt_free": round(snowball_res["months_to_payoff"] / 12.0, 1),
                    "total_interest_paid": str(quantize_currency(snowball_res["total_interest_paid"])),
                    "total_amount_paid": str(quantize_currency(snowball_res["total_amount_paid"])),
                    "interest_saved": str(quantize_currency(interest_saved_snowball)),
                    "months_saved": months_saved_snowball,
                    "first_debt_cleared_months": snowball_res.get("first_debt_payoff_months", 0),
                    "payoff_order": snowball_res["payoff_order"],
                },
                "minimum_only": {
                    "strategy_name": "Minimum Payments Only (Baseline)",
                    "months_to_debt_free": min_only_res["months_to_payoff"],
                    "years_to_debt_free": round(min_only_res["months_to_payoff"] / 12.0, 1),
                    "total_interest_paid": str(quantize_currency(min_only_res["total_interest_paid"])),
                    "total_amount_paid": str(quantize_currency(min_only_res["total_amount_paid"])),
                    "payoff_order": min_only_res["payoff_order"],
                },
            },
            "comparison": {
                "interest_difference_snowball_vs_avalanche": str(quantize_currency(avalanche_vs_snowball_diff)),
                "months_difference_snowball_vs_avalanche": snowball_res["months_to_payoff"] - avalanche_res["months_to_payoff"],
                "max_interest_savings": str(quantize_currency(interest_saved_avalanche)),
            },
            "recommended_strategy": recommended_strategy,
            "recommendation_summary": summary,
        }

    def _simulate_strategy(
        self,
        debts: List[Dict[str, Any]],
        extra_monthly: Decimal,
        strategy: str = "AVALANCHE",
    ) -> Dict[str, Any]:
        """
        Simulates debt payoff month by month with rollover snowball acceleration.
        Caps at 360 months (30 years) to prevent infinite loops.
        """
        # Deep copy state for simulation
        state = []
        for d in debts:
            state.append({
                "id": d["id"],
                "name": d["name"],
                "balance": d["principal"],
                "apr": d["apr"],
                "monthly_rate": d["monthly_rate"],
                "min_payment": d["minimum_payment"],
                "cleared_month": None,
            })

        total_interest_accrued = Decimal("0.00")
        total_paid = Decimal("0.00")
        payoff_order = []
        first_debt_cleared_month = None

        MAX_MONTHS = 360

        for m in range(1, MAX_MONTHS + 1):
            active_debts = [d for d in state if d["balance"] > Decimal("0.00")]
            if not active_debts:
                break

            # 1. Accrue monthly interest on active debts
            month_interest = Decimal("0.00")
            for d in active_debts:
                interest = quantize_currency(d["balance"] * d["monthly_rate"])
                d["balance"] += interest
                month_interest += interest
            total_interest_accrued += month_interest

            # 2. Allocate minimum payments
            available_snowball = extra_monthly
            for d in state:
                if d["balance"] > Decimal("0.00"):
                    pay = min(d["balance"], d["min_payment"])
                    d["balance"] -= pay
                    total_paid += pay
                else:
                    # Rollover freed-up minimum payment to acceleration pool
                    available_snowball += d["min_payment"]

            # 3. Sort remaining active debts by chosen strategy priority
            unpaid = [d for d in state if d["balance"] > Decimal("0.00")]
            if strategy == "AVALANCHE":
                # Highest APR first, then lowest balance
                unpaid.sort(key=lambda x: (-x["apr"], x["balance"]))
            elif strategy == "SNOWBALL":
                # Lowest balance first, then highest APR
                unpaid.sort(key=lambda x: (x["balance"], -x["apr"]))

            # 4. Apply snowball/avalanche accelerated surplus
            for target in unpaid:
                if available_snowball <= Decimal("0.00"):
                    break
                extra_pay = min(target["balance"], available_snowball)
                target["balance"] -= extra_pay
                available_snowball -= extra_pay
                total_paid += extra_pay

            # 5. Check for debts cleared this month
            for d in state:
                if d["balance"] <= Decimal("0.00") and d["cleared_month"] is None:
                    d["cleared_month"] = m
                    payoff_order.append({
                        "id": d["id"],
                        "name": d["name"],
                        "cleared_in_month": m,
                    })
                    if first_debt_cleared_month is None:
                        first_debt_cleared_month = m

        unpaid_count = sum(1 for d in state if d["balance"] > Decimal("0.00"))
        months_taken = m - 1 if unpaid_count == 0 else MAX_MONTHS

        return {
            "months_to_payoff": months_taken,
            "total_interest_paid": total_interest_accrued,
            "total_amount_paid": total_paid,
            "first_debt_payoff_months": first_debt_cleared_month or months_taken,
            "payoff_order": payoff_order,
        }
