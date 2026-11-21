"""
Financial Calculation Engine - Secure PDF Decryptor
Safely opens and authenticates password-protected bank statements using PyMuPDF.
Enforces zero-plaintext logging, memory-buffered processing, bounded attempt limits,
and safe credential cleanup.
"""

import hashlib
from typing import Optional, List, Tuple
import pymupdf

MAX_PASSWORD_ATTEMPTS = 10


class DecryptionError(Exception):
    """Base class for all statement decryption errors."""
    code: str = "DECRYPTION_ERROR"

    def __init__(self, message: str, code: Optional[str] = None):
        super().__init__(message)
        if code:
            self.code = code


class PasswordRequiredError(DecryptionError):
    """Raised when PDF is encrypted but no candidate passwords were provided."""
    code: str = "PASSWORD_REQUIRED"

    def __init__(self, message: str = "Statement is password-protected. Decryption password required."):
        super().__init__(message, code="PASSWORD_REQUIRED")


class PasswordIncorrectError(DecryptionError):
    """Raised when all candidate passwords fail to decrypt the document."""
    code: str = "PASSWORD_INCORRECT"

    def __init__(self, message: str = "Decryption failed: supplied password candidates are incorrect."):
        super().__init__(message, code="PASSWORD_INCORRECT")


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


def open_pdf_document(
    content: bytes,
    passwords: Optional[List[str]] = None,
) -> Tuple[pymupdf.Document, Optional[str]]:
    """
    Opens a PDF document from in-memory bytes.
    If encrypted, attempts supplied candidate passwords up to MAX_PASSWORD_ATTEMPTS.
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
        raise PasswordRequiredError("Statement is password-protected. Decryption password required.")

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
        raise PasswordRequiredError("Statement is password-protected. No valid non-empty password candidates provided.")

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
        f"Failed to decrypt PDF statement after trying {len(attempt_pool)} candidate password(s)."
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
    - SBI: DDMM + last 5 digits of mobile, or uppercase PAN.
    - Indian Bank: Full account number, or DDMMYYYY + last 4 mobile.
    - Custom user-configured secret.
    """
    candidates = []

    if custom_password:
        candidates.append(custom_password.strip())

    # SBI Rules: DDMM + MobileLast5
    if dob_ddmmyyyy and len(dob_ddmmyyyy) >= 4 and mobile_last5 and len(mobile_last5) >= 5:
        ddmm = dob_ddmmyyyy[:4]
        candidates.append(f"{ddmm}{mobile_last5}")
        candidates.append(f"{ddmm}{mobile_last5}".lower())
        candidates.append(f"{ddmm}{mobile_last5}".upper())

    # PAN rule (10 chars uppercase)
    if pan:
        clean_pan = pan.strip()
        candidates.append(clean_pan.upper())
        candidates.append(clean_pan.lower())

    # Indian Bank Rules: Account Number
    if account_number:
        clean_acc = account_number.strip()
        candidates.append(clean_acc)

    # Indian Bank Rule 2: DDMMYYYY + MobileLast4
    if dob_ddmmyyyy and len(dob_ddmmyyyy) == 8 and mobile_last5 and len(mobile_last5) >= 4:
        mobile_last4 = mobile_last5[-4:]
        candidates.append(f"{dob_ddmmyyyy}{mobile_last4}")

    return candidates
