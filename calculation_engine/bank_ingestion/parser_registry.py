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
from .generic_pdf_adapter import GenericPdfBankAdapter, detect_bank_name_from_text
from .generic_csv_adapter import GenericCsvBankAdapter
from .models import StatementParseResult
from .pdf_decryptor import (
    compute_file_hash,
    open_pdf_document,
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
        bank_hint: Optional[str] = None,
    ) -> StatementParseResult:
        """
        Detects appropriate adapter and executes full parse with validation.
        Preserves and surfaces explicit security and decryption errors (e.g. PASSWORD_REQUIRED,
        PASSWORD_INCORRECT, CORRUPTED_PDF) without masking them as generic format failures.
        Uses bank_hint from email metadata and inspects decrypted PDF content headers
        to reliably route statements to dedicated bank adapters even when filenames are generic.
        """
        file_hash = compute_file_hash(content)
        fallback_adapter = self.adapters[0]

        # 1. If PDF, check if we can inspect decrypted text for high-confidence bank identification
        fn_lower = filename.lower()
        if fn_lower.endswith(".pdf") or content.startswith(b"%PDF"):
            try:
                doc, _ = open_pdf_document(content, passwords)
                try:
                    text_sample = ""
                    for i in range(min(2, doc.page_count)):
                        text_sample += doc[i].get_text() + "\n"
                finally:
                    doc.close()

                detected_bank = detect_bank_name_from_text(text_sample)
                candidate_bank = detected_bank if detected_bank != "BANK" else bank_hint

                if candidate_bank:
                    target_adapter = next(
                        (a for a in self.adapters if getattr(a, "BANK_NAME", "") == candidate_bank),
                        None
                    )
                    if target_adapter:
                        try:
                            result = target_adapter.parse(content, filename, passwords)
                            if result.success or (result.transactions and not result.errors):
                                return result
                        except Exception:
                            pass
            except (PasswordRequiredError, PasswordIncorrectError, CorruptedPdfError, UnsupportedEncryptionError) as pe:
                return fallback_adapter._build_empty_failure(
                    filename,
                    file_hash,
                    str(pe),
                    error_code=pe.code,
                )
            except Exception:
                pass

        # 2. If bank_hint provided (e.g. from email sender/subject) and not yet tried
        if bank_hint:
            hint_adapter = next(
                (a for a in self.adapters if getattr(a, "BANK_NAME", "") == bank_hint),
                None
            )
            if hint_adapter:
                try:
                    result = hint_adapter.parse(content, filename, passwords)
                    if result.success or (result.transactions and not result.errors):
                        return result
                except Exception:
                    pass

        # 3. Standard fallback iteration through registered adapters
        last_error = None
        for adapter in self.adapters:
            if adapter.can_parse(content, filename):
                try:
                    result = adapter.parse(content, filename, passwords)
                    if result.success or (result.transactions and not result.errors):
                        return result
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

        # 4. If specific adapter didn't succeed, try generic fallbacks if applicable
        if fn_lower.endswith(".csv"):
            try:
                generic_csv = GenericCsvBankAdapter()
                return generic_csv.parse(content, filename, passwords)
            except Exception as e:
                last_error = str(e)
        elif fn_lower.endswith(".pdf") or content.startswith(b"%PDF"):
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
