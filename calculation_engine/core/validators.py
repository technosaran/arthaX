"""
Financial Calculation Engine - Validators & Data Models
Ensures strictly validated, sanitized, and typed inputs.
"""

from datetime import datetime, date
from decimal import Decimal
from typing import List, Optional, Union
from pydantic import BaseModel, Field, field_validator, ConfigDict
from .precision import (
    parse_monetary_decimal,
    DEFAULT_CURRENCY,
    SUPPORTED_CURRENCIES,
)


def validate_currency_code(code: Optional[str]) -> str:
    """Validates and normalizes 3-letter ISO currency code."""
    if not code:
        return DEFAULT_CURRENCY
    clean = code.strip().upper()
    if clean not in SUPPORTED_CURRENCIES:
        return DEFAULT_CURRENCY
    return clean


def parse_iso_date(d_str: Union[str, date, datetime, None]) -> Optional[date]:
    """Parses date string safely without crashing."""
    if not d_str:
        return None
    if isinstance(d_str, date):
        return d_str
    if isinstance(d_str, datetime):
        return d_str.date()

    clean = str(d_str).strip()[:10]
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(clean, fmt).date()
        except ValueError:
            continue
    return None


class BaseFinancialItem(BaseModel):
    """Base class providing Decimal conversion and dictionary extraction."""
    model_config = ConfigDict(arbitrary_types_allowed=True)


class TransactionRecord(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    id: Optional[str] = None
    title: str = Field(..., max_length=255)
    amount: Decimal = Field(default=Decimal("0.00"))
    category: str = Field(default="Other")
    transaction_date: str = Field(default_factory=lambda: date.today().isoformat())
    account_id: Optional[str] = None
    currency: str = Field(default=DEFAULT_CURRENCY)
    transaction_type: str = Field(default="expense")  # expense, income, transfer_out, transfer_in, refund
    tags: List[str] = Field(default_factory=list)
    is_recurring: bool = False
    transfer_id: Optional[str] = None

    @field_validator("amount", mode="before")
    @classmethod
    def parse_amount(cls, v):
        if v is None:
            return Decimal("0.00")
        return parse_monetary_decimal(v)

    @field_validator("currency", mode="before")
    @classmethod
    def parse_currency(cls, v):
        return validate_currency_code(v)


class AccountRecord(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    id: str
    name: str
    type: str
    balance: Decimal = Field(default=Decimal("0.00"))
    classification: str = Field(default="asset")  # asset or liability
    currency: str = Field(default=DEFAULT_CURRENCY)
    is_active: bool = True

    @field_validator("balance", mode="before")
    @classmethod
    def parse_balance(cls, v):
        if v is None:
            return Decimal("0.00")
        return parse_monetary_decimal(v)


class BudgetRecord(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    id: Optional[str] = None
    category: str
    amount: Decimal = Field(default=Decimal("0.00"))
    period: str = Field(default="monthly")
    month_year: str = Field(default_factory=lambda: date.today().strftime("%Y-%m"))
    alert_threshold: int = Field(default=80, ge=1, le=100)

    @field_validator("amount", mode="before")
    @classmethod
    def parse_amount(cls, v):
        if v is None:
            return Decimal("0.00")
        return parse_monetary_decimal(v)


class HoldingRecord(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    id: Optional[str] = None
    symbol_or_name: str
    asset_class: str  # stock, mutual_fund, bond, gold, silver, crypto
    quantity: Decimal = Field(default=Decimal("0.0000"))
    avg_purchase_price: Decimal = Field(default=Decimal("0.00"))
    current_price: Decimal = Field(default=Decimal("0.00"))
    invested_amount: Decimal = Field(default=Decimal("0.00"))
    current_value: Decimal = Field(default=Decimal("0.00"))
    currency: str = Field(default=DEFAULT_CURRENCY)
    purchase_date: Optional[str] = None

    @field_validator("quantity", "avg_purchase_price", "current_price", "invested_amount", "current_value", mode="before")
    @classmethod
    def parse_decimals(cls, v):
        if v is None:
            return Decimal("0.00")
        return parse_monetary_decimal(v)
