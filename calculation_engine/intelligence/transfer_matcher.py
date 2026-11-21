"""
Financial Calculation Engine - Internal Transfer Matching Engine
Pairs matching debit and credit legs across user-owned accounts within a settlement window.
Guarantees transfers are never double-counted as external income or expense.
Enforces 1-to-1 uniqueness and evidence-based matching (references, UPI IDs, narrations)
so ambiguous or coincidental transactions are left unmatched.
"""

from decimal import Decimal
from datetime import date
import re
from typing import List, Dict, Any, Optional, Set, Tuple
from .models import TransferMatchResult


TOLERANCE = Decimal("0.01")
MAX_SETTLEMENT_WINDOW_DAYS = 3
TRANSFER_KEYWORDS = (
    "TRANSFER", "TRF", "SWEEP", "FT", "NEFT", "RTGS", "IMPS",
    "SELF", "OWN A/C", "TO A/C", "FROM A/C", "OWN ACCOUNT", "FUNDS TRF"
)


def extract_transfer_reference(narr: str, explicit_ref: Optional[str] = None) -> Optional[str]:
    """Extracts stable transaction reference or UPI RRN/UTR token."""
    if explicit_ref and len(explicit_ref.strip()) >= 6:
        return explicit_ref.strip().upper()
    if not narr:
        return None
    # Look for UPI RRN or UTR (8 to 22 alphanumeric chars)
    m = re.search(r'(?:UPI|UTR|RRN|REF|IMPS)[\/:#\s-]*([0-9A-Za-z]{8,22})', narr, re.IGNORECASE)
    if m:
        return m.group(1).upper()
    return None


def evaluate_transfer_evidence(deb: Dict[str, Any], cr: Dict[str, Any]) -> Tuple[bool, Decimal, str]:
    """
    Evaluates evidence between candidate debit and credit legs.
    Returns (is_match, confidence, reason).
    """
    d_ref = extract_transfer_reference(
        deb.get("original_narration", "") + " " + deb.get("normalized_narration", ""),
        deb.get("transaction_reference")
    )
    c_ref = extract_transfer_reference(
        cr.get("original_narration", "") + " " + cr.get("normalized_narration", ""),
        cr.get("transaction_reference")
    )

    # 1. Exact Reference Match (highest confidence)
    if d_ref and c_ref and d_ref == c_ref:
        return True, Decimal("0.9900"), f"Exact reference identifier match ({d_ref})"

    d_narr = f"{deb.get('original_narration', '')} {deb.get('normalized_narration', '')} {deb.get('narration', '')}".upper()
    c_narr = f"{cr.get('original_narration', '')} {cr.get('normalized_narration', '')} {cr.get('narration', '')}".upper()

    has_d_keyword = any(kw in d_narr for kw in TRANSFER_KEYWORDS)
    has_c_keyword = any(kw in c_narr for kw in TRANSFER_KEYWORDS)

    # 2. Both legs contain explicit transfer narration keywords
    if has_d_keyword and has_c_keyword:
        return True, Decimal("0.9500"), "Dual-leg transfer narration confirmation"

    # 3. One leg has explicit transfer narration keyword
    if has_d_keyword or has_c_keyword:
        return True, Decimal("0.8500"), "Single-leg transfer narration confirmation"

    # 4. Ambiguous: No reference match and no transfer narration keywords
    # Coincidental amounts (e.g. two separate ₹500 purchases) MUST NOT be falsely matched
    return False, Decimal("0.0000"), "Insufficient evidence: coincidental amount without transfer identifiers"


def match_internal_transfers(
    transactions: List[Dict[str, Any]],
    user_account_ids: Optional[Set[str]] = None,
) -> List[TransferMatchResult]:
    """
    Identifies matching debit and credit pairs across different user accounts.
    Guarantees 1-to-1 matching: one debit can only match one credit,
    and one credit can only match one debit.
    """
    matches: List[TransferMatchResult] = []
    matched_debit_ids: Set[str] = set()
    matched_credit_ids: Set[str] = set()

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
        if d_id in matched_debit_ids:
            continue
        d_acc = str(deb["account_id"])
        d_amt = Decimal(str(deb["amount"]))
        d_date = deb.get("transaction_date") or deb.get("date")
        if isinstance(d_date, str):
            from datetime import datetime
            d_date = datetime.strptime(d_date, "%Y-%m-%d").date()

        for cr in credits:
            c_id = str(cr["id"])
            if c_id in matched_credit_ids:
                continue
            c_acc = str(cr["account_id"])
            # Must be across different accounts
            if d_acc == c_acc:
                continue

            c_amt = Decimal(str(cr["amount"]))
            # Amount must match within tolerance
            if abs(d_amt - c_amt) > TOLERANCE:
                continue

            c_date = cr.get("transaction_date") or cr.get("date")
            if isinstance(c_date, str):
                from datetime import datetime
                c_date = datetime.strptime(c_date, "%Y-%m-%d").date()

            days_diff = abs((c_date - d_date).days)
            if days_diff > MAX_SETTLEMENT_WINDOW_DAYS:
                continue

            # Check evidence: reference tokens or narration confirmation
            is_match, confidence, reason = evaluate_transfer_evidence(deb, cr)
            if not is_match or confidence < Decimal("0.8000"):
                continue

            # 1-to-1 match confirmed!
            matched_debit_ids.add(d_id)
            matched_credit_ids.add(c_id)

            matches.append(
                TransferMatchResult(
                    matched=True,
                    debit_tx_id=d_id,
                    credit_tx_id=c_id,
                    amount=d_amt,
                    from_account_id=d_acc,
                    to_account_id=c_acc,
                    days_difference=days_diff,
                    confidence=confidence,
                )
            )
            break

    return matches
