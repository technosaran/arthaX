-- ============================================================================
-- Migration: 20261125000000_secure_ledger_and_transfer_reconciliation.sql
-- Description: Hardened SQL Function Security, Internal Transfer Reconciliation & Attachment Lifecycle
-- Author: Senior Backend Architect & Financial Systems Security Engineer
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. STATEMENT ATTACHMENT JOBS TABLE (GRANULAR LIFECYCLE TRACKING)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.statement_attachment_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  message_id text NOT NULL,
  attachment_id text NOT NULL,
  filename text NOT NULL,
  file_hash text,
  bank_name text,
  status text NOT NULL DEFAULT 'DISCOVERED' CHECK (status IN (
    'DISCOVERED',
    'DOWNLOADED',
    'PARSED',
    'RECONCILED',
    'IMPORTED',
    'FAILED',
    'RETRY_PENDING'
  )),
  statement_id uuid REFERENCES public.bank_statements(id) ON DELETE SET NULL,
  retry_count integer NOT NULL DEFAULT 0,
  error_code text,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_attachment_jobs_user_msg_att UNIQUE (user_id, message_id, attachment_id)
);

CREATE INDEX IF NOT EXISTS idx_statement_att_user_status ON public.statement_attachment_jobs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_statement_att_file_hash ON public.statement_attachment_jobs(user_id, file_hash);

ALTER TABLE public.statement_attachment_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own statement attachment jobs" ON public.statement_attachment_jobs;
CREATE POLICY "Users can view own statement attachment jobs" ON public.statement_attachment_jobs
  FOR SELECT TO authenticated USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can update own statement attachment jobs" ON public.statement_attachment_jobs;
CREATE POLICY "Users can update own statement attachment jobs" ON public.statement_attachment_jobs
  FOR UPDATE TO authenticated USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can insert own statement attachment jobs" ON public.statement_attachment_jobs;
CREATE POLICY "Users can insert own statement attachment jobs" ON public.statement_attachment_jobs
  FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);


-- ----------------------------------------------------------------------------
-- 2. HARDENED ATOMIC CANONICAL TRANSACTION SYNCHRONIZATION FUNCTION
-- ----------------------------------------------------------------------------
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
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inserted_id uuid;
  v_calling_user text;
  v_calling_role text;
BEGIN
  -- A. Caller Authentication & Authorization Verification
  v_calling_user := auth.uid()::text;
  v_calling_role := coalesce(auth.role(), 'unknown');

  -- Reject anonymous invocation
  IF v_calling_role = 'anon' THEN
    RAISE EXCEPTION 'Unauthorized: Anonymous callers are barred from executing ledger synchronization'
      USING ERRCODE = '42501';
  END IF;

  -- Validate user_id parameter
  IF p_user_id IS NULL OR trim(p_user_id) = '' OR p_user_id = 'default_user' THEN
    RAISE EXCEPTION 'Invalid user_id parameter provided for ledger synchronization'
      USING ERRCODE = '22023';
  END IF;

  -- If called from an authenticated client context (not service_role), caller must match p_user_id
  IF v_calling_user IS NOT NULL AND v_calling_role <> 'service_role' THEN
    IF v_calling_user <> p_user_id THEN
      RAISE EXCEPTION 'Forbidden: Authenticated user (%) cannot sync financial records for user (%)',
        v_calling_user, p_user_id
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- B. Strict Input & Numeric Validation
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Transaction amount must be strictly positive and greater than 0'
      USING ERRCODE = '22023';
  END IF;

  IF upper(coalesce(p_direction, '')) NOT IN ('DEBIT', 'CREDIT') THEN
    RAISE EXCEPTION 'Invalid transaction direction (%). Must be DEBIT or CREDIT', p_direction
      USING ERRCODE = '22023';
  END IF;

  -- C. Account Ownership Verification
  IF NOT EXISTS (
    SELECT 1 FROM public.accounts 
    WHERE id = p_account_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Source account (%) does not exist or does not belong to user (%)',
      p_account_id, p_user_id
      USING ERRCODE = '42501';
  END IF;

  -- D. Canonical Transaction Ownership Verification (if canonical_tx_id supplied)
  IF p_canonical_tx_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.canonical_transactions
      WHERE id = p_canonical_tx_id AND user_id = p_user_id AND account_id = p_account_id
    ) THEN
      RAISE EXCEPTION 'Canonical transaction (%) does not exist or does not match account (%) for user (%)',
        p_canonical_tx_id, p_account_id, p_user_id
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 1. Handle Internal Transfers (Account-to-Account)
  IF p_is_transfer AND p_transfer_to_account_id IS NOT NULL THEN
    -- Verify destination account belongs to the same user
    IF NOT EXISTS (
      SELECT 1 FROM public.accounts 
      WHERE id = p_transfer_to_account_id AND user_id = p_user_id
    ) THEN
      RAISE EXCEPTION 'Destination transfer account (%) does not exist or does not belong to user (%)',
        p_transfer_to_account_id, p_user_id
        USING ERRCODE = '42501';
    END IF;

    IF p_account_id = p_transfer_to_account_id THEN
      RAISE EXCEPTION 'Transfer source account and destination account must be distinct'
        USING ERRCODE = '22023';
    END IF;

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

-- Restrict function execution privileges
REVOKE ALL ON FUNCTION public.fn_sync_canonical_transaction_to_ledger(text, uuid, uuid, text, numeric, date, text, text, text, boolean, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_sync_canonical_transaction_to_ledger(text, uuid, uuid, text, numeric, date, text, text, text, boolean, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_sync_canonical_transaction_to_ledger(text, uuid, uuid, text, numeric, date, text, text, text, boolean, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_sync_canonical_transaction_to_ledger(text, uuid, uuid, text, numeric, date, text, text, text, boolean, uuid) TO service_role;


-- ----------------------------------------------------------------------------
-- 3. AUTOMATED INTERNAL TRANSFER RECONCILIATION FUNCTION
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_reconcile_internal_transfers(
  p_user_id text,
  p_lookback_days integer DEFAULT 60
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_calling_user text;
  v_calling_role text;
  v_pair RECORD;
  v_matched_count integer := 0;
  v_cleaned_expenses integer := 0;
  v_cleaned_income integer := 0;
  v_transfer_id uuid;
BEGIN
  -- A. Authentication & Authorization Verification
  v_calling_user := auth.uid()::text;
  v_calling_role := coalesce(auth.role(), 'unknown');

  IF v_calling_role = 'anon' THEN
    RAISE EXCEPTION 'Unauthorized: Anonymous callers are barred from running transfer reconciliation'
      USING ERRCODE = '42501';
  END IF;

  IF p_user_id IS NULL OR trim(p_user_id) = '' OR p_user_id = 'default_user' THEN
    RAISE EXCEPTION 'Invalid user_id provided for transfer reconciliation'
      USING ERRCODE = '22023';
  END IF;

  IF v_calling_user IS NOT NULL AND v_calling_role <> 'service_role' THEN
    IF v_calling_user <> p_user_id THEN
      RAISE EXCEPTION 'Forbidden: Cannot reconcile transfers for user (%)', p_user_id
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- B. Iterate through candidate pairs within settlement window (<= 3 days / 72 hours)
  FOR v_pair IN
    SELECT DISTINCT ON (d.id)
      d.id AS debit_id,
      d.account_id AS from_acc_id,
      d.transaction_date AS transfer_date,
      d.amount AS amount,
      d.original_narration AS debit_narration,
      c.id AS credit_id,
      c.account_id AS to_acc_id,
      c.original_narration AS credit_narration,
      abs(d.transaction_date - c.transaction_date) AS days_diff
    FROM public.canonical_transactions d
    JOIN public.canonical_transactions c
      ON  c.user_id = d.user_id
      AND c.account_id <> d.account_id
      AND c.direction = 'CREDIT'
      AND c.amount = d.amount
      AND abs(d.transaction_date - c.transaction_date) <= 3
      AND c.transfer_counterpart_id IS NULL
    WHERE d.user_id = p_user_id
      AND d.direction = 'DEBIT'
      AND d.transfer_counterpart_id IS NULL
      AND d.transaction_date >= current_date - (p_lookback_days || ' days')::interval
    ORDER BY d.id, abs(d.transaction_date - c.transaction_date) ASC
  LOOP
    -- 1. Link Canonical Transactions
    UPDATE public.canonical_transactions
    SET is_transfer = true,
        transfer_counterpart_id = v_pair.credit_id,
        updated_at = timezone('utc'::text, now())
    WHERE id = v_pair.debit_id AND user_id = p_user_id;

    UPDATE public.canonical_transactions
    SET is_transfer = true,
        transfer_counterpart_id = v_pair.debit_id,
        updated_at = timezone('utc'::text, now())
    WHERE id = v_pair.credit_id AND user_id = p_user_id;

    -- 2. Persist in Transfers Table
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
      v_pair.from_acc_id,
      v_pair.to_acc_id,
      v_pair.amount,
      'INR',
      v_pair.transfer_date,
      'Reconciled statement transfer (' || v_pair.days_diff || 'd settlement window)',
      v_pair.debit_id
    )
    ON CONFLICT (user_id, canonical_transfer_id) WHERE canonical_transfer_id IS NOT NULL DO NOTHING
    RETURNING id INTO v_transfer_id;

    -- 3. Remove false expenses or income records generated prior to counterpart arrival
    DELETE FROM public.expenses
    WHERE user_id = p_user_id AND canonical_transaction_id = v_pair.debit_id;
    IF FOUND THEN
      v_cleaned_expenses := v_cleaned_expenses + 1;
    END IF;

    DELETE FROM public.income
    WHERE user_id = p_user_id AND canonical_transaction_id = v_pair.credit_id;
    IF FOUND THEN
      v_cleaned_income := v_cleaned_income + 1;
    END IF;

    v_matched_count := v_matched_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'transfers_reconciled', v_matched_count,
    'expenses_cleaned', v_cleaned_expenses,
    'income_cleaned', v_cleaned_income
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_reconcile_internal_transfers(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_reconcile_internal_transfers(text, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_reconcile_internal_transfers(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_reconcile_internal_transfers(text, integer) TO service_role;

-- ----------------------------------------------------------------------------
-- ROLLBACK STRATEGY:
-- In the event a rollback is required:
-- DROP FUNCTION IF EXISTS public.fn_reconcile_internal_transfers(text, integer);
-- DROP TABLE IF EXISTS public.statement_attachment_jobs;
-- Restore previous definition of fn_sync_canonical_transaction_to_ledger from 20261124000000.
-- ----------------------------------------------------------------------------
