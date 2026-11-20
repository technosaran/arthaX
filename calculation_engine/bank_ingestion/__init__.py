"""
Financial Calculation Engine - Bank Ingestion Module
"""

from .models import (
    ParsedTransactionItem,
    StatementMetadata,
    ValidationResult,
    StatementParseResult,
)
from .base_adapter import BaseBankAdapter
from .sbi_adapter import SbiBankAdapter
from .indian_bank_adapter import IndianBankAdapter
from .generic_csv_adapter import GenericCsvBankAdapter
from .pdf_decryptor import (
    open_pdf_document,
    generate_candidate_passwords,
    compute_file_hash,
    PasswordRequiredError,
    DecryptionError,
)
from .statement_validator import validate_statement_math, validate_statement_continuity
from .parser_registry import StatementParserRegistry, parser_registry

__all__ = [
    "ParsedTransactionItem",
    "StatementMetadata",
    "ValidationResult",
    "StatementParseResult",
    "BaseBankAdapter",
    "SbiBankAdapter",
    "IndianBankAdapter",
    "GenericCsvBankAdapter",
    "open_pdf_document",
    "generate_candidate_passwords",
    "compute_file_hash",
    "PasswordRequiredError",
    "DecryptionError",
    "validate_statement_math",
    "validate_statement_continuity",
    "StatementParserRegistry",
    "parser_registry",
]
