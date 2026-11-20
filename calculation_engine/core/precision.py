"""
Financial Calculation Engine - Precision & Monetary Arithmetic
Strict Decimal arithmetic for financial correctness (Zero binary floating-point error).
"""

from decimal import Decimal, ROUND_HALF_UP, ROUND_HALF_EVEN, InvalidOperation
from typing import Any, Optional, Union
import math

# Precision quantizers
CURRENCY_PLACES = Decimal("0.01")       # 2 decimal places (standard fiat)
UNIT_PLACES = Decimal("0.0001")         # 4 decimal places (stocks/mutual fund units)
RATE_PLACES = Decimal("0.0001")         # 4 decimal places (percentages/NAV rates)
HIGH_PRECISION_PLACES = Decimal("0.00000001") # 8 decimal places (crypto/sub-units)

SUPPORTED_CURRENCIES = {"INR", "USD", "EUR", "GBP", "SGD", "AED"}
DEFAULT_CURRENCY = "INR"


def to_decimal(val: Any, default: Union[str, Decimal] = "0.00") -> Decimal:
    """
    Safely converts any numeric, string, or None input into a Python Decimal.
    Guarantees no binary floating-point string representations (e.g., 0.10000000000000000555).
    """
    if val is None:
        return Decimal(str(default))
    
    if isinstance(val, Decimal):
        if val.is_nan() or val.is_infinite():
            return Decimal(str(default))
        return val

    if isinstance(val, (int, bool)):
        return Decimal(int(val))

    if isinstance(val, float):
        if math.isnan(val) or math.isinf(val):
            return Decimal(str(default))
        # Convert through formatted string to preserve exact human-intended precision
        # using up to 12 significant digits to avoid float64 trailing noise
        return Decimal(f"{val:.8f}".rstrip("0").rstrip(".") or "0")

    if isinstance(val, str):
        cleaned = val.strip().replace(",", "").replace("₹", "").replace("$", "").replace("€", "").replace("£", "")
        if not cleaned or cleaned.lower() in ("nan", "none", "null", "undefined", "inf", "-inf"):
            return Decimal(str(default))
        try:
            return Decimal(cleaned)
        except InvalidOperation:
            return Decimal(str(default))

    try:
        return Decimal(str(val))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal(str(default))


def quantize_currency(
    val: Union[Decimal, float, int, str],
    places: Decimal = CURRENCY_PLACES,
    rounding: str = ROUND_HALF_UP,
) -> Decimal:
    """
    Quantizes a monetary amount to 2 decimal places (or custom currency precision)
    using deterministic half-up rounding.
    """
    dec = to_decimal(val)
    return dec.quantize(places, rounding=rounding)


def quantize_units(
    val: Union[Decimal, float, int, str],
    places: Decimal = UNIT_PLACES,
    rounding: str = ROUND_HALF_UP,
) -> Decimal:
    """
    Quantizes asset quantities/units (e.g. mutual fund units, stock shares) to 4 decimal places.
    """
    dec = to_decimal(val)
    return dec.quantize(places, rounding=rounding)


def quantize_rate(
    val: Union[Decimal, float, int, str],
    places: Decimal = RATE_PLACES,
    rounding: str = ROUND_HALF_UP,
) -> Decimal:
    """
    Quantizes rates, ratios, and percentages to 4 decimal places.
    """
    dec = to_decimal(val)
    return dec.quantize(places, rounding=rounding)


def safe_divide(
    numerator: Union[Decimal, float, int, str],
    denominator: Union[Decimal, float, int, str],
    default: Union[Decimal, str] = Decimal("0.00"),
) -> Decimal:
    """
    Performs division with guaranteed prevention of ZeroDivisionError and NaN.
    """
    num = to_decimal(numerator)
    den = to_decimal(denominator)
    if den == Decimal("0"):
        return to_decimal(default)
    return num / den


def safe_percentage(
    part: Union[Decimal, float, int, str],
    whole: Union[Decimal, float, int, str],
    default: Union[Decimal, str] = Decimal("0.00"),
) -> Decimal:
    """
    Calculates (part / whole) * 100 with zero-division protection and 2 decimal places quantize.
    """
    w = to_decimal(whole)
    if w == Decimal("0"):
        return to_decimal(default)
    p = to_decimal(part)
    res = (p / w) * Decimal("100")
    return quantize_currency(res)


def format_inr(val: Union[Decimal, float, int, str]) -> str:
    """
    Formats a Decimal as standard Indian Rupee currency string:
    e.g., 1234567.89 -> ₹12,34,567.89
    """
    dec = quantize_currency(val)
    sign = "-" if dec < 0 else ""
    abs_dec = abs(dec)
    
    parts = f"{abs_dec:.2f}".split(".")
    integer_part = parts[0]
    decimal_part = parts[1]
    
    if len(integer_part) <= 3:
        formatted_int = integer_part
    else:
        last_three = integer_part[-3:]
        remaining = integer_part[:-3]
        groups = []
        while len(remaining) > 2:
            groups.insert(0, remaining[-2:])
            remaining = remaining[:-2]
        if remaining:
            groups.insert(0, remaining)
        formatted_int = ",".join(groups) + "," + last_three
        
    return f"{sign}₹{formatted_int}.{decimal_part}"
