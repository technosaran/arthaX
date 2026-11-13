-- ============================================================================
-- Migration: 20261113000000_production_financial_core.sql
-- Description: Production Financial Core upgrade for ArthaX
-- Features:
--   1. Account classification (asset vs liability) for accurate Net Worth
--   2. Dedicated Transfers table (account-to-account zero leakage)
--   3. Recurring rules engine & audit logs
--   4. Composite performance indexes
--   5. Atomic PostgreSQL stored procedures with pessimistic row-locking (FOR UPDATE)
-- ============================================================================

-- 1. Enhance accounts table
ALTER TABLE public.accounts 
  ADD COLUMN IF NOT EXISTS classification text NOT NULL DEFAULT 'asset' 
    CHECK (classification IN ('asset', 'liability')),
  ADD COLUMN IF NOT EXISTS currency varchar(3) NOT NULL DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz NULL;

-- Classify known credit card or loan account types as liabilities
UPDATE public.accounts 
SET classification = 'liability' 
WHERE lower(type) LIKE '%credit%' 
   OR lower(name) LIKE '%credit%' 
   OR lower(type) LIKE '%loan%' 
   OR lower(type) LIKE '%borrowing%';

-- 2. Enhance expenses and income tables with tags, currency, and transfer linkage
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS transaction_type text NOT NULL DEFAULT 'expense'
    CHECK (transaction_type IN ('expense', 'transfer_out', 'refund_payout')),
  ADD COLUMN IF NOT EXISTS currency varchar(3) NOT NULL DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS transfer_id uuid NULL,
  ADD COLUMN IF NOT EXISTS recurring_rule_id uuid NULL;

ALTER TABLE public.income
  ADD COLUMN IF NOT EXISTS transaction_type text NOT NULL DEFAULT 'income'
    CHECK (transaction_type IN ('income', 'transfer_in', 'refund_income')),
  ADD COLUMN IF NOT EXISTS currency varchar(3) NOT NULL DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS transfer_id uuid NULL,
  ADD COLUMN IF NOT EXISTS recurring_rule_id uuid NULL;

-- 3. Dedicated Account-to-Account Transfers Table
CREATE TABLE IF NOT EXISTS public.transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL DEFAULT coalesce(auth.uid()::text, 'default_user'),
  from_account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  to_account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  amount numeric(15, 2) NOT NULL CHECK (amount > 0),
  currency varchar(3) NOT NULL DEFAULT 'INR',
  transfer_date date NOT NULL DEFAULT current_date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT chk_different_accounts CHECK (from_account_id <> to_account_id)
);

CREATE INDEX IF NOT EXISTS idx_transfers_user_date ON public.transfers(user_id, transfer_date DESC);
CREATE INDEX IF NOT EXISTS idx_transfers_from_acc ON public.transfers(from_account_id);
CREATE INDEX IF NOT EXISTS idx_transfers_to_acc ON public.transfers(to_account_id);
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own transfers" ON public.transfers;
CREATE POLICY "Users can view own transfers" ON public.transfers
  FOR SELECT TO authenticated
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can insert own transfers" ON public.transfers;
CREATE POLICY "Users can insert own transfers" ON public.transfers
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can update own transfers" ON public.transfers;
CREATE POLICY "Users can update own transfers" ON public.transfers
  FOR UPDATE TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can delete own transfers" ON public.transfers;
CREATE POLICY "Users can delete own transfers" ON public.transfers
  FOR DELETE TO authenticated
  USING (auth.uid()::text = user_id);

-- 4. Recurring Transaction Rules Engine Table
CREATE TABLE IF NOT EXISTS public.recurring_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL DEFAULT coalesce(auth.uid()::text, 'default_user'),
  title text NOT NULL,
  amount numeric(15, 2) NOT NULL CHECK (amount > 0),
  transaction_type text NOT NULL CHECK (transaction_type IN ('expense', 'income', 'transfer')),
  category text NOT NULL DEFAULT 'Other',
  from_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  to_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  frequency text NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
  start_date date NOT NULL DEFAULT current_date,
  next_run_date date NOT NULL,
  last_run_date date NULL,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_recurring_rules_active ON public.recurring_rules(is_active, next_run_date);
ALTER TABLE public.recurring_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own recurring rules" ON public.recurring_rules;
CREATE POLICY "Users can manage own recurring rules" ON public.recurring_rules
  FOR ALL TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

-- 5. Financial Audit & Activity Log Table
CREATE TABLE IF NOT EXISTS public.financial_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  entity_type text NOT NULL, -- 'expense', 'income', 'transfer', 'account'
  entity_id uuid NOT NULL,
  action text NOT NULL,      -- 'CREATE', 'UPDATE', 'DELETE', 'REVERSE'
  delta_amount numeric(15, 2) NULL,
  old_state jsonb NULL,
  new_state jsonb NULL,
  performed_by text NOT NULL DEFAULT coalesce(auth.uid()::text, 'system'),
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_audit_user_created ON public.financial_audit_logs(user_id, created_at DESC);
ALTER TABLE public.financial_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own audit logs" ON public.financial_audit_logs;
CREATE POLICY "Users can read own audit logs" ON public.financial_audit_logs
  FOR SELECT TO authenticated
  USING (auth.uid()::text = user_id);

-- 6. Composite Indexes on Existing Tables for Scalability
CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON public.expenses(user_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_user_account ON public.expenses(user_id, account_id);
CREATE INDEX IF NOT EXISTS idx_expenses_user_category ON public.expenses(user_id, category);

CREATE INDEX IF NOT EXISTS idx_income_user_date ON public.income(user_id, received_date DESC);
CREATE INDEX IF NOT EXISTS idx_income_user_account ON public.income(user_id, account_id);
CREATE INDEX IF NOT EXISTS idx_income_user_category ON public.income(user_id, category);

-- Unique constraint on budgets to avoid duplicate category budgets in same month
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_budget_month 
  ON public.budgets(user_id, category, month_year);

-- Enable Realtime for transfers and recurring rules
ALTER TABLE public.transfers REPLICA IDENTITY FULL;
ALTER TABLE public.recurring_rules REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'transfers') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.transfers;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'recurring_rules') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.recurring_rules;
  END IF;
END $$;

-- ============================================================================
-- 7. ATOMIC FINANCIAL STORED PROCEDURES (ACID with pessimistic row locks)
-- ============================================================================

-- Function: Atomic Record Expense
CREATE OR REPLACE FUNCTION public.fn_record_expense_atomic(
  p_user_id text,
  p_title text,
  p_amount numeric,
  p_category text,
  p_account_id uuid,
  p_expense_date date,
  p_notes text DEFAULT NULL,
  p_tags text[] DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expense_id uuid;
  v_old_balance numeric := 0;
  v_new_balance numeric := 0;
  v_acc_name text := NULL;
  v_acc_classification text := 'asset';
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Expense amount must be strictly greater than zero.';
  END IF;

  -- Lock and Update Account Balance if account provided
  IF p_account_id IS NOT NULL THEN
    SELECT name, balance, classification INTO v_acc_name, v_old_balance, v_acc_classification
    FROM public.accounts
    WHERE id = p_account_id AND user_id = p_user_id
    FOR UPDATE; -- Row-level lock prevents race conditions

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Account % not found or unauthorized for user %.', p_account_id, p_user_id;
    END IF;

    -- If liability (credit card/loan), spending adds to liability.
    -- If asset (bank/cash), spending deducts from available balance.
    IF v_acc_classification = 'liability' THEN
      v_new_balance := round((v_old_balance + p_amount)::numeric, 2);
    ELSE
      v_new_balance := round((v_old_balance - p_amount)::numeric, 2);
    END IF;

    UPDATE public.accounts
    SET balance = v_new_balance
    WHERE id = p_account_id AND user_id = p_user_id;
  END IF;

  -- Insert Expense Record
  INSERT INTO public.expenses (
    user_id, title, amount, category, account_id, expense_date, notes, tags
  )
  VALUES (
    p_user_id, trim(p_title), round(p_amount::numeric, 2), p_category, p_account_id, p_expense_date, p_notes, p_tags
  )
  RETURNING id INTO v_expense_id;

  -- Write Audit Log
  INSERT INTO public.financial_audit_logs (
    user_id, entity_type, entity_id, action, delta_amount, new_state
  )
  VALUES (
    p_user_id, 'expense', v_expense_id, 'CREATE', -p_amount,
    jsonb_build_object('title', p_title, 'amount', p_amount, 'account', v_acc_name, 'new_balance', v_new_balance)
  );

  RETURN jsonb_build_object(
    'expense_id', v_expense_id,
    'account_id', p_account_id,
    'account_name', v_acc_name,
    'new_balance', v_new_balance
  );
END;
$$;

-- Function: Atomic Update Expense (Adjusts balance differences)
CREATE OR REPLACE FUNCTION public.fn_update_expense_atomic(
  p_expense_id uuid,
  p_user_id text,
  p_title text,
  p_amount numeric,
  p_category text,
  p_account_id uuid,
  p_expense_date date,
  p_notes text DEFAULT NULL,
  p_tags text[] DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_rec record;
  v_old_acc record;
  v_new_acc record;
  v_amount_diff numeric;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Expense amount must be strictly greater than zero.';
  END IF;

  SELECT * INTO v_old_rec
  FROM public.expenses
  WHERE id = p_expense_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expense record % not found.', p_expense_id;
  END IF;

  -- Case A: Same account, adjust difference
  IF v_old_rec.account_id IS NOT NULL AND v_old_rec.account_id = p_account_id THEN
    SELECT * INTO v_old_acc FROM public.accounts WHERE id = p_account_id AND user_id = p_user_id FOR UPDATE;
    IF FOUND THEN
      v_amount_diff := p_amount - v_old_rec.amount;
      IF v_old_acc.classification = 'liability' THEN
        UPDATE public.accounts SET balance = round((balance + v_amount_diff)::numeric, 2) WHERE id = p_account_id;
      ELSE
        UPDATE public.accounts SET balance = round((balance - v_amount_diff)::numeric, 2) WHERE id = p_account_id;
      END IF;
    END IF;

  -- Case B: Account changed (revert old account, apply to new account)
  ELSIF v_old_rec.account_id IS DISTINCT FROM p_account_id THEN
    -- Revert old account
    IF v_old_rec.account_id IS NOT NULL THEN
      SELECT * INTO v_old_acc FROM public.accounts WHERE id = v_old_rec.account_id AND user_id = p_user_id FOR UPDATE;
      IF FOUND THEN
        IF v_old_acc.classification = 'liability' THEN
          UPDATE public.accounts SET balance = round((balance - v_old_rec.amount)::numeric, 2) WHERE id = v_old_rec.account_id;
        ELSE
          UPDATE public.accounts SET balance = round((balance + v_old_rec.amount)::numeric, 2) WHERE id = v_old_rec.account_id;
        END IF;
      END IF;
    END IF;

    -- Apply to new account
    IF p_account_id IS NOT NULL THEN
      SELECT * INTO v_new_acc FROM public.accounts WHERE id = p_account_id AND user_id = p_user_id FOR UPDATE;
      IF FOUND THEN
        IF v_new_acc.classification = 'liability' THEN
          UPDATE public.accounts SET balance = round((balance + p_amount)::numeric, 2) WHERE id = p_account_id;
        ELSE
          UPDATE public.accounts SET balance = round((balance - p_amount)::numeric, 2) WHERE id = p_account_id;
        END IF;
      END IF;
    END IF;
  END IF;

  -- Update expense row
  UPDATE public.expenses
  SET title = trim(p_title),
      amount = round(p_amount::numeric, 2),
      category = p_category,
      account_id = p_account_id,
      expense_date = p_expense_date,
      notes = p_notes,
      tags = p_tags
  WHERE id = p_expense_id AND user_id = p_user_id;

  -- Audit log
  INSERT INTO public.financial_audit_logs (user_id, entity_type, entity_id, action, delta_amount, old_state, new_state)
  VALUES (
    p_user_id, 'expense', p_expense_id, 'UPDATE', p_amount - v_old_rec.amount,
    to_jsonb(v_old_rec),
    jsonb_build_object('title', p_title, 'amount', p_amount, 'account_id', p_account_id)
  );

  RETURN jsonb_build_object('success', true, 'expense_id', p_expense_id);
END;
$$;

-- Function: Atomic Delete Expense (Refunds balance to account)
CREATE OR REPLACE FUNCTION public.fn_delete_expense_atomic(
  p_expense_id uuid,
  p_user_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec record;
  v_acc record;
  v_reversed_balance numeric := NULL;
BEGIN
  SELECT * INTO v_rec
  FROM public.expenses
  WHERE id = p_expense_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expense record not found.';
  END IF;

  -- Refund / reverse balance on account
  IF v_rec.account_id IS NOT NULL THEN
    SELECT * INTO v_acc
    FROM public.accounts
    WHERE id = v_rec.account_id AND user_id = p_user_id
    FOR UPDATE;

    IF FOUND THEN
      IF v_acc.classification = 'liability' THEN
        v_reversed_balance := round((v_acc.balance - v_rec.amount)::numeric, 2);
      ELSE
        v_reversed_balance := round((v_acc.balance + v_rec.amount)::numeric, 2);
      END IF;

      UPDATE public.accounts
      SET balance = v_reversed_balance
      WHERE id = v_rec.account_id AND user_id = p_user_id;
    END IF;
  END IF;

  DELETE FROM public.expenses WHERE id = p_expense_id AND user_id = p_user_id;

  INSERT INTO public.financial_audit_logs (user_id, entity_type, entity_id, action, delta_amount, old_state)
  VALUES (
    p_user_id, 'expense', p_expense_id, 'DELETE_AND_REVERSE', v_rec.amount,
    to_jsonb(v_rec)
  );

  RETURN jsonb_build_object(
    'success', true,
    'deleted_expense_id', p_expense_id,
    'reversed_amount', v_rec.amount,
    'account_new_balance', v_reversed_balance
  );
END;
$$;

-- Function: Atomic Record Income
CREATE OR REPLACE FUNCTION public.fn_record_income_atomic(
  p_user_id text,
  p_title text,
  p_amount numeric,
  p_category text,
  p_frequency text,
  p_account_id uuid,
  p_received_date date,
  p_notes text DEFAULT NULL,
  p_tags text[] DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_income_id uuid;
  v_old_balance numeric := 0;
  v_new_balance numeric := 0;
  v_acc_name text := NULL;
  v_acc_classification text := 'asset';
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Income amount must be strictly greater than zero.';
  END IF;

  IF p_account_id IS NOT NULL THEN
    SELECT name, balance, classification INTO v_acc_name, v_old_balance, v_acc_classification
    FROM public.accounts
    WHERE id = p_account_id AND user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Account % not found or unauthorized.', p_account_id;
    END IF;

    -- If liability, income/payment decreases the debt.
    -- If asset, income increases available balance.
    IF v_acc_classification = 'liability' THEN
      v_new_balance := round((v_old_balance - p_amount)::numeric, 2);
    ELSE
      v_new_balance := round((v_old_balance + p_amount)::numeric, 2);
    END IF;

    UPDATE public.accounts
    SET balance = v_new_balance
    WHERE id = p_account_id AND user_id = p_user_id;
  END IF;

  INSERT INTO public.income (
    user_id, title, amount, category, frequency, account_id, received_date, notes, tags
  )
  VALUES (
    p_user_id, trim(p_title), round(p_amount::numeric, 2), p_category, p_frequency, p_account_id, p_received_date, p_notes, p_tags
  )
  RETURNING id INTO v_income_id;

  INSERT INTO public.financial_audit_logs (user_id, entity_type, entity_id, action, delta_amount, new_state)
  VALUES (
    p_user_id, 'income', v_income_id, 'CREATE', p_amount,
    jsonb_build_object('title', p_title, 'amount', p_amount, 'account', v_acc_name, 'new_balance', v_new_balance)
  );

  RETURN jsonb_build_object(
    'income_id', v_income_id,
    'account_id', p_account_id,
    'account_name', v_acc_name,
    'new_balance', v_new_balance
  );
END;
$$;

-- Function: Atomic Delete Income (Deducts credited amount from account)
CREATE OR REPLACE FUNCTION public.fn_delete_income_atomic(
  p_income_id uuid,
  p_user_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec record;
  v_acc record;
  v_reversed_balance numeric := NULL;
BEGIN
  SELECT * INTO v_rec
  FROM public.income
  WHERE id = p_income_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Income record not found.';
  END IF;

  IF v_rec.account_id IS NOT NULL THEN
    SELECT * INTO v_acc
    FROM public.accounts
    WHERE id = v_rec.account_id AND user_id = p_user_id
    FOR UPDATE;

    IF FOUND THEN
      IF v_acc.classification = 'liability' THEN
        v_reversed_balance := round((v_acc.balance + v_rec.amount)::numeric, 2);
      ELSE
        v_reversed_balance := round((v_acc.balance - v_rec.amount)::numeric, 2);
      END IF;

      UPDATE public.accounts
      SET balance = v_reversed_balance
      WHERE id = v_rec.account_id AND user_id = p_user_id;
    END IF;
  END IF;

  DELETE FROM public.income WHERE id = p_income_id AND user_id = p_user_id;

  INSERT INTO public.financial_audit_logs (user_id, entity_type, entity_id, action, delta_amount, old_state)
  VALUES (
    p_user_id, 'income', p_income_id, 'DELETE_AND_REVERSE', -v_rec.amount,
    to_jsonb(v_rec)
  );

  RETURN jsonb_build_object(
    'success', true,
    'deleted_income_id', p_income_id,
    'reversed_amount', v_rec.amount,
    'account_new_balance', v_reversed_balance
  );
END;
$$;

-- Function: Atomic Transfer Between Accounts
CREATE OR REPLACE FUNCTION public.fn_record_transfer_atomic(
  p_user_id text,
  p_from_account_id uuid,
  p_to_account_id uuid,
  p_amount numeric,
  p_transfer_date date,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transfer_id uuid;
  v_from_bal numeric;
  v_to_bal numeric;
  v_from_name text;
  v_to_name text;
  v_from_class text;
  v_to_class text;
  v_from_new_bal numeric;
  v_to_new_bal numeric;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Transfer amount must be strictly greater than zero.';
  END IF;
  IF p_from_account_id = p_to_account_id THEN
    RAISE EXCEPTION 'Source and destination accounts must be distinct.';
  END IF;

  -- Lock both accounts in deterministic sorted order to prevent deadlocks
  IF p_from_account_id < p_to_account_id THEN
    SELECT name, balance, classification INTO v_from_name, v_from_bal, v_from_class 
    FROM public.accounts WHERE id = p_from_account_id AND user_id = p_user_id FOR UPDATE;
    SELECT name, balance, classification INTO v_to_name, v_to_bal, v_to_class 
    FROM public.accounts WHERE id = p_to_account_id AND user_id = p_user_id FOR UPDATE;
  ELSE
    SELECT name, balance, classification INTO v_to_name, v_to_bal, v_to_class 
    FROM public.accounts WHERE id = p_to_account_id AND user_id = p_user_id FOR UPDATE;
    SELECT name, balance, classification INTO v_from_name, v_from_bal, v_from_class 
    FROM public.accounts WHERE id = p_from_account_id AND user_id = p_user_id FOR UPDATE;
  END IF;

  IF v_from_name IS NULL OR v_to_name IS NULL THEN
    RAISE EXCEPTION 'One or both accounts do not exist or access is unauthorized.';
  END IF;

  -- Debit source account:
  -- If from_account is asset (bank), balance decreases.
  -- If from_account is liability (credit card cash advance), balance (debt) increases.
  IF v_from_class = 'liability' THEN
    v_from_new_bal := round((v_from_bal + p_amount)::numeric, 2);
  ELSE
    v_from_new_bal := round((v_from_bal - p_amount)::numeric, 2);
  END IF;

  -- Credit destination account:
  -- If to_account is asset (cash), balance increases.
  -- If to_account is liability (paying credit card bill), debt balance decreases.
  IF v_to_class = 'liability' THEN
    v_to_new_bal := round((v_to_bal - p_amount)::numeric, 2);
  ELSE
    v_to_new_bal := round((v_to_bal + p_amount)::numeric, 2);
  END IF;

  UPDATE public.accounts SET balance = v_from_new_bal WHERE id = p_from_account_id;
  UPDATE public.accounts SET balance = v_to_new_bal WHERE id = p_to_account_id;

  INSERT INTO public.transfers (
    user_id, from_account_id, to_account_id, amount, transfer_date, notes
  )
  VALUES (
    p_user_id, p_from_account_id, p_to_account_id, round(p_amount::numeric, 2), p_transfer_date, p_notes
  )
  RETURNING id INTO v_transfer_id;

  INSERT INTO public.financial_audit_logs (user_id, entity_type, entity_id, action, delta_amount, new_state)
  VALUES (
    p_user_id, 'transfer', v_transfer_id, 'EXECUTE_TRANSFER', p_amount,
    jsonb_build_object(
      'from_account', v_from_name,
      'to_account', v_to_name,
      'amount', p_amount,
      'from_new_balance', v_from_new_bal,
      'to_new_balance', v_to_new_bal
    )
  );

  RETURN jsonb_build_object(
    'transfer_id', v_transfer_id,
    'from_account', v_from_name,
    'to_account', v_to_name,
    'amount', p_amount,
    'from_new_balance', v_from_new_bal,
    'to_new_balance', v_to_new_bal
  );
END;
$$;

-- Function: Atomic Delete Transfer (Reverses transfer balances)
CREATE OR REPLACE FUNCTION public.fn_delete_transfer_atomic(
  p_transfer_id uuid,
  p_user_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tr record;
  v_from_acc record;
  v_to_acc record;
BEGIN
  SELECT * INTO v_tr
  FROM public.transfers
  WHERE id = p_transfer_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transfer record not found.';
  END IF;

  -- Lock both accounts
  IF v_tr.from_account_id < v_tr.to_account_id THEN
    SELECT * INTO v_from_acc FROM public.accounts WHERE id = v_tr.from_account_id FOR UPDATE;
    SELECT * INTO v_to_acc FROM public.accounts WHERE id = v_tr.to_account_id FOR UPDATE;
  ELSE
    SELECT * INTO v_to_acc FROM public.accounts WHERE id = v_tr.to_account_id FOR UPDATE;
    SELECT * INTO v_from_acc FROM public.accounts WHERE id = v_tr.from_account_id FOR UPDATE;
  END IF;

  -- Reverse source account
  IF v_from_acc.classification = 'liability' THEN
    UPDATE public.accounts SET balance = round((balance - v_tr.amount)::numeric, 2) WHERE id = v_tr.from_account_id;
  ELSE
    UPDATE public.accounts SET balance = round((balance + v_tr.amount)::numeric, 2) WHERE id = v_tr.from_account_id;
  END IF;

  -- Reverse destination account
  IF v_to_acc.classification = 'liability' THEN
    UPDATE public.accounts SET balance = round((balance + v_tr.amount)::numeric, 2) WHERE id = v_tr.to_account_id;
  ELSE
    UPDATE public.accounts SET balance = round((balance - v_tr.amount)::numeric, 2) WHERE id = v_tr.to_account_id;
  END IF;

  DELETE FROM public.transfers WHERE id = p_transfer_id AND user_id = p_user_id;

  INSERT INTO public.financial_audit_logs (user_id, entity_type, entity_id, action, delta_amount, old_state)
  VALUES (
    p_user_id, 'transfer', p_transfer_id, 'DELETE_AND_REVERSE', v_tr.amount,
    to_jsonb(v_tr)
  );

  RETURN jsonb_build_object('success', true, 'deleted_transfer_id', p_transfer_id);
END;
$$;
