"""
Financial Calculation Engine - Transaction Intelligence Models
"""

from decimal import Decimal
from datetime import date
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class TransactionClassificationInput(BaseModel):
    id: Optional[str] = None
    account_id: Optional[str] = None
    amount: Decimal = Field(..., decimal_places=2)
    direction: str = Field(..., pattern="^(DEBIT|CREDIT)$")
    original_narration: str
    transaction_date: date
    transaction_reference: Optional[str] = None
    user_accounts: Optional[List[Dict[str, Any]]] = None
    family_members: Optional[List[Dict[str, Any]]] = None


class ClassificationResult(BaseModel):
    category: str
    transaction_type: str
    confidence: Decimal = Field(..., decimal_places=4)
    reason: str
    merchant_name: Optional[str] = None
    merchant_category: Optional[str] = None
    counterparty_name: Optional[str] = None
    counterparty_identifier: Optional[str] = None
    channel: str = "OTHER"
    is_transfer: bool = False
    is_refund: bool = False
    normalized_narration: str


class TransferMatchResult(BaseModel):
    matched: bool
    debit_tx_id: str
    credit_tx_id: str
    amount: Decimal
    from_account_id: str
    to_account_id: str
    days_difference: int
    confidence: Decimal = Field(default=Decimal("0.9800"), decimal_places=4)
