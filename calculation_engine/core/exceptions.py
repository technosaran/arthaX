"""
Financial Calculation Engine - Custom Domain Exceptions
"""

class CalculationEngineException(Exception):
    """Base exception for all financial calculation engine errors."""
    def __init__(self, message: str, code: str = "CALCULATION_ERROR", details: dict = None):
        super().__init__(message)
        self.message = message
        self.code = code
        self.details = details or {}


class InvalidFinancialDataError(CalculationEngineException):
    """Raised when monetary inputs contain invalid formats, NaN, Infinity, or impossible states."""
    def __init__(self, message: str, details: dict = None):
        super().__init__(message, code="INVALID_FINANCIAL_DATA", details=details)


class DivisionByZeroFinancialError(CalculationEngineException):
    """Raised when an operation would divide by zero and no safe default is applicable."""
    def __init__(self, message: str = "Attempted division by zero in financial formula", details: dict = None):
        super().__init__(message, code="DIVISION_BY_ZERO", details=details)


class InconsistentCurrencyError(CalculationEngineException):
    """Raised when operations attempt to combine amounts with differing currencies without an FX rate."""
    def __init__(self, message: str, details: dict = None):
        super().__init__(message, code="INCONSISTENT_CURRENCY", details=details)


class ReconciliationDiscrepancyError(CalculationEngineException):
    """Raised when a reconciliation check detects a balance mismatch or unallocated delta."""
    def __init__(self, message: str, details: dict = None):
        super().__init__(message, code="RECONCILIATION_DISCREPANCY", details=details)


class OutOfRangeFinancialValueError(CalculationEngineException):
    """Raised when input amounts exceed permissible realistic bounds (e.g., negative quantity, extreme values)."""
    def __init__(self, message: str, details: dict = None):
        super().__init__(message, code="OUT_OF_RANGE_VALUE", details=details)
