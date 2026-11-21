-- ============================================================================
-- Migration: 20261126000000_database_and_rls_security_remediation.sql
-- Description: Complete Database Security, RLS Hardening & Integrity Remediation
-- Authors: ArthaX Database Architecture & Security Audit
-- Date: 2026-11-21
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. HARDEN SECURITY DEFINER FUNCTIONS: CALLER IDENTITY VERIFICATION & SEARCH_PATH
-- ----------------------------------------------------------------------------

-- Verify and enforce caller ownership in balance decrement
CREATE OR REPLACE FUNCTION public.decrement_account_balance(
  p_account_id UUID,
  p_amount NUMERIC(15, 2)
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_owner_id TEXT;
  v_caller_id TEXT;
  v_caller_role TEXT;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'decrement_account_balance: Amount must be strictly positive (received %)', p_amount;
  END IF;

  SELECT user_id INTO v_owner_id FROM public.accounts WHERE id = p_account_id;
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'decrement_account_balance: Account % does not exist', p_account_id;
  END IF;

  v_caller_id := auth.uid()::text;
  v_caller_role := coalesce(current_setting('request.jwt.claim.role', true), '');

  IF v_caller_role != 'service_role' AND (v_caller_id IS NULL OR v_caller_id != v_owner_id) THEN
    RAISE EXCEPTION 'decrement_account_balance: Unauthorized access to account %', p_account_id;
  END IF;

  UPDATE public.accounts
  SET balance = balance - p_amount,
      updated_at = NOW()
  WHERE id = p_account_id;
END;
$$;

-- Verify and enforce caller ownership in balance increment
CREATE OR REPLACE FUNCTION public.increment_account_balance(
  p_account_id UUID,
  p_amount NUMERIC(15, 2)
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_owner_id TEXT;
  v_caller_id TEXT;
  v_caller_role TEXT;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'increment_account_balance: Amount must be strictly positive (received %)', p_amount;
  END IF;

  SELECT user_id INTO v_owner_id FROM public.accounts WHERE id = p_account_id;
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'increment_account_balance: Account % does not exist', p_account_id;
  END IF;

  v_caller_id := auth.uid()::text;
  v_caller_role := coalesce(current_setting('request.jwt.claim.role', true), '');

  IF v_caller_role != 'service_role' AND (v_caller_id IS NULL OR v_caller_id != v_owner_id) THEN
    RAISE EXCEPTION 'increment_account_balance: Unauthorized access to account %', p_account_id;
  END IF;

  UPDATE public.accounts
  SET balance = balance + p_amount,
      updated_at = NOW()
  WHERE id = p_account_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. HARDEN ATOMIC TRANSACTION STORED PROCEDURES
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_record_expense_atomic(
  p_user_id TEXT,
  p_account_id UUID,
  p_amount NUMERIC(15, 2),
  p_category TEXT,
  p_expense_date DATE,
  p_description TEXT DEFAULT NULL,
  p_merchant TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_new_id UUID;
  v_caller_id TEXT;
  v_caller_role TEXT;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'fn_record_expense_atomic: Amount must be strictly positive';
  END IF;

  v_caller_id := auth.uid()::text;
  v_caller_role := coalesce(current_setting('request.jwt.claim.role', true), '');

  IF v_caller_role != 'service_role' AND (v_caller_id IS NULL OR v_caller_id != p_user_id) THEN
    RAISE EXCEPTION 'fn_record_expense_atomic: Unauthorized tenant operation';
  END IF;

  -- Verify account ownership
  IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE id = p_account_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'fn_record_expense_atomic: Target account % does not belong to user %', p_account_id, p_user_id;
  END IF;

  INSERT INTO public.expenses (
    user_id, account_id, amount, category, expense_date, description, merchant
  )
  VALUES (
    p_user_id, p_account_id, p_amount, p_category, p_expense_date, p_description, p_merchant
  )
  RETURNING id INTO v_new_id;

  -- Decrement account balance atomically
  UPDATE public.accounts
  SET balance = balance - p_amount,
      updated_at = NOW()
  WHERE id = p_account_id AND user_id = p_user_id;

  RETURN v_new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_record_income_atomic(
  p_user_id TEXT,
  p_account_id UUID,
  p_amount NUMERIC(15, 2),
  p_source TEXT,
  p_income_date DATE,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_new_id UUID;
  v_caller_id TEXT;
  v_caller_role TEXT;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'fn_record_income_atomic: Amount must be strictly positive';
  END IF;

  v_caller_id := auth.uid()::text;
  v_caller_role := coalesce(current_setting('request.jwt.claim.role', true), '');

  IF v_caller_role != 'service_role' AND (v_caller_id IS NULL OR v_caller_id != p_user_id) THEN
    RAISE EXCEPTION 'fn_record_income_atomic: Unauthorized tenant operation';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE id = p_account_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'fn_record_income_atomic: Target account % does not belong to user %', p_account_id, p_user_id;
  END IF;

  INSERT INTO public.income (
    user_id, account_id, amount, source, income_date, description
  )
  VALUES (
    p_user_id, p_account_id, p_amount, p_source, p_income_date, p_description
  )
  RETURNING id INTO v_new_id;

  UPDATE public.accounts
  SET balance = balance + p_amount,
      updated_at = NOW()
  WHERE id = p_account_id AND user_id = p_user_id;

  RETURN v_new_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. REVOKE DEFAULT PUBLIC EXECUTION & GRANT RESTRICTED ROLES
-- ----------------------------------------------------------------------------
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;

GRANT EXECUTE ON FUNCTION public.decrement_account_balance(UUID, NUMERIC) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_account_balance(UUID, NUMERIC) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_record_expense_atomic(TEXT, UUID, NUMERIC, TEXT, DATE, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_record_income_atomic(TEXT, UUID, NUMERIC, TEXT, DATE, TEXT) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4. MISSING FOREIGN KEY & COMPOSITE QUERY PERFORMANCE INDEXES
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_stock_holdings_account_id ON public.stock_holdings(account_id);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_user_date ON public.stock_transactions(user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_holding ON public.stock_transactions(holding_id);
CREATE INDEX IF NOT EXISTS idx_fno_positions_user_status ON public.fno_positions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_fno_positions_account_id ON public.fno_positions(account_id);
CREATE INDEX IF NOT EXISTS idx_fno_trades_user_date ON public.fno_trades(user_id, trade_date DESC);
CREATE INDEX IF NOT EXISTS idx_fno_trades_position_id ON public.fno_trades(position_id);
CREATE INDEX IF NOT EXISTS idx_mf_holdings_account_id ON public.mutual_fund_holdings(account_id);
CREATE INDEX IF NOT EXISTS idx_mf_transactions_user_date ON public.mutual_fund_transactions(user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_mf_transactions_holding ON public.mutual_fund_transactions(holding_id);
CREATE INDEX IF NOT EXISTS idx_canonical_tx_user_ref ON public.canonical_transactions(user_id, transaction_reference) WHERE transaction_reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_attachment_jobs_statement_id ON public.statement_attachment_jobs(statement_id);

-- ----------------------------------------------------------------------------
-- 5. POSITIVE AMOUNT CHECK CONSTRAINTS
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_expenses_amount_positive'
  ) THEN
    ALTER TABLE public.expenses ADD CONSTRAINT chk_expenses_amount_positive CHECK (amount > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_income_amount_positive'
  ) THEN
    ALTER TABLE public.income ADD CONSTRAINT chk_income_amount_positive CHECK (amount > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_budgets_amount_nonnegative'
  ) THEN
    ALTER TABLE public.budgets ADD CONSTRAINT chk_budgets_amount_nonnegative CHECK (amount >= 0);
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 6. COMPREHENSIVE MULTI-TENANT WORKSPACE DATA WIPE PROCEDURE
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_wipe_user_data(p_user_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id TEXT;
  v_caller_role TEXT;
  v_cash_account_id UUID;
BEGIN
  v_caller_id := auth.uid()::text;
  v_caller_role := coalesce(current_setting('request.jwt.claim.role', true), '');

  -- Strict authorization: caller must be user themselves or service_role
  IF v_caller_role != 'service_role' AND (v_caller_id IS NULL OR v_caller_id != p_user_id) THEN
    RAISE EXCEPTION 'fn_wipe_user_data: Unauthorized master wipe request for user %', p_user_id;
  END IF;

  -- 1. Purge Statement & Automation pipelines
  DELETE FROM public.statement_attachment_jobs WHERE statement_id IN (
    SELECT id FROM public.bank_statements WHERE user_id = p_user_id
  );
  DELETE FROM public.canonical_transactions WHERE user_id = p_user_id;
  DELETE FROM public.bank_statements WHERE user_id = p_user_id;
  DELETE FROM public.statement_password_hints WHERE user_id = p_user_id;
  DELETE FROM public.automation_jobs WHERE user_id = p_user_id;
  DELETE FROM public.user_classification_rules WHERE user_id = p_user_id;
  DELETE FROM public.net_worth_snapshots WHERE user_id = p_user_id;

  -- 2. Purge Investment & Broker holdings & trades
  DELETE FROM public.fno_trades WHERE user_id = p_user_id;
  DELETE FROM public.fno_positions WHERE user_id = p_user_id;
  DELETE FROM public.stock_transactions WHERE user_id = p_user_id;
  DELETE FROM public.stock_holdings WHERE user_id = p_user_id;
  DELETE FROM public.mutual_fund_transactions WHERE user_id = p_user_id;
  DELETE FROM public.mutual_fund_holdings WHERE user_id = p_user_id;
  DELETE FROM public.bullion_transactions WHERE user_id = p_user_id;
  DELETE FROM public.bullion_holdings WHERE user_id = p_user_id;
  DELETE FROM public.bond_transactions WHERE user_id = p_user_id;
  DELETE FROM public.bond_holdings WHERE user_id = p_user_id;
  DELETE FROM public.crypto_trades WHERE user_id = p_user_id;
  DELETE FROM public.crypto_holdings WHERE user_id = p_user_id;

  -- 3. Purge Integrations
  DELETE FROM public.gmail_integrations WHERE user_id = p_user_id;
  DELETE FROM public.zerodha_integrations WHERE user_id = p_user_id;
  DELETE FROM public.binance_integrations WHERE user_id = p_user_id;

  -- 4. Purge Core Financial Ledgers & Audits
  DELETE FROM public.financial_audit_logs WHERE user_id = p_user_id;
  DELETE FROM public.transfers WHERE user_id = p_user_id;
  DELETE FROM public.expenses WHERE user_id = p_user_id;
  DELETE FROM public.income WHERE user_id = p_user_id;
  DELETE FROM public.budgets WHERE user_id = p_user_id;
  DELETE FROM public.recurring_rules WHERE user_id = p_user_id;

  -- 5. Purge Family Vault
  DELETE FROM public.family_responsibilities WHERE user_id = p_user_id;
  DELETE FROM public.family_goals WHERE user_id = p_user_id;
  DELETE FROM public.family_emergency_vault WHERE user_id = p_user_id;
  DELETE FROM public.family_members WHERE user_id = p_user_id;

  -- 6. Reset Accounts: Delete secondary accounts, reset or recreate Cash in Hand
  DELETE FROM public.accounts WHERE user_id = p_user_id AND name != 'Cash in Hand';
  
  UPDATE public.accounts
  SET balance = 0.00,
      updated_at = NOW()
  WHERE user_id = p_user_id AND name = 'Cash in Hand';

  IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE user_id = p_user_id AND name = 'Cash in Hand') THEN
    INSERT INTO public.accounts (user_id, name, type, balance, last_four, is_active)
    VALUES (p_user_id, 'Cash in Hand', 'Liquid Cash', 0.00, 'CASH', true);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'timestamp', NOW()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_wipe_user_data(TEXT) TO authenticated, service_role;

COMMIT;
