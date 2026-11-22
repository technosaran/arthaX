"""
Financial Calculation Engine - FIRE (Financial Independence, Retire Early) & Wealth Runway Engine
Calculates LeanFIRE, Standard FIRE, FatFIRE, CoastFIRE targets, years to financial freedom,
and Monte Carlo retirement sequence-of-returns survival probabilities.
"""

from decimal import Decimal
import math
from typing import Dict, Any, Optional
from ..core.precision import (
    to_decimal,
    safe_percentage,
    DEFAULT_CURRENCY,
)
from ..core.base_calculator import BaseCalculator


class FireEngine(BaseCalculator):
    CALCULATION_TYPE = "FIRE"

    def calculate(self, inputs: Dict[str, Any], context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Inputs:
            current_net_worth: float/Decimal (current invested corpus)
            annual_expenses: float/Decimal (current annual expenses)
            annual_savings: float/Decimal (annual savings added to corpus)
            current_age: int (default: 30)
            target_retirement_age: int (default: 50)
            expected_annual_return_pct: float (nominal return, default: 11.0%)
            expected_inflation_pct: float (default: 6.0%)
            safe_withdrawal_rate_pct: float (default: 3.5%)
            currency: string (default: INR)
        """
        current_nw = to_decimal(inputs.get("current_net_worth", 0))
        annual_exp = to_decimal(inputs.get("annual_expenses", 0))
        annual_sav = to_decimal(inputs.get("annual_savings", 0))
        current_age = int(inputs.get("current_age", 30))
        target_ret_age = int(inputs.get("target_retirement_age", 50))
        
        nom_return_pct = to_decimal(inputs.get("expected_annual_return_pct", "11.0"))
        inflation_pct = to_decimal(inputs.get("expected_inflation_pct", "6.0"))
        swr_pct = to_decimal(inputs.get("safe_withdrawal_rate_pct", "3.5"))
        currency = str(inputs.get("currency", DEFAULT_CURRENCY))

        # Real rate of return: r_real = (1 + r_nom) / (1 + i) - 1
        nom_r = float(nom_return_pct) / 100.0
        inf_r = float(inflation_pct) / 100.0
        real_r = ((1.0 + nom_r) / (1.0 + inf_r)) - 1.0
        swr = float(swr_pct) / 100.0 if float(swr_pct) > 0 else 0.035

        ann_exp_f = float(annual_exp)
        ann_sav_f = float(annual_sav)
        current_nw_f = float(current_nw)

        # 1. FIRE Targets (Annual Expense Multipliers)
        # LeanFIRE: 75% of expenses at 4% SWR (25x)
        lean_fire_target = (ann_exp_f * 0.75) / 0.04 if ann_exp_f > 0 else 0.0
        # Standard FIRE: 100% of expenses at chosen SWR (e.g. 1 / 0.035 = 28.57x)
        standard_fire_target = ann_exp_f / swr if (ann_exp_f > 0 and swr > 0) else 0.0
        # FatFIRE: 140% of expenses at 3.3% SWR (~30.3x)
        fat_fire_target = (ann_exp_f * 1.40) / 0.033 if ann_exp_f > 0 else 0.0

        # CoastFIRE: Corpus required today to grow to standard FIRE target by age 60 without any further savings
        years_to_60 = max(1, 60 - current_age)
        coast_fire_target = standard_fire_target / math.pow(1.0 + real_r, years_to_60) if real_r > -1.0 else 0.0
        is_coast_fire_achieved = current_nw_f >= coast_fire_target

        # 2. Years to Standard FIRE Projection
        # FV = PV*(1+r)^t + PMT * [((1+r)^t - 1) / r]
        years_to_fire = None
        if standard_fire_target > 0:
            if current_nw_f >= standard_fire_target:
                years_to_fire = 0.0
            elif real_r > 0:
                # Numerical / Analytical solution for t:
                # standard_fire = PV*(1+r)^t + PMT * ((1+r)^t - 1) / r
                # standard_fire + PMT/r = (PV + PMT/r) * (1+r)^t
                # t = ln( (standard_fire + PMT/r) / (PV + PMT/r) ) / ln(1+r)
                pmt_over_r = ann_sav_f / real_r
                numerator = standard_fire_target + pmt_over_r
                denominator = current_nw_f + pmt_over_r
                if denominator > 0 and numerator > denominator:
                    try:
                        years_to_fire = round(math.log(numerator / denominator) / math.log(1.0 + real_r), 1)
                    except (ValueError, ZeroDivisionError):
                        years_to_fire = None
            elif ann_sav_f > 0:
                years_to_fire = round((standard_fire_target - current_nw_f) / ann_sav_f, 1)

        projected_fire_age = (current_age + int(round(years_to_fire))) if years_to_fire is not None else None

        # 3. Savings Rate Sensitivity Analysis
        total_income_est = ann_exp_f + ann_sav_f
        current_savings_rate = safe_percentage(to_decimal(ann_sav_f), to_decimal(total_income_est)) if total_income_est > 0 else Decimal("0.0")
        
        sensitivity_milestones = []
        for delta_pct in [5, 10, 15]:
            boosted_sav = ann_sav_f + (total_income_est * (delta_pct / 100.0))
            if real_r > 0 and standard_fire_target > 0:
                pmt_over_r = boosted_sav / real_r
                num = standard_fire_target + pmt_over_r
                den = current_nw_f + pmt_over_r
                if den > 0 and num > den:
                    boosted_years = round(math.log(num / den) / math.log(1.0 + real_r), 1)
                    years_saved = round(max(0.0, (years_to_fire or 0.0) - boosted_years), 1)
                    sensitivity_milestones.append({
                        "savings_rate_increase_percent": delta_pct,
                        "new_annual_savings": round(boosted_sav, 2),
                        "years_to_fire": boosted_years,
                        "years_saved": years_saved,
                        "projected_fire_age": current_age + int(round(boosted_years)),
                    })

        # 4. Monte Carlo Sequence of Returns Simulation (1,000 Paths, 35-year horizon)
        # Compares Fixed Real Withdrawals vs Guyton-Klinger Dynamic Guardrail Rules
        sim_years = 35
        n_paths = 1000
        sim_corpus_start = max(current_nw_f, standard_fire_target) if standard_fire_target > 0 else 1000000.0
        annual_withdrawal_base = sim_corpus_start * swr

        # Lognormal distribution parameters calibrated to Indian balanced portfolio
        # Mean real return 4.5%, std dev 12.0%
        mean_ret = 0.045
        std_ret = 0.12
        survived_count_fixed = 0
        survived_count_guardrails = 0
        terminal_values_fixed = []
        terminal_values_guardrails = []

        # Guyton-Klinger triggers
        gk_upper_ceiling_rate = swr * 1.20   # e.g. 4.2% -> trigger 10% spending cut
        gk_lower_floor_rate = swr * 0.80     # e.g. 2.8% -> trigger 10% spending raise

        import random
        random.seed(101)

        for _ in range(n_paths):
            # Simulation A: Fixed real withdrawal
            corpus_a = sim_corpus_start
            depleted_a = False

            # Simulation B: Guyton-Klinger dynamic guardrails
            corpus_b = sim_corpus_start
            withdrawal_b = annual_withdrawal_base
            depleted_b = False

            for y in range(sim_years):
                shock = random.gauss(mean_ret, std_ret)

                # --- Path A: Fixed ---
                if not depleted_a:
                    corpus_a -= annual_withdrawal_base
                    if corpus_a <= 0:
                        depleted_a = True
                    else:
                        corpus_a *= (1.0 + shock)

                # --- Path B: Guyton-Klinger Guardrails ---
                if not depleted_b:
                    # Check current withdrawal rate against guardrails
                    if corpus_b > 0:
                        curr_rate_b = withdrawal_b / corpus_b
                        if curr_rate_b > gk_upper_ceiling_rate:
                            # Capital Preservation Rule: reduce spending by 10%
                            withdrawal_b *= 0.90
                        elif curr_rate_b < gk_lower_floor_rate:
                            # Prosperity Rule: increase spending by 10%
                            withdrawal_b *= 1.10

                    corpus_b -= withdrawal_b
                    if corpus_b <= 0:
                        depleted_b = True
                    else:
                        corpus_b *= (1.0 + shock)

            if not depleted_a:
                survived_count_fixed += 1
                terminal_values_fixed.append(corpus_a)
            else:
                terminal_values_fixed.append(0.0)

            if not depleted_b:
                survived_count_guardrails += 1
                terminal_values_guardrails.append(corpus_b)
            else:
                terminal_values_guardrails.append(0.0)

        terminal_values_fixed.sort()
        terminal_values_guardrails.sort()

        survival_rate_pct = round((survived_count_fixed / n_paths) * 100.0, 1)
        gk_survival_rate_pct = round((survived_count_guardrails / n_paths) * 100.0, 1)
        median_terminal = terminal_values_fixed[n_paths // 2] if terminal_values_fixed else 0.0
        gk_median_terminal = terminal_values_guardrails[n_paths // 2] if terminal_values_guardrails else 0.0

        # Current progress percentage towards standard FIRE
        progress_pct = round(min(100.0, (current_nw_f / standard_fire_target) * 100.0), 1) if standard_fire_target > 0 else 0.0

        # Longevity Spending Curve
        retirement_phases = [
            {"phase": "Go-Go Years (Ages 50-65)", "expense_factor_percent": 100.0, "annual_budget": round(ann_exp_f, 2), "description": "Active lifestyle, global travel, and early retirement hobbies."},
            {"phase": "Slow-Go Years (Ages 65-75)", "expense_factor_percent": 82.0, "annual_budget": round(ann_exp_f * 0.82, 2), "description": "Settled lifestyle, domestic focus, and reduced travel expenditure."},
            {"phase": "No-Go Years (Ages 75+)", "expense_factor_percent": 90.0, "annual_budget": round(ann_exp_f * 0.90, 2), "description": "Minimal lifestyle spending offset by higher private healthcare and nursing care."},
        ]

        return {
            "currency": currency,
            "current_net_worth": round(current_nw_f, 2),
            "annual_expenses": round(ann_exp_f, 2),
            "annual_savings": round(ann_sav_f, 2),
            "current_savings_rate_percent": float(current_savings_rate),
            "progress_percent": progress_pct,
            "fire_targets": {
                "lean_fire": round(lean_fire_target, 2),
                "standard_fire": round(standard_fire_target, 2),
                "fat_fire": round(fat_fire_target, 2),
                "coast_fire": round(coast_fire_target, 2),
                "is_coast_fire_achieved": is_coast_fire_achieved,
            },
            "timeline": {
                "current_age": current_age,
                "years_to_fire": years_to_fire,
                "projected_fire_age": projected_fire_age,
                "is_already_fire": current_nw_f >= standard_fire_target if standard_fire_target > 0 else False,
            },
            "monte_carlo_resilience": {
                "simulated_paths": n_paths,
                "horizon_years": sim_years,
                "fixed_withdrawal_survival_percent": survival_rate_pct,
                "survival_rate_percent": survival_rate_pct,
                "guardrail_survival_percent": gk_survival_rate_pct,
                "median_terminal_corpus": round(median_terminal, 2),
                "guardrail_median_terminal_corpus": round(gk_median_terminal, 2),
                "is_bulletproof": gk_survival_rate_pct >= 95.0 or survival_rate_pct >= 90.0,
                "guardrail_rules": {
                    "initial_swr_percent": float(swr_pct),
                    "capital_preservation_ceiling_rate_percent": round(gk_upper_ceiling_rate * 100.0, 2),
                    "prosperity_floor_rate_percent": round(gk_lower_floor_rate * 100.0, 2),
                    "action_on_trigger": "10% spending cut if rate exceeds ceiling; 10% spending raise if rate drops below floor",
                },
            },
            "longevity_spending_phases": retirement_phases,
            "savings_rate_sensitivity": sensitivity_milestones,
            "parameters_used": {
                "nominal_annual_return_percent": float(nom_return_pct),
                "inflation_percent": float(inflation_pct),
                "real_annual_return_percent": round(real_r * 100.0, 2),
                "safe_withdrawal_rate_percent": float(swr_pct),
            },
        }
