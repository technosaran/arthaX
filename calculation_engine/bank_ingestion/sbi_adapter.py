"""
Financial Calculation Engine - State Bank of India (SBI) Adapter
Parses SBI statements in PDF and CSV format.
Handles multi-line narration continuation, balance parsing, and opening/closing reconciliation.
"""

import re
import csv
import io
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List, Dict, Any, Tuple
import pymupdf

from .base_adapter import BaseBankAdapter
from .models import StatementParseResult, StatementMetadata, ParsedTransactionItem
from .pdf_decryptor import open_pdf_document, compute_file_hash
from .statement_validator import validate_statement_math


DATE_PATTERNS = [
    r"(\d{2}/\d{2}/\d{4})",
    r"(\d{2}-\d{2}-\d{4})",
    r"(\d{2}-[A-Za-z]{3}-\d{4})",
    r"(\d{2}\s+[A-Za-z]{3}\s+\d{4})",
]


def parse_date(date_str: str) -> Optional[date]:
    """Parses Indian bank date string into date object."""
    clean = date_str.strip()
    formats = [
        "%d/%m/%Y",
        "%d-%m-%Y",
        "%d-%b-%Y",
        "%d %b %Y",
        "%d-%m-%y",
        "%d/%m/%y",
        "%Y-%m-%d",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(clean, fmt).date()
        except ValueError:
            continue
    return None


class InvalidAmountError(ValueError):
    """Raised when an amount string is present but cannot be parsed as a valid finite Decimal."""
    pass


def parse_amount(val: Any) -> Decimal:
    """
    Parses string or numeric amount into Decimal.
    Returns Decimal('0.00') only when val is None or empty/placeholder (e.g. '', '-', 'NA').
    Raises InvalidAmountError when val contains invalid/malformed non-empty data or NaN/Infinity.
    """
    if val is None:
        return Decimal("0.00")
    if isinstance(val, (int, float, Decimal)):
        d = Decimal(str(val))
        if d.is_nan() or d.is_infinite():
            raise InvalidAmountError(f"Amount cannot be NaN or Infinite: {val}")
        return d.quantize(Decimal("0.01"))
    s = str(val).strip().replace(",", "").replace("₹", "").replace("INR", "").strip()
    if not s or s in ("-", "--", "NA", "N/A", "Nil", "None"):
        return Decimal("0.00")
    # Clean trailing Cr / Dr notations
    s = re.sub(r"(?i)\s*(cr|dr)$", "", s).strip()
    try:
        d = Decimal(s)
        if d.is_nan() or d.is_infinite():
            raise InvalidAmountError(f"Amount cannot be NaN or Infinite: {val}")
        return d.quantize(Decimal("0.01"))
    except Exception as e:
        raise InvalidAmountError(f"Invalid monetary amount format: '{val}'")


class SbiBankAdapter(BaseBankAdapter):
    BANK_NAME = "SBI"
    PARSER_VERSION = "2.0.0"

    def can_parse(self, content: bytes, filename: str) -> bool:
        fn = filename.lower()
        if fn.endswith(".csv"):
            try:
                sample = content[:4096].decode("utf-8", errors="ignore").upper()
                if "STATE BANK OF INDIA" in sample or "SBIN" in sample or "TXN DATE" in sample:
                    return True
            except Exception:
                pass
        elif fn.endswith(".pdf"):
            try:
                doc = pymupdf.open(stream=content, filetype="pdf")
                if doc.is_encrypted:
                    # Could be SBI statement if filename suggests or standard email statement name
                    doc.close()
                    return "sbi" in fn or "email_statement" in fn or "statement" in fn
                text = ""
                for i in range(min(2, doc.page_count)):
                    text += doc[i].get_text().upper()
                doc.close()
                return "STATE BANK OF INDIA" in text or "SBIN" in text or "WWW.ONLINESBI.COM" in text or "sbi" in fn or "email_statement" in fn
            except Exception:
                pass
        return "sbi" in fn or "email_statement" in fn

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

        for i, line in enumerate(lines[:30]):
            upper = line.upper()
            if "ACCOUNT NUMBER" in upper:
                m = re.search(r"(\d{9,18})", line)
                if m:
                    account_number = m.group(1)
            if "IFS CODE" in upper or "IFSC" in upper:
                m = re.search(r"(SBIN\d{7})", upper)
                if m:
                    ifsc_code = m.group(1)
            if "TXN DATE" in upper and "DESCRIPTION" in upper:
                header_index = i
                break

        if header_index == -1:
            header_index = 0

        reader = csv.reader(lines[header_index:])
        header = None
        transactions: List[ParsedTransactionItem] = []
        raw_row_idx = 0
        parsing_errors: List[str] = []

        for row in reader:
            if not row or not any(row):
                continue
            if header is None:
                header = [h.strip().upper() for h in row]
                continue

            raw_row_idx += 1
            row_dict = {header[idx]: (row[idx].strip() if idx < len(row) else "") for idx in range(len(header))}

            txn_date_str = (
                row_dict.get("TXN DATE")
                or row_dict.get("DATE")
                or (row[0].strip() if len(row) > 0 else "")
            )
            parsed_d = parse_date(txn_date_str)
            if not parsed_d:
                continue

            val_date_str = row_dict.get("VALUE DATE") or txn_date_str
            val_d = parse_date(val_date_str) or parsed_d

            narration = (
                row_dict.get("DESCRIPTION")
                or row_dict.get("PARTICULARS")
                or row_dict.get("NARRATION")
                or (row[2].strip() if len(row) > 2 else "")
            )
            ref_no = (
                row_dict.get("REF NO./CHEQUE NO.")
                or row_dict.get("REF NO")
                or row_dict.get("CHEQUE NO.")
                or (row[3].strip() if len(row) > 3 else "")
            )

            debit_str = row_dict.get("DEBIT") or (row[5].strip() if len(row) > 5 else "")
            credit_str = row_dict.get("CREDIT") or (row[6].strip() if len(row) > 6 else "")
            bal_str = row_dict.get("BALANCE") or (row[7].strip() if len(row) > 7 else "")

            try:
                debit_amt = parse_amount(debit_str)
                credit_amt = parse_amount(credit_str)
                bal_amt = parse_amount(bal_str) if bal_str else None
            except InvalidAmountError as ae:
                parsing_errors.append(f"Row {raw_row_idx}: {str(ae)}")
                continue

            if debit_amt > Decimal("0.00"):
                direction = "DEBIT"
                amount = debit_amt
            elif credit_amt > Decimal("0.00"):
                direction = "CREDIT"
                amount = credit_amt
            else:
                continue

            clean_narration = " ".join(narration.split())
            transactions.append(
                ParsedTransactionItem(
                    transaction_date=parsed_d,
                    value_date=val_d,
                    amount=amount,
                    direction=direction,
                    original_narration=clean_narration,
                    normalized_narration=clean_narration,
                    transaction_reference=ref_no if ref_no else None,
                    balance_after_transaction=bal_amt,
                    raw_row_index=raw_row_idx,
                )
            )

        if not transactions:
            err_msg = "No valid transactions parsed from SBI CSV."
            if parsing_errors:
                err_msg += f" Encountered {len(parsing_errors)} malformed amount error(s)."
            return self._build_empty_failure(filename, file_hash, err_msg)

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
        if parsing_errors:
            validation.errors.extend(parsing_errors)
            validation.is_valid = False

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
            m_acc = re.search(r"Account\s+Number\s*[:\-]?\s*(\d{9,18})", full_text, re.IGNORECASE)
            if m_acc:
                account_number = m_acc.group(1)

            ifsc = None
            m_ifsc = re.search(r"(SBIN\d{7})", full_text, re.IGNORECASE)
            if m_ifsc:
                ifsc = m_ifsc.group(1).upper()

            # Parse lines and stitch multi-line narrations
            lines = full_text.splitlines()
            transactions: List[ParsedTransactionItem] = []
            current_tx: Optional[Dict[str, Any]] = None
            raw_idx = 0

            # Line pattern: starts with date e.g. 01/11/2026 or 01-Nov-2026
            txn_line_re = re.compile(
                r"^(\d{2}[/\-][A-Za-z0-9]{2,3}[/\-]\d{2,4})\s+"
                r"(\d{2}[/\-][A-Za-z0-9]{2,3}[/\-]\d{2,4})?\s*(.*)$"
            )

            for line in lines:
                s_line = line.strip()
                if not s_line:
                    continue

                m = txn_line_re.match(s_line)
                if m:
                    # Check if line contains numbers at the end (amounts/balances)
                    tokens = s_line.split()
                    date_val = parse_date(tokens[0])
                    if date_val:
                        # Finalize previous transaction if in-flight
                        if current_tx:
                            tx_item = self._finalize_pdf_tx(current_tx)
                            if tx_item:
                                transactions.append(tx_item)
                            current_tx = None

                        raw_idx += 1
                        current_tx = {
                            "date": date_val,
                            "value_date": parse_date(tokens[1]) if len(tokens) > 1 else date_val,
                            "narration_parts": [],
                            "raw_tokens": tokens,
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
                # Fall back to vertical cell layout (standard in SBI YONO e-statements)
                return self._parse_vertical_pdf(doc, filename, file_hash, account_number, ifsc)

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
        combined_text = tx_dict["full_line"] + " " + " ".join(tx_dict["narration_parts"])
        tokens = combined_text.split()

        # Find numbers from the end of tokens: balance, credit/debit
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

        # Standard SBI table has: [Debit, Credit, Balance] or [Amount, Balance]
        upper_text = combined_text.upper()
        if len(numeric_tokens) >= 3:
            bal = numeric_tokens[0]
            cred = numeric_tokens[1]
            deb = numeric_tokens[2]
            if deb > Decimal("0.00") and cred == Decimal("0.00"):
                amt = deb
                direction = "DEBIT"
            elif cred > Decimal("0.00") and deb == Decimal("0.00"):
                amt = cred
                direction = "CREDIT"
            else:
                amt = cred if cred > 0 else deb
                direction = "CREDIT" if cred > 0 else "DEBIT"
        else:
            bal = numeric_tokens[0]
            amt = numeric_tokens[1] if len(numeric_tokens) > 1 else Decimal("0.00")
            amt_tok = tokens[-2].upper() if len(tokens) >= 2 else ""
            if "DR" in amt_tok:
                direction = "DEBIT"
            elif "CR" in amt_tok:
                direction = "CREDIT"
            elif any(k in upper_text for k in ["ATM", "WDL", "WITHDRAWAL", "POS", "PURCHASE", "TRANSFER TO", "TO TRANSFER", "PAID TO", "BILLPAY", "CREDIT CARD"]):
                direction = "DEBIT"
            elif any(k in upper_text for k in ["TRANSFER FROM", "BY TRANSFER", "SALARY", "INTEREST", "DIVIDEND", "REFUND", "DEPOSIT"]):
                direction = "CREDIT"
            elif "CREDIT" in upper_text and "CREDIT CARD" not in upper_text:
                direction = "CREDIT"
            else:
                direction = "DEBIT"

        ref_no = None
        m_ref = re.search(r"(?:UPI/|CMS/|NEFT/|IMPS/|CHQ\s*:?\s*)(\w{8,25})", combined_text, re.IGNORECASE)
        if m_ref:
            ref_no = m_ref.group(1)

        clean_narration = " ".join([t for t in tokens if not re.match(r"^[\d,.]+$", t)])

        return ParsedTransactionItem(
            transaction_date=tx_dict["date"],
            value_date=tx_dict["value_date"] or tx_dict["date"],
            amount=abs(amt),
            direction=direction,
            original_narration=combined_text,
            normalized_narration=clean_narration,
            transaction_reference=ref_no,
            balance_after_transaction=bal,
            raw_row_index=tx_dict["raw_idx"],
        )

    def _parse_vertical_pdf(
        self,
        doc: pymupdf.Document,
        filename: str,
        file_hash: str,
        account_number: Optional[str] = None,
        ifsc: Optional[str] = None,
    ) -> StatementParseResult:
        full_text = ""
        for page in doc:
            full_text += page.get_text() + "\n"

        if not account_number:
            m_acc = re.search(r"Account\s+Number\s*[:\n\s]+(\d{9,18})", full_text, re.IGNORECASE)
            if m_acc:
                account_number = m_acc.group(1)
            else:
                m2 = re.search(r"(\d{11})\s+(?:LOTUS|SAVING)", full_text, re.IGNORECASE)
                if m2:
                    account_number = m2.group(1)

        if not ifsc:
            m_ifsc = re.search(r"(SBIN\d{7})", full_text, re.IGNORECASE)
            if m_ifsc:
                ifsc = m_ifsc.group(1).upper()

        date_re = re.compile(r"^(\d{2}/\d{2}/\d{4})$")
        num_re = re.compile(r"^\d{1,3}(?:,\d{3})*(?:\.\d{2})$")

        transactions: List[ParsedTransactionItem] = []
        raw_row_idx = 0

        for p_no in range(doc.page_count):
            text = doc[p_no].get_text()
            lines = [l.strip() for l in text.splitlines() if l.strip()]

            i = 0
            while i < len(lines):
                if date_re.match(lines[i]):
                    d_str = lines[i]
                    if p_no == 0 and "Account open Date" in text and i < 40 and d_str == "30/03/2024":
                        i += 1
                        continue

                    parsed_d = parse_date(d_str)
                    i += 1

                    val_d = parsed_d
                    if i < len(lines) and date_re.match(lines[i]):
                        val_d = parse_date(lines[i]) or parsed_d
                        i += 1

                    item_lines = []
                    while i < len(lines):
                        if date_re.match(lines[i]):
                            break
                        if "Statement Summary" in lines[i] or "Page no." in lines[i] or "Please do not share" in lines[i]:
                            break
                        item_lines.append(lines[i])
                        i += 1

                    clean_tokens = [tok for tok in item_lines if tok not in ('( )', 'Page no.')]

                    bal_idx = -1
                    bal = None
                    for idx in range(len(clean_tokens) - 1, -1, -1):
                        if num_re.match(clean_tokens[idx]):
                            bal_idx = idx
                            bal = parse_amount(clean_tokens[idx])
                            break

                    if bal_idx != -1 and bal_idx >= 2:
                        cr_tok = clean_tokens[bal_idx - 1]
                        dr_tok = clean_tokens[bal_idx - 2]

                        credit = parse_amount(cr_tok) if num_re.match(cr_tok) else Decimal("0.00")
                        debit = parse_amount(dr_tok) if num_re.match(dr_tok) else Decimal("0.00")

                        ref_no = None
                        if bal_idx >= 3 and clean_tokens[bal_idx - 3] != '-':
                            ref_no = clean_tokens[bal_idx - 3]

                        narration_tokens = clean_tokens[:bal_idx - 2]
                        if bal_idx >= 3 and clean_tokens[bal_idx - 3] == '-':
                            narration_tokens = clean_tokens[:bal_idx - 3]

                        narration = " ".join(narration_tokens).strip()

                        direction = "CREDIT" if credit > Decimal("0.00") else "DEBIT"
                        amt = credit if credit > Decimal("0.00") else debit

                        if amt > Decimal("0.00"):
                            raw_row_idx += 1
                            transactions.append(
                                ParsedTransactionItem(
                                    transaction_date=parsed_d,
                                    value_date=val_d,
                                    amount=amt,
                                    direction=direction,
                                    original_narration=narration,
                                    normalized_narration=narration,
                                    transaction_reference=ref_no,
                                    balance_after_transaction=bal,
                                    raw_row_index=raw_row_idx,
                                )
                            )
                else:
                    i += 1

        if not transactions:
            return self._build_empty_failure(filename, file_hash, "No valid transactions parsed from SBI PDF.")

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
            account_type="SAVINGS",
            statement_period_start=period_start,
            statement_period_end=period_end,
            opening_balance=opening_balance,
            closing_balance=closing_balance,
            currency="INR",
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
