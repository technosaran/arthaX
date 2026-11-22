"""
Financial Calculation Engine - Financial Stress Testing & Macro Shock Engine
Simulates multi-factor personal financial shocks (Job Loss, Market Crash,
Stagflation, Medical Emergency, Black Swan) and computes a 0-100 Resilience Score.
"""

from decimal import Decimal
from typing import List, Dict, Any, Optional
import math

from ..core.precision import (
    to_decimal,
    quantize_currency,
    safe_divide,
    safe_percentage,
    DEFAULT_CURRENCY,
)
from ..core.base_calculator import BaseCalculator


class FinancialStressTestEngine(BaseCalculator):
    CALCULATION_TYPE = "STRESS_TEST"

    def calculate(self, inputs: Dict[str, Any], context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Inputs:
            liquid_cash: float/Decimal (Cash, Bank Savings, Immediate FDs)
            semi_liquid_assets: float/Decimal (Stocks, Equity MFs, Gold, Crypto)
            monthly_income: float/Decimal (Take-home net monthly income)
            monthly_mandatory_expenses: float/Decimal (Rent, EMIs, Groceries, Utilities, Healthcare)
            monthly_discretionary_expenses: float/Decimal (Dining, Entertainment, Shopping, Travel)
            total_debt: float/Decimal (Credit cards, personal loans, home loans)
            emergency_shock_amount: Optional float/Decimal (Custom one-time shock, default: 500000.0)
            currency: Optional str (default: INR)
        """
        currency = str(inputs.get("currency", DEFAULT_CURRENCY))
        liquid_cash = max(Decimal("0.00"), to_decimal(inputs.get("liquid_cash", 0)))
        investments = max(Decimal("0.00"), to_decimal(inputs.get("semi_liquid_assets", 0)))
        monthly_inc = max(Decimal("0.00"), to_decimal(inputs.get("monthly_income", 0)))
        mandatory_exp = max(Decimal("0.00"), to_decimal(inputs.get("monthly_mandatory_expenses", 0)))
        discretionary_exp = max(Decimal("0.00"), to_decimal(inputs.get("monthly_discretionary_expenses", 0)))
        total_debt = max(Decimal("0.00"), to_decimal(inputs.get("total_debt", 0)))
        custom_shock = max(Decimal("0.00"), to_decimal(inputs.get("emergency_shock_amount", 500000.0)))

        total_monthly_burn = mandatory_exp + discretionary_exp
        total_net_worth = liquid_cash + investments - total_debt

        # 1. Baseline Runway
        baseline_runway_months = safe_divide(liquid_cash, mandatory_exp) if mandatory_exp > Decimal("0.00") else Decimal("999.0")
        total_liquidity_runway = safe_divide(liquid_cash + investments, mandatory_exp) if mandatory_exp > Decimal("0.00") else Decimal("999.0")

        # -------------------------------------------------------------
        # Scenario 1: Job Loss / Income Halt for 6 Months
        # -------------------------------------------------------------
        # Under job loss: discretionary spending is slashed by 75%
        pruned_burn = mandatory_exp + (discretionary_exp * Decimal("0.25"))
        six_month_burn = pruned_burn * Decimal("6.0")
        job_loss_surplus_deficit = liquid_cash - six_month_burn
        survives_job_loss_on_cash = job_loss_surplus_deficit >= Decimal("0.00")
        job_loss_runway = safe_divide(liquid_cash, pruned_burn) if pruned_burn > Decimal("0.00") else Decimal("999.0")

        # -------------------------------------------------------------
        # Scenario 2: Severe Market Crash (40% Drop)
        # -------------------------------------------------------------
        market_crash_drop = investments * Decimal("0.40")
        post_crash_investments = investments - market_crash_drop
        post_crash_net_worth = liquid_cash + post_crash_investments - total_debt
        recovery_years_at_12pct = None
        if post_crash_investments > Decimal("0.00") and investments > post_crash_investments:
            try:
                # FV = PV * (1+r)^t => t = ln(FV/PV) / ln(1+r)
                ratio = float(investments / post_crash_investments)
                recovery_years_at_12pct = round(math.log(ratio) / math.log(1.12), 1)
            except (ValueError, ZeroDivisionError):
                recovery_years_at_12pct = None

        # -------------------------------------------------------------
        # Scenario 3: Large Medical Shock / Lump-sum Emergency
        # -------------------------------------------------------------
        post_medical_cash = liquid_cash - custom_shock
        medical_covered_by_cash = post_medical_cash >= Decimal("0.00")
        medical_forced_liquidations = max(Decimal("0.00"), custom_shock - liquid_cash)

        # -------------------------------------------------------------
        # Scenario 4: 3-Year Stagflation (9% Inflation, 0% Income Growth)
        # -------------------------------------------------------------
        # Year 3 mandatory expenses inflated at 9% per year: exp * (1.09)^3 = exp * 1.295
        stagflation_monthly_exp = mandatory_exp * Decimal("1.295") + discretionary_exp
        monthly_deficit_stagflation = max(Decimal("0.00"), stagflation_monthly_exp - monthly_inc)
        stagflation_annual_deficit = monthly_deficit_stagflation * Decimal("12.0")

        # -------------------------------------------------------------
        # Scenario 5: Black Swan Event
        # (Income cut by 50% + 35% Market Crash + ₹3,00,000 Emergency)
        # -------------------------------------------------------------
        black_swan_emergency = Decimal("300000.00")
        black_swan_monthly_income = monthly_inc * Decimal("0.50")
        black_swan_monthly_burn = mandatory_exp + (discretionary_exp * Decimal("0.20"))
        black_swan_monthly_shortfall = max(Decimal("0.00"), black_swan_monthly_burn - black_swan_monthly_income)
        black_swan_cash = max(Decimal("0.00"), liquid_cash - black_swan_emergency)
        black_swan_runway = (
            safe_divide(black_swan_cash, black_swan_monthly_shortfall)
            if black_swan_monthly_shortfall > Decimal("0.00")
            else Decimal("999.0")
        )

        # -------------------------------------------------------------
        # Resilience Score (0 - 100)
        # -------------------------------------------------------------
        score = 0
        # Metric A: Emergency Fund Coverage (Max 35 pts)
        if baseline_runway_months >= Decimal("6.0"):
            score += 35
        elif baseline_runway_months >= Decimal("3.0"):
            score += int(round(float(safe_divide(baseline_runway_months, Decimal("6.0")) * Decimal("35"))))
        else:
            score += int(round(float(safe_divide(baseline_runway_months, Decimal("3.0")) * Decimal("15"))))

        # Metric B: Debt-to-Income Health (Max 25 pts)
        dti = safe_divide(total_debt, monthly_inc * Decimal("12.0")) if monthly_inc > Decimal("0.00") else Decimal("999.0")
        if dti <= Decimal("0.20"):
            score += 25
        elif dti <= Decimal("0.40"):
            score += 18
        elif dti <= Decimal("0.80"):
            score += 10
        elif dti <= Decimal("1.50"):
            score += 5

        # Metric C: Investment Cushion & Net Worth (Max 20 pts)
        investment_to_burn_ratio = safe_divide(investments, mandatory_exp * Decimal("12.0")) if mandatory_exp > Decimal("0.00") else Decimal("0.0")
        if investment_to_burn_ratio >= Decimal("3.0"):
            score += 20
        elif investment_to_burn_ratio >= Decimal("1.0"):
            score += 14
        elif investment_to_burn_ratio >= Decimal("0.5"):
            score += 8

        # Metric D: Savings Rate Buffer (Max 20 pts)
        savings = monthly_inc - total_monthly_burn
        savings_rate = safe_percentage(savings, monthly_inc) if monthly_inc > Decimal("0.00") else Decimal("0.0")
        if savings_rate >= Decimal("30.0"):
            score += 20
        elif savings_rate >= Decimal("15.0"):
            score += 14
        elif savings_rate >= Decimal("5.0"):
            score += 8
        elif savings_rate > Decimal("0.0"):
            score += 4

        score = max(0, min(100, score))

        if score >= 85:
            tier = "FORTIFIED"
            summary = "Your financial position is exceptionally fortified against severe macro and personal shocks."
        elif score >= 70:
            tier = "ROBUST"
            summary = "Your finances are robust with healthy liquidity, able to withstand standard economic shocks."
        elif score >= 50:
            tier = "VULNERABLE"
            summary = "Moderate vulnerability detected. An income disruption or emergency will require liquidating investments or borrowing."
        else:
            tier = "CRITICAL"
            summary = "High financial vulnerability. Your liquid cushion is below recommended safety thresholds."

        # Actionable recommendations
        recommendations = []
        if baseline_runway_months < Decimal("6.0"):
            target_vault = quantize_currency(mandatory_exp * Decimal("6.0") - liquid_cash)
            recommendations.append(
                f"Build your Emergency Vault by {currency} {target_vault} to achieve a full 6-month safety buffer."
            )
        if total_debt > monthly_inc * Decimal("6.0"):
            recommendations.append(
                f"High debt exposure ({currency} {quantize_currency(total_debt)}). Accelerate repayment using the Debt Avalanche strategy."
            )
        if not medical_covered_by_cash:
            recommendations.append(
                f"A {currency} {quantize_currency(custom_shock)} emergency would force {currency} {quantize_currency(medical_forced_liquidations)} in distressed investment sales. Ensure health insurance covers at least ₹10 Lakhs."
            )
        if discretionary_exp > mandatory_exp * Decimal("0.50"):
            recommendations.append(
                "Discretionary spending represents over 33% of your monthly outflows. Trimming non-essential subscriptions will accelerate your safety buffer."
            )
        if not recommendations:
            recommendations.append("Continue regular automated SIP contributions while keeping your emergency fund in high-yield liquid instruments.")

        return {
            "currency": currency,
            "resilience_score": score,
            "resilience_tier": tier,
            "summary": summary,
            "baseline": {
                "liquid_cash": str(quantize_currency(liquid_cash)),
                "investments": str(quantize_currency(investments)),
                "total_debt": str(quantize_currency(total_debt)),
                "net_worth": str(quantize_currency(total_net_worth)),
                "monthly_income": str(quantize_currency(monthly_inc)),
                "monthly_mandatory_burn": str(quantize_currency(mandatory_exp)),
                "monthly_discretionary_burn": str(quantize_currency(discretionary_exp)),
                "cash_runway_months": float(round(baseline_runway_months, 1)),
                "total_runway_months": float(round(total_liquidity_runway, 1)),
            },
            "scenarios": {
                "job_loss_6_months": {
                    "scenario_name": "Job Loss / Income Halt (6 Months)",
                    "pruned_monthly_burn": str(quantize_currency(pruned_burn)),
                    "total_6m_burn": str(quantize_currency(six_month_burn)),
                    "surplus_or_deficit": str(quantize_currency(job_loss_surplus_deficit)),
                    "survives_without_selling_assets": survives_job_loss_on_cash,
                    "months_of_cash_runway": float(round(job_loss_runway, 1)),
                },
                "market_crash_40_pct": {
                    "scenario_name": "Market Crash (-40% Equity Drawdown)",
                    "portfolio_loss": str(quantize_currency(market_crash_drop)),
                    "portfolio_value_post_crash": str(quantize_currency(post_crash_investments)),
                    "net_worth_post_crash": str(quantize_currency(post_crash_net_worth)),
                    "estimated_recovery_years_at_12pct": recovery_years_at_12pct,
                },
                "emergency_medical_shock": {
                    "scenario_name": f"Lump-Sum Medical / Emergency Shock ({currency} {quantize_currency(custom_shock)})",
                    "shock_amount": str(quantize_currency(custom_shock)),
                    "covered_by_cash": medical_covered_by_cash,
                    "forced_investment_liquidation": str(quantize_currency(medical_forced_liquidations)),
                    "remaining_cash_after_shock": str(quantize_currency(max(Decimal("0.00"), post_medical_cash))),
                },
                "stagflation_3_years": {
                    "scenario_name": "Stagflation (9.5% Inflation Surge, Flat Salary)",
                    "inflated_monthly_expenses": str(quantize_currency(stagflation_monthly_exp)),
                    "monthly_cashflow_shortfall": str(quantize_currency(monthly_deficit_stagflation)),
                    "annual_purchasing_power_loss": str(quantize_currency(stagflation_annual_deficit)),
                },
                "black_swan_event": {
                    "scenario_name": "Black Swan (50% Pay Cut + 35% Market Crash + ₹3L Shock)",
                    "immediate_shock": str(quantize_currency(black_swan_emergency)),
                    "remaining_cash_after_shock": str(quantize_currency(black_swan_cash)),
                    "reduced_monthly_income": str(quantize_currency(black_swan_monthly_income)),
                    "pruned_monthly_burn": str(quantize_currency(black_swan_monthly_burn)),
                    "monthly_deficit": str(quantize_currency(black_swan_monthly_shortfall)),
                    "runway_months": float(round(black_swan_runway, 1)),
                    "survives_one_year": black_swan_runway >= Decimal("12.0"),
                },
            },
            "recommendations": recommendations,
        }
