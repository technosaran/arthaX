"""
Financial Calculation Engine - Income Engine
Calculates total income by source, monthly & annual aggregates, recurring income,
net cash flow, savings rate, and income vs. expenditure analysis.
"""

from datetime import date
from decimal import Decimal
from typing import List, Dict, Any, Optional
from collections import defaultdict
from ..core.precision import (
    to_decimal,
    quantize_currency,
    safe_percentage,
    DEFAULT_CURRENCY,
)
from ..core.validators import parse_iso_date
from ..core.base_calculator import BaseCalculator


class IncomeEngine(BaseCalculator):
    CALCULATION_TYPE = "INCOME"

    def calculate(self, inputs: Dict[str, Any], context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Inputs:
            income_records: List of income dictionaries
            expense_records: Optional list of expense dictionaries (for cash flow analysis)
            target_month: Optional string 'YYYY-MM'
            target_year: Optional int (e.g. 2026)
            currency: Optional currency code
        """
        raw_income: List[Dict[str, Any]] = inputs.get("income_records", [])
        raw_expenses: List[Dict[str, Any]] = inputs.get("expense_records", [])
        target_month: Optional[str] = inputs.get("target_month")
        target_year: Optional[int] = inputs.get("target_year")
        preferred_currency: str = inputs.get("currency", DEFAULT_CURRENCY)

        # 1. Filter out transfer_in and deduplicate
        seen_keys = set()
        valid_incomes = []
        transfers_excluded = 0

        for inc in raw_income:
            tx_type = str(inc.get("transaction_type") or "income").lower()
            if tx_type in ("transfer_in", "transfer") or inc.get("transfer_id"):
                transfers_excluded += 1
                continue

            inc_id = inc.get("id")
            key = f"id:{inc_id}" if inc_id else f"sig:{inc.get('title')}:{inc.get('amount')}:{inc.get('received_date')}:{inc.get('account_id')}"
            if key in seen_keys:
                continue
            seen_keys.add(key)
            valid_incomes.append(inc)

        total_income = Decimal("0.00")
        source_breakdown = defaultdict(Decimal)
        source_counts = defaultdict(int)
        monthly_income = defaultdict(Decimal)
        yearly_income = defaultdict(Decimal)
        recurring_income_total = Decimal("0.00")
        recurring_count = 0

        # Active vs Passive income classification
        passive_keywords = {"dividend", "dividends", "interest", "rental", "rent", "royalty", "capital_gains", "staking", "yield", "coupon", "fd", "bonds"}
        active_income_total = Decimal("0.00")
        passive_income_total = Decimal("0.00")

        target_month_income = Decimal("0.00")
        target_year_income = Decimal("0.00")

        for inc in valid_incomes:
            amt = to_decimal(inc.get("amount", 0))
            if amt <= Decimal("0"):
                continue

            total_income += amt
            src = str(inc.get("category") or inc.get("source") or "Salary").strip()
            src_lower = src.lower()
            source_breakdown[src] += amt
            source_counts[src] += 1

            if any(k in src_lower for k in passive_keywords):
                passive_income_total += amt
            else:
                active_income_total += amt

            d_val = inc.get("received_date") or inc.get("date")
            parsed_d = parse_iso_date(d_val)
            date_str = parsed_d.isoformat() if parsed_d else date.today().isoformat()

            month_key = date_str[:7]
            year_key = date_str[:4]
            monthly_income[month_key] += amt
            yearly_income[year_key] += amt

            freq = str(inc.get("frequency") or "").lower()
            if freq in ("monthly", "weekly", "biweekly", "yearly") or inc.get("is_recurring") or inc.get("recurring_rule_id"):
                recurring_income_total += amt
                recurring_count += 1

            if target_month and date_str.startswith(target_month):
                target_month_income += amt

            if target_year and date_str.startswith(str(target_year)):
                target_year_income += amt

        # Format source breakdown
        sources_list = []
        for src, s_amt in source_breakdown.items():
            pct = safe_percentage(s_amt, total_income)
            sources_list.append({
                "source": src,
                "amount": str(quantize_currency(s_amt)),
                "count": source_counts[src],
                "percentage": float(pct),
            })
        sources_list.sort(key=lambda x: Decimal(x["amount"]), reverse=True)

        # 2. Net Cash Flow & Savings Analysis (if expenses provided)
        total_expense = Decimal("0.00")
        target_month_expense = Decimal("0.00")
        
        for exp in raw_expenses:
            tx_type = str(exp.get("transaction_type") or "expense").lower()
            if tx_type in ("transfer_out", "transfer") or exp.get("transfer_id"):
                continue
            amt = to_decimal(exp.get("amount", 0))
            if amt <= Decimal("0"):
                continue

            total_expense += amt
            d_val = exp.get("expense_date") or exp.get("transaction_date") or exp.get("date")
            parsed_d = parse_iso_date(d_val)
            date_str = parsed_d.isoformat() if parsed_d else ""
            if target_month and date_str.startswith(target_month):
                target_month_expense += amt

        net_cash_flow = total_income - total_expense
        savings_rate = safe_percentage(net_cash_flow, total_income) if total_income > 0 else Decimal("0.00")

        # Target Month Cash Flow
        target_month_net_cash_flow = target_month_income - target_month_expense
        target_month_savings_rate = safe_percentage(target_month_net_cash_flow, target_month_income) if target_month_income > 0 else Decimal("0.00")

        # Passive Income Coverage Ratio (% of expenses covered completely passively)
        passive_coverage_pct = safe_percentage(passive_income_total, total_expense) if total_expense > Decimal("0.00") else Decimal("0.00")
        is_fire_crossover = passive_coverage_pct >= Decimal("100.00")

        # Income Stability & Volatility Analysis
        month_vals = [float(v) for v in monthly_income.values()]
        if len(month_vals) >= 2:
            import math
            mean_m = sum(month_vals) / len(month_vals)
            var_m = sum((v - mean_m) ** 2 for v in month_vals) / (len(month_vals) - 1)
            std_m = math.sqrt(var_m)
            cv = (std_m / mean_m) if mean_m > 0 else 0.0
            stability_tier = "PREDICTABLE_SALARIED" if cv < 0.15 else "MODERATELY_VARIABLE" if cv <= 0.40 else "HIGHLY_IRREGULAR"
            income_volatility = {
                "coefficient_of_variation": round(cv, 3),
                "stability_tier": stability_tier,
                "average_monthly_income": str(quantize_currency(Decimal(str(round(mean_m, 2))))),
            }
        else:
            income_volatility = {
                "coefficient_of_variation": 0.0,
                "stability_tier": "SINGLE_PERIOD_BASELINE",
                "average_monthly_income": str(quantize_currency(total_income)),
            }

        return {
            "total_income": str(quantize_currency(total_income)),
            "currency": preferred_currency,
            "target_month": target_month,
            "target_month_income": str(quantize_currency(target_month_income)),
            "target_year": target_year,
            "target_year_income": str(quantize_currency(target_year_income)),
            "recurring_income_total": str(quantize_currency(recurring_income_total)),
            "recurring_income_count": recurring_count,
            "active_passive_split": {
                "active_earned_income": str(quantize_currency(active_income_total)),
                "active_percent": float(safe_percentage(active_income_total, total_income)),
                "passive_investment_income": str(quantize_currency(passive_income_total)),
                "passive_percent": float(safe_percentage(passive_income_total, total_income)),
                "passive_income_coverage_percent": float(passive_coverage_pct),
                "is_fire_crossover_achieved": is_fire_crossover,
            },
            "income_stability": income_volatility,
            "sources_breakdown": sources_list,
            "monthly_income": {k: str(quantize_currency(v)) for k, v in monthly_income.items()},
            "yearly_income": {k: str(quantize_currency(v)) for k, v in yearly_income.items()},
            "cash_flow_analysis": {
                "total_income": str(quantize_currency(total_income)),
                "total_expense": str(quantize_currency(total_expense)),
                "net_cash_flow": str(quantize_currency(net_cash_flow)),
                "savings_rate_percent": float(savings_rate),
                "is_positive_cash_flow": net_cash_flow >= Decimal("0.00"),
                "target_month_income": str(quantize_currency(target_month_income)),
                "target_month_expense": str(quantize_currency(target_month_expense)),
                "target_month_net_savings": str(quantize_currency(target_month_net_cash_flow)),
                "target_month_savings_rate_percent": float(target_month_savings_rate),
            },
            "transfers_excluded": transfers_excluded,
        }
