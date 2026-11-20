"""
Unit Tests: Precision & Monetary Arithmetic
Tests Decimal operations, quantizing, zero-division safety, and property-based invariance with Hypothesis.
"""

from decimal import Decimal, ROUND_HALF_UP
import math
import pytest
from hypothesis import given, strategies as st

from calculation_engine.core.precision import (
    to_decimal,
    quantize_currency,
    quantize_units,
    quantize_rate,
    safe_divide,
    safe_percentage,
    format_inr,
)


def test_to_decimal_various_inputs():
    assert to_decimal(100) == Decimal("100")
    assert to_decimal(100.5) == Decimal("100.5")
    assert to_decimal("2,500.75") == Decimal("2500.75")
    assert to_decimal("₹1,234.50") == Decimal("1234.50")
    assert to_decimal(None) == Decimal("0.00")
    assert to_decimal(float("nan")) == Decimal("0.00")
    assert to_decimal(float("inf")) == Decimal("0.00")
    assert to_decimal("invalid") == Decimal("0.00")


def test_quantize_currency_half_up():
    # 0.005 rounds up to 0.01 in ROUND_HALF_UP
    assert quantize_currency("10.005") == Decimal("10.01")
    assert quantize_currency("10.004") == Decimal("10.00")
    assert quantize_currency("0.000") == Decimal("0.00")


def test_safe_divide():
    assert safe_divide(100, 2) == Decimal("50")
    assert safe_divide(100, 0) == Decimal("0.00")
    assert safe_divide(100, "0") == Decimal("0.00")
    assert safe_divide(0, 100) == Decimal("0")


def test_safe_percentage():
    assert safe_percentage(25, 100) == Decimal("25.00")
    assert safe_percentage(1, 3) == Decimal("33.33")
    assert safe_percentage(50, 0) == Decimal("0.00")


def test_format_inr():
    assert format_inr("1000") == "₹1,000.00"
    assert format_inr("100000") == "₹1,00,000.00"
    assert format_inr("10000000") == "₹1,00,00,000.00"
    assert format_inr("-5000.50") == "-₹5,000.50"


# Hypothesis Property-Based Testing
@given(
    num=st.decimals(min_value=-1e10, max_value=1e10, allow_nan=False, allow_infinity=False),
    den=st.decimals(min_value=-1e10, max_value=1e10, allow_nan=False, allow_infinity=False),
)
def test_safe_divide_never_raises(num, den):
    result = safe_divide(num, den)
    assert isinstance(result, Decimal)
    if den == Decimal("0"):
        assert result == Decimal("0.00")


@given(
    amt=st.decimals(min_value=0, max_value=1e10, places=4, allow_nan=False, allow_infinity=False)
)
def test_quantize_currency_preserves_two_decimal_places(amt):
    q = quantize_currency(amt)
    assert isinstance(q, Decimal)
    # Check exponent is at most -2
    assert q.as_tuple().exponent == -2
