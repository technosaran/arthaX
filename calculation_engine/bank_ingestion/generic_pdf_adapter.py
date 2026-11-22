"""
Financial Calculation Engine - Universal Generic PDF Bank Statement Adapter
Provides universal fallback parsing for all Indian and international banks in PDF format
(e.g., Bank of Baroda, Punjab National Bank, Canara Bank, Union Bank, Standard Chartered,
IndusInd, Federal Bank, IDFC First Bank, etc.).
Uses fuzzy header detection, line clustering, multi-line narration continuation,
and strict mathematical balance validation.
"""

import re
from datetime import date
from decimal import Decimal
from typing import Optional, List, Dict, Any

from .base_adapter import BaseBankAdapter
from .models import StatementParseResult, StatementMetadata, ParsedTransactionItem
from .pdf_decryptor import open_pdf_document, compute_file_hash
from .statement_validator import validate_statement_math
from .sbi_adapter import parse_date, parse_amount, InvalidAmountError


def detect_bank_name_from_text(text: str) -> str:
    upper = text.upper()
    if "STATE BANK OF INDIA" in upper or "SBIN" in upper:
        return "SBI"
    if "HDFC" in upper:
        return "HDFC"
    if "ICICI" in upper:
        return "ICICI"
    if "AXIS" in upper or "UTIB" in upper:
        return "AXIS"
    if "KOTAK" in upper or "KKBK" in upper:
        return "KOTAK"
    if "INDIAN BANK" in upper or "IDIB" in upper:
        return "INDIAN_BANK"
    if "PUNJAB NATIONAL BANK" in upper or "PNB" in upper:
        return "PNB"
    if "BANK OF BARODA" in upper or "BARB" in upper:
        return "BANK_OF_BARODA"
    if "CANARA BANK" in upper or "CNRB" in upper:
        return "CANARA_BANK"
    if "UNION BANK" in upper or "UBIN" in upper:
        return "UNION_BANK"
    if "STANDARD CHARTERED" in upper or "SCBL" in upper:
        return "STANDARD_CHARTERED"
    if "INDUSIND" in upper or "INDB" in upper:
        return "INDUSIND"
    if "IDFC" in upper:
        return "IDFC_FIRST"
    if "FEDERAL BANK" in upper:
        return "FEDERAL_BANK"
    return "BANK"


class GenericPdfBankAdapter(BaseBankAdapter):
    BANK_NAME = "GENERIC_PDF"
    PARSER_VERSION = "2.0.0"

    def can_parse(self, content: bytes, filename: str) -> bool:
        fn = filename.lower()
        if not fn.endswith(".pdf"):
            return False
        # Can attempt to parse any PDF file
        return True

    def parse(
        self,
        content: bytes,
        filename: str,
        passwords: Optional[List[str]] = None,
    ) -> StatementParseResult:
        file_hash = compute_file_hash(content)
        doc, _ = open_pdf_document(content, passwords)

        is_ocr = False
        ocr_confidence = 0.0
        try:
            full_text = ""
            for i in range(doc.page_count):
                full_text += doc[i].get_text() + "\n"

            # Check if document appears to be a scanned bitmap PDF with no text layer
            if len(full_text.strip()) < 30 and doc.page_count > 0:
                ocr_text = ""
                try:
                    for i in range(doc.page_count):
                        tp = doc[i].get_textpage_ocr(language="eng")
                        ocr_text += doc[i].get_text(textpage=tp) + "\n"
                    if len(ocr_text.strip()) > 30:
                        full_text = ocr_text
                        is_ocr = True
                        ocr_confidence = min(0.85, 0.5 + (len(ocr_text.splitlines()) * 0.02))
                except Exception as ocr_err:
                    doc.close()
                    return self._build_empty_failure(
                        filename=filename,
                        file_hash=file_hash,
                        error_msg=(
                            "Scanned document detected: PDF contains bitmap images with no embedded text layer. "
                            f"OCR extraction notice: {str(ocr_err)}"
                        ),
                        error_code="SCANNED_PDF_OCR_FAILED",
                    )
        finally:
            if not doc.is_closed:
                doc.close()

        if len(full_text.strip()) < 30:
            return self._build_empty_failure(
                filename=filename,
                file_hash=file_hash,
                error_msg="Document contains no readable text or transaction data.",
                error_code="EMPTY_DOCUMENT_TEXT",
            )

        detected_bank = detect_bank_name_from_text(full_text)
        lines = full_text.splitlines()

        account_number = None
        m_acc = re.search(r"(?i)(?:account\s*number|a/c\s*no\.?|account\s*no)[\s:]*([0-9]{9,18})", full_text)
        if m_acc:
            account_number = m_acc.group(1)

        ifsc_code = None
        m_ifsc = re.search(r"\b([A-Z]{4}0[A-Z0-9]{6})\b", full_text)
        if m_ifsc:
            ifsc_code = m_ifsc.group(1)

        date_re = re.compile(
            r"^\s*(\d{2}[/-]\d{2}[/-]\d{4}|\d{2}-[A-Za-z]{3}-\d{4}|\d{4}-\d{2}-\d{2})"
        )

        transactions: List[ParsedTransactionItem] = []
        current_tx: Optional[Dict[str, Any]] = None

        for idx, line in enumerate(lines):
            line_str = line.strip()
            if not line_str:
                continue

            m_date = date_re.match(line_str)
            if m_date:
                if current_tx:
                    parsed = self._finalize_generic_tx(current_tx)
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
                upper = line_str.upper()
                if not any(k in upper for k in ["STATEMENT SUMMARY", "PAGE ", "TOTAL", "CLOSING BALANCE", "DISCLAIMER"]):
                    current_tx["lines"].append(line_str)
                else:
                    parsed = self._finalize_generic_tx(current_tx)
                    if parsed:
                        transactions.append(parsed)
                    current_tx = None

        if current_tx:
            parsed = self._finalize_generic_tx(current_tx)
            if parsed:
                transactions.append(parsed)

        if not transactions:
            return self._build_empty_failure(
                filename, file_hash, f"No statement transactions could be identified in PDF '{filename}'."
            )

        first_d = transactions[0].transaction_date
        last_d = transactions[-1].transaction_date
        p_start = min(first_d, last_d)
        p_end = max(first_d, last_d)

        # Closing balance detection
        cl_bal = None
        m_cl = re.search(r"(?i)closing\s*balance[\s:]*([0-9,]+\.[0-9]{2})", full_text)
        if m_cl:
            try:
                cl_bal = parse_amount(m_cl.group(1))
            except InvalidAmountError:
                pass

        if cl_bal is None:
            cl_bal = transactions[-1].balance_after_transaction or Decimal("0.00")

        # Opening balance detection
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
            bank_name=detected_bank,
            account_number_masked=f"******{account_number[-4:]}" if account_number else None,
            statement_period_start=p_start,
            statement_period_end=p_end,
            opening_balance=op_bal,
            closing_balance=cl_bal,
            ifsc_code=ifsc_code,
        )

        validation = validate_statement_math(metadata, transactions)

        return StatementParseResult(
            success=validation.is_valid,
            bank_name=detected_bank,
            metadata=metadata,
            transactions=transactions,
            validation=validation,
            parser_version=self.PARSER_VERSION,
            file_hash=file_hash,
            file_name=filename,
            raw_metadata={"ocr_applied": is_ocr, "ocr_confidence": ocr_confidence} if is_ocr else {},
        )

    def _finalize_generic_tx(self, tx_dict: Dict[str, Any]) -> Optional[ParsedTransactionItem]:
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
        elif "WITHDRAWAL" in upper_c:
            direction = "DEBIT"
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
