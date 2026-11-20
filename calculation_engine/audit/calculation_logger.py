"""
Financial Calculation Engine - Audit Logger & History Store
Maintains a versioned, immutable calculation audit trail for compliance and developer validation.
"""

from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from collections import deque
import threading

# Thread-safe in-memory circular buffer for recent calculations (last 2000 events)
_AUDIT_LOCK = threading.Lock()
_MAX_AUDIT_HISTORY = 2000
_CALCULATION_HISTORY: deque = deque(maxlen=_MAX_AUDIT_HISTORY)

# Metrics counters
_METRICS = {
    "total_executed": 0,
    "successful": 0,
    "failed": 0,
    "module_counts": {},
}


def record_calculation_audit(
    calculation_id: str,
    calculation_type: str,
    user_id: str,
    version: str,
    execution_time_ms: float,
    status: str,
    error: Optional[str] = None,
    result_summary: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Appends an immutable audit record to the history buffer and updates metrics.
    """
    record = {
        "calculation_id": calculation_id,
        "calculation_type": calculation_type,
        "user_id": user_id,
        "version": version,
        "execution_time_ms": execution_time_ms,
        "status": status,
        "error": error,
        "result_summary": result_summary or {},
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    with _AUDIT_LOCK:
        _CALCULATION_HISTORY.append(record)
        _METRICS["total_executed"] += 1
        if status == "SUCCESS":
            _METRICS["successful"] += 1
        else:
            _METRICS["failed"] += 1

        mod_counts = _METRICS["module_counts"]
        mod_counts[calculation_type] = mod_counts.get(calculation_type, 0) + 1

    return record


def get_calculation_history(
    limit: int = 50,
    calculation_type: Optional[str] = None,
    status: Optional[str] = None,
    user_id: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Retrieves filtered calculation history entries, newest first.
    """
    with _AUDIT_LOCK:
        records = list(_CALCULATION_HISTORY)

    # Filter
    results = []
    for r in reversed(records):
        if calculation_type and r["calculation_type"].upper() != calculation_type.upper():
            continue
        if status and r["status"].upper() != status.upper():
            continue
        if user_id and r["user_id"] != user_id:
            continue
        results.append(r)
        if len(results) >= limit:
            break

    return results


def get_validation_metrics() -> Dict[str, Any]:
    """
    Returns global validation summary for the developer/admin dashboard.
    """
    with _AUDIT_LOCK:
        total = _METRICS["total_executed"]
        succ = _METRICS["successful"]
        fail = _METRICS["failed"]
        pass_rate = round((succ / total * 100.0), 2) if total > 0 else 100.0
        
        # Recent execution time average
        recent_times = [r["execution_time_ms"] for r in list(_CALCULATION_HISTORY)[-100:]]
        avg_time = round(sum(recent_times) / len(recent_times), 2) if recent_times else 0.0

        return {
            "total_calculations_executed": total,
            "successful_calculations": succ,
            "failed_calculations": fail,
            "validation_pass_rate_percent": pass_rate,
            "average_execution_time_ms": avg_time,
            "module_wise_breakdown": dict(_METRICS["module_counts"]),
            "latest_validation_timestamp": datetime.now(timezone.utc).isoformat(),
            "history_buffer_size": len(_CALCULATION_HISTORY),
        }


def clear_audit_history_for_testing():
    """Testing helper to reset metrics and buffer."""
    with _AUDIT_LOCK:
        _CALCULATION_HISTORY.clear()
        _METRICS["total_executed"] = 0
        _METRICS["successful"] = 0
        _METRICS["failed"] = 0
        _METRICS["module_counts"].clear()
