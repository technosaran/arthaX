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
from .pdf_decryptor import compute_file_hash


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
        """
        for adapter in self.adapters:
            if adapter.can_parse(content, filename):
                try:
                    result = adapter.parse(content, filename, passwords)
                    if result.success or (result.transactions and not result.errors):
                        return result
                except Exception as e:
                    # Continue trying subsequent matching adapters (e.g. fallback to generic)
                    last_error = str(e)
                    continue

        # If specific adapter didn't succeed, try generic if applicable
        if filename.lower().endswith(".csv"):
            generic = GenericCsvBankAdapter()
            return generic.parse(content, filename, passwords)

        # Failure response
        file_hash = compute_file_hash(content)
        sbi = SbiBankAdapter()
        return sbi._build_empty_failure(
            filename,
            file_hash,
            f"Unsupported or unparseable bank statement format for '{filename}'.",
        )


# Global Singleton Registry
parser_registry = StatementParserRegistry()
