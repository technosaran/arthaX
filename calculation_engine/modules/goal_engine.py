"""
Financial Calculation Engine - Institutional Goal-Based Wealth & Step-Up SIP Engine
Calculates future inflation-adjusted goal costs, lumpsum compounding, required standard SIP,
step-up (top-up) graduated SIP with annual increment relief, horizon-based asset allocation,
and comprehensive year-by-year amortization wealth schedules.
"""

from decimal import Decimal
import math
from typing import List, Dict, Any, Optional
from ..core.precision import (
    to_decimal,
    quantize_currency,
    quantize_rate,
    safe_divide,
    safe_percentage,
    DEFAULT_CURRENCY,
)
from ..core.base_calculator import BaseCalculator


GOAL_CATEGORY_INFLATION = {
    "education": Decimal("10.0"),    # Higher education inflation in India is ~10-12%
    "real_estate": Decimal("7.5"),   # Property and construction cost inflation
    "healthcare": Decimal("11.0"),   # Medical inflation
    "wedding": Decimal("8.0"),       # Social milestone inflation
    "vehicle": Decimal("5.0"),       # Automobile cost inflation
    "retirement": Decimal("6.0"),    # Core lifestyle inflation
    "general": Decimal("6.0"),       # General CPI baseline
}


class GoalWealthEngine(BaseCalculator):
    CALCULATION_TYPE = "GOAL_PLANNER"

    def calculate(self, inputs: Dict[str, Any], context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Inputs:
            goal_name: str (e.g. "Dream Villa", "Child Oxford Degree")
            target_amount_today: float/Decimal (current cost of the goal)
            horizon_years: int/float (years until goal needs to be funded)
            current_savings: Optional float/Decimal (existing corpus allocated, default 0)
            category: Optional str ("education", "real_estate", "healthcare", "wedding", "vehicle", "retirement", "general")
            custom_inflation_pct: Optional float/Decimal (overrides category default)
            custom_expected_return_pct: Optional float/Decimal (overrides recommended asset mix return)
            annual_step_up_pct: Optional float/Decimal (e.g. 10.0 for 10% annual SIP step-up, default 10.0)
            currency: Optional str (default INR)
        """
        goal_name = str(inputs.get("goal_name") or "Financial Goal").strip()
        category = str(inputs.get("category") or "general").lower().strip()
        horizon_years = max(1, int(round(float(inputs.get("horizon_years", 5)))))
        currency = str(inputs.get("currency", DEFAULT_CURRENCY))

        target_today = max(Decimal("0.00"), to_decimal(inputs.get("target_amount_today", 0)))
        current_corpus = max(Decimal("0.00"), to_decimal(inputs.get("current_savings", 0)))

        # 1. Resolve Inflation Rate
        if "custom_inflation_pct" in inputs and inputs["custom_inflation_pct"] is not None:
            inflation_rate_pct = max(Decimal("0.0"), to_decimal(inputs["custom_inflation_pct"]))
        else:
            inflation_rate_pct = GOAL_CATEGORY_INFLATION.get(category, Decimal("6.0"))

        inf_rate = float(inflation_rate_pct) / 100.0

        # 2. Recommended Asset Mix & Expected Portfolio Return
        if horizon_years < 3:
            recommended_mix = {
                "equity_pct": 0.0,
                "debt_pct": 80.0,
                "liquid_pct": 20.0,
                "strategy": "Capital Preservation & Extreme Liquidity",
                "default_return_pct": 6.8,
            }
        elif horizon_years <= 7:
            recommended_mix = {
                "equity_pct": 55.0,
                "debt_pct": 35.0,
                "gold_pct": 10.0,
                "strategy": "Balanced Multi-Asset Hybrid",
                "default_return_pct": 10.2,
            }
        else:
            recommended_mix = {
                "equity_pct": 75.0,
                "debt_pct": 15.0,
                "gold_pct": 10.0,
                "strategy": "Aggressive Long-Term Compounder",
                "default_return_pct": 12.5,
            }

        if "custom_expected_return_pct" in inputs and inputs["custom_expected_return_pct"] is not None:
            expected_return_pct = max(Decimal("0.0"), to_decimal(inputs["custom_expected_return_pct"]))
        else:
            expected_return_pct = to_decimal(recommended_mix["default_return_pct"])

        nom_return = float(expected_return_pct) / 100.0

        # Step-Up Rate
        step_up_pct = max(Decimal("0.0"), to_decimal(inputs.get("annual_step_up_pct", 10.0)))
        g_step = float(step_up_pct) / 100.0

        target_today_f = float(target_today)
        current_corpus_f = float(current_corpus)

        # 3. Future Inflated Target Cost
        # FV_goal = PV * (1 + i)^t
        future_target_cost = target_today_f * math.pow(1.0 + inf_rate, horizon_years)

        # 4. Future Value of Existing Savings
        # FV_corpus = PV * (1 + r)^t
        future_lumpsum_value = current_corpus_f * math.pow(1.0 + nom_return, horizon_years)

        # Net Shortfall needed to be accumulated via SIP
        shortfall = max(0.0, future_target_cost - future_lumpsum_value)
        is_already_funded = (future_lumpsum_value >= future_target_cost) and (future_target_cost > 0)

        # 5. Standard Monthly SIP Calculation
        # FV = PMT * [((1 + r_m)^n - 1) / r_m] * (1 + r_m)  (annuity due - beginning of month)
        n_months = horizon_years * 12
        r_monthly = nom_return / 12.0

        if shortfall <= 0.0:
            standard_monthly_sip = 0.0
            step_up_starting_sip = 0.0
            step_up_unit_factor = 1.0
        elif r_monthly > 0:
            growth_factor = math.pow(1.0 + r_monthly, n_months)
            annuity_due_factor = ((growth_factor - 1.0) / r_monthly) * (1.0 + r_monthly)
            standard_monthly_sip = shortfall / annuity_due_factor
        else:
            standard_monthly_sip = shortfall / n_months

        # 6. Step-Up SIP (Top-Up) Calculation
        # In Year 1: SIP = S_0
        # In Year 2: SIP = S_0 * (1 + g)
        # In Year y: SIP = S_0 * (1 + g)^(y-1)
        # We simulate accumulation with unit S_0 = 1.0 to find the exact multiplier:
        accumulated_from_unit = 0.0
        if shortfall > 0.0:
            unit_balance = 0.0
            for m in range(n_months):
                year_idx = m // 12
                unit_monthly_payment = math.pow(1.0 + g_step, year_idx)
                # Invest at start of month
                unit_balance += unit_monthly_payment
                # Earn monthly interest
                unit_balance *= (1.0 + r_monthly)
            accumulated_from_unit = unit_balance
            step_up_starting_sip = (shortfall / accumulated_from_unit) if accumulated_from_unit > 0 else standard_monthly_sip
        else:
            step_up_starting_sip = 0.0

        # Starting Burden Reduction
        if standard_monthly_sip > 0:
            sip_reduction_amount = max(0.0, standard_monthly_sip - step_up_starting_sip)
            sip_reduction_pct = (sip_reduction_amount / standard_monthly_sip) * 100.0
        else:
            sip_reduction_amount = 0.0
            sip_reduction_pct = 0.0

        # 7. Year-by-Year Amortization Schedule (Step-Up Trajectory)
        amortization_schedule: List[Dict[str, Any]] = []
        running_corpus = current_corpus_f
        total_sip_invested = 0.0

        for year in range(1, horizon_years + 1):
            opening_balance = running_corpus
            monthly_sip_this_year = step_up_starting_sip * math.pow(1.0 + g_step, year - 1)
            annual_sip_contribution = 0.0
            year_returns_earned = 0.0

            # Simulate month by month for exact compounding
            for m in range(12):
                running_corpus += monthly_sip_this_year
                annual_sip_contribution += monthly_sip_this_year
                total_sip_invested += monthly_sip_this_year

                month_growth = running_corpus * r_monthly
                running_corpus += month_growth
                year_returns_earned += month_growth

            closing_balance = running_corpus
            progress_pct = min(100.0, (closing_balance / future_target_cost) * 100.0) if future_target_cost > 0 else 100.0

            amortization_schedule.append({
                "year": year,
                "monthly_sip": round(monthly_sip_this_year, 2),
                "annual_contribution": round(annual_sip_contribution, 2),
                "opening_balance": round(opening_balance, 2),
                "returns_earned": round(year_returns_earned, 2),
                "closing_balance": round(closing_balance, 2),
                "cumulative_invested": round(current_corpus_f + total_sip_invested, 2),
                "progress_percent": round(progress_pct, 1),
            })

        # Feasibility classification
        if is_already_funded:
            status = "ALREADY_FUNDED"
            feasibility_note = "Your existing corpus is projected to outgrow the goal cost without additional monthly savings!"
        elif standard_monthly_sip <= 10000.0:
            status = "HIGHLY_FEASIBLE"
            feasibility_note = "Goal is comfortably achievable with modest monthly savings discipline."
        elif step_up_starting_sip <= 35000.0:
            status = "FEASIBLE_WITH_STEP_UP"
            feasibility_note = "Achievable by adopting a Step-Up SIP matching your annual compensation revisions."
        else:
            status = "AMBITIOUS"
            feasibility_note = "Requires strategic wealth allocation, aggressive savings rate, or extending the horizon."

        return {
            "goal_name": goal_name,
            "category": category,
            "currency": currency,
            "horizon_years": horizon_years,
            "valuation": {
                "target_today": round(target_today_f, 2),
                "future_target_cost": round(future_target_cost, 2),
                "inflation_rate_percent": float(inflation_rate_pct),
                "current_savings_allocated": round(current_corpus_f, 2),
                "future_value_of_current_savings": round(future_lumpsum_value, 2),
                "net_shortfall_to_accumulate": round(shortfall, 2),
                "is_already_funded": is_already_funded,
            },
            "sip_strategies": {
                "standard_fixed_sip": {
                    "monthly_sip": round(standard_monthly_sip, 2),
                    "total_invested": round(standard_monthly_sip * n_months, 2),
                    "wealth_created": round(future_target_cost, 2),
                },
                "step_up_sip": {
                    "annual_step_up_percent": float(step_up_pct),
                    "initial_monthly_sip": round(step_up_starting_sip, 2),
                    "total_invested": round(total_sip_invested, 2),
                    "starting_burden_relief_percent": round(sip_reduction_pct, 1),
                    "monthly_savings_in_year_one": round(sip_reduction_amount, 2),
                },
            },
            "recommended_asset_allocation": {
                "strategy": recommended_mix["strategy"],
                "equity_percent": recommended_mix["equity_pct"],
                "debt_percent": recommended_mix["debt_pct"],
                "gold_percent": recommended_mix.get("gold_pct", 0.0),
                "liquid_percent": recommended_mix.get("liquid_pct", 0.0),
                "expected_cagr_percent": float(expected_return_pct),
            },
            "feasibility": {
                "status": status,
                "note": feasibility_note,
            },
            "amortization_schedule": amortization_schedule,
        }
