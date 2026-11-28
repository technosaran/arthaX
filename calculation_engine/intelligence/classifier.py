"""
Financial Calculation Engine - Hybrid Transaction Classifier
Multi-layer Indian banking classification waterfall covering refunds, statutory taxes,
charges, ATM/cash, salary/interest/dividend income, internal transfers, credit card bills,
loans/EMIs, investments/SIPs, insurance, merchant & VPA database, and UPI P2P/P2M resolution.
"""

import re
from decimal import Decimal
from typing import Optional
from .models import TransactionClassificationInput, ClassificationResult
from .entity_database import lookup_merchant_by_name, lookup_merchant_by_vpa
from .upi_parser import parse_upi_narration


class TransactionClassifier:
    def _detect_channel(self, upper: str) -> str:
        if "UPI" in upper or "@" in upper:
            return "UPI"
        if re.search(r"\bIMPS\b", upper):
            return "IMPS"
        if re.search(r"\bNEFT\b", upper):
            return "NEFT"
        if re.search(r"\bRTGS\b", upper):
            return "RTGS"
        if re.search(r"\b(?:ATM|NFS|CDM)\b", upper):
            return "ATM"
        if any(k in upper for k in ("NACH", "ACH ", "ECS ", "AUTOPAY", "MANDATE")):
            return "NACH"
        if any(k in upper for k in ("POS ", "POS/", "POS-", "DEBIT CARD", "CREDIT CARD", "ECOM", "SWIPE")):
            return "CARD"
        if any(k in upper for k in ("NETBANKING", "INB", "MB ", "MOBILE BANKING")):
            return "NETBANKING"
        if any(k in upper for k in ("INT.PD", "INTEREST PAID", "INTEREST CREDIT", "CREDIT INTEREST")):
            return "INTEREST"
        if any(k in upper for k in ("CHARGE", "FEE", "PENALTY", "SMS CHG", "MIN BAL", "AMB ")):
            return "BANK"
        if any(k in upper for k in ("CHQ", "CHEQUE", "CLG", "CLEARING")):
            return "CHEQUE"
        return "OTHER"

    def _normalize_narration(self, raw: str) -> str:
        return " ".join(str(raw or "").split())

    def classify(self, tx: TransactionClassificationInput) -> ClassificationResult:
        narration = self._normalize_narration(tx.original_narration)
        upper = narration.upper()
        direction = (tx.direction or "DEBIT").upper()

        upi_meta = parse_upi_narration(narration)
        channel_resolved = upi_meta["channel"] if upi_meta else self._detect_channel(upper)

        vpa = upi_meta.get("vpa") if upi_meta else None
        cp_name = upi_meta.get("counterparty_name") if upi_meta else None

        # Pre-resolve merchant entity so refunds & purchases both get accurate merchant + category
        merchant_entity = None
        if vpa:
            merchant_entity = lookup_merchant_by_vpa(vpa)
        if not merchant_entity:
            merchant_entity = lookup_merchant_by_name(narration)

        # 1. Refunds, Reversals & Cashbacks (strictly on CREDIT with explicit refund/reversal signal)
        is_explicit_refund_kw = bool(
            re.search(
                r"\b(REFUND|REVERSAL|REVERSED|REV\s+TXN|CHARGEBACK|FAILED\s+TXN|CASHBACK|MERCHANT\s+REFUND)\b",
                upper,
            )
            or (
                re.search(r"\bRETURN\b", upper)
                and any(w in upper for w in ("REFUND", "RETAIL", "ORDER", "AMAZON", "FLIPKART", "MYNTRA", "MERCHANT"))
            )
        )
        if direction == "CREDIT" and is_explicit_refund_kw:
            m_name = merchant_entity["name"] if merchant_entity else cp_name
            m_cat = merchant_entity["category"] if merchant_entity else "Shopping"
            return ClassificationResult(
                category=m_cat,
                transaction_type="REFUND",
                confidence=Decimal("0.9600"),
                reason="RULE:CREDIT_REFUND_REVERSAL",
                merchant_name=m_name,
                merchant_category=m_cat,
                counterparty_name=cp_name or m_name,
                counterparty_identifier=vpa,
                channel=channel_resolved,
                is_refund=True,
                normalized_narration=narration,
            )

        # 2. Bank Charges, Fees & Penalties
        if direction == "DEBIT" and re.search(
            r"\b(SMS\s*CHARGES?|CONSOLIDATED.*CHARGES?|AMB\s*CHARGE|MIN\s*BAL|ANNUAL\s*FEE|CARD\s*FEE|"
            r"ISSUANCE\s*FEE|MAINTENANCE\s*CHARGE|RETURN\s*CHARGE|CHEQUE\s*BOUNCE|LATE\s*FEE|"
            r"FINANCE\s*CHARGE|FOREX\s*MARKUP|MARKUP\s*FEE|CONVENIENCE\s*FEE|PENALTY|PENAL)\b",
            upper,
        ):
            return ClassificationResult(
                category="Bank Charges",
                transaction_type="BANK_CHARGES",
                confidence=Decimal("0.9700"),
                reason="RULE:BANK_FEE_OR_CHARGE",
                merchant_name=tx.bank_name or "Bank",
                merchant_category="Bank Charges",
                channel="BANK",
                normalized_narration=narration,
            )

        # 3. Direct Taxes & Government Statutory Payments
        if direction == "DEBIT" and re.search(
            r"\b(INCOME\s*TAX|ADVANCE\s*TAX|SELF\s*ASSESSMENT|CHALLAN\s*280|CBDT|TIN\s*NSDL|"
            r"GST\s*PAYMENT|CGST|SGST|IGST|TDS\s*PAYMENT|TRACES|OLTAS)\b",
            upper,
        ):
            return ClassificationResult(
                category="Taxes",
                transaction_type="TAX_PAYMENT",
                confidence=Decimal("0.9600"),
                reason="RULE:STATUTORY_TAX_PAYMENT",
                merchant_name="Income Tax / Gov",
                merchant_category="Taxes",
                channel=channel_resolved,
                normalized_narration=narration,
            )

        # 4. ATM Cash Withdrawals
        if direction == "DEBIT" and re.search(r"\b(ATM\s*WDL|ATM\s*CASH|CASH\s*WDL|CASH\s*WITHDRAWAL|NFS/ATM|ATM/)\b|\bATM\b", upper):
            return ClassificationResult(
                category="Cash & ATM",
                transaction_type="ATM_WITHDRAWAL",
                confidence=Decimal("0.9850"),
                reason="RULE:ATM_CASH_WITHDRAWAL",
                merchant_name="ATM Withdrawal",
                merchant_category="Cash & ATM",
                channel="ATM",
                normalized_narration=narration,
            )

        # 5. Salary & Payroll Credits
        if direction == "CREDIT" and re.search(r"\b(SALARY|PAYROLL|SAL\s*CR|STIPEND|WAGES|SALARY\s*CREDIT)\b", upper):
            return ClassificationResult(
                category="Salary",
                transaction_type="SALARY",
                confidence=Decimal("0.9700"),
                reason="RULE:SALARY_CREDIT",
                counterparty_name=cp_name,
                counterparty_identifier=vpa,
                channel=channel_resolved,
                normalized_narration=narration,
            )

        # 6. Interest & Dividend Credits
        if direction == "CREDIT" and re.search(
            r"\b(INT\.?\s*PD|INTEREST\s*PAID|INTEREST\s*CREDIT|CR\s*INTEREST|SAVINGS\s*INT|FD\s*INT|QTRLY\s*INT)\b",
            upper,
        ):
            return ClassificationResult(
                category="Interest & Dividends",
                transaction_type="INTEREST_INCOME",
                confidence=Decimal("0.9600"),
                reason="RULE:INTEREST_CREDIT",
                merchant_name=tx.bank_name or "Bank",
                merchant_category="Interest & Dividends",
                channel="INTEREST",
                normalized_narration=narration,
            )

        if direction == "CREDIT" and re.search(r"\b(DIVIDEND|FINAL\s*DIV|INTERIM\s*DIV|ACH\s*CR.*DIV)\b", upper):
            return ClassificationResult(
                category="Interest & Dividends",
                transaction_type="DIVIDEND",
                confidence=Decimal("0.9500"),
                reason="RULE:DIVIDEND_CREDIT",
                counterparty_name=cp_name,
                channel="NACH" if "ACH" in upper else channel_resolved,
                normalized_narration=narration,
            )

        # 7. Explicit Internal / Self Account Transfers
        if re.search(
            r"\b(SELF\s*TRANSFER|SELF\s*TRF|OWN\s*A/?C|OWN\s*ACCOUNT|TO\s*OWN|INTER[_\s]ACCOUNT|"
            r"SWEEP\s*(?:TO|FROM)|AUTOSWEEP|MOD\s*TRF|INTERNAL\s*TRANSFER)\b",
            upper,
        ):
            return ClassificationResult(
                category="Transfer",
                transaction_type="INTERNAL_TRANSFER",
                confidence=Decimal("0.9500"),
                reason="RULE:EXPLICIT_SELF_TRANSFER",
                counterparty_name=cp_name,
                counterparty_identifier=vpa,
                channel=channel_resolved,
                is_transfer=True,
                normalized_narration=narration,
            )

        # 8. Credit Card Bill Payments
        if direction == "DEBIT" and (
            re.search(
                r"\b(CC\s*BILL|CREDIT\s*CARD\s*BILL|CREDIT\s*CARD\s*PAY|CARD\s*PYMT|"
                r"HDFC\s*CARD|ICICI\s*CARD|AXIS\s*CARD|SBI\s*CARD|AMEX\s*BILL)\b",
                upper,
            )
            or (merchant_entity and merchant_entity["name"] == "CRED")
        ):
            return ClassificationResult(
                category="Credit Card Payment",
                transaction_type="CREDIT_CARD_PAYMENT",
                confidence=Decimal("0.9400"),
                reason="RULE:CREDIT_CARD_BILL",
                merchant_name=merchant_entity["name"] if merchant_entity else "Credit Card Bill",
                merchant_category="Credit Card Payment",
                counterparty_identifier=vpa,
                channel=channel_resolved,
                normalized_narration=narration,
            )

        # 9. Loan EMI & NACH Auto-Debits
        if direction == "DEBIT" and re.search(
            r"\b(EMI|LOAN\s*REPAY|HOME\s*LOAN|AUTO\s*LOAN|PERSONAL\s*LOAN|CAR\s*LOAN|"
            r"BAJAJ\s*FIN|HDFC\s*LTD|LIC\s*HOUSING|HDB\s*FIN)\b",
            upper,
        ):
            return ClassificationResult(
                category="Loans & EMIs",
                transaction_type="LOAN_EMI",
                confidence=Decimal("0.9400"),
                reason="RULE:LOAN_OR_EMI",
                merchant_name=cp_name or "Loan EMI",
                merchant_category="Loans & EMIs",
                channel="NACH" if "NACH" in upper or "ACH" in upper else channel_resolved,
                normalized_narration=narration,
            )

        # 10. Mutual Funds / SIPs / Investments
        if direction == "DEBIT" and re.search(
            r"\b(SIP|MUTUAL\s*FUND|MF\s*PURCHASE|BSE\s*STAR|NSEMF|PPFAS|SBI\s*MF|HDFC\s*MF|NIPPON|MIRAE|NPS|PPF|EPFO|SGB)\b",
            upper,
        ):
            return ClassificationResult(
                category="Investments",
                transaction_type="INVESTMENT_PURCHASE",
                confidence=Decimal("0.9400"),
                reason="RULE:INVESTMENT_SIP",
                merchant_name=merchant_entity["name"] if merchant_entity else cp_name,
                merchant_category="Investments",
                counterparty_identifier=vpa,
                channel=channel_resolved,
                normalized_narration=narration,
            )

        # 11. Known Indian Merchant / VPA Database Match
        if merchant_entity:
            return ClassificationResult(
                category=merchant_entity["category"],
                transaction_type=merchant_entity["type"],
                confidence=Decimal("0.9400"),
                reason=f"ENTITY_DB:{merchant_entity['name'].upper()}",
                merchant_name=merchant_entity["name"],
                merchant_category=merchant_entity["category"],
                counterparty_name=cp_name or merchant_entity["name"],
                counterparty_identifier=vpa,
                channel=channel_resolved,
                normalized_narration=narration,
            )

        # 12. Domain Keyword Heuristics (Clean Indian banking terms — no spurious local literals)
        heuristic_rules = [
            ("Food & Dining", "FOOD_DINING", r"\b(RESTAURANT|CAFE|COFFEE|BAKERY|BIRYANI|PIZZA|HOTEL|DINING|CANTEEN|DHABA|SWEETS|FOOD)\b"),
            ("Groceries", "FOOD_DINING", r"\b(GROCERY|GROCERIES|SUPERMARKET|KIRANA|VEGETABLE|FRUITS|DAIRY|MILK|PROVISION)\b"),
            ("Transportation", "TRAVEL", r"\b(PETROL|DIESEL|FUEL|FILLING\s*STATION|PUMP|CAB|TAXI|METRO|PARKING|TOLL|AUTO\s*RICKSHAW|FASTAG)\b"),
            ("Travel", "TRAVEL", r"\b(AIRLINE|FLIGHT|AIRPORT|RAILWAY|TRAIN|HOTEL\s*STAY|RESORT|BOOKING)\b"),
            ("Utilities", "UTILITIES", r"\b(ELECTRICITY|POWER\s*BILL|WATER\s*BILL|BROADBAND|FIBERNET|WIFI|GAS\s*BILL|RECHARGE|POSTPAID|DTH|TELECOM)\b"),
            ("Healthcare & Fitness", "MERCHANT_EXPENSE", r"\b(PHARMACY|CHEMIST|MEDICAL|MEDICINE|HOSPITAL|CLINIC|DOCTOR|DENTAL|DIAGNOSTIC|LAB|PATHOLOGY|GYM|FITNESS)\b"),
            ("Insurance", "INSURANCE", r"\b(INSURANCE|POLICY|PREMIUM|GENERAL\s*INS|LIFE\s*INS|HEALTH\s*INS)\b"),
            ("Rent & Housing", "RENT", r"\b(HOUSE\s*RENT|MONTHLY\s*RENT|FLAT\s*RENT|SOCIETY\s*MAINT|MAINTENANCE\s*BILL|RENTAL)\b"),
            ("Education", "MERCHANT_EXPENSE", r"\b(SCHOOL\s*FEE|TUITION|COLLEGE|UNIVERSITY|EXAM\s*FEE|COURSE\s*FEE|BOOKS)\b"),
            ("Entertainment", "MERCHANT_EXPENSE", r"\b(CINEMA|MULTIPLEX|MOVIE|THEATRE|TICKET|CONCERT|STREAMING)\b"),
        ]
        for cat, t_type, pattern in heuristic_rules:
            if re.search(pattern, upper):
                return ClassificationResult(
                    category=cat,
                    transaction_type=t_type,
                    confidence=Decimal("0.8400"),
                    reason=f"HEURISTIC:{t_type}",
                    merchant_name=cp_name,
                    merchant_category=cat,
                    counterparty_name=cp_name,
                    counterparty_identifier=vpa,
                    channel=channel_resolved,
                    normalized_narration=narration,
                )

        # 13. UPI P2P / Named Counterparty Resolution
        if upi_meta and cp_name:
            if direction == "CREDIT":
                return ClassificationResult(
                    category="Other Inflow",
                    transaction_type="P2P_CREDIT" if upi_meta.get("mode") == "P2P" else "OTHER_CREDIT",
                    confidence=Decimal("0.7500"),
                    reason="UPI:COUNTERPARTY_CREDIT",
                    counterparty_name=cp_name,
                    counterparty_identifier=vpa,
                    channel="UPI",
                    normalized_narration=narration,
                )
            return ClassificationResult(
                category="Person-to-Person" if upi_meta.get("mode") == "P2P" else "Other Expense",
                transaction_type="P2P_TRANSFER" if upi_meta.get("mode") == "P2P" else "MERCHANT_EXPENSE",
                confidence=Decimal("0.7500"),
                reason="UPI:COUNTERPARTY_DEBIT",
                counterparty_name=cp_name,
                counterparty_identifier=vpa,
                channel="UPI",
                normalized_narration=narration,
            )

        # 14. Clean Direction Fallback
        if direction == "DEBIT":
            return ClassificationResult(
                category="Other Expense",
                transaction_type="UNKNOWN",
                confidence=Decimal("0.6000"),
                reason="HEURISTIC:UNCATEGORIZED_DEBIT",
                channel=channel_resolved,
                normalized_narration=narration,
            )
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
