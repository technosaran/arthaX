"""
Financial Calculation Engine - Statement Validation Engine
Strict mathematical reconciliation and continuity checking for bank statements.
"""

from decimal import Decimal
from typing import List, Optional, Tuple
from .models import ParsedTransactionItem, StatementMetadata, ValidationResult


TOLERANCE = Decimal("0.01")


def validate_statement_math(
    metadata: StatementMetadata,
    transactions: List[ParsedTransactionItem],
) -> ValidationResult:
    """
    Validates:
    Opening Balance + Total Credits - Total Debits == Closing Balance
    """
    total_credits = Decimal("0.00")
    total_debits = Decimal("0.00")
    errors: List[str] = []
    warnings: List[str] = []

    for tx in transactions:
        if tx.direction == "CREDIT":
            total_credits += tx.amount
        elif tx.direction == "DEBIT":
            total_debits += tx.amount

        # Check date range
        if tx.transaction_date < metadata.statement_period_start or tx.transaction_date > metadata.statement_period_end:
            warnings.append(
                f"Transaction on {tx.transaction_date} falls outside declared period "
                f"({metadata.statement_period_start} to {metadata.statement_period_end})"
            )

    calculated_closing = metadata.opening_balance + total_credits - total_debits
    discrepancy = abs(calculated_closing - metadata.closing_balance)

    is_valid = discrepancy <= TOLERANCE

    if not is_valid:
        errors.append(
            f"Mathematical discrepancy: Opening ({metadata.opening_balance}) + "
            f"Credits ({total_credits}) - Debits ({total_debits}) = "
            f"{calculated_closing}, but reported Closing is {metadata.closing_balance}. "
            f"Difference of {discrepancy}."
        )

    # Check reported summary vs sum if metadata has non-zero total_credits/debits
    if metadata.total_credits > Decimal("0.00"):
        if abs(metadata.total_credits - total_credits) > TOLERANCE:
            warnings.append(
                f"Reported total credits ({metadata.total_credits}) differs from "
                f"sum of transactions ({total_credits})."
            )

    if metadata.total_debits > Decimal("0.00"):
        if abs(metadata.total_debits - total_debits) > TOLERANCE:
            warnings.append(
                f"Reported total debits ({metadata.total_debits}) differs from "
                f"sum of transactions ({total_debits})."
            )

    return ValidationResult(
        is_valid=is_valid,
        opening_balance=metadata.opening_balance,
        total_credits=total_credits,
        total_debits=total_debits,
        calculated_closing_balance=calculated_closing,
        reported_closing_balance=metadata.closing_balance,
        discrepancy_amount=discrepancy,
        transaction_count=len(transactions),
        errors=errors,
        warnings=warnings,
    )


def validate_statement_continuity(
    prior_closing_balance: Decimal,
    new_opening_balance: Decimal,
) -> Tuple[bool, Optional[str]]:
    """
    Validates continuity between consecutive statements:
    New Opening Balance must equal Prior Closing Balance.
    """
    diff = abs(new_opening_balance - prior_closing_balance)
    if diff <= TOLERANCE:
        return True, None
    return False, (
        f"Statement continuity break: Previous closing balance ({prior_closing_balance}) "
        f"does not match new statement opening balance ({new_opening_balance}). Discrepancy: {diff}."
    )
