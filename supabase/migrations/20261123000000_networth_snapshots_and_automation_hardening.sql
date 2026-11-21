-- ============================================================================
-- Migration: 20261123000000_networth_snapshots_and_automation_hardening.sql
-- Description: Net Worth Snapshots and Automation Performance Hardening
-- Author: Senior Software Architect & Database Security Engineer
-- ============================================================================

-- 1. NET WORTH SNAPSHOTS TABLE
CREATE TABLE IF NOT EXISTS public.net_worth_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL DEFAULT coalesce(auth.uid()::text, 'default_user'),
  snapshot_date date NOT NULL,
  total_assets numeric(15, 2) NOT NULL DEFAULT 0.00,
  total_liabilities numeric(15, 2) NOT NULL DEFAULT 0.00,
  net_worth numeric(15, 2) NOT NULL DEFAULT 0.00,
  currency text NOT NULL DEFAULT 'INR',
  breakdown jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_net_worth_snapshots_user_date UNIQUE (user_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_net_worth_snapshots_user_date ON public.net_worth_snapshots(user_id, snapshot_date DESC);

ALTER TABLE public.net_worth_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own net worth snapshots" ON public.net_worth_snapshots;
CREATE POLICY "Users can view own net worth snapshots" ON public.net_worth_snapshots
  FOR SELECT TO authenticated USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can insert own net worth snapshots" ON public.net_worth_snapshots;
CREATE POLICY "Users can insert own net worth snapshots" ON public.net_worth_snapshots
  FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can update own net worth snapshots" ON public.net_worth_snapshots;
CREATE POLICY "Users can update own net worth snapshots" ON public.net_worth_snapshots
  FOR UPDATE TO authenticated USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can delete own net worth snapshots" ON public.net_worth_snapshots;
CREATE POLICY "Users can delete own net worth snapshots" ON public.net_worth_snapshots
  FOR DELETE TO authenticated USING (auth.uid()::text = user_id);

-- 2. PERFORMANCE HARDENING INDEXES FOR CANONICAL TRANSACTIONS & AUTOMATION
CREATE INDEX IF NOT EXISTS idx_canonical_tx_user_transfer_date ON public.canonical_transactions(user_id, is_transfer, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_canonical_tx_user_acc_date ON public.canonical_transactions(user_id, account_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_automation_jobs_user_type_created ON public.automation_jobs(user_id, job_type, created_at DESC);
