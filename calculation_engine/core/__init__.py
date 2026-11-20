"""
Financial Calculation Engine - Core Package
"""

from .precision import (
    to_decimal,
    quantize_currency,
    quantize_units,
    quantize_rate,
    safe_divide,
    safe_percentage,
    format_inr,
    DEFAULT_CURRENCY,
    SUPPORTED_CURRENCIES,
)
from .validators import (
    validate_currency_code,
    parse_iso_date,
    TransactionRecord,
    AccountRecord,
    BudgetRecord,
    HoldingRecord,
)
from .exceptions import (
    CalculationEngineException,
    InvalidFinancialDataError,
    DivisionByZeroFinancialError,
    InconsistentCurrencyError,
    ReconciliationDiscrepancyError,
    OutOfRangeFinancialValueError,
)
from .base_calculator import BaseCalculator, CalculationMetadata
