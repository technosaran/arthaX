"""
Financial Calculation Engine - Indian Bank Adapter
Parses Indian Bank statements in PDF and CSV format.
Supports standard Indian Bank layout:
Date | Particulars | Cheque No | Withdrawals(Dr) | Deposits(Cr) | Balance
"""

import re
import csv
import io
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List, Dict, Any
import pymupdf

from .base_adapter import BaseBankAdapter
from .models import StatementParseResult, StatementMetadata, ParsedTransactionItem
from .pdf_decryptor import open_pdf_document, compute_file_hash
from .statement_validator import validate_statement_math
from .sbi_adapter import parse_date, parse_amount


class IndianBankAdapter(BaseBankAdapter):
    BANK_NAME = "INDIAN_BANK"
    PARSER_VERSION = "2.0.0"

    def can_parse(self, content: bytes, filename: str) -> bool:
        fn = filename.lower()
        if fn.endswith(".csv"):
            try:
                sample = content[:4096].decode("utf-8", errors="ignore").upper()
                if "INDIAN BANK" in sample or "IDIB" in sample or "WITHDRAWALS(DR)" in sample:
                    return True
            except Exception:
                pass
        elif fn.endswith(".pdf"):
            try:
                doc = pymupdf.open(stream=content, filetype="pdf")
                if doc.is_encrypted:
                    doc.close()
                    return "indian" in fn or "idib" in fn
                text = ""
                for i in range(min(2, doc.page_count)):
                    text += doc[i].get_text().upper()
                doc.close()
                return "INDIAN BANK" in text or "IDIB" in text or "INDIANBANK.IN" in text
            except Exception:
                pass
        return "indian" in fn or "idib" in fn

    def parse(
        self,
        content: bytes,
        filename: str,
        passwords: Optional[List[str]] = None,
    ) -> StatementParseResult:
        file_hash = compute_file_hash(content)
        fn = filename.lower()

        if fn.endswith(".csv"):
            return self._parse_csv(content, filename, file_hash)
        else:
            return self._parse_pdf(content, filename, file_hash, passwords)

    def _parse_csv(self, content: bytes, filename: str, file_hash: str) -> StatementParseResult:
        text = content.decode("utf-8", errors="replace")
        lines = text.splitlines()

        account_number = None
        ifsc_code = None
        header_index = -1

        for i, line in enumerate(lines[:30]):
            upper = line.upper()
            if "ACCOUNT" in upper and "NO" in upper:
                m = re.search(r"(\d{9,18})", line)
                if m:
                    account_number = m.group(1)
            if "IDIB" in upper:
                m = re.search(r"(IDIB\d{7})", upper)
                if m:
                    ifsc_code = m.group(1)
            if "DATE" in upper and ("PARTICULARS" in upper or "WITHDRAWAL" in upper):
                header_index = i
                break

        if header_index == -1:
            header_index = 0

        reader = csv.reader(lines[header_index:])
        header = None
        transactions: List[ParsedTransactionItem] = []
        raw_row_idx = 0

        for row in reader:
            if not row or not any(row):
                continue
            if header is None:
                header = [h.strip().upper() for h in row]
                continue

            raw_row_idx += 1
            row_dict = {header[idx]: (row[idx].strip() if idx < len(row) else "") for idx in range(len(header))}

            txn_date_str = (
                row_dict.get("DATE")
                or row_dict.get("TXN DATE")
                or (row[0].strip() if len(row) > 0 else "")
            )
            parsed_d = parse_date(txn_date_str)
            if not parsed_d:
                continue

            narration = (
                row_dict.get("PARTICULARS")
                or row_dict.get("DESCRIPTION")
                or (row[1].strip() if len(row) > 1 else "")
            )
            chq_no = (
                row_dict.get("CHEQUE NO")
                or row_dict.get("CHQ NO")
                or (row[2].strip() if len(row) > 2 else "")
            )

            withdrawal_str = (
                row_dict.get("WITHDRAWALS(DR)")
                or row_dict.get("WITHDRAWALS")
                or row_dict.get("DEBIT")
                or (row[3].strip() if len(row) > 3 else "")
            )
            deposit_str = (
                row_dict.get("DEPOSITS(CR)")
                or row_dict.get("DEPOSITS")
                or row_dict.get("CREDIT")
                or (row[4].strip() if len(row) > 4 else "")
            )
            balance_str = (
                row_dict.get("BALANCE")
                or (row[5].strip() if len(row) > 5 else "")
            )

            debit_amt = parse_amount(withdrawal_str)
            credit_amt = parse_amount(deposit_str)
            bal_amt = parse_amount(balance_str) if balance_str else None

            if debit_amt > Decimal("0.00"):
                direction = "DEBIT"
                amount = debit_amt
            elif credit_amt > Decimal("0.00"):
                direction = "CREDIT"
                amount = credit_amt
            else:
                continue

            ref_no = chq_no if chq_no else None
            m_ref = re.search(r"(?:UPI/|IMPS/|NEFT/|UTR:?)(\w{8,25})", narration, re.IGNORECASE)
            if m_ref and not ref_no:
                ref_no = m_ref.group(1)

            clean_narration = " ".join(narration.split())
            transactions.append(
                ParsedTransactionItem(
                    transaction_date=parsed_d,
                    value_date=parsed_d,
                    amount=amount,
                    direction=direction,
                    original_narration=clean_narration,
                    normalized_narration=clean_narration,
                    transaction_reference=ref_no,
                    balance_after_transaction=bal_amt,
                    raw_row_index=raw_row_idx,
                )
            )

        if not transactions:
            return self._build_empty_failure(filename, file_hash, "No valid transactions parsed from Indian Bank CSV.")

        transactions.sort(key=lambda t: t.transaction_date)
        period_start = transactions[0].transaction_date
        period_end = transactions[-1].transaction_date

        first_bal = transactions[0].balance_after_transaction
        last_bal = transactions[-1].balance_after_transaction

        if first_bal is not None:
            if transactions[0].direction == "CREDIT":
                opening_balance = first_bal - transactions[0].amount
            else:
                opening_balance = first_bal + transactions[0].amount
        else:
            opening_balance = Decimal("0.00")

        closing_balance = last_bal if last_bal is not None else Decimal("0.00")

        metadata = StatementMetadata(
            bank_name=self.BANK_NAME,
            account_number_masked=f"******{account_number[-4:]}" if account_number else None,
            statement_period_start=period_start,
            statement_period_end=period_end,
            opening_balance=opening_balance,
            closing_balance=closing_balance,
            ifsc_code=ifsc_code,
        )

        validation = validate_statement_math(metadata, transactions)

        return StatementParseResult(
            success=validation.is_valid,
            bank_name=self.BANK_NAME,
            metadata=metadata,
            transactions=transactions,
            validation=validation,
            parser_version=self.PARSER_VERSION,
            file_hash=file_hash,
            file_name=filename,
            errors=validation.errors,
        )

    def _parse_pdf(
        self,
        content: bytes,
        filename: str,
        file_hash: str,
        passwords: Optional[List[str]] = None,
    ) -> StatementParseResult:
        doc, _ = open_pdf_document(content, passwords)

        try:
            full_text = ""
            for page in doc:
                full_text += page.get_text() + "\n"

            account_number = None
            m_acc = re.search(r"Account\s+(?:No|Number)\s*[:\-]?\s*(\d{9,18})", full_text, re.IGNORECASE)
            if m_acc:
                account_number = m_acc.group(1)

            ifsc = None
            m_ifsc = re.search(r"(IDIB\d{7})", full_text, re.IGNORECASE)
            if m_ifsc:
                ifsc = m_ifsc.group(1).upper()

            lines = full_text.splitlines()
            transactions: List[ParsedTransactionItem] = []
            current_tx: Optional[Dict[str, Any]] = None
            raw_idx = 0

            txn_line_re = re.compile(r"^(\d{2}[/\-]\d{2}[/\-]\d{2,4})\s+(.*)$")

            for line in lines:
                s_line = line.strip()
                if not s_line:
                    continue

                m = txn_line_re.match(s_line)
                if m:
                    date_val = parse_date(m.group(1))
                    if date_val:
                        if current_tx:
                            tx_item = self._finalize_pdf_tx(current_tx)
                            if tx_item:
                                transactions.append(tx_item)
                            current_tx = None

                        raw_idx += 1
                        current_tx = {
                            "date": date_val,
                            "narration_parts": [m.group(2)],
                            "raw_idx": raw_idx,
                            "full_line": s_line,
                        }
                        continue

                if current_tx:
                    current_tx["narration_parts"].append(s_line)

            if current_tx:
                tx_item = self._finalize_pdf_tx(current_tx)
                if tx_item:
                    transactions.append(tx_item)

            if not transactions:
                return self._build_empty_failure(filename, file_hash, "No valid transactions parsed from Indian Bank PDF.")

            transactions.sort(key=lambda t: t.transaction_date)
            period_start = transactions[0].transaction_date
            period_end = transactions[-1].transaction_date

            first_bal = transactions[0].balance_after_transaction
            last_bal = transactions[-1].balance_after_transaction

            if first_bal is not None:
                if transactions[0].direction == "CREDIT":
                    opening_balance = first_bal - transactions[0].amount
                else:
                    opening_balance = first_bal + transactions[0].amount
            else:
                opening_balance = Decimal("0.00")

            closing_balance = last_bal if last_bal is not None else Decimal("0.00")

            metadata = StatementMetadata(
                bank_name=self.BANK_NAME,
                account_number_masked=f"******{account_number[-4:]}" if account_number else None,
                statement_period_start=period_start,
                statement_period_end=period_end,
                opening_balance=opening_balance,
                closing_balance=closing_balance,
                ifsc_code=ifsc,
            )

            validation = validate_statement_math(metadata, transactions)

            return StatementParseResult(
                success=validation.is_valid,
                bank_name=self.BANK_NAME,
                metadata=metadata,
                transactions=transactions,
                validation=validation,
                parser_version=self.PARSER_VERSION,
                file_hash=file_hash,
                file_name=filename,
                errors=validation.errors,
            )
        finally:
            doc.close()

    def _finalize_pdf_tx(self, tx_dict: Dict[str, Any]) -> Optional[ParsedTransactionItem]:
        combined_text = " ".join(tx_dict["narration_parts"]).strip()
        tokens = combined_text.split()

        numeric_tokens = []
        for tok in reversed(tokens):
            clean_tok = tok.replace(",", "").replace("Cr", "").replace("Dr", "")
            try:
                val = Decimal(clean_tok)
                numeric_tokens.append(val)
                if len(numeric_tokens) >= 3:
                    break
            except Exception:
                if numeric_tokens:
                    break

        if not numeric_tokens:
            return None

        bal = numeric_tokens[0]
        amt = numeric_tokens[1] if len(numeric_tokens) > 1 else Decimal("0.00")

        upper_text = combined_text.upper()
        if "CR" in tokens[-1].upper() or "DEPOSIT" in upper_text or "BY " in upper_text:
            direction = "CREDIT"
        else:
            direction = "DEBIT"

        ref_no = None
        m_ref = re.search(r"(?:UPI/|IMPS/|NEFT/|UTR:?)(\w{8,25})", combined_text, re.IGNORECASE)
        if m_ref:
            ref_no = m_ref.group(1)

        clean_narration = " ".join([t for t in tokens if not re.match(r"^[\d,.]+$", t)])

        return ParsedTransactionItem(
            transaction_date=tx_dict["date"],
            value_date=tx_dict["date"],
            amount=abs(amt),
            direction=direction,
            original_narration=combined_text,
            normalized_narration=clean_narration,
            transaction_reference=ref_no,
            balance_after_transaction=bal,
            raw_row_index=tx_dict["raw_idx"],
        )

    def _build_empty_failure(self, filename: str, file_hash: str, error_msg: str) -> StatementParseResult:
        empty_meta = StatementMetadata(
            bank_name=self.BANK_NAME,
            statement_period_start=date.today(),
            statement_period_end=date.today(),
            opening_balance=Decimal("0.00"),
            closing_balance=Decimal("0.00"),
        )
        empty_val = validate_statement_math(empty_meta, [])
        empty_val.is_valid = False
        empty_val.errors.append(error_msg)
        return StatementParseResult(
            success=False,
            bank_name=self.BANK_NAME,
            metadata=empty_meta,
            transactions=[],
            validation=empty_val,
            parser_version=self.PARSER_VERSION,
            file_hash=file_hash,
            file_name=filename,
            errors=[error_msg],
        )
