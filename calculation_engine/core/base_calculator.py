"""
Financial Calculation Engine - Base Calculator
Abstract base class providing timing, deterministic execution, and audit trail hooks.
"""

from abc import ABC, abstractmethod
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from pydantic import BaseModel


class CalculationMetadata(BaseModel):
    calculation_id: str
    calculation_type: str
    version: str
    execution_time_ms: float
    timestamp: str
    status: str
    user_id: Optional[str] = None


class BaseCalculator(ABC):
    """
    Abstract base calculator ensuring deterministic execution,
    precise execution timing, and structured audit logs.
    """
    CALCULATION_TYPE = "GENERIC"
    ENGINE_VERSION = "1.0.0"

    def execute(self, inputs: Any, user_id: Optional[str] = None, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Executes the financial calculation with timing, validation, and audit recording.
        """
        calc_id = str(uuid.uuid4())
        start_time = time.perf_counter()
        status = "SUCCESS"
        error_msg = None

        try:
            result = self.calculate(inputs, context=context)
        except Exception as e:
            status = "FAILED"
            error_msg = str(e)
            raise e
        finally:
            elapsed_ms = round((time.perf_counter() - start_time) * 1000.0, 3)
            # Record audit event
            from ..audit.calculation_logger import record_calculation_audit
            record_calculation_audit(
                calculation_id=calc_id,
                calculation_type=self.CALCULATION_TYPE,
                user_id=user_id or "anonymous",
                version=self.ENGINE_VERSION,
                execution_time_ms=elapsed_ms,
                status=status,
                error=error_msg,
                result_summary=self.summarize_result(result) if status == "SUCCESS" else None,
            )

        metadata = CalculationMetadata(
            calculation_id=calc_id,
            calculation_type=self.CALCULATION_TYPE,
            version=self.ENGINE_VERSION,
            execution_time_ms=elapsed_ms,
            timestamp=datetime.now(timezone.utc).isoformat(),
            status=status,
            user_id=user_id,
        )

        return {
            "data": result,
            "metadata": metadata.model_dump(),
        }

    @abstractmethod
    def calculate(self, inputs: Any, context: Optional[Dict[str, Any]] = None) -> Any:
        """Core mathematical calculation logic. Must be deterministic and pure."""
        pass

    def summarize_result(self, result: Any) -> Dict[str, Any]:
        """Summarizes high-level totals without sensitive PII for audit logging."""
        if isinstance(result, dict):
            # Extract common financial summary keys
            keys = [
                "total_expense", "total_income", "net_worth", "net_savings",
                "total_invested", "current_value", "unrealized_pnl", "total_budget",
                "discrepancies_count", "cagr", "xirr"
            ]
            return {k: str(result[k]) for k in keys if k in result}
        return {}
