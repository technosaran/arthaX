# ARTHAX — BANK STATEMENT PARSER & INGESTION SPECIFICATION

**Document Version**: 1.0.0  
**Status**: Implemented Specification  
**Module**: `calculation_engine.bank_ingestion`  

---

## 1. OBJECTIVE & ARCHITECTURE

The ArthaX Bank Statement Ingestion Framework is an enterprise-grade, extensible parsing engine designed to automatically extract account metadata, transaction line items, balances, and period coverage from bank statements in **PDF**, **Password-Protected PDF**, and **CSV** formats.

### Core Architecture Principles
1. **Independent Bank Adapters**: Each bank (e.g., SBI, Indian Bank) has an isolated adapter implementing `BaseBankAdapter`. Adding new banks never requires modifying transaction intelligence or downstream calculation logic.
2. **Deterministic Mathematical Validation**: Every parsed statement must satisfy:
   $$\text{Opening Balance} + \text{Total Credits} - \text{Total Debits} = \text{Closing Balance} \pm 0.01$$
3. **Decoupled Classification**: Adapters only extract raw financial data and normalized bank narration. Financial intent classification and merchant identification are handled downstream.
4. **Zero Plaintext Credential Leaks**: Passwords are used ephemerally in-memory and are never stored in plaintext, logged, or sent to external APIs.

---

## 2. BANK ADAPTER SPECIFICATION

### 2.1 State Bank of India (SBI) Adapter

#### Identification Signatures
- **PDF Headers / Keywords**: `"STATE BANK OF INDIA"`, `"SBI"`, `"Account Name"`, `"IFS Code"`, `"SBIN0"`, `"Txn Date"`, `"Value Date"`, `"Ref No./Cheque No."`
- **CSV Headers**: `Txn Date, Value Date, Description, Ref No./Cheque No., Branch Code, Debit, Credit, Balance`

#### Parsing Rules
- **Date Format**: `DD/MM/YYYY` or `DD-MMM-YYYY` (e.g. `14/11/2026`, `14-Nov-2026`).
- **Narrations**: Wrapped over 1 to 4 lines. SBI often splits UPI references into subsequent lines (e.g., `TRANSFER TO 501004... / UPI/6319.../PAYTO`). The adapter concatenates multi-line narrations until the next date row.
- **Amounts**: Commas stripped (`1,25,000.50` -> `125000.50`). Negative numbers or empty cells mapped to `0.00`.
- **Direction**:
  - If `Debit` > 0 -> `DEBIT`
  - If `Credit` > 0 -> `CREDIT`
- **Password Rules**:
  - Rule 1: `DDMM` (4 digits of DOB) + Last 5 digits of registered mobile number.
  - Rule 2: Registered PAN (uppercase, 10 characters).

---

### 2.2 Indian Bank Adapter

#### Identification Signatures
- **PDF Headers / Keywords**: `"INDIAN BANK"`, `"Your Tech-Friendly Bank"`, `"IFSC : IDIB"`, `"Statement of Account"`, `"Withdrawals(Dr)"`, `"Deposits(Cr)"`
- **CSV Headers**: `Date, Particulars, Cheque No, Withdrawals(Dr), Deposits(Cr), Balance`

#### Parsing Rules
- **Date Format**: `DD/MM/YYYY` or `DD-MM-YYYY`.
- **Narrations**: `"Particulars"` column containing NEFT/IMPS/UPI transaction codes.
- **Password Rules**:
  - Rule 1: Registered Account Number (11 to 17 digits).
  - Rule 2: Date of Birth (`DDMMYYYY`) + Last 4 digits of registered mobile number.

---

### 2.3 Generic CSV/Spreadsheet Adapter

Provides universal fallbacks for all other Indian and international banks (HDFC, ICICI, Axis, Kotak) using fuzzy column header matching:
- **Date Columns**: `Date`, `Txn Date`, `Transaction Date`, `Value Date`, `Posting Date`
- **Narration Columns**: `Narration`, `Description`, `Particulars`, `Transaction Details`, `Remarks`
- **Reference Columns**: `Ref No`, `Reference`, `Chq / Ref No`, `UTR`, `Cheque No`
- **Debit Columns**: `Debit`, `Withdrawal`, `Dr`, `Debit Amount`
- **Credit Columns**: `Credit`, `Deposit`, `Cr`, `Credit Amount`
- **Balance Columns**: `Balance`, `Closing Balance`, `Available Balance`, `Running Balance`

---

## 3. SECURE PASSWORD DECRYPTION PIPELINE

```
Input PDF -> Is Encrypted?
  |
  +-- NO  -> Process with PyMuPDF
  |
  +-- YES -> Fetch Encrypted Hint from Database
              |
              Decrypt Hint (AES-256-GCM)
              |
              Generate Candidate Passwords (DOB+Mobile, PAN, Custom)
              |
              PyMuPDF doc.authenticate(candidate)
              |
              Success? -> Extract In-Memory Buffer -> Purge Credentials
              |
              Fail?    -> Raise PasswordRequiredError(bank_name, account_id)
```

---

## 4. GMAIL STATEMENT DISCOVERY & SYNCHRONIZATION

The Gmail integration interacts with the Google Gmail API (via `https://www.googleapis.com/auth/gmail.readonly`):

### 4.1 Search Query Matrix
Targeted Gmail query filters discover financial statement emails without scanning unrelated user mail:
```
(from:sbi.co.in OR from:indianbank.co.in OR from:hdfcbank.net OR from:icicibank.com OR from:camsonline.com) 
AND (subject:statement OR subject:"e-statement" OR subject:"account statement" OR subject:"consolidated account statement") 
AND has:attachment filename:pdf
```

### 4.2 Incremental Checkpointing
1. Store `last_history_id` and `last_sync_at` in `gmail_integrations`.
2. Fetch new messages since the last checkpoint using `messages.list(q=..., pageToken=...)`.
3. Process attachments in-memory. Compute SHA256 of attachment byte streams to prevent re-parsing identical attachments.
4. Record progress in `automation_jobs` with structured statistics (`statements_found`, `transactions_imported`, `duplicates_skipped`).
