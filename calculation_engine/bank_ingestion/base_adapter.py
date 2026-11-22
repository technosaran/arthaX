"""
Financial Calculation Engine - Base Bank Adapter
Defines interface for all bank statement parsers, unified account type detection,
and non-financial document classification.
"""

from abc import ABC, abstractmethod
from datetime import date
from decimal import Decimal
from typing import Optional, List

from .models import StatementParseResult, StatementMetadata
from .statement_validator import validate_statement_math


def detect_account_type_from_text(text: Optional[str]) -> str:
    """
    Detects the bank account type from statement text.
    Returns: 'CREDIT_CARD', 'CURRENT', 'OVERDRAFT', 'LOAN', 'SALARY', or 'SAVINGS'.
    """
    if not text:
        return "SAVINGS"
    upper = str(text).upper()
    if any(k in upper for k in ["CREDIT CARD", "CARD STATEMENT", "SBI CARD", "MINIMUM AMOUNT DUE", "PAYMENT DUE DATE", "TOTAL AMOUNT DUE", "CREDIT LIMIT", "AVAILABLE CREDIT"]):
        return "CREDIT_CARD"
    if any(k in upper for k in ["CURRENT ACCOUNT", "CURRENT A/C", "CA-", "CA -", "CURRENT ACC", "CA A/C"]):
        return "CURRENT"
    if any(k in upper for k in ["OVERDRAFT", "OD A/C", "CASH CREDIT", "OD-", "OD ACCOUNT"]):
        return "OVERDRAFT"
    if any(k in upper for k in ["LOAN ACCOUNT", "TERM LOAN", "HOME LOAN", "PERSONAL LOAN", "AUTO LOAN", "EMI"]):
        return "LOAN"
    if any(k in upper for k in ["SALARY ACCOUNT", "CORPORATE SALARY", "SALARY SB"]):
        return "SALARY"
    if any(k in upper for k in ["SAVINGS", "SAVING", "SB-", "SB -", "REGULAR SB", "SAVINGS BANK", "SB A/C", "SB ACC"]):
        return "SAVINGS"
    return "SAVINGS"


NON_FINANCIAL_KEYWORDS = [
    "TERMS AND CONDITIONS",
    "TERMS & CONDITIONS",
    "SCHEDULE OF CHARGES",
    "TARIFF",
    "BROCHURE",
    "USER GUIDE",
    "PRIVACY POLICY",
    "WELCOME KIT",
    "PRODUCT GUIDE",
    "APPLICATION FORM",
    "DISCLOSURE",
    "FEATURES AND BENEFITS",
    "MOST IMPORTANT TERMS",
    "MITC",
    "FEE SCHEDULE",
    "INTEREST RATES",
    "IMPORTANT NOTICE",
    "CUSTOMER COPY",
    "OFFER DOCUMENT",
    "SERVICE CHARGES",
    "GUIDELINES",
    "USER MANUAL",
    "BENEFITS AND PRIVILEGES",
    "REWARD POINTS PROGRAM",
    "FAQ",
    "FAQS",
    "FREQUENTLY ASKED QUESTIONS",
    "POLICY DOCUMENT",
    "AGREEMENT",
]

STATEMENT_INDICATORS = [
    "STATEMENT OF ACCOUNT",
    "ACCOUNT STATEMENT",
    "A/C STATEMENT",
    "STATEMENT SUMMARY",
    "TRANSACTION DETAILS",
    "CLOSING BALANCE",
    "OPENING BALANCE",
]


def is_non_financial_document(text: Optional[str]) -> bool:
    """
    Checks if a document text contains terms/charges/brochures or general
    non-statement documentation rather than bank statement transaction data.
    """
    if not text or len(str(text).strip()) < 10:
        return False
    upper = str(text).upper()

    has_non_fin = any(k in upper for k in NON_FINANCIAL_KEYWORDS)
    has_statement_data = any(k in upper for k in STATEMENT_INDICATORS) and any(
        k in upper for k in ["ACCOUNT NUMBER", "ACCOUNT NO", "A/C NO", "CRN:"]
    )

    if has_non_fin and not has_statement_data:
        return True
    if not has_statement_data and not any(
        k in upper for k in ["WITHDRAWAL", "DEPOSIT", "BALANCE", "TXN DATE", "VALUE DATE", "PARTICULARS", "CHQ NO", "CHEQUE NO"]
    ):
        return True
    return False


class BaseBankAdapter(ABC):
    BANK_NAME: str = "GENERIC"
    PARSER_VERSION: str = "1.0.0"

    @abstractmethod
    def can_parse(self, content: bytes, filename: str) -> bool:
        """Determines if this adapter can parse the given file."""

    @abstractmethod
    def parse(
        self,
        content: bytes,
        filename: str,
        passwords: Optional[List[str]] = None,
    ) -> StatementParseResult:
        """Parses the statement content and returns normalized result."""

    def _build_empty_failure(
        self,
        filename: str,
        file_hash: str,
        error_msg: str,
        error_code: Optional[str] = None,
    ) -> StatementParseResult:
        """Standard helper to build a consistent empty failure result."""
        empty_meta = StatementMetadata(
            bank_name=self.BANK_NAME,
            statement_period_start=date.today(),
            statement_period_end=date.today(),
            opening_balance=Decimal("0.00"),
            closing_balance=Decimal("0.00"),
        )
        empty_val = validate_statement_math(empty_meta, [])
        empty_val.is_valid = False
        err_list = [error_code, error_msg] if error_code else [error_msg]
        empty_val.errors.extend(err_list)
        return StatementParseResult(
            success=False,
            bank_name=self.BANK_NAME,
            metadata=empty_meta,
            transactions=[],
            validation=empty_val,
            parser_version=self.PARSER_VERSION,
            file_hash=file_hash,
            file_name=filename,
            errors=err_list,
        )
