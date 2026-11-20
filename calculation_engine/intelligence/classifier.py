"""
Financial Calculation Engine - Hybrid Transaction Classifier
Combines deterministic bank code rules, merchant entity resolution, UPI parsing,
and calibrated confidence scoring.
"""

import re
from decimal import Decimal
from typing import Optional, List, Dict, Any

from .models import TransactionClassificationInput, ClassificationResult
from .entity_database import lookup_merchant_by_name, lookup_merchant_by_vpa
from .upi_parser import parse_upi_narration


def clean_narration(raw: str) -> str:
    """Normalizes narration by stripping non-standard delimiters and redundant whitespace."""
    s = re.sub(r"[\t\r\n]+", " ", raw)
    s = re.sub(r"\s+", " ", s).strip()
    return s


class TransactionClassifier:
    def classify(self, inp: TransactionClassificationInput) -> ClassificationResult:
        narration = clean_narration(inp.original_narration)
        upper = narration.upper()
        direction = inp.direction.upper()
        amount = inp.amount

        # -------------------------------------------------------------
        # 1. Deterministic Refunds & Reversals (Direction == CREDIT)
        # -------------------------------------------------------------
        if direction == "CREDIT":
            if any(k in upper for k in ("REFUND", "REVERSAL", "RET DEBIT", "RETURN", "CHARGEBACK")):
                # Find refunded merchant if present
                merchant = lookup_merchant_by_name(upper)
                return ClassificationResult(
                    category=merchant["category"] if merchant else "Refunds & Reversals",
                    transaction_type="REFUND",
                    confidence=Decimal("0.9600"),
                    reason="DETERMINISTIC:REFUND_OR_REVERSAL_KEYWORD",
                    merchant_name=merchant["name"] if merchant else None,
                    is_refund=True,
                    channel="UPI" if "UPI" in upper else "OTHER",
                    normalized_narration=narration,
                )

        # -------------------------------------------------------------
        # 2. Deterministic Salary & Regular Earnings (Direction == CREDIT)
        # -------------------------------------------------------------
        if direction == "CREDIT":
            if any(k in upper for k in ("SALARY", "SAL/CREDIT", "CMS/SALARY", "ACH/SALARY", "MONTHLY SAL")):
                return ClassificationResult(
                    category="Salary",
                    transaction_type="SALARY",
                    confidence=Decimal("0.9700"),
                    reason="DETERMINISTIC:SALARY_PAYROLL_CREDIT",
                    channel="ACH" if "ACH" in upper or "CMS" in upper else "OTHER",
                    normalized_narration=narration,
                )
            if any(k in upper for k in ("INT.PD", "INTEREST CREDIT", "INT CR", "QUARTERLY INTEREST")):
                return ClassificationResult(
                    category="Interest",
                    transaction_type="INTEREST",
                    confidence=Decimal("0.9800"),
                    reason="DETERMINISTIC:BANK_INTEREST_CREDIT",
                    channel="NET_BANKING",
                    normalized_narration=narration,
                )
            if any(k in upper for k in ("DIVIDEND", "ACH/DIV", "BSE DIVIDEND", "NSE DIVIDEND")):
                return ClassificationResult(
                    category="Dividends",
                    transaction_type="DIVIDEND",
                    confidence=Decimal("0.9600"),
                    reason="DETERMINISTIC:CORPORATE_DIVIDEND_PAYOUT",
                    channel="ACH",
                    normalized_narration=narration,
                )

        # -------------------------------------------------------------
        # 3. Deterministic Cash Withdrawals & Bank Charges (Direction == DEBIT)
        # -------------------------------------------------------------
        if direction == "DEBIT":
            if any(k in upper for k in ("ATM WDL", "NFS/ATM", "ATM CASH", "CASH WITHDRAWAL", "ATM/CASH")):
                return ClassificationResult(
                    category="Cash & ATM",
                    transaction_type="ATM_WITHDRAWAL",
                    confidence=Decimal("0.9900"),
                    reason="DETERMINISTIC:ATM_PHYSICAL_WITHDRAWAL",
                    channel="ATM",
                    normalized_narration=narration,
                )
            if any(k in upper for k in ("CHG:", "CHARGES", "ANNUAL FEE", "SMS CHG", "SERVICE CHARGE", "CONSOLIDATED CHG")):
                return ClassificationResult(
                    category="Bank Charges",
                    transaction_type="BANK_CHARGES",
                    confidence=Decimal("0.9700"),
                    reason="DETERMINISTIC:BANK_MAINTENANCE_FEES",
                    channel="CHARGES",
                    normalized_narration=narration,
                )
            if any(k in upper for k in ("CHALLAN 280", "INCOME TAX", "CBDT", "GST PMT", "TDS DEDUCT")):
                return ClassificationResult(
                    category="Taxes",
                    transaction_type="TAX_PAYMENT",
                    confidence=Decimal("0.9500"),
                    reason="DETERMINISTIC:TAX_AUTHORITY_CHALLAN",
                    channel="NET_BANKING",
                    normalized_narration=narration,
                )

        # -------------------------------------------------------------
        # 4. UPI VPA & Merchant Resolution
        # -------------------------------------------------------------
        upi_data = parse_upi_narration(narration)
        if upi_data:
            channel = "UPI"
            vpa = upi_data.get("vpa")
            counterparty = upi_data.get("counterparty_name")

            # Check if VPA matches known merchant
            if vpa:
                merchant_match = lookup_merchant_by_vpa(vpa)
                if merchant_match:
                    return ClassificationResult(
                        category=merchant_match["category"],
                        transaction_type=merchant_match["type"],
                        confidence=Decimal("0.9500"),
                        reason=f"ENTITY_REGISTRY:UPI_VPA_MATCH:{merchant_match['name']}",
                        merchant_name=merchant_match["name"],
                        merchant_category=merchant_match["category"],
                        counterparty_name=merchant_match["name"],
                        counterparty_identifier=vpa,
                        channel="UPI",
                        normalized_narration=narration,
                    )

            # Check if narration text contains merchant name
            text_merchant = lookup_merchant_by_name(upper)
            if text_merchant:
                return ClassificationResult(
                    category=text_merchant["category"],
                    transaction_type=text_merchant["type"],
                    confidence=Decimal("0.9300"),
                    reason=f"ENTITY_REGISTRY:NAME_MATCH:{text_merchant['name']}",
                    merchant_name=text_merchant["name"],
                    merchant_category=text_merchant["category"],
                    counterparty_name=text_merchant["name"],
                    counterparty_identifier=vpa,
                    channel="UPI",
                    normalized_narration=narration,
                )

            # Check if P2P UPI
            if upi_data.get("mode") == "P2P":
                tx_type = "PERSONAL_TRANSFER_SENT" if direction == "DEBIT" else "PERSONAL_TRANSFER_RECEIVED"
                cat = "Personal Transfers" if direction == "DEBIT" else "Other Inflow"
                return ClassificationResult(
                    category=cat,
                    transaction_type=tx_type,
                    confidence=Decimal("0.8500"),
                    reason="UPI:PEER_TO_PEER_TRANSFER",
                    counterparty_name=counterparty,
                    counterparty_identifier=vpa,
                    channel="UPI",
                    normalized_narration=narration,
                )

        # -------------------------------------------------------------
        # 5. Non-UPI Direct Merchant Match
        # -------------------------------------------------------------
        merchant_match = lookup_merchant_by_name(upper)
        if merchant_match:
            return ClassificationResult(
                category=merchant_match["category"],
                transaction_type=merchant_match["type"],
                confidence=Decimal("0.9000"),
                reason=f"ENTITY_REGISTRY:NAME_MATCH:{merchant_match['name']}",
                merchant_name=merchant_match["name"],
                merchant_category=merchant_match["category"],
                channel="POS" if "POS" in upper else ("NEFT" if "NEFT" in upper else "OTHER"),
                normalized_narration=narration,
            )

        # -------------------------------------------------------------
        # 6. Fallback Heuristics
        # -------------------------------------------------------------
        channel_resolved = "OTHER"
        if "NEFT" in upper:
            channel_resolved = "NEFT"
        elif "RTGS" in upper:
            channel_resolved = "RTGS"
        elif "IMPS" in upper:
            channel_resolved = "IMPS"
        elif "POS" in upper or "CARD" in upper:
            channel_resolved = "POS"
        elif "ACH" in upper or "NACH" in upper:
            channel_resolved = "ACH"

        if direction == "DEBIT":
            return ClassificationResult(
                category="General Expenses",
                transaction_type="MERCHANT_EXPENSE",
                confidence=Decimal("0.6000"),
                reason="HEURISTIC:UNCATEGORIZED_DEBIT",
                channel=channel_resolved,
                normalized_narration=narration,
            )
        else:
            return ClassificationResult(
                category="Other Inflow",
                transaction_type="UNKNOWN",
                confidence=Decimal("0.5000"),
                reason="HEURISTIC:UNCATEGORIZED_CREDIT",
                channel=channel_resolved,
                normalized_narration=narration,
            )


# Global singleton
classifier = TransactionClassifier()
