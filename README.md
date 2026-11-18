# arthaX — Sovereign Wealth & Portfolio Intelligence Platform

**arthaX** is an enterprise-grade, high-performance personal wealth intelligence and family capital management platform. Built with Next.js 16 (Turbopack), React 19, Supabase RLS, Upstash Redis, and Python FastAPI microservices, arthaX delivers real-time portfolio tracking across multi-asset classes in India and worldwide.

---

## 🌟 Key Capabilities & Architecture

- **Multi-Asset Portfolio Intelligence**:
  - **Equities (Stocks)**: Real-time price quotes, sector distribution, profit & loss, automated Zerodha Kite sync.
  - **Mutual Funds**: Scheme NAV tracking via AMFI, SIP scheduling, capital gains categorization, portfolio import.
  - **Bonds & Fixed Income**: Corporate bonds, Sovereign Gold Bonds (SGB), Tax-free PSU bonds, NCD yield-to-maturity (YTM) calculators and coupon payment schedules.
  - **Physical Bullion (Gold & Silver)**: Live 24K/22K gold & 999 silver spot rates, hallmark purity valuations, holding ledger.
  - **Futures & Options (F&O)**: Derivatives positioning, Greeks analysis, margin exposure, and open contract tracking.
  - **Cash & Multi-Bank Accounts**: High-resolution bank visual identity, Apple Wallet-style cards, liquid emergency fund runway calculations.
  - **Budgets & Family Finance**: Dynamic budget velocity, category limits, family member ledger splits, and milestone goal tracking.
- **Automated Integrations**:
  - **Zerodha Kite Connect**: Automated multi-factor TOTP login and scheduled portfolio synchronization (`scripts/zerodhaAutoSync.ts`).
  - **Telegram & WhatsApp Bots**: Conversational transaction logging, instant receipt parsing, and portfolio queries via webhooks.
  - **Apple Shortcuts**: High-speed iOS expense logging with bearer API authentication.
- **Python Financial Analytics Engine**:
  - FastAPI microservice providing spending anomaly detection (z-score analysis), runway forecasting, and heuristic merchant categorization.
- **Zero-Trust Security & Observability**:
  - AES-256-GCM authenticated encryption for broker credentials and tokens.
  - Row Level Security (RLS) tenant isolation across all PostgreSQL tables.
  - Distributed Upstash Redis rate limiting and atomic idempotency guards.
  - Sentry exception tracking and performance tracing.

---

## 🚀 Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | [Next.js 16](https://nextjs.org) (App Router, Turbopack), [React 19](https://react.dev), [Tailwind CSS 4](https://tailwindcss.com), [Lucide React](https://lucide.dev) |
| **Backend** | Next.js Serverless Route Handlers, [FastAPI](https://fastapi.tiangolo.com) (Python 3.12 Serverless) |
| **Database & Auth** | [Supabase](https://supabase.com) (PostgreSQL 15+, Row Level Security, Realtime, Auth, Storage) |
| **Caching & Rate Limiting** | [Upstash Redis](https://upstash.com) (REST API, sliding-window rate limit, atomic idempotency) |
| **Observability** | [@sentry/nextjs](https://sentry.io) (Full-stack telemetry and performance traces) |
| **Testing** | [Vitest](https://vitest.dev), TypeScript strict checking, ESLint |

---

## 🛠️ Getting Started

### 1. Prerequisites
- Node.js >= 20.x
- Python >= 3.10 (for the optional local analytics engine)
- Supabase account & project

### 2. Installation
```bash
git clone https://github.com/your-username/arthaX.git
cd arthaX
npm install
```

### 3. Environment Configuration
Copy `.env.example` to `.env.local` and populate your secrets:
```bash
cp .env.example .env.local
```

### 4. Database Setup
Apply all database migrations from `supabase/migrations/` using the Supabase CLI:
```bash
supabase link --project-ref <your-supabase-ref>
supabase db push
```

### 5. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing & Verification

Run the comprehensive test suite:
```bash
# Run Vitest unit & integration test suites
npm test

# Run ESLint validation
npm run lint

# Run TypeScript compilation checks
npm run typecheck

# Build for production
npm run build
```

---

## 📄 License
Private & Proprietary. All rights reserved.
