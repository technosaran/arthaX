"""
Financial Calculation Engine - Institutional Portfolio Risk & Performance Analytics Engine
Calculates Sharpe Ratio, Sortino Ratio (downside risk), Maximum Drawdown (MDD),
Underwater periods, Value at Risk (VaR 95% & 99%), Conditional Value at Risk (CVaR / Expected Shortfall),
Calmar Ratio, Beta, Jensen's Alpha, and Herfindahl Concentration Index (HHI).
"""

from decimal import Decimal
import math
from typing import List, Dict, Any, Optional, Tuple
from ..core.precision import (
    to_decimal,
    quantize_currency,
    quantize_rate,
    safe_divide,
    safe_percentage,
    DEFAULT_CURRENCY,
)
from ..core.base_calculator import BaseCalculator


# Standard Z-scores for one-tailed normal distribution
Z_SCORES = {
    "95": 1.6448536269514722,
    "99": 2.3263478740408408,
}


class PortfolioAnalyticsEngine(BaseCalculator):
    CALCULATION_TYPE = "PORTFOLIO_ANALYTICS"

    def calculate(self, inputs: Dict[str, Any], context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Inputs:
            portfolio_returns: Optional List[float] (periodic returns as decimals, e.g. 0.02 for +2%)
            portfolio_snapshots: Optional List[Dict[str, Any]] (e.g. [{"date": "2024-01-01", "value": 100000}, ...])
            benchmark_returns: Optional List[float] (e.g. Nifty 50 periodic returns)
            current_portfolio_value: Optional float (for absolute VaR loss calculation)
            risk_free_rate_pct: Optional float (annualized risk-free rate, default 6.75% for Indian 91-day T-Bill)
            period_frequency: Optional str ("monthly" [12], "daily" [252], "annual" [1], default "monthly")
            holdings: Optional List[Dict[str, Any]] (holdings with "symbol", "weight_percent" or "current_value")
            currency: Optional str (default INR)
        """
        currency = str(inputs.get("currency", DEFAULT_CURRENCY))
        rf_rate_pct = float(inputs.get("risk_free_rate_pct", 6.75))
        rf_annual = rf_rate_pct / 100.0

        freq_str = str(inputs.get("period_frequency", "monthly")).lower().strip()
        if freq_str == "daily":
            periods_per_year = 252
        elif freq_str == "annual":
            periods_per_year = 1
        else:
            periods_per_year = 12

        rf_period = rf_annual / periods_per_year

        # 1. Extract Returns
        raw_returns: List[float] = []
        if "portfolio_returns" in inputs and inputs["portfolio_returns"]:
            raw_returns = [float(r) for r in inputs["portfolio_returns"] if r is not None]
        elif "portfolio_snapshots" in inputs and inputs["portfolio_snapshots"]:
            snaps = inputs["portfolio_snapshots"]
            sorted_snaps = sorted(snaps, key=lambda s: s.get("date", ""))
            vals = [float(s.get("value", 0)) for s in sorted_snaps if float(s.get("value", 0)) > 0]
            for i in range(1, len(vals)):
                prev = vals[i - 1]
                curr = vals[i]
                raw_returns.append((curr - prev) / prev)

        curr_value = float(inputs.get("current_portfolio_value", 0.0))
        if curr_value <= 0.0 and "portfolio_snapshots" in inputs and inputs["portfolio_snapshots"]:
            curr_value = float(inputs["portfolio_snapshots"][-1].get("value", 0.0))

        # Benchmark returns (if provided)
        bench_returns: List[float] = []
        if "benchmark_returns" in inputs and inputs["benchmark_returns"]:
            bench_returns = [float(r) for r in inputs["benchmark_returns"] if r is not None]

        # Edge cases: minimal or empty returns
        if len(raw_returns) < 2:
            return self._empty_response(currency, curr_value, rf_rate_pct, periods_per_year)

        n = len(raw_returns)

        # 2. Mean, Volatility, Annualized Return & Risk
        mean_period_ret = sum(raw_returns) / n
        var_period = sum((r - mean_period_ret) ** 2 for r in raw_returns) / (n - 1)
        std_period = math.sqrt(var_period)

        annualized_return = mean_period_ret * periods_per_year
        annualized_volatility = std_period * math.sqrt(periods_per_year)

        # 3. Sharpe Ratio
        excess_annual_return = annualized_return - rf_annual
        if annualized_volatility > 0:
            sharpe_ratio = round(excess_annual_return / annualized_volatility, 3)
        else:
            sharpe_ratio = 0.0

        # 4. Sortino Ratio (Downside Deviation against Risk-Free Hurdle)
        downside_sq_sum = sum(min(0.0, r - rf_period) ** 2 for r in raw_returns)
        downside_std_period = math.sqrt(downside_sq_sum / n)
        annualized_downside_vol = downside_std_period * math.sqrt(periods_per_year)

        if annualized_downside_vol > 0:
            sortino_ratio = round(excess_annual_return / annualized_downside_vol, 3)
        else:
            sortino_ratio = round(sharpe_ratio * 1.5, 3) if excess_annual_return > 0 else 0.0

        # 5. Maximum Drawdown (MDD) & Underwater Analysis
        wealth_index = 1.0
        peak = 1.0
        max_drawdown = 0.0
        current_underwater_periods = 0
        max_underwater_periods = 0

        for r in raw_returns:
            wealth_index *= (1.0 + r)
            if wealth_index > peak:
                peak = wealth_index
                current_underwater_periods = 0
            else:
                dd = (wealth_index - peak) / peak
                if dd < max_drawdown:
                    max_drawdown = dd
                current_underwater_periods += 1
                if current_underwater_periods > max_underwater_periods:
                    max_underwater_periods = current_underwater_periods

        mdd_pct = abs(max_drawdown) * 100.0

        # 6. Calmar Ratio
        if mdd_pct > 0:
            calmar_ratio = round(annualized_return / (mdd_pct / 100.0), 3)
        else:
            calmar_ratio = 99.0 if annualized_return > 0 else 0.0

        # 7. Value at Risk (VaR 95% and 99%)
        # Relative VaR (volatility risk from mean return)
        rel_var_95_annual_pct = round(Z_SCORES["95"] * annualized_volatility * 100.0, 2)
        rel_var_99_annual_pct = round(Z_SCORES["99"] * annualized_volatility * 100.0, 2)

        # Absolute Parametric 1-period and 1-year VaR (loss from initial capital)
        var_95_period_pct = round(max(0.0, -(mean_period_ret - Z_SCORES["95"] * std_period)) * 100.0, 2)
        var_99_period_pct = round(max(0.0, -(mean_period_ret - Z_SCORES["99"] * std_period)) * 100.0, 2)

        var_95_annual_pct = round(max(0.0, -(annualized_return - Z_SCORES["95"] * annualized_volatility)) * 100.0, 2)
        var_99_annual_pct = round(max(0.0, -(annualized_return - Z_SCORES["99"] * annualized_volatility)) * 100.0, 2)

        # Historical Empirical VaR
        sorted_rets = sorted(raw_returns)
        idx_95 = max(0, int(0.05 * n))
        idx_99 = max(0, int(0.01 * n))
        hist_var_95_pct = round(max(0.0, -sorted_rets[idx_95]) * 100.0, 2)
        hist_var_99_pct = round(max(0.0, -sorted_rets[idx_99]) * 100.0, 2)

        # Conditional Value at Risk (CVaR / Expected Shortfall)
        tail_95 = sorted_rets[:idx_95 + 1]
        cvar_95_period_pct = round(max(0.0, -(sum(tail_95) / len(tail_95))) * 100.0, 2) if tail_95 else var_95_period_pct

        # Absolute Loss in Currency (if current value known)
        abs_var_95_period = round(curr_value * (var_95_period_pct / 100.0), 2) if curr_value > 0 else 0.0
        abs_var_95_annual = round(curr_value * (var_95_annual_pct / 100.0), 2) if curr_value > 0 else 0.0
        abs_var_99_annual = round(curr_value * (var_99_annual_pct / 100.0), 2) if curr_value > 0 else 0.0

        # 8. Beta & Jensen's Alpha (if benchmark given and length matches)
        beta = None
        alpha_pct = None
        if bench_returns and len(bench_returns) >= 2:
            m_len = min(len(raw_returns), len(bench_returns))
            p_sub = raw_returns[:m_len]
            b_sub = bench_returns[:m_len]

            p_m = sum(p_sub) / m_len
            b_m = sum(b_sub) / m_len

            cov = sum((p_sub[i] - p_m) * (b_sub[i] - b_m) for i in range(m_len)) / (m_len - 1)
            var_b = sum((b - b_m) ** 2 for b in b_sub) / (m_len - 1)

            if var_b > 0:
                beta_val = cov / var_b
                beta = round(beta_val, 2)

                bench_annual_ret = b_m * periods_per_year
                # Jensen's Alpha = R_p - (R_f + Beta * (R_m - R_f))
                expected_p_ret = rf_annual + beta_val * (bench_annual_ret - rf_annual)
                alpha_val = annualized_return - expected_p_ret
                alpha_pct = round(alpha_val * 100.0, 2)

        # 9. Holdings Concentration & Herfindahl-Hirschman Index (HHI)
        holdings = inputs.get("holdings", [])
        hhi_score = 0.0
        effective_holdings_count = 0.0
        concentration_tier = "NOT_SPECIFIED"

        if holdings:
            weights = []
            total_h_val = sum(float(h.get("current_value", 0)) for h in holdings)
            if total_h_val > 0:
                weights = [(float(h.get("current_value", 0)) / total_h_val) * 100.0 for h in holdings]
            else:
                total_w = sum(float(h.get("weight_percent", 0)) for h in holdings)
                if total_w > 0:
                    weights = [(float(h.get("weight_percent", 0)) / total_w) * 100.0 for h in holdings]

            if weights:
                # HHI = sum of squared market share percentages (0 - 10,000)
                hhi_score = round(sum(w ** 2 for w in weights), 1)
                sum_sq_decimals = sum((w / 100.0) ** 2 for w in weights)
                effective_holdings_count = round(1.0 / sum_sq_decimals, 1) if sum_sq_decimals > 0 else len(weights)

                if hhi_score < 1500:
                    concentration_tier = "WELL_DIVERSIFIED"
                elif hhi_score <= 2500:
                    concentration_tier = "MODERATELY_CONCENTRATED"
                else:
                    concentration_tier = "HEAVILY_CONCENTRATED"

        # Overall Institutional Assessment
        if sharpe_ratio >= 1.5 and mdd_pct <= 15.0:
            rating = "EXCELLENT"
            rating_summary = "Institutional-grade risk-adjusted return with tightly controlled drawdowns."
        elif sharpe_ratio >= 1.0 and mdd_pct <= 25.0:
            rating = "GOOD"
            rating_summary = "Robust risk-adjusted performance beating standard benchmark hurdle."
        elif sharpe_ratio >= 0.5:
            rating = "ACCEPTABLE"
            rating_summary = "Positive excess returns above risk-free rate, but volatility could be optimized."
        else:
            rating = "NEEDS_OPTIMIZATION"
            rating_summary = "Portfolio risk is insufficiently compensated by current return generation."

        return {
            "currency": currency,
            "current_portfolio_value": curr_value,
            "period_frequency": freq_str,
            "periods_analyzed": n,
            "returns_and_volatility": {
                "annualized_return_percent": round(annualized_return * 100.0, 2),
                "annualized_volatility_percent": round(annualized_volatility * 100.0, 2),
                "annualized_downside_volatility_percent": round(annualized_downside_vol * 100.0, 2),
                "risk_free_rate_percent": rf_rate_pct,
            },
            "risk_adjusted_ratios": {
                "sharpe_ratio": sharpe_ratio,
                "sortino_ratio": sortino_ratio,
                "calmar_ratio": calmar_ratio,
                "beta": beta,
                "jensens_alpha_percent": alpha_pct,
            },
            "drawdown_metrics": {
                "maximum_drawdown_percent": round(mdd_pct, 2),
                "longest_underwater_periods": max_underwater_periods,
            },
            "value_at_risk": {
                "parametric_var_95_period_percent": var_95_period_pct,
                "parametric_var_99_period_percent": var_99_period_pct,
                "parametric_var_95_annual_percent": var_95_annual_pct,
                "parametric_var_99_annual_percent": var_99_annual_pct,
                "relative_var_95_annual_percent": rel_var_95_annual_pct,
                "relative_var_99_annual_percent": rel_var_99_annual_pct,
                "historical_var_95_period_percent": hist_var_95_pct,
                "historical_var_99_period_percent": hist_var_99_pct,
                "cvar_expected_shortfall_95_percent": cvar_95_period_pct,
                "estimated_loss_at_risk_95_period": abs_var_95_period,
                "estimated_loss_at_risk_95_annual": abs_var_95_annual,
                "estimated_loss_at_risk_99_annual": abs_var_99_annual,
            },
            "diversification_metrics": {
                "herfindahl_index_hhi": hhi_score,
                "effective_number_of_holdings": effective_holdings_count,
                "concentration_tier": concentration_tier,
            },
            "institutional_assessment": {
                "rating": rating,
                "summary": rating_summary,
            },
        }

    def _empty_response(self, currency: str, curr_value: float, rf_rate_pct: float, periods_per_year: int) -> Dict[str, Any]:
        return {
            "currency": currency,
            "current_portfolio_value": curr_value,
            "period_frequency": "monthly",
            "periods_analyzed": 0,
            "returns_and_volatility": {
                "annualized_return_percent": 0.0,
                "annualized_volatility_percent": 0.0,
                "annualized_downside_volatility_percent": 0.0,
                "risk_free_rate_percent": rf_rate_pct,
            },
            "risk_adjusted_ratios": {
                "sharpe_ratio": 0.0,
                "sortino_ratio": 0.0,
                "calmar_ratio": 0.0,
                "beta": None,
                "jensens_alpha_percent": None,
            },
            "drawdown_metrics": {
                "maximum_drawdown_percent": 0.0,
                "longest_underwater_periods": 0,
            },
            "value_at_risk": {
                "parametric_var_95_annual_percent": 0.0,
                "parametric_var_99_annual_percent": 0.0,
                "historical_var_95_period_percent": 0.0,
                "historical_var_99_period_percent": 0.0,
                "cvar_expected_shortfall_95_percent": 0.0,
                "estimated_loss_at_risk_95_annual": 0.0,
                "estimated_loss_at_risk_99_annual": 0.0,
            },
            "diversification_metrics": {
                "herfindahl_index_hhi": 0.0,
                "effective_number_of_holdings": 0.0,
                "concentration_tier": "INSUFFICIENT_DATA",
            },
            "institutional_assessment": {
                "rating": "INSUFFICIENT_DATA",
                "summary": "Provide at least 2 return periods to compute institutional risk analytics.",
            },
        }
