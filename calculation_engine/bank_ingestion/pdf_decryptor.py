"""
Financial Calculation Engine - Secure PDF Decryptor
Safely opens and authenticates password-protected bank statements using PyMuPDF.
Enforces zero-plaintext logging, memory-buffered processing, bounded attempt limits,
and safe credential cleanup.
"""

import hashlib
import re
from typing import Optional, List, Tuple
import pymupdf

MAX_PASSWORD_ATTEMPTS = 25


class DecryptionError(Exception):
    """Base class for all statement decryption errors."""
    code: str = "DECRYPTION_ERROR"

    def __init__(self, message: str, code: Optional[str] = None):
        super().__init__(message)
        if code:
            self.code = code


def get_bank_password_format_hint(bank_name: Optional[str]) -> Optional[str]:
    """
    Returns human-friendly instructions for common bank PDF password formats.
    """
    if not bank_name:
        return None
    norm = bank_name.strip().upper()
    if "SBI" in norm or "STATE BANK" in norm:
        return (
            "SBI YONO format is 4 digits of DOB (DDMM) + '@' + last 4 digits of mobile "
            "(e.g., 0101@9876). SBI NetBanking format is DDMM + last 5 digits of mobile, or PAN."
        )
    if "HDFC" in norm:
        return "Customer ID, PAN (uppercase), or first 4 letters of name in lowercase + DDMM."
    if "ICICI" in norm:
        return "First 4 letters of name in lowercase + DDMM (e.g. sara1508)."
    if "AXIS" in norm:
        return "10-digit PAN in uppercase, or first 4 letters of name in uppercase + last 4 digits of account number."
    if "INDIAN" in norm:
        return "Full account number, or DDMMYYYY + last 4 digits of mobile."
    if "KOTAK" in norm:
        return "CRN (Customer Relationship Number) or DDMMYYYY."
    return "Standard formats include PAN (uppercase), DOB (DDMMYYYY or DDMM), or combinations of Name/DOB/mobile/account number."


class PasswordRequiredError(DecryptionError):
    """Raised when PDF is encrypted but no candidate passwords were provided."""
    code: str = "PASSWORD_REQUIRED"
    bank_name: Optional[str] = None
    format_hint: Optional[str] = None

    def __init__(
        self,
        message: str = "Statement is password-protected. Decryption password required.",
        bank_name: Optional[str] = None,
        format_hint: Optional[str] = None,
    ):
        self.bank_name = bank_name
        self.format_hint = format_hint or (get_bank_password_format_hint(bank_name) if bank_name else None)
        full_message = message
        if self.format_hint and self.format_hint not in full_message:
            full_message = f"{message} Expected format: {self.format_hint}"
        super().__init__(full_message, code="PASSWORD_REQUIRED")


class PasswordIncorrectError(DecryptionError):
    """Raised when all candidate passwords fail to decrypt the document."""
    code: str = "PASSWORD_INCORRECT"
    bank_name: Optional[str] = None
    format_hint: Optional[str] = None

    def __init__(
        self,
        message: str = "Decryption failed: supplied password candidates are incorrect.",
        bank_name: Optional[str] = None,
        format_hint: Optional[str] = None,
    ):
        self.bank_name = bank_name
        self.format_hint = format_hint or (get_bank_password_format_hint(bank_name) if bank_name else None)
        full_message = message
        if self.format_hint and self.format_hint not in full_message:
            full_message = f"{message} Expected format: {self.format_hint}"
        super().__init__(full_message, code="PASSWORD_INCORRECT")


class CorruptedPdfError(DecryptionError):
    """Raised when the document stream is corrupted, malformed, or unreadable."""
    code: str = "CORRUPTED_PDF"

    def __init__(self, message: str = "Corrupted or malformed PDF statement."):
        super().__init__(message, code="CORRUPTED_PDF")


class UnsupportedEncryptionError(DecryptionError):
    """Raised when PDF uses an unsupported encryption algorithm or permission handler."""
    code: str = "UNSUPPORTED_ENCRYPTION"

    def __init__(self, message: str = "Unsupported PDF encryption format."):
        super().__init__(message, code="UNSUPPORTED_ENCRYPTION")


def compute_file_hash(content: bytes) -> str:
    """Computes SHA-256 hash of file bytes for deduplication."""
    return hashlib.sha256(content).hexdigest()


def prioritize_candidates_by_bank(candidates: List[str], bank_hint: Optional[str]) -> List[str]:
    """
    Reorders candidates so that bank-specific formulas are tested first.
    For SBI: YONO '@' format, 9-digit combos with mobile last 4/5, PAN, etc. are tried first.
    """
    if not bank_hint or not candidates:
        return candidates

    norm = bank_hint.strip().upper()
    if "SBI" in norm or "STATE BANK" in norm:
        def sbi_priority(c: str) -> int:
            # 0: YONO '@' format (e.g. 1508@4321, 0101@9876)
            if "@" in c:
                return 0
            # 1: 9-digit combos (DDMM + 5 mobile digits, or 5 mobile digits + DDMM)
            if len(c) == 9 and c.isdigit():
                return 1
            # 1: 10-char PAN (uppercase/lowercase)
            if len(c) == 10 and re.match(r"^[A-Za-z]{5}\d{4}[A-Za-z]$", c):
                return 1
            # 1: First 5 of PAN + DDMM (9 chars)
            if len(c) == 9 and re.match(r"^[A-Za-z]{5}\d{4}$", c):
                return 1
            # 2: 8-digit combos (DDMM + 4 mobile digits, or DDMMYYYY)
            if len(c) == 8 and c.isdigit():
                return 2
            # 2: 12-digit combos (DDMMYYYY + 4 mobile digits for SBI Card)
            if len(c) == 12 and c.isdigit():
                return 2
            # 3: Remaining candidates
            return 3

        return sorted(candidates, key=sbi_priority)

    if "HDFC" in norm:
        def hdfc_priority(c: str) -> int:
            if len(c) == 10 and re.match(r"^[A-Za-z]{5}\d{4}[A-Za-z]$", c):
                return 0
            if len(c) == 8 and re.match(r"^[A-Za-z]{4}\d{4}$", c):
                return 0
            if len(c) in (7, 8, 9, 10) and c.isdigit():
                return 0
            return 1

        return sorted(candidates, key=hdfc_priority)

    if "ICICI" in norm:
        def icici_priority(c: str) -> int:
            if len(c) == 8 and re.match(r"^[A-Za-z]{4}\d{4}$", c):
                return 0
            return 1

        return sorted(candidates, key=icici_priority)

    if "AXIS" in norm:
        def axis_priority(c: str) -> int:
            if len(c) == 10 and re.match(r"^[A-Za-z]{5}\d{4}[A-Za-z]$", c):
                return 0
            if len(c) == 8 and re.match(r"^[A-Za-z]{4}\d{4}$", c):
                return 0
            return 1

        return sorted(candidates, key=axis_priority)

    if "INDIAN" in norm:
        def indian_bank_priority(c: str) -> int:
            if len(c) >= 10 and c.isdigit():
                return 0
            return 1

        return sorted(candidates, key=indian_bank_priority)

    if "KOTAK" in norm:
        def kotak_priority(c: str) -> int:
            if len(c) == 8 and c.isdigit():
                return 0
            return 1

        return sorted(candidates, key=kotak_priority)

    return candidates


def open_pdf_document(
    content: bytes,
    passwords: Optional[List[str]] = None,
    bank_hint: Optional[str] = None,
) -> Tuple[pymupdf.Document, Optional[str]]:
    """
    Opens a PDF document from in-memory bytes.
    If encrypted, attempts supplied candidate passwords up to MAX_PASSWORD_ATTEMPTS.
    Prioritizes candidates based on bank_hint if provided.
    Returns (doc, successful_password_or_none).
    
    Zero-plaintext guarantee:
    Candidate passwords and document buffers are never logged or leaked in exceptions.
    """
    if not content or len(content) < 10:
        raise CorruptedPdfError("PDF file is empty or too small to be a valid document.")

    try:
        doc = pymupdf.open(stream=content, filetype="pdf")
    except Exception as e:
        raise CorruptedPdfError(f"Failed to open PDF stream: {str(e)}")

    if not doc.is_encrypted:
        return doc, None

    if not passwords:
        doc.close()
        raise PasswordRequiredError(
            "Statement is password-protected. Decryption password required.",
            bank_name=bank_hint,
        )

    # Deduplicate and clean candidates, enforcing attempt bound
    seen = set()
    cleaned_candidates: List[str] = []
    for cand in passwords:
        if cand and isinstance(cand, str):
            c_str = cand.strip()
            if c_str and c_str not in seen:
                seen.add(c_str)
                cleaned_candidates.append(c_str)

    if not cleaned_candidates:
        doc.close()
        raise PasswordRequiredError(
            "Statement is password-protected. No valid non-empty password candidates provided.",
            bank_name=bank_hint,
        )

    # Prioritize candidates based on bank_hint if provided
    if bank_hint:
        cleaned_candidates = prioritize_candidates_by_bank(cleaned_candidates, bank_hint)

    # Limit to MAX_PASSWORD_ATTEMPTS to prevent brute-force or denial of service
    attempt_pool = cleaned_candidates[:MAX_PASSWORD_ATTEMPTS]

    for candidate in attempt_pool:
        try:
            auth_status = doc.authenticate(candidate)
            if auth_status > 0:
                # Successfully authenticated
                return doc, candidate
        except Exception:
            # Continue trying next candidate without exposing candidate
            continue

    doc.close()
    raise PasswordIncorrectError(
        f"Failed to decrypt PDF statement after trying {len(attempt_pool)} candidate password(s).",
        bank_name=bank_hint,
    )


def generate_candidate_passwords(
    dob_ddmmyyyy: Optional[str] = None,
    mobile_last5: Optional[str] = None,
    pan: Optional[str] = None,
    account_number: Optional[str] = None,
    custom_password: Optional[str] = None,
) -> List[str]:
    """
    Generates deterministic candidate passwords based on user-authorized information
    and standard Indian bank rules.
    - SBI YONO: DDMM@mobile_last4, DDMM@mobile_last5, and reverse.
    - SBI standard: DDMM + last 5 digits of mobile, or uppercase PAN.
    - SBI Credit Card: DDMMYYYY + last 4 mobile, or reverse, or PAN.
    - Indian Bank: Full account number, or DDMMYYYY + last 4 mobile.
    - Custom user-configured secret.
    """
    candidates = []

    def _add(cand: Optional[str]):
        if cand and cand not in candidates:
            candidates.append(cand)

    if custom_password:
        _add(custom_password.strip())

    # SBI YONO & Standard Rules
    if dob_ddmmyyyy and len(dob_ddmmyyyy) >= 4 and mobile_last5:
        ddmm = dob_ddmmyyyy[:4]
        mobile_last4 = mobile_last5[-4:] if len(mobile_last5) >= 4 else None

        # YONO pattern: DDMM@mobile_last4, DDMM@mobile_last5, and reverse
        if mobile_last4:
            _add(f"{ddmm}@{mobile_last4}")
            _add(f"{mobile_last4}@{ddmm}")
        if len(mobile_last5) >= 5:
            _add(f"{ddmm}@{mobile_last5}")
            _add(f"{mobile_last5}@{ddmm}")

        # SBI standard: DDMM + MobileLast5
        if len(mobile_last5) >= 5:
            _add(f"{ddmm}{mobile_last5}")
            _add(f"{ddmm}{mobile_last5}".lower())
            _add(f"{ddmm}{mobile_last5}".upper())
            _add(f"{mobile_last5}{ddmm}")

        if mobile_last4:
            _add(f"{ddmm}{mobile_last4}")
            _add(f"{mobile_last4}{ddmm}")

    # SBI Credit Card / Indian Bank Rule 2: DDMMYYYY + MobileLast4 and reverse
    if dob_ddmmyyyy and len(dob_ddmmyyyy) == 8 and mobile_last5 and len(mobile_last5) >= 4:
        mobile_last4 = mobile_last5[-4:]
        _add(f"{dob_ddmmyyyy}@{mobile_last4}")
        _add(f"{mobile_last4}@{dob_ddmmyyyy}")
        _add(f"{dob_ddmmyyyy}{mobile_last4}")
        _add(f"{mobile_last4}{dob_ddmmyyyy}")

    # PAN rule (10 chars uppercase and lowercase, and PAN5 + DDMM)
    if pan:
        clean_pan = pan.strip()
        _add(clean_pan.upper())
        _add(clean_pan.lower())
        if dob_ddmmyyyy and len(dob_ddmmyyyy) >= 4 and len(clean_pan) >= 5:
            ddmm = dob_ddmmyyyy[:4]
            _add(f"{clean_pan[:5].upper()}{ddmm}")
            _add(f"{clean_pan[:5].lower()}{ddmm}")

    # Indian Bank / Axis Rules: Account Number
    if account_number:
        clean_acc = account_number.strip()
        _add(clean_acc)
        clean_digits = "".join(ch for ch in clean_acc if ch.isdigit())
        if len(clean_digits) >= 4:
            acc_last4 = clean_digits[-4:]
            _add(acc_last4)
            if dob_ddmmyyyy and len(dob_ddmmyyyy) >= 4:
                ddmm = dob_ddmmyyyy[:4]
                _add(f"{ddmm}{acc_last4}")
                _add(f"{acc_last4}{ddmm}")
            if pan and len(pan) >= 5:
                _add(f"{pan[:5].upper()}{acc_last4}")

    return candidates


def prioritize_passwords_by_hint(
    passwords: Optional[List[str]],
    password_hints: Optional[dict] = None,
) -> Optional[List[str]]:
    """
    Reorders candidate passwords based on the detected password hint in the email.
    Candidates matching the hinted format are prioritized first, ensuring they are attempted
    within the decryptor's attempt limit (MAX_PASSWORD_ATTEMPTS = 10).
    """
    if not passwords or not password_hints:
        return passwords

    high_priority: List[str] = []
    normal_priority: List[str] = []

    is_yono = password_hints.get("is_yono_sbi", False)
    is_dob_mob = password_hints.get("is_dob_mobile", False)
    is_pan = password_hints.get("is_pan", False)
    is_acc = password_hints.get("is_account_number", False)
    is_name = password_hints.get("is_name", False)

    for pwd in passwords:
        if not pwd or not isinstance(pwd, str):
            continue
        p = pwd.strip()
        matched = False

        if is_yono and "@" in p:
            matched = True
        elif is_dob_mob and "@" not in p and p.isdigit() and len(p) in (8, 9, 12):
            matched = True
        elif is_pan and len(p) == 10 and re.match(r'^[A-Za-z]{5}[0-9]{4}[A-Za-z]$', p):
            matched = True
        elif is_acc and p.isdigit() and 9 <= len(p) <= 18:
            matched = True
        elif is_name and re.match(r'^[A-Za-z]{3,5}\d+', p):
            matched = True

        if matched:
            high_priority.append(pwd)
        else:
            normal_priority.append(pwd)

    return high_priority + normal_priority
