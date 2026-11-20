"""
Financial Calculation Engine - Secure PDF Decryptor
Safely opens and authenticates password-protected bank statements using PyMuPDF.
Enforces zero-plaintext logging, memory-buffered processing, and safe credential cleanup.
"""

import hashlib
from typing import Optional, List, Tuple
import pymupdf


class DecryptionError(Exception):
    pass


class PasswordRequiredError(DecryptionError):
    pass


def compute_file_hash(content: bytes) -> str:
    """Computes SHA-256 hash of file bytes for deduplication."""
    return hashlib.sha256(content).hexdigest()


def open_pdf_document(
    content: bytes,
    passwords: Optional[List[str]] = None,
) -> Tuple[pymupdf.Document, Optional[str]]:
    """
    Opens a PDF document from bytes.
    If encrypted, attempts supplied candidate passwords.
    Returns (doc, successful_password_or_none).
    Raises PasswordRequiredError if encrypted and no password or candidates fail.
    """
    try:
        doc = pymupdf.open(stream=content, filetype="pdf")
    except Exception as e:
        raise DecryptionError(f"Failed to open PDF stream: {str(e)}")

    if not doc.is_encrypted:
        return doc, None

    if not passwords:
        doc.close()
        raise PasswordRequiredError("Statement is password-protected. Please provide decryption password.")

    # Try each candidate password securely
    for candidate in passwords:
        if not candidate:
            continue
        try:
            auth_status = doc.authenticate(candidate.strip())
            if auth_status > 0:
                return doc, candidate.strip()
        except Exception:
            continue

    doc.close()
    raise PasswordRequiredError("Failed to decrypt PDF with provided password candidates.")


def generate_candidate_passwords(
    dob_ddmmyyyy: Optional[str] = None,
    mobile_last5: Optional[str] = None,
    pan: Optional[str] = None,
    account_number: Optional[str] = None,
    custom_password: Optional[str] = None,
) -> List[str]:
    """
    Generates deterministic candidate passwords based on standard Indian bank rules.
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
        candidates.append(pan.strip().upper())
        candidates.append(pan.strip().lower())

    # Indian Bank Rules: Account Number
    if account_number:
        candidates.append(account_number.strip())

    # Indian Bank Rule 2: DDMMYYYY + MobileLast4
    if dob_ddmmyyyy and len(dob_ddmmyyyy) == 8 and mobile_last5 and len(mobile_last5) >= 4:
        mobile_last4 = mobile_last5[-4:]
        candidates.append(f"{dob_ddmmyyyy}{mobile_last4}")

    return candidates
