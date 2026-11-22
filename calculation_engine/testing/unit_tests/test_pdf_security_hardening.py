"""
Financial Calculation Engine - PDF Security & Hardened Decryption Unit Tests
Verifies password attempt limits (<= 25), specific internal error codes (PASSWORD_REQUIRED,
PASSWORD_INCORRECT, CORRUPTED_PDF), memory-buffered handling, bank-specific prioritization,
and zero plaintext leakage.
"""

import pytest
import pymupdf
from calculation_engine.bank_ingestion.pdf_decryptor import (
    open_pdf_document,
    generate_candidate_passwords,
    get_bank_password_format_hint,
    prioritize_candidates_by_bank,
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
    raw_pdf = create_mock_pdf_bytes(password="ValidAt30")
    # 30 candidate passwords where valid password is at index 29 (> MAX_PASSWORD_ATTEMPTS = 25)
    many_candidates = [f"attempt_{i}" for i in range(29)] + ["ValidAt30"]
    assert len(many_candidates) == 30
    assert MAX_PASSWORD_ATTEMPTS == 25

    # Because only first 25 are tried, ValidAt30 should never be reached
    with pytest.raises(PasswordIncorrectError) as exc_info:
        open_pdf_document(raw_pdf, passwords=many_candidates)
    assert "25 candidate password(s)" in str(exc_info.value)


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


def test_generate_candidate_passwords_sbi_yono_and_credit_card():
    """Validates SBI YONO '@' rule, reverse patterns, credit card, and account number rules."""
    cands = generate_candidate_passwords(
        dob_ddmmyyyy="15081995",
        mobile_last5="43210",
        pan="ABCDE1234F",
        account_number="50100412345678",
    )

    # SBI YONO formats
    assert "1508@3210" in cands
    assert "3210@1508" in cands
    assert "1508@43210" in cands
    assert "43210@1508" in cands
    assert "15081995@3210" in cands
    assert "3210@15081995" in cands

    # SBI Standard & Credit Card formats
    assert "150843210" in cands
    assert "432101508" in cands
    assert "150819953210" in cands
    assert "321015081995" in cands

    # PAN formats
    assert "ABCDE1234F" in cands
    assert "abcde1234f" in cands
    assert "ABCDE1508" in cands

    # Account number formats
    assert "50100412345678" in cands
    assert "5678" in cands
    assert "15085678" in cands
    assert "56781508" in cands
    assert "ABCDE5678" in cands


def test_sbi_candidate_prioritization_with_bank_hint():
    """Validates that candidate passwords matching SBI formulas (@ and 9-digit) are tried first."""
    yono_password = "1508@4321"
    raw_pdf = create_mock_pdf_bytes(password=yono_password)

    # Place yono_password after multiple generic candidates
    candidates = [
        "generic_pass_1",
        "random_guess_2",
        "not_a_bank_pw",
        "another_try_4",
        "user_secret_5",
        yono_password,
    ]

    # Without bank hint, order is preserved
    without_hint = prioritize_candidates_by_bank(list(candidates), None)
    assert without_hint[0] == "generic_pass_1"

    # With SBI bank hint, YONO '@' candidate must be reordered to first
    with_hint = prioritize_candidates_by_bank(list(candidates), "SBI")
    assert with_hint[0] == yono_password

    # open_pdf_document unlocks successfully using prioritized password
    doc, matched = open_pdf_document(raw_pdf, passwords=candidates, bank_hint="SBI")
    assert doc is not None
    assert matched == yono_password
    doc.close()


def test_password_errors_include_bank_name_and_format_hint():
    """Validates that bank_name and format_hint are attached when errors are raised."""
    raw_pdf = create_mock_pdf_bytes(password="Secret@999")

    # PasswordRequiredError with bank hint
    with pytest.raises(PasswordRequiredError) as exc_req:
        open_pdf_document(raw_pdf, passwords=None, bank_hint="SBI")
    assert exc_req.value.bank_name == "SBI"
    assert exc_req.value.format_hint is not None
    assert "YONO" in exc_req.value.format_hint
    assert "Expected format:" in str(exc_req.value)

    # PasswordIncorrectError with bank hint
    with pytest.raises(PasswordIncorrectError) as exc_inc:
        open_pdf_document(raw_pdf, passwords=["wrong1", "wrong2"], bank_hint="HDFC")
    assert exc_inc.value.bank_name == "HDFC"
    assert exc_inc.value.format_hint is not None
    assert "Customer ID" in exc_inc.value.format_hint
    assert "Expected format:" in str(exc_inc.value)


def test_parser_registry_preserves_bank_hint_on_decryption_failure():
    """Validates that bank_hint (e.g. INDIAN_BANK) is preserved on failure rather than hardcoding SBI."""
    raw_pdf = create_mock_pdf_bytes(password="Account123456789")

    result = parser_registry.parse_statement(
        content=raw_pdf,
        filename="IndianBank_Statement.pdf",
        passwords=["wrong1", "wrong2"],
        bank_hint="INDIAN_BANK",
    )

    assert result.success is False
    assert result.bank_name == "INDIAN_BANK"
    assert result.metadata.bank_name == "INDIAN_BANK"
    assert "PASSWORD_INCORRECT" in result.errors
