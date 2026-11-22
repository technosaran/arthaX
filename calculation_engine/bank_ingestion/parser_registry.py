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
    prioritize_passwords_by_hint,
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
        metadata: Optional[dict] = None,
        password_hints: Optional[dict] = None,
        **kwargs,
    ) -> StatementParseResult:
        """
        Detects appropriate adapter and executes full parse with validation.
        Preserves and surfaces explicit security and decryption errors (e.g. PASSWORD_REQUIRED,
        PASSWORD_INCORRECT, CORRUPTED_PDF) without masking them as generic format failures.
        Uses bank_hint from email metadata and inspects decrypted PDF content headers
        to reliably route statements to dedicated bank adapters even when filenames are generic.
        Prioritizes decryption passwords if password_hints are provided from the email.
        """
        file_hash = compute_file_hash(content)
        fn_lower = filename.lower()
        is_pdf = fn_lower.endswith(".pdf") or content.startswith(b"%PDF")
        best_candidate: Optional[StatementParseResult] = None

        def _get_failure_adapter(hint: Optional[str]) -> BaseBankAdapter:
            if hint:
                norm = hint.strip().upper()
                for a in self.adapters:
                    a_name = getattr(a, "BANK_NAME", "").upper()
                    if a_name == norm or a_name in norm or norm in a_name:
                        return a
            if fn_lower.endswith(".csv"):
                return GenericCsvBankAdapter()
            return GenericPdfBankAdapter()

        def _build_failure(error_msg: str, error_code: Optional[str] = None, hint_override: Optional[str] = None) -> StatementParseResult:
            active_hint = hint_override or bank_hint
            adapter = _get_failure_adapter(active_hint)
            res = adapter._build_empty_failure(
                filename,
                file_hash,
                error_msg,
                error_code=error_code,
            )
            if active_hint and active_hint not in ("GENERIC", "BANK", "GENERIC_PDF", "GENERIC_CSV"):
                res.bank_name = active_hint
                if res.metadata:
                    res.metadata.bank_name = active_hint
            return _enrich_result(res)

        if password_hints and passwords:
            passwords = prioritize_passwords_by_hint(passwords, password_hints)

        def _enrich_result(res: StatementParseResult) -> StatementParseResult:
            if metadata:
                res.raw_metadata["email_metadata"] = metadata
            if password_hints:
                res.raw_metadata["password_hints"] = password_hints
            return res

        def _update_best_candidate(cand: Optional[StatementParseResult]):
            nonlocal best_candidate
            if cand and cand.transactions:
                if best_candidate is None or len(cand.transactions) > len(best_candidate.transactions):
                    best_candidate = cand

        # 1. If PDF, check if we can inspect decrypted text for high-confidence bank identification
        fn_lower = filename.lower()
        if fn_lower.endswith(".pdf") or content.startswith(b"%PDF"):
            try:
                doc, _ = open_pdf_document(content, passwords, bank_hint=bank_hint)
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
                            if result.success:
                                return _enrich_result(result)
                            _update_best_candidate(result)
                        except Exception:
                            pass
            except (PasswordRequiredError, PasswordIncorrectError, CorruptedPdfError, UnsupportedEncryptionError) as pe:
                pe_bank = getattr(pe, "bank_name", None) or bank_hint
                return _build_failure(str(pe), error_code=pe.code, hint_override=pe_bank)
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
                    if result.success:
                        return _enrich_result(result)
                    _update_best_candidate(result)
                except Exception:
                    pass

        # 3. Standard fallback iteration through registered adapters
        last_error = None
        for adapter in self.adapters:
            if adapter.can_parse(content, filename):
                try:
                    result = adapter.parse(content, filename, passwords)
                    if result.success:
                        return _enrich_result(result)
                    _update_best_candidate(result)
                    if result.errors:
                        for err in result.errors:
                            if err in ("PASSWORD_REQUIRED", "PASSWORD_INCORRECT", "CORRUPTED_PDF", "UNSUPPORTED_ENCRYPTION"):
                                return _enrich_result(result)
                except (PasswordRequiredError, PasswordIncorrectError, CorruptedPdfError, UnsupportedEncryptionError) as pe:
                    pe_bank = getattr(pe, "bank_name", None) or bank_hint or getattr(adapter, "BANK_NAME", None)
                    return _build_failure(str(pe), error_code=pe.code, hint_override=pe_bank)
                except Exception as e:
                    last_error = str(e)
                    continue

        # 4. If specific adapter didn't succeed, try generic fallbacks if applicable
        if fn_lower.endswith(".csv"):
            try:
                generic_csv = GenericCsvBankAdapter()
                result = generic_csv.parse(content, filename, passwords)
                if result.success:
                    return _enrich_result(result)
                _update_best_candidate(result)
            except Exception as e:
                last_error = str(e)
        elif is_pdf:
            try:
                generic_pdf = GenericPdfBankAdapter()
                result = generic_pdf.parse(content, filename, passwords)
                if result.success:
                    return _enrich_result(result)
                _update_best_candidate(result)
            except Exception as e:
                last_error = str(e)

        # 5. Return best candidate if any adapter successfully extracted transactions
        if best_candidate is not None:
            if not best_candidate.errors and best_candidate.validation and best_candidate.validation.errors:
                best_candidate.errors = list(best_candidate.validation.errors)
            return _enrich_result(best_candidate)

        # Standard failure response for unsupported or unparseable format
        err_msg = f"Unsupported or unparseable bank statement format for '{filename}'."
        if last_error:
            err_msg += f" Last error: {last_error}"

        return _build_failure(err_msg, error_code="UNSUPPORTED_FORMAT")


# Global Singleton Registry
parser_registry = StatementParserRegistry()
