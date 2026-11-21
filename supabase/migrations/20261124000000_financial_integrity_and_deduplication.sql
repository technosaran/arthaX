-- ============================================================================
-- Migration: 20261124000000_financial_integrity_and_deduplication.sql
-- Description: Financial Data Integrity, Canonical Linkage & Idempotent Synchronization
-- Author: Senior Backend Architect & Financial Systems Security Engineer
-- ============================================================================

-- 1. ADD CANONICAL TRANSACTION LINKAGE TO EXPENSES
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS canonical_transaction_id uuid REFERENCES public.canonical_transactions(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_expenses_user_canonical_tx 
  ON public.expenses(user_id, canonical_transaction_id) 
  WHERE canonical_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_canonical_tx 
  ON public.expenses(canonical_transaction_id);


-- 2. ADD CANONICAL TRANSACTION LINKAGE TO INCOME
ALTER TABLE public.income
  ADD COLUMN IF NOT EXISTS canonical_transaction_id uuid REFERENCES public.canonical_transactions(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_income_user_canonical_tx 
  ON public.income(user_id, canonical_transaction_id) 
  WHERE canonical_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_income_canonical_tx 
  ON public.income(canonical_transaction_id);


-- 3. ADD CANONICAL TRANSFER LINKAGE TO TRANSFERS
ALTER TABLE public.transfers
  ADD COLUMN IF NOT EXISTS canonical_transfer_id uuid REFERENCES public.canonical_transactions(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_transfers_user_canonical_tx 
  ON public.transfers(user_id, canonical_transfer_id) 
  WHERE canonical_transfer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transfers_canonical_tx 
  ON public.transfers(canonical_transfer_id);


-- 4. REMOVE RISKY 'default_user' FALLBACK DEFAULTS TO PREVENT MULTI-TENANT LEAKAGE
ALTER TABLE public.bank_statements
  ALTER COLUMN user_id DROP DEFAULT;

ALTER TABLE public.canonical_transactions
  ALTER COLUMN user_id DROP DEFAULT;

ALTER TABLE public.statement_password_hints
  ALTER COLUMN user_id DROP DEFAULT;

ALTER TABLE public.automation_jobs
  ALTER COLUMN user_id DROP DEFAULT;

ALTER TABLE public.user_classification_rules
  ALTER COLUMN user_id DROP DEFAULT;

ALTER TABLE public.net_worth_snapshots
  ALTER COLUMN user_id DROP DEFAULT;


-- 5. ATOMIC CANONICAL TRANSACTION SYNCHRONIZATION FUNCTION
CREATE OR REPLACE FUNCTION public.fn_sync_canonical_transaction_to_ledger(
  p_user_id text,
  p_canonical_tx_id uuid,
  p_account_id uuid,
  p_direction text,
  p_amount numeric(15, 2),
  p_transaction_date date,
  p_title text,
  p_category text,
  p_original_narration text,
  p_is_transfer boolean DEFAULT false,
  p_transfer_to_account_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted_id uuid;
  v_record_type text;
BEGIN
  -- Strict input validation
  IF p_user_id IS NULL OR p_user_id = '' OR p_user_id = 'default_user' THEN
    RAISE EXCEPTION 'Invalid user_id provided for ledger synchronization';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Transaction amount must be strictly greater than 0';
  END IF;

  -- 1. Handle Internal Transfers (Account-to-Account)
  IF p_is_transfer AND p_transfer_to_account_id IS NOT NULL THEN
    INSERT INTO public.transfers (
      user_id,
      from_account_id,
      to_account_id,
      amount,
      currency,
      transfer_date,
      notes,
      canonical_transfer_id
    ) VALUES (
      p_user_id,
      p_account_id,
      p_transfer_to_account_id,
      p_amount,
      'INR',
      p_transaction_date,
      'Automated statement transfer: ' || coalesce(p_original_narration, p_title),
      p_canonical_tx_id
    )
    ON CONFLICT (user_id, canonical_transfer_id) WHERE canonical_transfer_id IS NOT NULL DO NOTHING
    RETURNING id INTO v_inserted_id;

    RETURN jsonb_build_object(
      'success', true,
      'type', 'transfer',
      'ledger_id', v_inserted_id,
      'is_new', (v_inserted_id IS NOT NULL)
    );
  END IF;

  -- 2. Handle DEBIT -> Expense
  IF upper(p_direction) = 'DEBIT' THEN
    INSERT INTO public.expenses (
      user_id,
      account_id,
      amount,
      category,
      expense_date,
      title,
      notes,
      tags,
      canonical_transaction_id,
      currency
    ) VALUES (
      p_user_id,
      p_account_id,
      p_amount,
      coalesce(p_category, 'General'),
      p_transaction_date,
      p_title,
      'Statement import: ' || coalesce(p_original_narration, p_title),
      ARRAY['statement_import', 'verified'],
      p_canonical_tx_id,
      'INR'
    )
    ON CONFLICT (user_id, canonical_transaction_id) WHERE canonical_transaction_id IS NOT NULL DO NOTHING
    RETURNING id INTO v_inserted_id;

    RETURN jsonb_build_object(
      'success', true,
      'type', 'expense',
      'ledger_id', v_inserted_id,
      'is_new', (v_inserted_id IS NOT NULL)
    );
  END IF;

  -- 3. Handle CREDIT -> Income
  IF upper(p_direction) = 'CREDIT' THEN
    INSERT INTO public.income (
      user_id,
      account_id,
      amount,
      category,
      received_date,
      title,
      notes,
      tags,
      canonical_transaction_id,
      currency
    ) VALUES (
      p_user_id,
      p_account_id,
      p_amount,
      CASE WHEN p_category = 'Salary' THEN 'Salary' ELSE 'Other Income' END,
      p_transaction_date,
      p_title,
      'Statement import: ' || coalesce(p_original_narration, p_title),
      ARRAY['statement_import', 'verified'],
      p_canonical_tx_id,
      'INR'
    )
    ON CONFLICT (user_id, canonical_transaction_id) WHERE canonical_transaction_id IS NOT NULL DO NOTHING
    RETURNING id INTO v_inserted_id;

    RETURN jsonb_build_object(
      'success', true,
      'type', 'income',
      'ledger_id', v_inserted_id,
      'is_new', (v_inserted_id IS NOT NULL)
    );
  END IF;

  RETURN jsonb_build_object('success', false, 'error', 'Unknown transaction direction: ' || p_direction);
END;
$$;
