"""
Financial Calculation Engine - Budget Engine
Calculates budget utilization, remaining margins, overspending detection,
category-wise tracking, monthly rollovers, and budget vs actual comparisons.
"""

from decimal import Decimal
from typing import List, Dict, Any, Optional
from collections import defaultdict
from ..core.precision import (
    to_decimal,
    quantize_currency,
    safe_divide,
    safe_percentage,
    DEFAULT_CURRENCY,
)
from ..core.base_calculator import BaseCalculator


class BudgetEngine(BaseCalculator):
    CALCULATION_TYPE = "BUDGET"

    def calculate(self, inputs: Dict[str, Any], context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Inputs:
            budgets: List of budget records [{ category, amount, month_year, alert_threshold }]
            expenses: List of expense records [{ category, amount, expense_date }]
            target_month: Target month 'YYYY-MM'
            currency: Optional currency code
            rollover_enabled: bool
        """
        raw_budgets: List[Dict[str, Any]] = inputs.get("budgets", [])
        raw_expenses: List[Dict[str, Any]] = inputs.get("expenses", [])
        target_month: Optional[str] = inputs.get("target_month")
        preferred_currency: str = inputs.get("currency", DEFAULT_CURRENCY)
        rollover_enabled: bool = inputs.get("rollover_enabled", False)

        # 1. Aggregate expenses by category for target month
        category_spending = defaultdict(Decimal)
        category_expense_counts = defaultdict(int)

        for exp in raw_expenses:
            # Skip internal transfers
            tx_type = str(exp.get("transaction_type") or "expense").lower()
            if tx_type in ("transfer_out", "transfer") or exp.get("transfer_id"):
                continue

            d_str = str(exp.get("expense_date") or exp.get("transaction_date") or "")
            if target_month and not d_str.startswith(target_month):
                continue

            cat = str(exp.get("category") or "Other").strip()
            amt_raw = to_decimal(exp.get("amount", 0))
            if amt_raw == Decimal("0"):
                continue

            is_refund = (
                amt_raw < Decimal("0")
                or tx_type in ("refund", "refund_payout", "reversal")
                or "refund" in str(exp.get("title", "")).lower()
            )

            if is_refund:
                category_spending[cat] -= abs(amt_raw)
            else:
                category_spending[cat] += abs(amt_raw)
                category_expense_counts[cat] += 1

        # 2. Evaluate each budgeted category
        total_budgeted = Decimal("0.00")
        total_spent_in_budgeted_categories = Decimal("0.00")
        total_overspent_amount = Decimal("0.00")
        overspent_categories_count = 0
        warning_categories_count = 0
        on_track_categories_count = 0

        category_cards = []
        processed_categories = set()

        for b in raw_budgets:
            b_month = str(b.get("month_year") or "")
            if target_month and b_month and b_month != target_month:
                continue

            cat = str(b.get("category") or "Other").strip()
            processed_categories.add(cat.lower())

            budget_amt = to_decimal(b.get("amount", 0))
            spent_amt = category_spending.get(cat, Decimal("0.00"))
            threshold = int(b.get("alert_threshold") or 80)

            total_budgeted += budget_amt
            total_spent_in_budgeted_categories += spent_amt

            remaining = budget_amt - spent_amt
            percent_used = safe_percentage(spent_amt, budget_amt) if budget_amt > Decimal("0") else Decimal("0.00")

            is_over = spent_amt > budget_amt
            is_warning = not is_over and percent_used >= Decimal(threshold)

            if is_over:
                overspent_categories_count += 1
                total_overspent_amount += (spent_amt - budget_amt)
            elif is_warning:
                warning_categories_count += 1
            else:
                on_track_categories_count += 1

            category_cards.append({
                "category": cat,
                "budget_amount": str(quantize_currency(budget_amt)),
                "spent_amount": str(quantize_currency(spent_amt)),
                "remaining_amount": str(quantize_currency(remaining)),
                "utilization_percent": float(percent_used),
                "alert_threshold": threshold,
                "is_over_budget": is_over,
                "is_warning": is_warning,
                "overspent_amount": str(quantize_currency(spent_amt - budget_amt)) if is_over else "0.00",
                "expense_count": category_expense_counts.get(cat, 0),
            })

        # 3. Identify unbudgeted categories with expenses
        unbudgeted_cards = []
        unbudgeted_total_spent = Decimal("0.00")

        for cat, spent_amt in category_spending.items():
            if cat.lower() not in processed_categories:
                unbudgeted_total_spent += spent_amt
                unbudgeted_cards.append({
                    "category": cat,
                    "budget_amount": "0.00",
                    "spent_amount": str(quantize_currency(spent_amt)),
                    "remaining_amount": str(quantize_currency(-spent_amt)),
                    "utilization_percent": 100.0,
                    "alert_threshold": 80,
                    "is_over_budget": True,
                    "is_warning": False,
                    "overspent_amount": str(quantize_currency(spent_amt)),
                    "expense_count": category_expense_counts.get(cat, 0),
                    "is_unbudgeted": True,
                })

        # Global Portfolio Utilization
        total_actual_spent = total_spent_in_budgeted_categories + unbudgeted_total_spent
        total_remaining = total_budgeted - total_spent_in_budgeted_categories
        overall_utilization = safe_percentage(total_spent_in_budgeted_categories, total_budgeted) if total_budgeted > Decimal("0") else Decimal("0.00")

        # 4. Monthly Rollover calculation (surplus from under-spent categories)
        rollover_surplus = Decimal("0.00")
        if rollover_enabled:
            for item in category_cards:
                rem = Decimal(item["remaining_amount"])
                if rem > Decimal("0.00"):
                    rollover_surplus += rem

        # 5. Pacing Velocity & Month-End Burn Projection
        pacing_index = Decimal("1.00")
        month_elapsed_percent = Decimal("0.00")
        projected_month_end_spend = total_actual_spent
        safe_daily_allowance = Decimal("0.00")
        days_in_month = 30
        days_elapsed = 15
        days_remaining = 15

        if target_month:
            try:
                from datetime import date, timedelta
                y_num, m_num = map(int, target_month.split("-"))
                if m_num == 12:
                    next_month_start = date(y_num + 1, 1, 1)
                else:
                    next_month_start = date(y_num, m_num + 1, 1)
                days_in_month = (next_month_start - timedelta(days=1)).day
                today = date.today()
                is_curr_m = (today.year == y_num and today.month == m_num)
                days_elapsed = today.day if is_curr_m else days_in_month
                days_remaining = max(1, days_in_month - days_elapsed)

                month_elapsed_percent = safe_percentage(Decimal(days_elapsed), Decimal(days_in_month))
                # Pacing Index = % Budget Used / % Month Elapsed
                if month_elapsed_percent > Decimal("0.00"):
                    pacing_index = safe_divide(overall_utilization, month_elapsed_percent)

                # Month-end burn projection
                daily_burn = safe_divide(total_actual_spent, Decimal(max(1, days_elapsed)))
                projected_month_end_spend = quantize_currency(daily_burn * Decimal(days_in_month))

                # Safe daily allowance for remaining days
                if total_remaining > Decimal("0.00") and days_remaining > 0:
                    safe_daily_allowance = quantize_currency(safe_divide(total_remaining, Decimal(days_remaining)))
            except Exception:
                pass

        pacing_status = "ON_TRACK"
        if pacing_index > Decimal("1.25"):
            pacing_status = "OVERPACING_BURNING_FAST"
        elif pacing_index < Decimal("0.75"):
            pacing_status = "UNDERPACING_THRIFTY"

        # 6. 50/30/20 Budget Rule Categorization
        needs_cats = {"groceries", "grocery", "rent", "utilities", "bills", "electricity", "water", "gas", "health", "medical", "insurance", "education", "emi", "fuel", "commute", "maintenance"}
        savings_cats = {"savings", "investment", "sip", "stocks", "mutual_fund", "emergency", "ppf", "nps"}
        
        needs_budgeted = Decimal("0.00")
        wants_budgeted = Decimal("0.00")
        savings_budgeted = Decimal("0.00")

        for card in category_cards:
            b_val = Decimal(card["budget_amount"])
            c_name = card["category"].lower()
            if any(k in c_name for k in needs_cats):
                needs_budgeted += b_val
            elif any(k in c_name for k in savings_cats):
                savings_budgeted += b_val
            else:
                wants_budgeted += b_val

        category_cards.sort(key=lambda x: x["utilization_percent"], reverse=True)

        return {
            "target_month": target_month,
            "currency": preferred_currency,
            "total_budgeted": str(quantize_currency(total_budgeted)),
            "total_spent_budgeted": str(quantize_currency(total_spent_in_budgeted_categories)),
            "total_actual_spent": str(quantize_currency(total_actual_spent)),
            "unbudgeted_spent": str(quantize_currency(unbudgeted_total_spent)),
            "remaining_budget": str(quantize_currency(total_remaining)),
            "overall_utilization_percent": float(overall_utilization),
            "is_overall_over_budget": total_spent_in_budgeted_categories > total_budgeted,
            "total_overspent_amount": str(quantize_currency(total_overspent_amount)),
            "overspent_categories_count": overspent_categories_count,
            "warning_categories_count": warning_categories_count,
            "on_track_categories_count": on_track_categories_count,
            "rollover_surplus_available": str(quantize_currency(rollover_surplus)),
            "pacing_analytics": {
                "days_in_month": days_in_month,
                "days_elapsed": days_elapsed,
                "days_remaining": days_remaining,
                "month_elapsed_percent": float(month_elapsed_percent),
                "pacing_index": float(round(pacing_index, 2)),
                "pacing_status": pacing_status,
                "projected_month_end_spend": str(projected_month_end_spend),
                "safe_daily_allowance_remaining": str(safe_daily_allowance),
            },
            "rule_50_30_20_allocation": {
                "needs_budgeted": str(quantize_currency(needs_budgeted)),
                "needs_percent": float(safe_percentage(needs_budgeted, total_budgeted)),
                "wants_budgeted": str(quantize_currency(wants_budgeted)),
                "wants_percent": float(safe_percentage(wants_budgeted, total_budgeted)),
                "savings_budgeted": str(quantize_currency(savings_budgeted)),
                "savings_percent": float(safe_percentage(savings_budgeted, total_budgeted)),
            },
            "category_budgets": category_cards,
            "unbudgeted_categories": unbudgeted_cards,
        }
