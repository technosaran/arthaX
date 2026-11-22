"""
Financial Calculation Engine - Expense Engine
Calculates daily, weekly, monthly, yearly aggregations, category breakdowns,
averages, recurring trends, refunds, reversals, and internal transfer exclusions.
"""

from datetime import date, timedelta
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
from ..core.validators import parse_iso_date
from ..core.base_calculator import BaseCalculator


def is_transfer_or_reversal(tx: Dict[str, Any]) -> bool:
    """Checks if a transaction is an internal transfer, family support, or account transfer."""
    tx_type = str(tx.get("transaction_type") or "").lower()
    if tx_type in ("transfer_out", "transfer_in", "transfer"):
        return True

    if tx.get("transfer_id"):
        return True

    # Check tags
    tags = tx.get("tags") or []
    if any(t.lower() in ("family", "family_support", "transfer", "internal_transfer") for t in tags):
        return True

    # Check title / notes
    title = str(tx.get("title") or "").lower()
    notes = str(tx.get("notes") or "").lower()
    if "money sent to" in title or "family support transfer" in notes or "family allowance" in notes:
        return True

    return False


class ExpenseEngine(BaseCalculator):
    CALCULATION_TYPE = "EXPENSE"

    def calculate(self, inputs: Dict[str, Any], context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Inputs:
            transactions: List of transaction dictionaries
            target_month: Optional string 'YYYY-MM'
            target_year: Optional int (e.g. 2026)
            currency: Optional currency code
        """
        raw_txs: List[Dict[str, Any]] = inputs.get("transactions", [])
        target_month: Optional[str] = inputs.get("target_month")
        target_year: Optional[int] = inputs.get("target_year")
        preferred_currency: str = inputs.get("currency", DEFAULT_CURRENCY)

        # 1. Deduplicate transactions by unique ID or signature
        seen_keys = set()
        unique_txs = []
        duplicate_count = 0

        for tx in raw_txs:
            tx_id = tx.get("id")
            if tx_id:
                key = f"id:{tx_id}"
            else:
                key = f"sig:{tx.get('title')}:{tx.get('amount')}:{tx.get('transaction_date') or tx.get('expense_date')}:{tx.get('account_id')}"
            
            if key in seen_keys:
                duplicate_count += 1
                continue
            seen_keys.add(key)
            unique_txs.append(tx)

        # 2. Filter out internal transfers
        spending_txs = []
        transfers_excluded_count = 0
        transfers_excluded_amount = Decimal("0.00")

        for tx in unique_txs:
            if is_transfer_or_reversal(tx):
                transfers_excluded_count += 1
                transfers_excluded_amount += to_decimal(tx.get("amount", 0))
                continue
            spending_txs.append(tx)

        # 3. Categorize into normal expenses, refunds, and reversals
        # Positive expenses add to total, refunds/reversals deduct from total
        total_gross_expense = Decimal("0.00")
        total_refunds = Decimal("0.00")
        category_totals = defaultdict(Decimal)
        category_counts = defaultdict(int)
        daily_totals = defaultdict(Decimal)
        monthly_totals = defaultdict(Decimal)
        yearly_totals = defaultdict(Decimal)
        recurring_totals = Decimal("0.00")
        recurring_count = 0

        # Day-of-week and weekend tracking (0 = Monday, ..., 6 = Sunday)
        day_of_week_totals = defaultdict(Decimal)
        day_of_week_counts = defaultdict(int)
        weekend_spending = Decimal("0.00")
        weekday_spending = Decimal("0.00")

        # Mandatory vs Discretionary tracking
        mandatory_categories = {
            "groceries", "grocery", "rent", "utilities", "bills", "bill", "electricity",
            "water", "gas", "health", "healthcare", "medical", "pharmacy", "insurance",
            "education", "school", "tuition", "emi", "loan", "maintenance", "fuel",
            "commute", "transport", "tax", "taxes"
        }
        mandatory_spending = Decimal("0.00")
        discretionary_spending = Decimal("0.00")

        valid_tx_amounts = []

        earliest_date: Optional[date] = None
        latest_date: Optional[date] = None

        target_month_expenses = Decimal("0.00")
        target_year_expenses = Decimal("0.00")

        for tx in spending_txs:
            amt_raw = to_decimal(tx.get("amount", 0))
            if amt_raw == Decimal("0"):
                continue

            amt = abs(amt_raw)
            d_val = tx.get("transaction_date") or tx.get("expense_date")
            parsed_d = parse_iso_date(d_val)
            date_str = parsed_d.isoformat() if parsed_d else date.today().isoformat()

            if parsed_d:
                if earliest_date is None or parsed_d < earliest_date:
                    earliest_date = parsed_d
                if latest_date is None or parsed_d > latest_date:
                    latest_date = parsed_d

                # Track day of week
                weekday_idx = parsed_d.weekday()
                day_name = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][weekday_idx]
                day_of_week_totals[day_name] += amt
                day_of_week_counts[day_name] += 1
                if weekday_idx in (5, 6):
                    weekend_spending += amt
                else:
                    weekday_spending += amt

            cat = str(tx.get("category") or "Other").strip()
            cat_lower = cat.lower()
            tx_type = str(tx.get("transaction_type") or "expense").lower()

            is_refund = (
                amt_raw < Decimal("0")
                or tx_type in ("refund", "refund_payout", "reversal")
                or "refund" in str(tx.get("title", "")).lower()
            )

            if is_refund:
                total_refunds += amt
                category_totals[cat] -= amt
                daily_totals[date_str] -= amt
                month_key = date_str[:7]
                monthly_totals[month_key] -= amt
                year_key = date_str[:4]
                yearly_totals[year_key] -= amt

                if target_month and date_str.startswith(target_month):
                    target_month_expenses -= amt

                if target_year and date_str.startswith(str(target_year)):
                    target_year_expenses -= amt
            else:
                total_gross_expense += amt
                category_totals[cat] += amt
                category_counts[cat] += 1
                daily_totals[date_str] += amt
                month_key = date_str[:7]
                monthly_totals[month_key] += amt
                year_key = date_str[:4]
                yearly_totals[year_key] += amt

                valid_tx_amounts.append((amt, tx))

                if cat_lower in mandatory_categories:
                    mandatory_spending += amt
                else:
                    discretionary_spending += amt

                if tx.get("is_recurring") or tx.get("recurring_rule_id"):
                    recurring_totals += amt
                    recurring_count += 1

                if target_month and date_str.startswith(target_month):
                    target_month_expenses += amt

                if target_year and date_str.startswith(str(target_year)):
                    target_year_expenses += amt

        # Net Expense = Gross - Refunds
        total_net_expense = max(Decimal("0.00"), total_gross_expense - total_refunds)

        # 4. Category breakdown with percentages
        category_breakdown = []
        for cat, cat_amt in category_totals.items():
            net_cat_amt = max(Decimal("0.00"), cat_amt)
            pct = safe_percentage(net_cat_amt, total_net_expense)
            category_breakdown.append({
                "category": cat,
                "amount": str(quantize_currency(net_cat_amt)),
                "count": category_counts[cat],
                "percentage": float(pct),
            })
        category_breakdown.sort(key=lambda x: Decimal(x["amount"]), reverse=True)

        # 5. Averages: Daily and Monthly
        # Calculate active span of days
        days_span = 1
        if earliest_date and latest_date:
            days_span = max(1, (latest_date - earliest_date).days + 1)
        
        average_daily_expense = quantize_currency(safe_divide(total_net_expense, Decimal(days_span)))

        distinct_months_count = max(1, len(monthly_totals))
        average_monthly_expense = quantize_currency(safe_divide(total_net_expense, Decimal(distinct_months_count)))

        # Target month velocity (if requested)
        target_month_daily_average = Decimal("0.00")
        target_month_projected = Decimal("0.00")
        if target_month:
            try:
                y_num, m_num = map(int, target_month.split("-"))
                # Days in target month
                if m_num == 12:
                    next_month_start = date(y_num + 1, 1, 1)
                else:
                    next_month_start = date(y_num, m_num + 1, 1)
                last_day_of_month = (next_month_start - timedelta(days=1)).day
                
                today = date.today()
                is_current = (today.year == y_num and today.month == m_num)
                days_elapsed = today.day if is_current else last_day_of_month

                target_month_daily_average = quantize_currency(
                    safe_divide(target_month_expenses, Decimal(max(1, days_elapsed)))
                )
                target_month_projected = quantize_currency(target_month_daily_average * Decimal(last_day_of_month))
            except Exception:
                pass

        # 6. Statistical Outlier / Spike Detection
        outliers = []
        if len(valid_tx_amounts) >= 3:
            sorted_amts = sorted([a[0] for a in valid_tx_amounts])
            q1_idx = len(sorted_amts) // 4
            q1_amt = sorted_amts[q1_idx]
            median_amt = sorted_amts[len(sorted_amts) // 2]
            # Anomaly threshold: 2.5x median or 3x Q1 baseline (minimum ₹1,000)
            baseline = q1_amt if q1_amt > Decimal("0.00") else median_amt
            outlier_threshold = max(Decimal("1000.00"), min(median_amt * Decimal("2.50"), baseline * Decimal("3.00")))
            for amt, tx in valid_tx_amounts:
                if amt >= outlier_threshold:
                    outliers.append({
                        "id": str(tx.get("id") or ""),
                        "title": str(tx.get("title") or "Transaction"),
                        "amount": str(quantize_currency(amt)),
                        "date": str(tx.get("transaction_date") or tx.get("expense_date") or ""),
                        "category": str(tx.get("category") or "Other"),
                        "spike_multiplier": float(round(safe_divide(amt, baseline), 1)) if baseline > Decimal("0") else 3.0,
                    })

        # 7. Month-over-Month (MoM) Growth
        mom_growth = []
        sorted_month_keys = sorted(monthly_totals.keys())
        for i in range(1, len(sorted_month_keys)):
            prev_m = sorted_month_keys[i - 1]
            curr_m = sorted_month_keys[i]
            prev_val = monthly_totals[prev_m]
            curr_val = monthly_totals[curr_m]
            pct_change = safe_percentage(curr_val - prev_val, prev_val) if prev_val > Decimal("0") else Decimal("0.00")
            mom_growth.append({
                "from_month": prev_m,
                "to_month": curr_m,
                "previous_amount": str(quantize_currency(prev_val)),
                "current_amount": str(quantize_currency(curr_val)),
                "growth_percent": float(pct_change),
                "is_increased": curr_val > prev_val,
            })

        mandatory_pct = safe_percentage(mandatory_spending, total_net_expense) if total_net_expense > Decimal("0") else Decimal("0.00")
        discretionary_pct = safe_percentage(discretionary_spending, total_net_expense) if total_net_expense > Decimal("0") else Decimal("0.00")

        return {
            "total_gross_expense": str(quantize_currency(total_gross_expense)),
            "total_refunds": str(quantize_currency(total_refunds)),
            "total_net_expense": str(quantize_currency(total_net_expense)),
            "currency": preferred_currency,
            "average_daily_expense": str(average_daily_expense),
            "average_monthly_expense": str(average_monthly_expense),
            "target_month": target_month,
            "target_month_expenses": str(quantize_currency(target_month_expenses)),
            "target_month_daily_average": str(target_month_daily_average),
            "target_month_projected": str(target_month_projected),
            "target_year": target_year,
            "target_year_expenses": str(quantize_currency(target_year_expenses)),
            "recurring_expense_total": str(quantize_currency(recurring_totals)),
            "recurring_expense_count": recurring_count,
            "duplicate_transactions_prevented": duplicate_count,
            "internal_transfers_excluded": transfers_excluded_count,
            "transfers_excluded_amount": str(quantize_currency(transfers_excluded_amount)),
            "total_analyzed_transactions": len(raw_txs),
            "valid_spending_transactions": len(spending_txs),
            "category_breakdown": category_breakdown,
            "monthly_totals": {k: str(quantize_currency(v)) for k, v in monthly_totals.items()},
            "yearly_totals": {k: str(quantize_currency(v)) for k, v in yearly_totals.items()},
            "spending_behavior": {
                "mandatory_needs_total": str(quantize_currency(mandatory_spending)),
                "mandatory_needs_percent": float(mandatory_pct),
                "discretionary_wants_total": str(quantize_currency(discretionary_spending)),
                "discretionary_wants_percent": float(discretionary_pct),
                "weekend_spending_total": str(quantize_currency(weekend_spending)),
                "weekday_spending_total": str(quantize_currency(weekday_spending)),
                "weekend_spending_percent": float(safe_percentage(weekend_spending, total_net_expense)),
                "day_of_week_distribution": {k: str(quantize_currency(v)) for k, v in day_of_week_totals.items()},
            },
            "statistical_outliers": outliers[:10],
            "month_over_month_velocity": mom_growth,
        }
