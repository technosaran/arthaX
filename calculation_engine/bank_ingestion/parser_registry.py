"""
Financial Calculation Engine - Bank Parser Registry & Orchestrator
Coordinates bank adapter detection, password decryption, parsing, and balance validation.
"""

from typing import List, Optional
from .base_adapter import BaseBankAdapter
from .sbi_adapter import SbiBankAdapter
from .indian_bank_adapter import IndianBankAdapter
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
        # Ordered by specificity: dedicated bank adapters first, generic fallback last
        self.adapters: List[BaseBankAdapter] = [
            SbiBankAdapter(),
            IndianBankAdapter(),
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
        fallback_adapter = SbiBankAdapter()

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

        # If specific adapter didn't succeed, try generic if applicable
        if filename.lower().endswith(".csv"):
            try:
                generic = GenericCsvBankAdapter()
                return generic.parse(content, filename, passwords)
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
