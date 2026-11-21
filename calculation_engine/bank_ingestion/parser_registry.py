"""
Financial Calculation Engine - Bank Parser Registry & Orchestrator
Coordinates bank adapter detection, password decryption, parsing, and balance validation.
Supports SBI, HDFC, ICICI, Axis, Kotak, Indian Bank, and universal PDF & CSV fallbacks.
"""

from typing import List, Optional
from .base_adapter import BaseBankAdapter
from .sbi_adapter import SbiBankAdapter
from .hdfc_adapter import HdfcBankAdapter
from .icici_adapter import IciciBankAdapter
from .axis_adapter import AxisBankAdapter
from .kotak_adapter import KotakBankAdapter
from .indian_bank_adapter import IndianBankAdapter
from .generic_pdf_adapter import GenericPdfBankAdapter
from .generic_csv_adapter import GenericCsvBankAdapter
from .models import StatementParseResult
from .pdf_decryptor import (
    compute_file_hash,
    DecryptionError,
    PasswordRequiredError,
    PasswordIncorrectError,
    CorruptedPdfError,
    UnsupportedEncryptionError,
)


class StatementParserRegistry:
    def __init__(self):
        # Ordered by specificity: dedicated bank adapters first, generic fallbacks last
        self.adapters: List[BaseBankAdapter] = [
            SbiBankAdapter(),
            HdfcBankAdapter(),
            IciciBankAdapter(),
            AxisBankAdapter(),
            KotakBankAdapter(),
            IndianBankAdapter(),
            GenericPdfBankAdapter(),
            GenericCsvBankAdapter(),
        ]

    def register_adapter(self, adapter: BaseBankAdapter):
        self.adapters.insert(0, adapter)

    def parse_statement(
        self,
        content: bytes,
        filename: str,
        passwords: Optional[List[str]] = None,
    ) -> StatementParseResult:
        """
        Detects appropriate adapter and executes full parse with validation.
        Preserves and surfaces explicit security and decryption errors (e.g. PASSWORD_REQUIRED,
        PASSWORD_INCORRECT, CORRUPTED_PDF) without masking them as generic format failures.
        """
        file_hash = compute_file_hash(content)
        fallback_adapter = self.adapters[0]

        matched_any = False
        last_error = None

        for adapter in self.adapters:
            if adapter.can_parse(content, filename):
                matched_any = True
                try:
                    result = adapter.parse(content, filename, passwords)
                    if result.success or (result.transactions and not result.errors):
                        return result
                    # If result explicitly contains a decryption error, return it immediately
                    if result.errors:
                        for err in result.errors:
                            if err in ("PASSWORD_REQUIRED", "PASSWORD_INCORRECT", "CORRUPTED_PDF", "UNSUPPORTED_ENCRYPTION"):
                                return result
                except (PasswordRequiredError, PasswordIncorrectError, CorruptedPdfError, UnsupportedEncryptionError) as pe:
                    return fallback_adapter._build_empty_failure(
                        filename,
                        file_hash,
                        str(pe),
                        error_code=pe.code,
                    )
                except Exception as e:
                    last_error = str(e)
                    continue

        # If specific adapter didn't succeed, try generic fallbacks if applicable
        fn_lower = filename.lower()
        if fn_lower.endswith(".csv"):
            try:
                generic_csv = GenericCsvBankAdapter()
                return generic_csv.parse(content, filename, passwords)
            except Exception as e:
                last_error = str(e)
        elif fn_lower.endswith(".pdf"):
            try:
                generic_pdf = GenericPdfBankAdapter()
                return generic_pdf.parse(content, filename, passwords)
            except Exception as e:
                last_error = str(e)

        # Standard failure response for unsupported or unparseable format
        err_msg = f"Unsupported or unparseable bank statement format for '{filename}'."
        if last_error:
            err_msg += f" Last error: {last_error}"

        return fallback_adapter._build_empty_failure(
            filename,
            file_hash,
            err_msg,
            error_code="UNSUPPORTED_FORMAT",
        )


# Global Singleton Registry
parser_registry = StatementParserRegistry()
