"""
Financial Calculation Engine - Bank Ingestion Models
Canonical data models for statement ingestion, parsed transactions, and validation reports.
"""

from decimal import Decimal
from datetime import date
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class ParsedTransactionItem(BaseModel):
    transaction_date: date
    value_date: Optional[date] = None
    amount: Decimal = Field(..., decimal_places=2)
    direction: str = Field(..., pattern="^(DEBIT|CREDIT)$")
    original_narration: str
    normalized_narration: str
    transaction_reference: Optional[str] = None
    balance_after_transaction: Optional[Decimal] = None
    raw_row_index: int = 0
    raw_metadata: Dict[str, Any] = Field(default_factory=dict)


class StatementMetadata(BaseModel):
    bank_name: str
    account_number_masked: Optional[str] = None
    account_type: Optional[str] = None
    statement_period_start: date
    statement_period_end: date
    opening_balance: Decimal = Field(..., decimal_places=2)
    closing_balance: Decimal = Field(..., decimal_places=2)
    total_credits: Decimal = Field(default=Decimal("0.00"), decimal_places=2)
    total_debits: Decimal = Field(default=Decimal("0.00"), decimal_places=2)
    currency: str = "INR"
    ifsc_code: Optional[str] = None
    branch_name: Optional[str] = None


class ValidationResult(BaseModel):
    is_valid: bool
    opening_balance: Decimal
    total_credits: Decimal
    total_debits: Decimal
    calculated_closing_balance: Decimal
    reported_closing_balance: Decimal
    discrepancy_amount: Decimal
    transaction_count: int
    errors: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)


class StatementParseResult(BaseModel):
    success: bool
    bank_name: str
    metadata: StatementMetadata
    transactions: List[ParsedTransactionItem]
    validation: ValidationResult
    parser_version: str = "1.0.0"
    file_hash: str
    file_name: str
    errors: List[str] = Field(default_factory=list)
