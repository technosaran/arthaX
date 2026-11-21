"""
Financial Calculation Engine - PDF Security & Hardened Decryption Unit Tests
Verifies password attempt limits (<= 10), specific internal error codes (PASSWORD_REQUIRED,
PASSWORD_INCORRECT, CORRUPTED_PDF), memory-buffered handling, and zero plaintext leakage.
"""

import pytest
import pymupdf
from calculation_engine.bank_ingestion.pdf_decryptor import (
    open_pdf_document,
    generate_candidate_passwords,
    PasswordRequiredError,
    PasswordIncorrectError,
    CorruptedPdfError,
    MAX_PASSWORD_ATTEMPTS,
)
from calculation_engine.bank_ingestion.parser_registry import parser_registry


def create_mock_pdf_bytes(password: str = None) -> bytes:
    """Helper to generate an in-memory PDF document, optionally encrypted."""
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_text((50, 50), "State Bank of India Statement Nov 2026")
    if password:
        # Encrypt document in memory with standard permissions
        pdf_bytes = doc.tobytes(
            encryption=pymupdf.PDF_ENCRYPT_AES_256,
            owner_pw=password,
            user_pw=password,
            permissions=pymupdf.PDF_PERM_ACCESSIBILITY | pymupdf.PDF_PERM_PRINT,
        )
    else:
        pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def test_open_unencrypted_pdf_success():
    raw_pdf = create_mock_pdf_bytes()
    doc, pw = open_pdf_document(raw_pdf)
    assert doc is not None
    assert doc.is_encrypted is False
    assert pw is None
    doc.close()


def test_open_encrypted_pdf_without_password_raises_password_required():
    raw_pdf = create_mock_pdf_bytes(password="Secret@123")
    with pytest.raises(PasswordRequiredError) as exc_info:
        open_pdf_document(raw_pdf, passwords=None)
    assert exc_info.value.code == "PASSWORD_REQUIRED"
    assert "password-protected" in str(exc_info.value).lower()


def test_open_encrypted_pdf_with_wrong_passwords_raises_password_incorrect():
    raw_pdf = create_mock_pdf_bytes(password="ActualPassword")
    wrong_candidates = ["wrong1", "wrong2", "wrong3"]
    with pytest.raises(PasswordIncorrectError) as exc_info:
        open_pdf_document(raw_pdf, passwords=wrong_candidates)
    assert exc_info.value.code == "PASSWORD_INCORRECT"
    # Zero-plaintext guarantee: no candidates leaked in error message
    for cand in wrong_candidates:
        assert cand not in str(exc_info.value)


def test_open_encrypted_pdf_with_valid_password_succeeds():
    correct_pw = "ValidPass123"
    raw_pdf = create_mock_pdf_bytes(password=correct_pw)
    candidates = ["guess1", "guess2", correct_pw, "guess3"]
    doc, matched_pw = open_pdf_document(raw_pdf, passwords=candidates)
    assert doc is not None
    assert matched_pw == correct_pw
    doc.close()


def test_max_password_attempts_enforced():
    raw_pdf = create_mock_pdf_bytes(password="ValidAt15")
    # 15 candidate passwords where valid password is at index 14 (> MAX_PASSWORD_ATTEMPTS)
    many_candidates = [f"attempt_{i}" for i in range(14)] + ["ValidAt15"]
    assert len(many_candidates) == 15
    assert MAX_PASSWORD_ATTEMPTS == 10

    # Because only first 10 are tried, ValidAt15 should never be reached
    with pytest.raises(PasswordIncorrectError) as exc_info:
        open_pdf_document(raw_pdf, passwords=many_candidates)
    assert "10 candidate password(s)" in str(exc_info.value)


def test_corrupted_pdf_stream_raises_corrupted_pdf_error():
    garbage_bytes = b"NOT_A_PDF_STREAM_RANDOM_GARBAGE_BYTES_12345"
    with pytest.raises(CorruptedPdfError) as exc_info:
        open_pdf_document(garbage_bytes)
    assert exc_info.value.code == "CORRUPTED_PDF"


def test_parser_registry_surfaces_password_required_error():
    raw_pdf = create_mock_pdf_bytes(password="SBI_SECRET")
    result = parser_registry.parse_statement(raw_pdf, "sbi_statement.pdf", passwords=[])
    assert result.success is False
    assert "PASSWORD_REQUIRED" in result.errors


def test_parser_registry_surfaces_password_incorrect_error():
    raw_pdf = create_mock_pdf_bytes(password="SBI_SECRET")
    result = parser_registry.parse_statement(raw_pdf, "sbi_statement.pdf", passwords=["WrongPass"])
    assert result.success is False
    assert "PASSWORD_INCORRECT" in result.errors
