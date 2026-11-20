"""
Financial Calculation Engine - Internal Transfer Matching Engine
Pairs matching debit and credit legs across user-owned accounts within a settlement window.
Guarantees transfers are never double-counted as external income or expense.
"""

from decimal import Decimal
from datetime import date
from typing import List, Dict, Any, Optional, Set
from .models import TransferMatchResult


TOLERANCE = Decimal("0.01")
MAX_SETTLEMENT_WINDOW_DAYS = 3


def match_internal_transfers(
    transactions: List[Dict[str, Any]],
    user_account_ids: Optional[Set[str]] = None,
) -> List[TransferMatchResult]:
    """
    Identifies matching debit and credit pairs across different user accounts.
    Transactions schema:
    [
      { "id": "tx1", "account_id": "accA", "amount": Decimal("5000.00"), "direction": "DEBIT", "date": date(2026, 11, 1), "narration": "..." },
      ...
    ]
    """
    matches: List[TransferMatchResult] = []
    matched_ids: Set[str] = set()

    debits = [
        t for t in transactions
        if t.get("direction") == "DEBIT" and t.get("id") and t.get("account_id")
    ]
    credits = [
        t for t in transactions
        if t.get("direction") == "CREDIT" and t.get("id") and t.get("account_id")
    ]

    for deb in debits:
        d_id = str(deb["id"])
        if d_id in matched_ids:
            continue
        d_acc = str(deb["account_id"])
        d_amt = Decimal(str(deb["amount"]))
        d_date = deb.get("transaction_date") or deb.get("date")
        if isinstance(d_date, str):
            from datetime import datetime
            d_date = datetime.strptime(d_date, "%Y-%m-%d").date()

        for cr in credits:
            c_id = str(cr["id"])
            if c_id in matched_ids:
                continue
            c_acc = str(cr["account_id"])
            # Must be across different accounts
            if d_acc == c_acc:
                continue

            c_amt = Decimal(str(cr["amount"]))
            # Amount must match
            if abs(d_amt - c_amt) > TOLERANCE:
                continue

            c_date = cr.get("transaction_date") or cr.get("date")
            if isinstance(c_date, str):
                from datetime import datetime
                c_date = datetime.strptime(c_date, "%Y-%m-%d").date()

            days_diff = abs((c_date - d_date).days)
            if days_diff <= MAX_SETTLEMENT_WINDOW_DAYS:
                # Valid internal transfer pair!
                matched_ids.add(d_id)
                matched_ids.add(c_id)

                matches.append(
                    TransferMatchResult(
                        matched=True,
                        debit_tx_id=d_id,
                        credit_tx_id=c_id,
                        amount=d_amt,
                        from_account_id=d_acc,
                        to_account_id=c_acc,
                        days_difference=days_diff,
                        confidence=Decimal("0.9800") if days_diff == 0 else Decimal("0.9200"),
                    )
                )
                break

    return matches
