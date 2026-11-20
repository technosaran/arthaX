# ARTHAX — EXTERNAL PROVIDER INTEGRATIONS & AUTOMATION STATUS

**Document Version**: 2.0.0  
**Status**: Production & Experimental Integration Audit  
**Target Branch**: `experiment/complete-automation`  

---

## 1. INTEGRATION REGISTRY & STATUS MATRIX

| Provider / Integration | Service Scope | Authentication Model | Current Status | Rate Limits / Quotas | Fallback Behavior |
|---|---|---|---|---|---|
| **Google Gmail API** | Automated bank statement email & attachment discovery. | OAuth 2.0 (`gmail.readonly`) with encrypted refresh token in PostgreSQL. | Fully Implemented & Tested | 250 quota units/sec (Google Cloud Standard). | Manual statement upload in UI; incremental checkpointing. |
| **State Bank of India (SBI)** | E-statement parsing (PDF, password-protected PDF, CSV). | Client-side password rules (DOB+Mobile/PAN) with AES-256-GCM encrypted vault. | Fully Implemented & Tested | Unlimited local CPU/memory processing. | Generic CSV adapter; structured discrepancy report. |
| **Indian Bank** | E-statement parsing (PDF, password-protected PDF, CSV). | Account number or DOB+Mobile password rules. | Fully Implemented & Tested | Unlimited local CPU/memory processing. | Generic CSV adapter; structured discrepancy report. |
| **Generic Bank CSV** | Universal fallback for HDFC, ICICI, Axis, Kotak, etc. | None (user-uploaded or email attachment). | Fully Implemented & Tested | 10 MB per file, 500 rows per batch. | Detailed error report on header mismatch. |
| **Zerodha Kite Connect** | Holdings, positions, orders, margins, profile sync. | Kite Connect API Key + API Secret + Automated TOTP headless login. | Fully Implemented & Tested | 3 requests / second; 200 req / minute. | Manual stock entry; cached portfolio snapshot (TTL: 120s). |
| **AMFI MFAPI** (`api.mfapi.in`) | Daily NAV updates for 25,000+ Indian Mutual Fund schemes. | Public REST API (free, open-access, AMFI official data). | Fully Implemented & Tested | Generous / unmetered (cached 1 hr in Redis). | Local memory cache + last known NAV from database. |
| **Yahoo Finance / Market Feed** | Live quotes for NSE & BSE equities. | Public crumb / quote endpoint with header spoofing. | Fully Implemented & Tested | Throttled on rapid burst (cached 60s in Redis). | Last recorded closing price; marked as `isStale: true`. |
| **Binance API** | Spot crypto balances and trade history. | API Key + HMAC-SHA256 signature. | Fully Implemented & Tested | 1200 request weight / minute. | Manual crypto holding tracking; cached holdings in Supabase. |
| **Telegram Bot Webhook** | Chat-based expense, income, and transfer logging. | Webhook secret token + Telegram Bot API token. | Fully Implemented & Tested | 30 messages / sec per bot. | Interactive Web UI ledger & quick shortcuts. |
| **WhatsApp Cloud API** | Conversational message logging via WhatsApp webhook. | Meta Webhook verification token + System user token. | Fully Implemented & Tested | Standard Meta Graph API tier. | Interactive Web UI ledger & quick shortcuts. |

---

## 2. DETAILED INTEGRATION SPECIFICATIONS

### 2.1 Gmail OAuth Integration
- **Minimum Scopes**: `https://www.googleapis.com/auth/gmail.readonly`
- **Security**: The access token and refresh token are encrypted using AES-256-GCM before storage in `public.gmail_integrations`.
- **Query Strategy**: Targeted query filtering by bank domains (`from:sbi.co.in`, `from:indianbank.co.in`, `from:hdfcbank.net`) avoids unnecessary scanning of personal emails.
- **Deduplication**: SHA-256 hash of attachments prevents re-downloading or re-parsing identical monthly statements.

### 2.2 Zerodha Kite Automated Sync
- **Capabilities**:
  - Automatically generates daily request tokens via TOTP without manual user login every morning.
  - Synchronizes stock holdings, F&O positions, and trade books.
  - Scheduled via GitHub Actions (`.github/workflows/zerodha_auto_sync.yml`) or Vercel Crons (`/api/v1/integrations/zerodha/cron`).

### 2.3 AMFI Indian Mutual Fund NAV Sync
- **Source**: `https://api.mfapi.in/mf/{schemeCode}`
- **Cadence**: AMFI publishes official NAVs once daily on working days between 9:00 PM and 11:00 PM IST.
- **Caching**: NAVs are cached in Upstash Redis (`arthax:mf_nav:{schemeCode}`) with a 1-hour TTL.
