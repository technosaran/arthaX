-- ============================================================================
-- Migration: 20261122000000_universal_automation_architecture.sql
-- Description: ArthaX Universal Automation & Canonical Financial Intelligence Schema
-- Author: Senior Financial Systems Architect & Database Security Engineer
-- ============================================================================

-- 1. BANK STATEMENTS TABLE
CREATE TABLE IF NOT EXISTS public.bank_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL DEFAULT coalesce(auth.uid()::text, 'default_user'),
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
  bank_name text NOT NULL, -- 'SBI', 'INDIAN_BANK', 'HDFC', 'ICICI', 'AXIS', 'OTHER'
  statement_source text NOT NULL DEFAULT 'MANUAL_UPLOAD', -- 'GMAIL_AUTO', 'MANUAL_UPLOAD', 'API_FEED'
  file_name text NOT NULL,
  file_hash text NOT NULL, -- SHA256 of file content to prevent duplicate processing
  period_start date NOT NULL,
  period_end date NOT NULL,
  opening_balance numeric(15, 2) NOT NULL,
  closing_balance numeric(15, 2) NOT NULL,
  total_credits numeric(15, 2) NOT NULL DEFAULT 0.00,
  total_debits numeric(15, 2) NOT NULL DEFAULT 0.00,
  transaction_count integer NOT NULL DEFAULT 0,
  reconciliation_status text NOT NULL DEFAULT 'PENDING', -- 'RECONCILED', 'DISCREPANCY', 'PENDING', 'FAILED'
  reconciliation_error text,
  parser_version text NOT NULL DEFAULT '1.0.0',
  raw_metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_bank_statements_user_file_hash UNIQUE (user_id, file_hash)
);

CREATE INDEX IF NOT EXISTS idx_bank_statements_user_account ON public.bank_statements(user_id, account_id);
CREATE INDEX IF NOT EXISTS idx_bank_statements_period ON public.bank_statements(user_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_bank_statements_status ON public.bank_statements(user_id, reconciliation_status);

ALTER TABLE public.bank_statements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own bank statements" ON public.bank_statements;
CREATE POLICY "Users can view own bank statements" ON public.bank_statements
  FOR SELECT TO authenticated USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can insert own bank statements" ON public.bank_statements;
CREATE POLICY "Users can insert own bank statements" ON public.bank_statements
  FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can update own bank statements" ON public.bank_statements;
CREATE POLICY "Users can update own bank statements" ON public.bank_statements
  FOR UPDATE TO authenticated USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can delete own bank statements" ON public.bank_statements;
CREATE POLICY "Users can delete own bank statements" ON public.bank_statements
  FOR DELETE TO authenticated USING (auth.uid()::text = user_id);


-- 2. CANONICAL TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.canonical_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL DEFAULT coalesce(auth.uid()::text, 'default_user'),
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
  statement_id uuid REFERENCES public.bank_statements(id) ON DELETE SET NULL,
  transaction_date date NOT NULL,
  value_date date,
  amount numeric(15, 2) NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  direction text NOT NULL CHECK (direction IN ('DEBIT', 'CREDIT')),
  original_narration text NOT NULL,
  normalized_narration text NOT NULL,
  transaction_reference text, -- UTR, Cheque No, UPI Ref ID
  counterparty_name text,
  counterparty_identifier text, -- UPI VPA, Bank Account, Card Last 4
  merchant_name text,
  merchant_category text,
  channel text NOT NULL DEFAULT 'OTHER', -- 'UPI', 'NEFT', 'RTGS', 'IMPS', 'POS', 'ATM', 'NET_BANKING', 'CHEQUE', 'CHARGES', 'OTHER'
  category text NOT NULL DEFAULT 'Unknown',
  transaction_type text NOT NULL DEFAULT 'UNKNOWN',
  classification_confidence numeric(5, 4) NOT NULL DEFAULT 0.5000,
  classification_reason text,
  is_transfer boolean NOT NULL DEFAULT false,
  transfer_counterpart_id uuid REFERENCES public.canonical_transactions(id) ON DELETE SET NULL,
  is_verified boolean NOT NULL DEFAULT false,
  user_overridden boolean NOT NULL DEFAULT false,
  raw_data jsonb DEFAULT '{}'::jsonb,
  dedup_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_canonical_transactions_dedup UNIQUE (user_id, dedup_hash)
);

CREATE INDEX IF NOT EXISTS idx_canonical_tx_user_date ON public.canonical_transactions(user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_canonical_tx_user_account ON public.canonical_transactions(user_id, account_id);
CREATE INDEX IF NOT EXISTS idx_canonical_tx_statement ON public.canonical_transactions(statement_id);
CREATE INDEX IF NOT EXISTS idx_canonical_tx_category ON public.canonical_transactions(user_id, category);
CREATE INDEX IF NOT EXISTS idx_canonical_tx_type ON public.canonical_transactions(user_id, transaction_type);
CREATE INDEX IF NOT EXISTS idx_canonical_tx_transfer ON public.canonical_transactions(user_id, is_transfer);

ALTER TABLE public.canonical_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own canonical transactions" ON public.canonical_transactions;
CREATE POLICY "Users can view own canonical transactions" ON public.canonical_transactions
  FOR SELECT TO authenticated USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can insert own canonical transactions" ON public.canonical_transactions;
CREATE POLICY "Users can insert own canonical transactions" ON public.canonical_transactions
  FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can update own canonical transactions" ON public.canonical_transactions;
CREATE POLICY "Users can update own canonical transactions" ON public.canonical_transactions
  FOR UPDATE TO authenticated USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can delete own canonical transactions" ON public.canonical_transactions;
CREATE POLICY "Users can delete own canonical transactions" ON public.canonical_transactions
  FOR DELETE TO authenticated USING (auth.uid()::text = user_id);


-- 3. GMAIL INTEGRATIONS TABLE
CREATE TABLE IF NOT EXISTS public.gmail_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL UNIQUE,
  email_address text NOT NULL,
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expiry timestamptz,
  scope text,
  last_sync_at timestamptz,
  last_history_id text,
  sync_status text DEFAULT 'ACTIVE', -- 'ACTIVE', 'EXPIRED', 'DISCONNECTED', 'FAILED'
  error_details text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.gmail_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own gmail integration" ON public.gmail_integrations;
CREATE POLICY "Users can view own gmail integration" ON public.gmail_integrations
  FOR SELECT TO authenticated USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can insert own gmail integration" ON public.gmail_integrations;
CREATE POLICY "Users can insert own gmail integration" ON public.gmail_integrations
  FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can update own gmail integration" ON public.gmail_integrations;
CREATE POLICY "Users can update own gmail integration" ON public.gmail_integrations
  FOR UPDATE TO authenticated USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can delete own gmail integration" ON public.gmail_integrations;
CREATE POLICY "Users can delete own gmail integration" ON public.gmail_integrations
  FOR DELETE TO authenticated USING (auth.uid()::text = user_id);


-- 4. STATEMENT PASSWORD CONFIGURATION TABLE
CREATE TABLE IF NOT EXISTS public.statement_password_hints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL DEFAULT coalesce(auth.uid()::text, 'default_user'),
  bank_name text NOT NULL,
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
  hint_pattern text NOT NULL, -- e.g. 'DOB_DDMM_PAN_LAST4', 'DOB_DDMMYYYY_MOBILE_LAST4'
  encrypted_secret text,      -- Dedicated AES-256-GCM encrypted payload, never plaintext
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_statement_password_bank UNIQUE (user_id, bank_name, account_id)
);

ALTER TABLE public.statement_password_hints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own statement password hints" ON public.statement_password_hints;
CREATE POLICY "Users can view own statement password hints" ON public.statement_password_hints
  FOR SELECT TO authenticated USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can insert own statement password hints" ON public.statement_password_hints;
CREATE POLICY "Users can insert own statement password hints" ON public.statement_password_hints
  FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can update own statement password hints" ON public.statement_password_hints;
CREATE POLICY "Users can update own statement password hints" ON public.statement_password_hints
  FOR UPDATE TO authenticated USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can delete own statement password hints" ON public.statement_password_hints;
CREATE POLICY "Users can delete own statement password hints" ON public.statement_password_hints
  FOR DELETE TO authenticated USING (auth.uid()::text = user_id);


-- 5. AUTOMATION JOBS & AUDIT TABLE
CREATE TABLE IF NOT EXISTS public.automation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL DEFAULT coalesce(auth.uid()::text, 'default_user'),
  job_type text NOT NULL, -- 'GMAIL_SYNC', 'STATEMENT_PARSE', 'RECONCILIATION', 'PORTFOLIO_SYNC', 'NETWORTH_SNAPSHOT'
  status text NOT NULL DEFAULT 'QUEUED', -- 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'PARTIAL'
  checkpoint jsonb DEFAULT '{}'::jsonb,
  stats jsonb DEFAULT '{}'::jsonb,
  error_message text,
  retry_count integer NOT NULL DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_automation_jobs_user_status ON public.automation_jobs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_automation_jobs_created ON public.automation_jobs(user_id, created_at DESC);

ALTER TABLE public.automation_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own automation jobs" ON public.automation_jobs;
CREATE POLICY "Users can view own automation jobs" ON public.automation_jobs
  FOR SELECT TO authenticated USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can insert own automation jobs" ON public.automation_jobs;
CREATE POLICY "Users can insert own automation jobs" ON public.automation_jobs
  FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can update own automation jobs" ON public.automation_jobs;
CREATE POLICY "Users can update own automation jobs" ON public.automation_jobs
  FOR UPDATE TO authenticated USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can delete own automation jobs" ON public.automation_jobs;
CREATE POLICY "Users can delete own automation jobs" ON public.automation_jobs
  FOR DELETE TO authenticated USING (auth.uid()::text = user_id);


-- 6. USER CLASSIFICATION OVERRIDES (FEEDBACK LOOP)
CREATE TABLE IF NOT EXISTS public.user_classification_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL DEFAULT coalesce(auth.uid()::text, 'default_user'),
  match_field text NOT NULL CHECK (match_field IN ('NARATION_CONTAINS', 'COUNTERPARTY', 'UPI_VPA', 'REGEX')),
  match_pattern text NOT NULL,
  assigned_category text NOT NULL,
  assigned_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_classification_pattern UNIQUE (user_id, match_field, match_pattern)
);

ALTER TABLE public.user_classification_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own classification rules" ON public.user_classification_rules;
CREATE POLICY "Users can view own classification rules" ON public.user_classification_rules
  FOR SELECT TO authenticated USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can insert own classification rules" ON public.user_classification_rules;
CREATE POLICY "Users can insert own classification rules" ON public.user_classification_rules
  FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can update own classification rules" ON public.user_classification_rules;
CREATE POLICY "Users can update own classification rules" ON public.user_classification_rules
  FOR UPDATE TO authenticated USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can delete own classification rules" ON public.user_classification_rules;
CREATE POLICY "Users can delete own classification rules" ON public.user_classification_rules
  FOR DELETE TO authenticated USING (auth.uid()::text = user_id);
