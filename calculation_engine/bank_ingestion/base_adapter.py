"""
Financial Calculation Engine - Base Bank Adapter
Defines interface for all bank statement parsers.
"""

from abc import ABC, abstractmethod
from typing import Optional, List
from .models import StatementParseResult


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
