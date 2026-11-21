"""
Financial Calculation Engine - Generic Bank CSV Adapter
Parses standard CSV bank statements with dynamic column matching.
Works with HDFC, ICICI, Axis, Kotak, and custom export formats.
"""

import re
import csv
import io
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List, Dict, Any, Tuple

from .base_adapter import BaseBankAdapter
from .models import StatementParseResult, StatementMetadata, ParsedTransactionItem
from .pdf_decryptor import compute_file_hash
from .statement_validator import validate_statement_math
from .sbi_adapter import parse_date, parse_amount, InvalidAmountError


class GenericCsvBankAdapter(BaseBankAdapter):
    BANK_NAME = "GENERIC_CSV"
    PARSER_VERSION = "2.0.0"

    def can_parse(self, content: bytes, filename: str) -> bool:
        return filename.lower().endswith(".csv")

    def parse(
        self,
        content: bytes,
        filename: str,
        passwords: Optional[List[str]] = None,
    ) -> StatementParseResult:
        file_hash = compute_file_hash(content)
        text = content.decode("utf-8", errors="replace")
        lines = text.splitlines()

        header_idx = -1
        col_map: Dict[str, int] = {}

        for i, line in enumerate(lines[:35]):
            row = [c.strip().upper() for c in next(csv.reader([line])) if c.strip()]
            date_col = next((j for j, h in enumerate(row) if any(k in h for k in ("DATE", "TXN DATE", "VALUE DATE"))), None)
            narration_col = next((j for j, h in enumerate(row) if any(k in h for k in ("NARRATION", "DESCRIPTION", "PARTICULARS", "REMARKS", "DETAILS"))), None)
            amt_col = next((j for j, h in enumerate(row) if any(k in h for k in ("AMOUNT", "DEBIT", "WITHDRAWAL", "CREDIT", "DEPOSIT"))), None)

            if date_col is not None and (narration_col is not None or amt_col is not None):
                header_idx = i
                # Build complete column map
                raw_headers = next(csv.reader([line]))
                for idx, h in enumerate(raw_headers):
                    u = h.strip().upper()
                    if any(k == u or k in u for k in ("TXN DATE", "TRANSACTION DATE", "POSTING DATE", "DATE")):
                        col_map.setdefault("date", idx)
                    elif any(k == u or k in u for k in ("VALUE DATE", "VAL DATE")):
                        col_map.setdefault("value_date", idx)
                    elif any(k == u or k in u for k in ("NARRATION", "DESCRIPTION", "PARTICULARS", "DETAILS", "REMARKS")):
                        col_map.setdefault("narration", idx)
                    elif any(k == u or k in u for k in ("REF NO", "REFERENCE", "UTR", "CHQ NO", "CHEQUE NO")):
                        col_map.setdefault("reference", idx)
                    elif any(k == u or k in u for k in ("DEBIT", "WITHDRAWAL", "DR", "DR AMOUNT")):
                        col_map.setdefault("debit", idx)
                    elif any(k == u or k in u for k in ("CREDIT", "DEPOSIT", "CR", "CR AMOUNT")):
                        col_map.setdefault("credit", idx)
                    elif any(k == u or k in u for k in ("BALANCE", "RUNNING BALANCE", "CLOSING BALANCE")):
                        col_map.setdefault("balance", idx)
                    elif "AMOUNT" in u and "debit" not in col_map and "credit" not in col_map:
                        col_map.setdefault("amount", idx)
                    elif any(k in u for k in ("TYPE", "CR/DR", "DR/CR")):
                        col_map.setdefault("type", idx)
                break

        if header_idx == -1 or "date" not in col_map:
            return self._build_empty_failure(filename, file_hash, "Could not identify tabular statement headers in CSV.")

        reader = csv.reader(lines[header_idx + 1:])
        transactions: List[ParsedTransactionItem] = []
        raw_row_idx = 0
        parsing_errors: List[str] = []

        for row in reader:
            if not row or not any(row):
                continue
            raw_row_idx += 1

            date_idx = col_map["date"]
            if date_idx >= len(row):
                continue
            d_str = row[date_idx].strip()
            parsed_d = parse_date(d_str)
            if not parsed_d:
                continue

            val_d = parsed_d
            if "value_date" in col_map and col_map["value_date"] < len(row):
                val_d = parse_date(row[col_map["value_date"]].strip()) or parsed_d

            narration = row[col_map["narration"]].strip() if "narration" in col_map and col_map["narration"] < len(row) else ""
            ref_no = row[col_map["reference"]].strip() if "reference" in col_map and col_map["reference"] < len(row) else None

            # Resolve amount and direction
            try:
                debit_amt = parse_amount(row[col_map["debit"]]) if "debit" in col_map and col_map["debit"] < len(row) else Decimal("0.00")
                credit_amt = parse_amount(row[col_map["credit"]]) if "credit" in col_map and col_map["credit"] < len(row) else Decimal("0.00")
                bal_amt = parse_amount(row[col_map["balance"]]) if "balance" in col_map and col_map["balance"] < len(row) else None
            except InvalidAmountError as ae:
                parsing_errors.append(f"Row {raw_row_idx}: {str(ae)}")
                continue

            if debit_amt > Decimal("0.00"):
                direction = "DEBIT"
                amount = debit_amt
            elif credit_amt > Decimal("0.00"):
                direction = "CREDIT"
                amount = credit_amt
            elif "amount" in col_map and col_map["amount"] < len(row):
                try:
                    raw_amt = parse_amount(row[col_map["amount"]])
                except InvalidAmountError as ae:
                    parsing_errors.append(f"Row {raw_row_idx}: {str(ae)}")
                    continue
                if raw_amt == Decimal("0.00"):
                    continue
                type_indicator = row[col_map["type"]].strip().upper() if "type" in col_map and col_map["type"] < len(row) else ""
                if "CR" in type_indicator or "CREDIT" in type_indicator or raw_amt > 0:
                    direction = "CREDIT"
                    amount = abs(raw_amt)
                else:
                    direction = "DEBIT"
                    amount = abs(raw_amt)
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
            err_msg = "No valid transactions extracted from CSV."
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
            statement_period_start=period_start,
            statement_period_end=period_end,
            opening_balance=opening_balance,
            closing_balance=closing_balance,
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
