"""
Financial Calculation Engine - Portfolio Engine
Calculates CAGR, XIRR with dated cash flows, weighted average purchase prices,
holdings valuations, asset-wise returns, and corporate cash flows.
"""

from datetime import datetime, date
from decimal import Decimal
import math
from typing import List, Dict, Any, Optional, Tuple
from ..core.precision import (
    to_decimal,
    quantize_currency,
    quantize_units,
    quantize_rate,
    safe_divide,
    safe_percentage,
    DEFAULT_CURRENCY,
)
from ..core.validators import parse_iso_date
from ..core.base_calculator import BaseCalculator


def calculate_cagr(
    initial_value: Decimal,
    final_value: Decimal,
    years: Decimal,
) -> Optional[Decimal]:
    """
    Computes Compound Annual Growth Rate (CAGR):
    CAGR = (final_value / initial_value) ** (1 / years) - 1
    Returns Decimal rate (e.g. 0.1250 for 12.50%) or None if invalid.
    """
    if initial_value <= Decimal("0") or final_value <= Decimal("0") or years <= Decimal("0"):
        return None

    try:
        init_f = float(initial_value)
        final_f = float(final_value)
        years_f = float(years)
        cagr_val = math.pow(final_f / init_f, 1.0 / years_f) - 1.0
        if math.isnan(cagr_val) or math.isinf(cagr_val):
            return None
        return quantize_rate(Decimal(str(cagr_val)))
    except (ValueError, OverflowError, ZeroDivisionError):
        return None


def calculate_xirr(
    cash_flows: List[Tuple[date, Decimal]],
    guess: float = 0.10,
    max_iterations: int = 100,
    tolerance: float = 1e-7,
) -> Optional[Decimal]:
    """
    Computes Extended Internal Rate of Return (XIRR) for irregular dated cash flows:
    sum( C_i / (1 + r)^((d_i - d_0)/365) ) = 0
    Employs Newton-Raphson with bounded Bisection fallback for guaranteed convergence.
    """
    if len(cash_flows) < 2:
        return None

    # Check for at least one positive and one negative cash flow
    has_positive = any(cf[1] > Decimal("0") for cf in cash_flows)
    has_negative = any(cf[1] < Decimal("0") for cf in cash_flows)
    if not (has_positive and has_negative):
        return None

    # Sort cash flows chronologically
    sorted_flows = sorted(cash_flows, key=lambda x: x[0])
    d0 = sorted_flows[0][0]

    # Convert to float tuples for mathematical root finding
    flows: List[Tuple[float, float]] = []
    for d, amt in sorted_flows:
        days = (d - d0).days
        year_frac = days / 365.0
        flows.append((year_frac, float(amt)))

    def npv(rate: float) -> float:
        if rate <= -1.0:
            return float("inf")
        total = 0.0
        for t, c in flows:
            try:
                total += c / math.pow(1.0 + rate, t)
            except (OverflowError, ZeroDivisionError):
                return float("inf")
        return total

    def npv_prime(rate: float) -> float:
        if rate <= -1.0:
            return float("-inf")
        total = 0.0
        for t, c in flows:
            if t == 0:
                continue
            try:
                total -= (t * c) / math.pow(1.0 + rate, t + 1.0)
            except (OverflowError, ZeroDivisionError):
                return float("-inf")
        return total

    # Newton-Raphson Method
    r = guess
    for _ in range(max_iterations):
        val = npv(r)
        if math.isnan(val) or math.isinf(val):
            break
        if abs(val) < tolerance:
            return quantize_rate(Decimal(str(r)))
        
        deriv = npv_prime(r)
        if deriv == 0.0 or math.isnan(deriv) or math.isinf(deriv):
            break
        
        step = val / deriv
        r_new = r - step
        # Keep rate within realistic financial boundaries (-99% to +10000%)
        if r_new <= -0.999 or r_new > 100.0:
            break
        if abs(r_new - r) < tolerance:
            return quantize_rate(Decimal(str(r_new)))
        r = r_new

    # Fallback: Robust Bisection Method on bracket [-0.99, 10.0]
    low = -0.99
    high = 10.0
    f_low = npv(low)
    f_high = npv(high)

    if not (math.isnan(f_low) or math.isnan(f_high)) and (f_low * f_high <= 0):
        for _ in range(120):
            mid = (low + high) / 2.0
            f_mid = npv(mid)
            if abs(f_mid) < tolerance or (high - low) / 2.0 < tolerance:
                return quantize_rate(Decimal(str(mid)))
            if f_low * f_mid <= 0:
                high = mid
                f_high = f_mid
            else:
                low = mid
                f_low = f_mid

    return None


class PortfolioEngine(BaseCalculator):
    CALCULATION_TYPE = "PORTFOLIO"

    def calculate(self, inputs: Dict[str, Any], context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Inputs:
            holdings: List of unified holdings with purchase dates and amounts
            transactions: List of dated buy/sell/dividend cash flows
            current_valuation: Total current portfolio value
            initial_date: Optional start date for portfolio CAGR
            currency: Preferred currency
        """
        holdings: List[Dict[str, Any]] = inputs.get("holdings", [])
        transactions: List[Dict[str, Any]] = inputs.get("transactions", [])
        current_valuation_in = inputs.get("current_valuation")
        preferred_currency: str = inputs.get("currency", DEFAULT_CURRENCY)

        total_invested = Decimal("0.00")
        computed_current_value = Decimal("0.00")
        earliest_buy_date: Optional[date] = None

        holding_summaries = []

        unpriced_holdings_count = 0

        # 1. Holdings Valuation & Weighted Average Buy Price
        for h in holdings:
            qty = to_decimal(h.get("quantity", 0))
            avg_p = to_decimal(h.get("avg_price", 0))
            cur_p = to_decimal(h.get("current_price", 0))
            is_price_fallback = False
            if cur_p <= Decimal("0"):
                cur_p = avg_p
                if qty > Decimal("0"):
                    is_price_fallback = True
                    unpriced_holdings_count += 1

            inv = to_decimal(h.get("invested_amount", 0))
            if inv <= Decimal("0"):
                inv = qty * avg_p

            val = qty * cur_p
            total_invested += inv
            computed_current_value += val

            # Earliest date tracking
            p_date = parse_iso_date(h.get("purchase_date") or h.get("created_at"))
            if p_date:
                if earliest_buy_date is None or p_date < earliest_buy_date:
                    earliest_buy_date = p_date

            unrealized = val - inv
            ret_pct = safe_percentage(unrealized, inv) if inv > Decimal("0") else Decimal("0.00")

            holding_summaries.append({
                "symbol": str(h.get("symbol") or h.get("name") or ""),
                "quantity": str(quantize_units(qty)),
                "weighted_avg_price": str(quantize_currency(avg_p)),
                "current_price": str(quantize_currency(cur_p)),
                "invested_amount": str(quantize_currency(inv)),
                "current_value": str(quantize_currency(val)),
                "unrealized_pnl": str(quantize_currency(unrealized)),
                "return_percent": float(ret_pct),
                "is_price_fallback": is_price_fallback,
            })

        final_portfolio_value = to_decimal(current_valuation_in) if current_valuation_in is not None else computed_current_value

        # 2. CAGR Calculation
        cagr_rate: Optional[Decimal] = None
        portfolio_years = Decimal("0.00")
        if earliest_buy_date and total_invested > Decimal("0") and final_portfolio_value > Decimal("0"):
            today = date.today()
            days_held = (today - earliest_buy_date).days
            if days_held >= 30:  # Minimum 30 days to calculate meaningful annualized CAGR
                portfolio_years = to_decimal(days_held / 365.25)
                cagr_rate = calculate_cagr(total_invested, final_portfolio_value, portfolio_years)

        # 3. XIRR Cash Flows Construction
        # Cash outflows (Investments): negative
        # Cash inflows (Dividends, Payouts, Sells): positive
        # Terminal value at today: positive
        cash_flows: List[Tuple[date, Decimal]] = []

        for tx in transactions:
            t_type = str(tx.get("type") or "").upper()
            amt = to_decimal(tx.get("amount", 0))
            d_val = parse_iso_date(tx.get("transaction_date") or tx.get("date"))
            if not d_val or amt <= Decimal("0"):
                continue

            if t_type in ("BUY", "SIP", "INVESTMENT"):
                # Cash outflow
                cash_flows.append((d_val, -amt))
            elif t_type in ("SELL", "DIVIDEND", "COUPON_PAYOUT", "INTEREST"):
                # Cash inflow
                cash_flows.append((d_val, amt))

        # If no explicit transaction cash flows provided, use holdings as initial investments
        if not cash_flows and earliest_buy_date and total_invested > Decimal("0"):
            cash_flows.append((earliest_buy_date, -total_invested))

        # Terminal current value today
        if final_portfolio_value > Decimal("0"):
            cash_flows.append((date.today(), final_portfolio_value))

        xirr_rate = calculate_xirr(cash_flows) if len(cash_flows) >= 2 else None

        # 4. Absolute Return
        total_pnl = final_portfolio_value - total_invested
        absolute_return_pct = safe_percentage(total_pnl, total_invested) if total_invested > Decimal("0") else Decimal("0.00")

        return {
            "currency": preferred_currency,
            "total_invested": str(quantize_currency(total_invested)),
            "current_valuation": str(quantize_currency(final_portfolio_value)),
            "total_pnl": str(quantize_currency(total_pnl)),
            "absolute_return_percent": float(absolute_return_pct),
            "portfolio_holding_years": float(portfolio_years),
            "cagr_percent": float(cagr_rate * Decimal("100")) if cagr_rate is not None else None,
            "xirr_percent": float(xirr_rate * Decimal("100")) if xirr_rate is not None else None,
            "holdings_count": len(holdings),
            "unpriced_holdings_count": unpriced_holdings_count,
            "holdings": holding_summaries,
            "cash_flows_count": len(cash_flows),
        }
