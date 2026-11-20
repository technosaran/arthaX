"""
Financial Calculation Engine - Precision & Monetary Arithmetic
Strict Decimal arithmetic for financial correctness (Zero binary floating-point error).
"""

from decimal import Decimal, ROUND_HALF_UP, ROUND_HALF_EVEN, InvalidOperation
from typing import Any, Optional, Union, Dict
import math

from .exceptions import InvalidFinancialDataError

# Precision quantizers
CURRENCY_PLACES = Decimal("0.01")              # 2 decimal places (standard fiat: INR, USD, EUR)
UNIT_PLACES = Decimal("0.0001")                # 4 decimal places (stocks/mutual fund units)
RATE_PLACES = Decimal("0.0001")                # 4 decimal places (percentages/NAV rates)
HIGH_PRECISION_PLACES = Decimal("0.00000001")  # 8 decimal places (crypto / sub-units)

# Currency-specific precision mapping
CURRENCY_PRECISION_MAP: Dict[str, Decimal] = {
    "INR": Decimal("0.01"),
    "USD": Decimal("0.01"),
    "EUR": Decimal("0.01"),
    "GBP": Decimal("0.01"),
    "SGD": Decimal("0.01"),
    "AED": Decimal("0.01"),
    "JPY": Decimal("1"),
    "KRW": Decimal("1"),
    "KWD": Decimal("0.001"),
    "BHD": Decimal("0.001"),
    "OMR": Decimal("0.001"),
}

SUPPORTED_CURRENCIES = set(CURRENCY_PRECISION_MAP.keys())
DEFAULT_CURRENCY = "INR"


def get_currency_precision(currency_code: Optional[str]) -> Decimal:
    """Returns the ISO currency-specific decimal place precision."""
    if not currency_code:
        return CURRENCY_PLACES
    return CURRENCY_PRECISION_MAP.get(currency_code.strip().upper(), CURRENCY_PLACES)


def to_decimal(val: Any, default: Union[str, Decimal] = "0.00", strict: bool = False) -> Decimal:
    """
    Safely converts numeric, string, or Decimal input into a Python Decimal.
    Guarantees no binary floating-point string representations.
    When strict=True, raises InvalidFinancialDataError on NaN, Infinity, or unparseable inputs.
    """
    if val is None:
        return Decimal(str(default))

    if isinstance(val, Decimal):
        if val.is_nan() or val.is_infinite():
            if strict:
                raise InvalidFinancialDataError("Monetary input cannot be NaN or Infinity")
            return Decimal(str(default))
        return val

    if isinstance(val, bool):
        return Decimal(int(val))

    if isinstance(val, int):
        return Decimal(val)

    if isinstance(val, float):
        if math.isnan(val) or math.isinf(val):
            if strict:
                raise InvalidFinancialDataError("Monetary floating-point input cannot be NaN or Infinity")
            return Decimal(str(default))
        return Decimal(f"{val:.8f}".rstrip("0").rstrip(".") or "0")

    if isinstance(val, str):
        cleaned = val.strip().replace(",", "").replace("₹", "").replace("$", "").replace("€", "").replace("£", "")
        if not cleaned:
            return Decimal(str(default))
        if cleaned.lower() in ("nan", "none", "null", "undefined", "inf", "-inf"):
            if strict:
                raise InvalidFinancialDataError(f"Monetary numeric input contains invalid literal: '{val}'")
            return Decimal(str(default))
        try:
            return Decimal(cleaned)
        except InvalidOperation:
            if strict:
                raise InvalidFinancialDataError(f"Cannot parse monetary decimal from string: '{val}'")
            return Decimal(str(default))

    try:
        return Decimal(str(val))
    except (InvalidOperation, TypeError, ValueError):
        if strict:
            raise InvalidFinancialDataError(f"Invalid monetary numeric input type: {type(val)}")
        return Decimal(str(default))


def parse_monetary_decimal(val: Any) -> Decimal:
    """Strictly parses monetary inputs, rejecting NaN, Infinity, and invalid data."""
    return to_decimal(val, strict=True)


def quantize_currency(
    val: Union[Decimal, float, int, str],
    places: Optional[Decimal] = None,
    currency: Optional[str] = None,
    rounding: str = ROUND_HALF_UP,
) -> Decimal:
    """
    Quantizes a monetary amount to standard currency places (or currency-specific precision).
    """
    dec = to_decimal(val)
    effective_places = places or get_currency_precision(currency)
    return dec.quantize(effective_places, rounding=rounding)


def quantize_units(
    val: Union[Decimal, float, int, str],
    places: Decimal = UNIT_PLACES,
    rounding: str = ROUND_HALF_UP,
) -> Decimal:
    """Quantizes asset quantities/units (e.g. mutual fund units, stock shares) to 4 decimal places."""
    dec = to_decimal(val)
    return dec.quantize(places, rounding=rounding)


def quantize_crypto(
    val: Union[Decimal, float, int, str],
    places: Decimal = HIGH_PRECISION_PLACES,
    rounding: str = ROUND_HALF_UP,
) -> Decimal:
    """Quantizes crypto asset quantities up to 8 decimal places to preserve fractional satoshis/wei."""
    dec = to_decimal(val)
    return dec.quantize(places, rounding=rounding)


def quantize_rate(
    val: Union[Decimal, float, int, str],
    places: Decimal = RATE_PLACES,
    rounding: str = ROUND_HALF_UP,
) -> Decimal:
    """Quantizes rates, ratios, and percentages to 4 decimal places."""
    dec = to_decimal(val)
    return dec.quantize(places, rounding=rounding)


def safe_divide(
    numerator: Union[Decimal, float, int, str],
    denominator: Union[Decimal, float, int, str],
    default: Union[Decimal, str] = Decimal("0.00"),
) -> Decimal:
    """Safe division returning Decimal default on division by zero."""
    num_dec = to_decimal(numerator)
    den_dec = to_decimal(denominator)
    if den_dec == Decimal("0"):
        return Decimal(str(default))
    return num_dec / den_dec


def safe_percentage(
    part: Union[Decimal, float, int, str],
    total: Union[Decimal, float, int, str],
    places: Decimal = Decimal("0.01"),
) -> Decimal:
    """Calculates percentage (part / total * 100) rounded to 2 decimal places."""
    tot_dec = to_decimal(total)
    if tot_dec == Decimal("0"):
        return Decimal("0.00")
    pct = (to_decimal(part) / tot_dec) * Decimal("100")
    return pct.quantize(places, rounding=ROUND_HALF_UP)


def format_inr(val: Union[Decimal, float, int, str]) -> str:
    """Formats a decimal amount using the Indian numbering format (Lakhs & Crores)."""
    dec = to_decimal(val)
    is_neg = dec < Decimal("0")
    abs_dec = abs(dec)
    quantized = abs_dec.quantize(CURRENCY_PLACES, rounding=ROUND_HALF_UP)
    s = f"{quantized:.2f}"
    parts = s.split(".")
    integer_part = parts[0]
    decimal_part = parts[1]

    if len(integer_part) <= 3:
        formatted_int = integer_part
    else:
        last3 = integer_part[-3:]
        remaining = integer_part[:-3]
        chunks = []
        while len(remaining) > 2:
            chunks.insert(0, remaining[-2:])
            remaining = remaining[:-2]
        if remaining:
            chunks.insert(0, remaining)
        chunks.append(last3)
        formatted_int = ",".join(chunks)

    formatted = f"₹{formatted_int}.{decimal_part}"
    return f"-{formatted}" if is_neg else formatted
