"""
Financial Calculation Engine - Axis Bank Adapter
Parses Axis Bank statements in PDF and CSV format.
Supports standard Axis layout:
Tran Date | Value Date | Transaction Particulars | Chq No | Amount | DR/CR | Balance
or Debit / Credit separate columns.
Handles multi-line narration continuation and balance reconciliation.
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
from .sbi_adapter import parse_date, parse_amount, InvalidAmountError


class AxisBankAdapter(BaseBankAdapter):
    BANK_NAME = "AXIS"
    PARSER_VERSION = "2.0.0"

    def can_parse(self, content: bytes, filename: str) -> bool:
        fn = filename.lower()
        if fn.endswith(".csv"):
            try:
                sample = content[:4096].decode("utf-8", errors="ignore").upper()
                if "AXIS" in sample or "UTIB" in sample or "TRAN DATE" in sample:
                    return True
            except Exception:
                pass
        elif fn.endswith(".pdf"):
            try:
                doc = pymupdf.open(stream=content, filetype="pdf")
                if doc.is_encrypted:
                    doc.close()
                    return "axis" in fn
                text = ""
                for i in range(min(2, doc.page_count)):
                    text += doc[i].get_text().upper()
                doc.close()
                return "AXIS BANK" in text or "AXISBANK.COM" in text or "UTIB" in text
            except Exception:
                pass
        return "axis" in fn

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
        opening_balance = None
        header_index = -1

        for i, line in enumerate(lines[:35]):
            upper = line.upper()
            if "ACCOUNT NO" in upper or "A/C NO" in upper:
                m = re.search(r"(\d{15})", line)
                if m:
                    account_number = m.group(1)
            if "IFSC" in upper:
                m = re.search(r"(UTIB\d{7})", upper)
                if m:
                    ifsc_code = m.group(1)
            if "OPENING BALANCE" in upper:
                m = re.search(r"([\d,]+\.\d{2})", line)
                if m:
                    try:
                        opening_balance = parse_amount(m.group(1))
                    except InvalidAmountError:
                        pass
            if any(k in upper for k in ["TRAN PARTICULARS", "PARTICULARS", "CHQ NO", "DR/CR"]):
                header_index = i
                break

        if header_index == -1:
            for i, line in enumerate(lines[:30]):
                parts = [p.strip().upper() for p in line.split(",")]
                if any("DATE" in p for p in parts) and any("PARTICULAR" in p or "AMOUNT" in p for p in parts):
                    header_index = i
                    break

        if header_index == -1:
            return self._build_empty_failure(filename, file_hash, "Could not find Axis CSV transaction table header row.")

        reader = csv.reader(io.StringIO("\n".join(lines[header_index:])))
        try:
            raw_headers = next(reader)
        except StopIteration:
            return self._build_empty_failure(filename, file_hash, "Empty CSV content in Axis statement.")

        headers = [h.strip().upper() for h in raw_headers]
        date_col = next((idx for idx, h in enumerate(headers) if "TRAN DATE" in h or ("DATE" in h and "VALUE" not in h)), -1)
        val_date_col = next((idx for idx, h in enumerate(headers) if "VALUE DATE" in h or "VALUE" in h), -1)
        narration_col = next((idx for idx, h in enumerate(headers) if "PARTICULAR" in h or "NARRATION" in h or "DESCRIPTION" in h), -1)
        ref_col = next((idx for idx, h in enumerate(headers) if "CHQ" in h or "REF" in h), -1)
        amt_col = next((idx for idx, h in enumerate(headers) if h == "AMOUNT" or "TRANSACTION AMOUNT" in h), -1)
        type_col = next((idx for idx, h in enumerate(headers) if "DR/CR" in h or "TYPE" in h or "DR / CR" in h), -1)
        debit_col = next((idx for idx, h in enumerate(headers) if "DEBIT" in h or "WITHDRAWAL" in h or h == "DR"), -1)
        credit_col = next((idx for idx, h in enumerate(headers) if "CREDIT" in h or "DEPOSIT" in h or h == "CR"), -1)
        balance_col = next((idx for idx, h in enumerate(headers) if "BALANCE" in h), -1)

        if date_col == -1 or narration_col == -1 or (amt_col == -1 and debit_col == -1 and credit_col == -1):
            return self._build_empty_failure(filename, file_hash, "Missing essential transaction columns in Axis CSV.")

        transactions: List[ParsedTransactionItem] = []
        closing_balance = None
        reported_opening = opening_balance

        for row_idx, row in enumerate(reader, start=header_index + 1):
            if not row or all(not cell.strip() for cell in row):
                continue
            if date_col >= len(row):
                continue

            d = parse_date(row[date_col])
            if not d:
                continue

            val_d = parse_date(row[val_date_col]) if (val_date_col != -1 and val_date_col < len(row)) else d
            narration = row[narration_col].strip() if narration_col < len(row) else ""
            ref_no = row[ref_col].strip() if (ref_col != -1 and ref_col < len(row)) else None

            # Handle either (Amount + Dr/Cr column) or (Separate Debit & Credit columns)
            if amt_col != -1 and amt_col < len(row):
                try:
                    amt = parse_amount(row[amt_col])
                except InvalidAmountError:
                    continue
                type_indicator = row[type_col].strip().upper() if (type_col != -1 and type_col < len(row)) else "DR"
                direction = "CREDIT" if ("CR" in type_indicator or "DEPOSIT" in type_indicator) else "DEBIT"
            else:
                try:
                    debit_amt = parse_amount(row[debit_col]) if (debit_col != -1 and debit_col < len(row)) else Decimal("0.00")
                except InvalidAmountError:
                    debit_amt = Decimal("0.00")
                try:
                    credit_amt = parse_amount(row[credit_col]) if (credit_col != -1 and credit_col < len(row)) else Decimal("0.00")
                except InvalidAmountError:
                    credit_amt = Decimal("0.00")

                if debit_amt > 0 and credit_amt == 0:
                    direction = "DEBIT"
                    amt = debit_amt
                elif credit_amt > 0 and debit_amt == 0:
                    direction = "CREDIT"
                    amt = credit_amt
                else:
                    continue

            bal = None
            if balance_col != -1 and balance_col < len(row):
                try:
                    bal = parse_amount(row[balance_col])
                    closing_balance = bal
                    if reported_opening is None:
                        reported_opening = (bal + amt) if direction == "DEBIT" else (bal - amt)
                except InvalidAmountError:
                    pass

            transactions.append(
                ParsedTransactionItem(
                    transaction_date=d,
                    value_date=val_d or d,
                    amount=amt,
                    direction=direction,
                    original_narration=narration,
                    normalized_narration=re.sub(r"\s+", " ", narration).strip(),
                    transaction_reference=ref_no,
                    balance_after_transaction=bal,
                    raw_row_index=row_idx,
                )
            )

        if not transactions:
            return self._build_empty_failure(filename, file_hash, "No valid transactions parsed from Axis CSV.")

        first_d = transactions[0].transaction_date
        last_d = transactions[-1].transaction_date
        p_start = min(first_d, last_d)
        p_end = max(first_d, last_d)

        op_bal = reported_opening if reported_opening is not None else Decimal("0.00")
        cl_bal = closing_balance if closing_balance is not None else op_bal

        metadata = StatementMetadata(
            bank_name=self.BANK_NAME,
            account_number_masked=f"******{account_number[-4:]}" if account_number else None,
            statement_period_start=p_start,
            statement_period_end=p_end,
            opening_balance=op_bal,
            closing_balance=cl_bal,
            ifsc_code=ifsc_code or "UTIB0000001",
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
        )

    def _parse_pdf(
        self,
        content: bytes,
        filename: str,
        file_hash: str,
        passwords: Optional[List[str]] = None,
    ) -> StatementParseResult:
        doc = open_pdf_document(content, filename, passwords)
        try:
            full_text = ""
            for i in range(doc.page_count):
                full_text += doc[i].get_text() + "\n"
        finally:
            doc.close()

        account_number = None
        ifsc_code = None
        m_acc = re.search(r"(?i)(?:account\s*number|a/c\s*no\.?)[\s:]*([0-9]{15})", full_text)
        if m_acc:
            account_number = m_acc.group(1)

        m_ifsc = re.search(r"(UTIB[0-9]{7})", full_text)
        if m_ifsc:
            ifsc_code = m_ifsc.group(1)

        lines = full_text.splitlines()
        transactions: List[ParsedTransactionItem] = []
        current_tx: Optional[Dict[str, Any]] = None

        date_re = re.compile(r"^\s*(\d{2}[/-]\d{2}[/-]\d{4}|\d{2}-[A-Za-z]{3}-\d{4})")

        for idx, line in enumerate(lines):
            line_str = line.strip()
            if not line_str:
                continue

            m_date = date_re.match(line_str)
            if m_date:
                if current_tx:
                    parsed = self._finalize_pdf_tx(current_tx)
                    if parsed:
                        transactions.append(parsed)
                    current_tx = None

                tokens = line_str.split()
                d = parse_date(tokens[0])
                if d:
                    current_tx = {
                        "date": d,
                        "raw_idx": idx,
                        "lines": [line_str],
                    }
            elif current_tx:
                if not any(k in line_str.upper() for k in ["STATEMENT SUMMARY", "PAGE ", "TOTAL", "CLOSING BALANCE"]):
                    current_tx["lines"].append(line_str)
                else:
                    parsed = self._finalize_pdf_tx(current_tx)
                    if parsed:
                        transactions.append(parsed)
                    current_tx = None

        if current_tx:
            parsed = self._finalize_pdf_tx(current_tx)
            if parsed:
                transactions.append(parsed)

        if not transactions:
            return self._build_empty_failure(filename, file_hash, "No valid transactions parsed from Axis PDF.")

        first_d = transactions[0].transaction_date
        last_d = transactions[-1].transaction_date
        p_start = min(first_d, last_d)
        p_end = max(first_d, last_d)

        cl_bal = None
        m_cl = re.search(r"(?i)closing\s*balance[\s:]*([0-9,]+\.[0-9]{2})", full_text)
        if m_cl:
            try:
                cl_bal = parse_amount(m_cl.group(1))
            except InvalidAmountError:
                pass

        if cl_bal is None:
            cl_bal = transactions[-1].balance_after_transaction or Decimal("0.00")

        op_bal = None
        m_op = re.search(r"(?i)opening\s*balance[\s:]*([0-9,]+\.[0-9]{2})", full_text)
        if m_op:
            try:
                op_bal = parse_amount(m_op.group(1))
            except InvalidAmountError:
                pass

        if op_bal is None:
            total_cr = sum(t.amount for t in transactions if t.direction == "CREDIT")
            total_dr = sum(t.amount for t in transactions if t.direction == "DEBIT")
            op_bal = cl_bal - total_cr + total_dr

        metadata = StatementMetadata(
            bank_name=self.BANK_NAME,
            account_number_masked=f"******{account_number[-4:]}" if account_number else None,
            statement_period_start=p_start,
            statement_period_end=p_end,
            opening_balance=op_bal,
            closing_balance=cl_bal,
            ifsc_code=ifsc_code or "UTIB0000001",
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
        )

    def _finalize_pdf_tx(self, tx_dict: Dict[str, Any]) -> Optional[ParsedTransactionItem]:
        combined = " ".join(tx_dict["lines"]).strip()
        tokens = combined.split()
        if len(tokens) < 3:
            return None

        amt_candidates = []
        for t in reversed(tokens):
            clean_t = t.replace(",", "")
            if re.match(r"^\d+\.\d{2}$", clean_t):
                amt_candidates.append(parse_amount(clean_t))
            elif amt_candidates:
                break

        if not amt_candidates:
            return None

        bal = amt_candidates[0] if len(amt_candidates) >= 2 else None
        amt = amt_candidates[1] if len(amt_candidates) >= 2 else amt_candidates[0]

        upper_c = combined.upper()
        if "CR" in upper_c and "DR" not in upper_c:
            direction = "CREDIT"
        elif "DR" in upper_c:
            direction = "DEBIT"
        elif "DEPOSIT" in upper_c:
            direction = "CREDIT"
        else:
            direction = "DEBIT"

        ref_no = None
        m_ref = re.search(r"\b(\d{12})\b", combined) or re.search(r"(UPI/\d+|NEFT[A-Z0-9]+|IMPS/\d+)", combined)
        if m_ref:
            ref_no = m_ref.group(1)

        clean_narration = " ".join([t for t in tokens[1:] if not re.match(r"^[\d,.]+$", t)])

        return ParsedTransactionItem(
            transaction_date=tx_dict["date"],
            value_date=tx_dict["date"],
            amount=abs(amt),
            direction=direction,
            original_narration=combined,
            normalized_narration=clean_narration,
            transaction_reference=ref_no,
            balance_after_transaction=bal,
            raw_row_index=tx_dict["raw_idx"],
        )

    def _build_empty_failure(
        self,
        filename: str,
        file_hash: str,
        error_msg: str,
        error_code: Optional[str] = None,
    ) -> StatementParseResult:
        empty_meta = StatementMetadata(
            bank_name=self.BANK_NAME,
            statement_period_start=date.today(),
            statement_period_end=date.today(),
            opening_balance=Decimal("0.00"),
            closing_balance=Decimal("0.00"),
        )
        empty_val = validate_statement_math(empty_meta, [])
        empty_val.is_valid = False
        err_list = [error_code, error_msg] if error_code else [error_msg]
        empty_val.errors.extend(err_list)
        return StatementParseResult(
            success=False,
            bank_name=self.BANK_NAME,
            metadata=empty_meta,
            transactions=[],
            validation=empty_val,
            parser_version=self.PARSER_VERSION,
            file_hash=file_hash,
            file_name=filename,
            errors=err_list,
        )
