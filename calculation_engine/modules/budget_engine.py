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
            amt = to_decimal(exp.get("amount", 0))
            if amt > Decimal("0"):
                category_spending[cat] += amt
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
            "category_budgets": category_cards,
            "unbudgeted_categories": unbudgeted_cards,
        }
