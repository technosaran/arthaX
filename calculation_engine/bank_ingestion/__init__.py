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
from .hdfc_adapter import HdfcBankAdapter
from .icici_adapter import IciciBankAdapter
from .axis_adapter import AxisBankAdapter
from .kotak_adapter import KotakBankAdapter
from .indian_bank_adapter import IndianBankAdapter
from .generic_pdf_adapter import GenericPdfBankAdapter
from .generic_csv_adapter import GenericCsvBankAdapter
from .pdf_decryptor import (
    open_pdf_document,
    generate_candidate_passwords,
    compute_file_hash,
    PasswordRequiredError,
    PasswordIncorrectError,
    DecryptionError,
    get_bank_password_format_hint,
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
    "HdfcBankAdapter",
    "IciciBankAdapter",
    "AxisBankAdapter",
    "KotakBankAdapter",
    "IndianBankAdapter",
    "GenericPdfBankAdapter",
    "GenericCsvBankAdapter",
    "open_pdf_document",
    "generate_candidate_passwords",
    "compute_file_hash",
    "PasswordRequiredError",
    "PasswordIncorrectError",
    "DecryptionError",
    "get_bank_password_format_hint",
    "validate_statement_math",
    "validate_statement_continuity",
    "StatementParserRegistry",
    "parser_registry",
]
