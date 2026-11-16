-- ============================================================================
-- Migration: 20261116000000_database_security_hardening.sql
-- Description: Enterprise Security Hardening for ArthaX Database
-- Remediates:
--   1. Drops all insecure 'anon' policies on investment and broker tables
--   2. Purges legacy permissive 'true' policies across accounts, expenses, income, budgets
--   3. Hardens Foreign Key ownership validation in RLS policies
--   4. Hardens all SECURITY DEFINER stored procedures with auth.uid() checks and search_path = public
--   5. Fixes fn_wipe_user_data BOLA vulnerability and extends wipe to all tables
--   6. Enforces multi-tenant isolation across all financial assets
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. PURGE ALL INSECURE ANONYMOUS DEV POLICIES
-- ----------------------------------------------------------------------------

-- A. Zerodha Broker Integration
DROP POLICY IF EXISTS "Allow anon dev select zerodha integration" ON public.zerodha_integrations;
DROP POLICY IF EXISTS "Allow anon dev insert zerodha integration" ON public.zerodha_integrations;
DROP POLICY IF EXISTS "Allow anon dev update zerodha integration" ON public.zerodha_integrations;
DROP POLICY IF EXISTS "Allow anon dev delete zerodha integration" ON public.zerodha_integrations;

-- B. Stock Tracker
DROP POLICY IF EXISTS "Allow anon dev select stock holdings" ON public.stock_holdings;
DROP POLICY IF EXISTS "Allow anon dev insert stock holdings" ON public.stock_holdings;
DROP POLICY IF EXISTS "Allow anon dev update stock holdings" ON public.stock_holdings;
DROP POLICY IF EXISTS "Allow anon dev delete stock holdings" ON public.stock_holdings;

DROP POLICY IF EXISTS "Allow anon dev select stock transactions" ON public.stock_transactions;
DROP POLICY IF EXISTS "Allow anon dev insert stock transactions" ON public.stock_transactions;
DROP POLICY IF EXISTS "Allow anon dev update stock transactions" ON public.stock_transactions;
DROP POLICY IF EXISTS "Allow anon dev delete stock transactions" ON public.stock_transactions;

-- C. F&O Derivatives Tracker
DROP POLICY IF EXISTS "Allow anon dev select fno positions" ON public.fno_positions;
DROP POLICY IF EXISTS "Allow anon dev insert fno positions" ON public.fno_positions;
DROP POLICY IF EXISTS "Allow anon dev update fno positions" ON public.fno_positions;
DROP POLICY IF EXISTS "Allow anon dev delete fno positions" ON public.fno_positions;

DROP POLICY IF EXISTS "Allow anon dev select fno trades" ON public.fno_trades;
DROP POLICY IF EXISTS "Allow anon dev insert fno trades" ON public.fno_trades;
DROP POLICY IF EXISTS "Allow anon dev update fno trades" ON public.fno_trades;
DROP POLICY IF EXISTS "Allow anon dev delete fno trades" ON public.fno_trades;

-- D. Mutual Funds Tracker
DROP POLICY IF EXISTS "Allow anon dev select mf holdings" ON public.mutual_fund_holdings;
DROP POLICY IF EXISTS "Allow anon dev insert mf holdings" ON public.mutual_fund_holdings;
DROP POLICY IF EXISTS "Allow anon dev update mf holdings" ON public.mutual_fund_holdings;
DROP POLICY IF EXISTS "Allow anon dev delete mf holdings" ON public.mutual_fund_holdings;

DROP POLICY IF EXISTS "Allow anon dev select mf transactions" ON public.mutual_fund_transactions;
DROP POLICY IF EXISTS "Allow anon dev insert mf transactions" ON public.mutual_fund_transactions;
DROP POLICY IF EXISTS "Allow anon dev update mf transactions" ON public.mutual_fund_transactions;
DROP POLICY IF EXISTS "Allow anon dev delete mf transactions" ON public.mutual_fund_transactions;

-- E. Purge Legacy Permissive Policies from Migrations 00-06
DROP POLICY IF EXISTS "Allow public read" ON public.user_settings;
DROP POLICY IF EXISTS "Allow public insert" ON public.user_settings;
DROP POLICY IF EXISTS "Allow public update" ON public.user_settings;

DROP POLICY IF EXISTS "Allow public read accounts" ON public.accounts;
DROP POLICY IF EXISTS "Allow public insert accounts" ON public.accounts;
DROP POLICY IF EXISTS "Allow public update accounts" ON public.accounts;
DROP POLICY IF EXISTS "Allow public delete accounts" ON public.accounts;

DROP POLICY IF EXISTS "Allow public select on income" ON public.income;
DROP POLICY IF EXISTS "Allow public insert on income" ON public.income;
DROP POLICY IF EXISTS "Allow public update on income" ON public.income;
DROP POLICY IF EXISTS "Allow public delete on income" ON public.income;

DROP POLICY IF EXISTS "Allow public select on expenses" ON public.expenses;
DROP POLICY IF EXISTS "Allow public insert on expenses" ON public.expenses;
DROP POLICY IF EXISTS "Allow public update on expenses" ON public.expenses;
DROP POLICY IF EXISTS "Allow public delete on expenses" ON public.expenses;

DROP POLICY IF EXISTS "Allow public select on budgets" ON public.budgets;
DROP POLICY IF EXISTS "Allow public insert on budgets" ON public.budgets;
DROP POLICY IF EXISTS "Allow public update on budgets" ON public.budgets;
DROP POLICY IF EXISTS "Allow public delete on budgets" ON public.budgets;

-- ----------------------------------------------------------------------------
-- 2. RE-ESTABLISH STRICT AUTHENTICATED RLS POLICIES FOR ALL TABLES
-- ----------------------------------------------------------------------------

-- A. Zerodha Integrations
ALTER TABLE public.zerodha_integrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own zerodha integration" ON public.zerodha_integrations;
CREATE POLICY "Users can view own zerodha integration" ON public.zerodha_integrations
  FOR SELECT TO authenticated
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can insert own zerodha integration" ON public.zerodha_integrations;
CREATE POLICY "Users can insert own zerodha integration" ON public.zerodha_integrations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can update own zerodha integration" ON public.zerodha_integrations;
CREATE POLICY "Users can update own zerodha integration" ON public.zerodha_integrations
  FOR UPDATE TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can delete own zerodha integration" ON public.zerodha_integrations;
CREATE POLICY "Users can delete own zerodha integration" ON public.zerodha_integrations
  FOR DELETE TO authenticated
  USING (auth.uid()::text = user_id);

-- B. Stock Holdings & Transactions
ALTER TABLE public.stock_holdings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own stock holdings" ON public.stock_holdings;
CREATE POLICY "Users can view own stock holdings" ON public.stock_holdings
  FOR SELECT TO authenticated
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can insert own stock holdings" ON public.stock_holdings;
CREATE POLICY "Users can insert own stock holdings" ON public.stock_holdings
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can update own stock holdings" ON public.stock_holdings;
CREATE POLICY "Users can update own stock holdings" ON public.stock_holdings
  FOR UPDATE TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can delete own stock holdings" ON public.stock_holdings;
CREATE POLICY "Users can delete own stock holdings" ON public.stock_holdings
  FOR DELETE TO authenticated
  USING (auth.uid()::text = user_id);

ALTER TABLE public.stock_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own stock transactions" ON public.stock_transactions;
CREATE POLICY "Users can view own stock transactions" ON public.stock_transactions
  FOR SELECT TO authenticated
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can insert own stock transactions" ON public.stock_transactions;
CREATE POLICY "Users can insert own stock transactions" ON public.stock_transactions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can update own stock transactions" ON public.stock_transactions;
CREATE POLICY "Users can update own stock transactions" ON public.stock_transactions
  FOR UPDATE TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can delete own stock transactions" ON public.stock_transactions;
CREATE POLICY "Users can delete own stock transactions" ON public.stock_transactions
  FOR DELETE TO authenticated
  USING (auth.uid()::text = user_id);

-- C. F&O Positions & Trades
ALTER TABLE public.fno_positions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own fno positions" ON public.fno_positions;
CREATE POLICY "Users can view own fno positions" ON public.fno_positions
  FOR SELECT TO authenticated
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can insert own fno positions" ON public.fno_positions;
CREATE POLICY "Users can insert own fno positions" ON public.fno_positions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can update own fno positions" ON public.fno_positions;
CREATE POLICY "Users can update own fno positions" ON public.fno_positions
  FOR UPDATE TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can delete own fno positions" ON public.fno_positions;
CREATE POLICY "Users can delete own fno positions" ON public.fno_positions
  FOR DELETE TO authenticated
  USING (auth.uid()::text = user_id);

ALTER TABLE public.fno_trades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own fno trades" ON public.fno_trades;
CREATE POLICY "Users can view own fno trades" ON public.fno_trades
  FOR SELECT TO authenticated
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can insert own fno trades" ON public.fno_trades;
CREATE POLICY "Users can insert own fno trades" ON public.fno_trades
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can update own fno trades" ON public.fno_trades;
CREATE POLICY "Users can update own fno trades" ON public.fno_trades
  FOR UPDATE TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can delete own fno trades" ON public.fno_trades;
CREATE POLICY "Users can delete own fno trades" ON public.fno_trades
  FOR DELETE TO authenticated
  USING (auth.uid()::text = user_id);

-- D. Mutual Fund Holdings & Transactions
ALTER TABLE public.mutual_fund_holdings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own mf holdings" ON public.mutual_fund_holdings;
CREATE POLICY "Users can view own mf holdings" ON public.mutual_fund_holdings
  FOR SELECT TO authenticated
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can insert own mf holdings" ON public.mutual_fund_holdings;
CREATE POLICY "Users can insert own mf holdings" ON public.mutual_fund_holdings
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can update own mf holdings" ON public.mutual_fund_holdings;
CREATE POLICY "Users can update own mf holdings" ON public.mutual_fund_holdings
  FOR UPDATE TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can delete own mf holdings" ON public.mutual_fund_holdings;
CREATE POLICY "Users can delete own mf holdings" ON public.mutual_fund_holdings
  FOR DELETE TO authenticated
  USING (auth.uid()::text = user_id);

ALTER TABLE public.mutual_fund_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own mf transactions" ON public.mutual_fund_transactions;
CREATE POLICY "Users can view own mf transactions" ON public.mutual_fund_transactions
  FOR SELECT TO authenticated
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can insert own mf transactions" ON public.mutual_fund_transactions;
CREATE POLICY "Users can insert own mf transactions" ON public.mutual_fund_transactions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can update own mf transactions" ON public.mutual_fund_transactions;
CREATE POLICY "Users can update own mf transactions" ON public.mutual_fund_transactions
  FOR UPDATE TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can delete own mf transactions" ON public.mutual_fund_transactions;
CREATE POLICY "Users can delete own mf transactions" ON public.mutual_fund_transactions
  FOR DELETE TO authenticated
  USING (auth.uid()::text = user_id);

-- ----------------------------------------------------------------------------
-- 3. HARDEN FOREIGN KEY OWNERSHIP RLS (Expenses, Income, Transfers)
-- ----------------------------------------------------------------------------

-- Expenses: Prevent referencing accounts belonging to another tenant
DROP POLICY IF EXISTS "Users can insert own expenses" ON public.expenses;
CREATE POLICY "Users can insert own expenses" ON public.expenses
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid()::text = user_id AND (
      account_id IS NULL OR EXISTS (
        SELECT 1 FROM public.accounts WHERE id = expenses.account_id AND user_id = auth.uid()::text
      )
    )
  );

DROP POLICY IF EXISTS "Users can update own expenses" ON public.expenses;
CREATE POLICY "Users can update own expenses" ON public.expenses
  FOR UPDATE TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (
    auth.uid()::text = user_id AND (
      account_id IS NULL OR EXISTS (
        SELECT 1 FROM public.accounts WHERE id = expenses.account_id AND user_id = auth.uid()::text
      )
    )
  );

-- Income: Prevent referencing accounts belonging to another tenant
DROP POLICY IF EXISTS "Users can insert own income" ON public.income;
CREATE POLICY "Users can insert own income" ON public.income
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid()::text = user_id AND (
      account_id IS NULL OR EXISTS (
        SELECT 1 FROM public.accounts WHERE id = income.account_id AND user_id = auth.uid()::text
      )
    )
  );

DROP POLICY IF EXISTS "Users can update own income" ON public.income;
CREATE POLICY "Users can update own income" ON public.income
  FOR UPDATE TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (
    auth.uid()::text = user_id AND (
      account_id IS NULL OR EXISTS (
        SELECT 1 FROM public.accounts WHERE id = income.account_id AND user_id = auth.uid()::text
      )
    )
  );

-- Transfers: Enforce both from_account_id and to_account_id belong to auth.uid()
DROP POLICY IF EXISTS "Users can insert own transfers" ON public.transfers;
CREATE POLICY "Users can insert own transfers" ON public.transfers
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid()::text = user_id AND EXISTS (
      SELECT 1 FROM public.accounts WHERE id = transfers.from_account_id AND user_id = auth.uid()::text
    ) AND EXISTS (
      SELECT 1 FROM public.accounts WHERE id = transfers.to_account_id AND user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Users can update own transfers" ON public.transfers;
CREATE POLICY "Users can update own transfers" ON public.transfers
  FOR UPDATE TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (
    auth.uid()::text = user_id AND EXISTS (
      SELECT 1 FROM public.accounts WHERE id = transfers.from_account_id AND user_id = auth.uid()::text
    ) AND EXISTS (
      SELECT 1 FROM public.accounts WHERE id = transfers.to_account_id AND user_id = auth.uid()::text
    )
  );

-- ----------------------------------------------------------------------------
-- 4. HARDEN STORED PROCEDURES (Caller Validation, search_path = public)
-- ----------------------------------------------------------------------------

-- A. Balance Increment & Decrement
CREATE OR REPLACE FUNCTION public.decrement_account_balance(
  p_account_id UUID,
  p_user_id TEXT,
  p_amount NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance NUMERIC;
BEGIN
  IF auth.role() <> 'service_role' AND (auth.uid() IS NULL OR auth.uid()::text <> p_user_id) THEN
    RAISE EXCEPTION 'Access denied: unauthorized balance decrement.';
  END IF;

  UPDATE public.accounts
  SET balance = round((balance - p_amount)::numeric, 2)
  WHERE id = p_account_id AND user_id = p_user_id
  RETURNING balance INTO v_new_balance;

  RETURN COALESCE(v_new_balance, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_account_balance(
  p_account_id UUID,
  p_user_id TEXT,
  p_amount NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance NUMERIC;
BEGIN
  IF auth.role() <> 'service_role' AND (auth.uid() IS NULL OR auth.uid()::text <> p_user_id) THEN
    RAISE EXCEPTION 'Access denied: unauthorized balance increment.';
  END IF;

  UPDATE public.accounts
  SET balance = round((balance + p_amount)::numeric, 2)
  WHERE id = p_account_id AND user_id = p_user_id
  RETURNING balance INTO v_new_balance;

  RETURN COALESCE(v_new_balance, 0);
END;
$$;

-- B. fn_wipe_user_data: Secure caller verification and complete multi-table cascade
CREATE OR REPLACE FUNCTION public.fn_wipe_user_data(p_user_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cash_id uuid;
  v_deleted_expenses int := 0;
  v_deleted_income int := 0;
  v_deleted_transfers int := 0;
  v_deleted_budgets int := 0;
  v_deleted_rules int := 0;
  v_deleted_family_resp int := 0;
  v_deleted_family_goals int := 0;
  v_deleted_family_vault int := 0;
  v_deleted_family_members int := 0;
  v_deleted_accounts int := 0;
  v_deleted_mf_tx int := 0;
  v_deleted_mf_holdings int := 0;
  v_deleted_fno_trades int := 0;
  v_deleted_fno_pos int := 0;
  v_deleted_stock_tx int := 0;
  v_deleted_stock_holdings int := 0;
BEGIN
  IF p_user_id IS NULL OR trim(p_user_id) = '' THEN
    RAISE EXCEPTION 'p_user_id is required';
  END IF;

  -- CRITICAL SECURITY CHECK: Caller must be service_role or the user themselves
  IF auth.role() <> 'service_role' AND (auth.uid() IS NULL OR auth.uid()::text <> p_user_id) THEN
    RAISE EXCEPTION 'Access denied: caller is not authorized to wipe user data.';
  END IF;

  -- 1. Investment tables
  DELETE FROM public.mutual_fund_transactions WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_mf_tx = ROW_COUNT;

  DELETE FROM public.mutual_fund_holdings WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_mf_holdings = ROW_COUNT;

  DELETE FROM public.fno_trades WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_fno_trades = ROW_COUNT;

  DELETE FROM public.fno_positions WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_fno_pos = ROW_COUNT;

  DELETE FROM public.stock_transactions WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_stock_tx = ROW_COUNT;

  DELETE FROM public.stock_holdings WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_stock_holdings = ROW_COUNT;

  -- 2. Transfers
  DELETE FROM public.transfers WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_transfers = ROW_COUNT;

  -- 3. Recurring rules
  DELETE FROM public.recurring_rules WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_rules = ROW_COUNT;

  -- 4. Expenses & Income
  DELETE FROM public.expenses WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_expenses = ROW_COUNT;

  DELETE FROM public.income WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_income = ROW_COUNT;

  -- 5. Budgets
  DELETE FROM public.budgets WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_budgets = ROW_COUNT;

  -- 6. Family tables
  DELETE FROM public.family_responsibilities WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_family_resp = ROW_COUNT;

  DELETE FROM public.family_goals WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_family_goals = ROW_COUNT;

  DELETE FROM public.family_emergency_vault WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_family_vault = ROW_COUNT;

  DELETE FROM public.family_members WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_family_members = ROW_COUNT;

  -- 7. Audit logs
  DELETE FROM public.financial_audit_logs WHERE user_id = p_user_id;

  -- 8. Accounts: reset default cash account, delete remainder
  SELECT id INTO v_cash_id
  FROM public.accounts
  WHERE user_id = p_user_id
    AND (
      id = '00000000-0000-0000-0000-000000000001'
      OR last_four = 'CASH'
      OR lower(name) = 'cash in hand'
    )
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_cash_id IS NOT NULL THEN
    DELETE FROM public.accounts WHERE user_id = p_user_id AND id <> v_cash_id;
    GET DIAGNOSTICS v_deleted_accounts = ROW_COUNT;

    UPDATE public.accounts
    SET balance = 0.00
    WHERE id = v_cash_id;
  ELSE
    DELETE FROM public.accounts WHERE user_id = p_user_id;
    GET DIAGNOSTICS v_deleted_accounts = ROW_COUNT;

    INSERT INTO public.accounts (user_id, name, type, balance, last_four)
    VALUES (p_user_id, 'Cash in Hand', 'Liquid Cash', 0.00, 'CASH');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Workspace wiped securely',
    'deleted_transfers', v_deleted_transfers,
    'deleted_rules', v_deleted_rules,
    'deleted_expenses', v_deleted_expenses,
    'deleted_income', v_deleted_income,
    'deleted_budgets', v_deleted_budgets,
    'deleted_accounts', v_deleted_accounts,
    'deleted_stocks', v_deleted_stock_holdings,
    'deleted_fno', v_deleted_fno_pos,
    'deleted_mutual_funds', v_deleted_mf_holdings
  );
END;
$$;

-- C. Atomic Transaction Stored Procedures
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
  IF auth.role() <> 'service_role' AND (auth.uid() IS NULL OR auth.uid()::text <> p_user_id) THEN
    RAISE EXCEPTION 'Access denied: caller is not authorized for user %.', p_user_id;
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Expense amount must be strictly greater than zero.';
  END IF;

  IF p_account_id IS NOT NULL THEN
    SELECT name, balance, classification INTO v_acc_name, v_old_balance, v_acc_classification
    FROM public.accounts
    WHERE id = p_account_id AND user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Account % not found or unauthorized for user %.', p_account_id, p_user_id;
    END IF;

    IF v_acc_classification = 'liability' THEN
      v_new_balance := round((v_old_balance + p_amount)::numeric, 2);
    ELSE
      v_new_balance := round((v_old_balance - p_amount)::numeric, 2);
    END IF;

    UPDATE public.accounts
    SET balance = v_new_balance
    WHERE id = p_account_id AND user_id = p_user_id;
  END IF;

  INSERT INTO public.expenses (
    user_id, title, amount, category, account_id, expense_date, notes, tags
  )
  VALUES (
    p_user_id, trim(p_title), round(p_amount::numeric, 2), p_category, p_account_id, p_expense_date, p_notes, p_tags
  )
  RETURNING id INTO v_expense_id;

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
  v_diff numeric;
BEGIN
  IF auth.role() <> 'service_role' AND (auth.uid() IS NULL OR auth.uid()::text <> p_user_id) THEN
    RAISE EXCEPTION 'Access denied: caller is not authorized for user %.', p_user_id;
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Expense amount must be strictly greater than zero.';
  END IF;

  SELECT * INTO v_old_rec
  FROM public.expenses
  WHERE id = p_expense_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expense record % not found or unauthorized.', p_expense_id;
  END IF;

  -- Reverse old account impact if account existed
  IF v_old_rec.account_id IS NOT NULL THEN
    SELECT * INTO v_old_acc
    FROM public.accounts
    WHERE id = v_old_rec.account_id AND user_id = p_user_id
    FOR UPDATE;

    IF FOUND THEN
      IF v_old_acc.classification = 'liability' THEN
        UPDATE public.accounts SET balance = round((balance - v_old_rec.amount)::numeric, 2) WHERE id = v_old_rec.account_id;
      ELSE
        UPDATE public.accounts SET balance = round((balance + v_old_rec.amount)::numeric, 2) WHERE id = v_old_rec.account_id;
      END IF;
    END IF;
  END IF;

  -- Apply new account impact
  IF p_account_id IS NOT NULL THEN
    SELECT * INTO v_new_acc
    FROM public.accounts
    WHERE id = p_account_id AND user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Account % not found or unauthorized.', p_account_id;
    END IF;

    IF v_new_acc.classification = 'liability' THEN
      UPDATE public.accounts SET balance = round((balance + p_amount)::numeric, 2) WHERE id = p_account_id;
    ELSE
      UPDATE public.accounts SET balance = round((balance - p_amount)::numeric, 2) WHERE id = p_account_id;
    END IF;
  END IF;

  UPDATE public.expenses
  SET title = trim(p_title),
      amount = round(p_amount::numeric, 2),
      category = p_category,
      account_id = p_account_id,
      expense_date = p_expense_date,
      notes = p_notes,
      tags = p_tags,
      updated_at = timezone('utc'::text, now())
  WHERE id = p_expense_id AND user_id = p_user_id;

  INSERT INTO public.financial_audit_logs (user_id, entity_type, entity_id, action, delta_amount, old_state, new_state)
  VALUES (
    p_user_id, 'expense', p_expense_id, 'UPDATE', (p_amount - v_old_rec.amount),
    to_jsonb(v_old_rec),
    jsonb_build_object('title', p_title, 'amount', p_amount, 'category', p_category, 'account_id', p_account_id)
  );

  RETURN jsonb_build_object('success', true, 'expense_id', p_expense_id);
END;
$$;

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
  v_reversed_balance numeric;
BEGIN
  IF auth.role() <> 'service_role' AND (auth.uid() IS NULL OR auth.uid()::text <> p_user_id) THEN
    RAISE EXCEPTION 'Access denied: caller is not authorized for user %.', p_user_id;
  END IF;

  SELECT * INTO v_rec
  FROM public.expenses
  WHERE id = p_expense_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expense record % not found or unauthorized.', p_expense_id;
  END IF;

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
  IF auth.role() <> 'service_role' AND (auth.uid() IS NULL OR auth.uid()::text <> p_user_id) THEN
    RAISE EXCEPTION 'Access denied: caller is not authorized for user %.', p_user_id;
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Income amount must be strictly greater than zero.';
  END IF;

  IF p_account_id IS NOT NULL THEN
    SELECT name, balance, classification INTO v_acc_name, v_old_balance, v_acc_classification
    FROM public.accounts
    WHERE id = p_account_id AND user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Account % not found or unauthorized for user %.', p_account_id, p_user_id;
    END IF;

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

  INSERT INTO public.financial_audit_logs (
    user_id, entity_type, entity_id, action, delta_amount, new_state
  )
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
  v_reversed_balance numeric;
BEGIN
  IF auth.role() <> 'service_role' AND (auth.uid() IS NULL OR auth.uid()::text <> p_user_id) THEN
    RAISE EXCEPTION 'Access denied: caller is not authorized for user %.', p_user_id;
  END IF;

  SELECT * INTO v_rec
  FROM public.income
  WHERE id = p_income_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Income record % not found or unauthorized.', p_income_id;
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
  IF auth.role() <> 'service_role' AND (auth.uid() IS NULL OR auth.uid()::text <> p_user_id) THEN
    RAISE EXCEPTION 'Access denied: caller is not authorized for user %.', p_user_id;
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Transfer amount must be strictly greater than zero.';
  END IF;
  IF p_from_account_id = p_to_account_id THEN
    RAISE EXCEPTION 'Source and destination accounts must be distinct.';
  END IF;

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

  IF v_from_class = 'liability' THEN
    v_from_new_bal := round((v_from_bal + p_amount)::numeric, 2);
  ELSE
    v_from_new_bal := round((v_from_bal - p_amount)::numeric, 2);
  END IF;

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
  IF auth.role() <> 'service_role' AND (auth.uid() IS NULL OR auth.uid()::text <> p_user_id) THEN
    RAISE EXCEPTION 'Access denied: caller is not authorized for user %.', p_user_id;
  END IF;

  SELECT * INTO v_tr
  FROM public.transfers
  WHERE id = p_transfer_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transfer record not found or unauthorized.';
  END IF;

  IF v_tr.from_account_id < v_tr.to_account_id THEN
    SELECT * INTO v_from_acc FROM public.accounts WHERE id = v_tr.from_account_id FOR UPDATE;
    SELECT * INTO v_to_acc FROM public.accounts WHERE id = v_tr.to_account_id FOR UPDATE;
  ELSE
    SELECT * INTO v_to_acc FROM public.accounts WHERE id = v_tr.to_account_id FOR UPDATE;
    SELECT * INTO v_from_acc FROM public.accounts WHERE id = v_tr.from_account_id FOR UPDATE;
  END IF;

  IF v_from_acc.classification = 'liability' THEN
    UPDATE public.accounts SET balance = round((balance - v_tr.amount)::numeric, 2) WHERE id = v_tr.from_account_id;
  ELSE
    UPDATE public.accounts SET balance = round((balance + v_tr.amount)::numeric, 2) WHERE id = v_tr.from_account_id;
  END IF;

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

-- ----------------------------------------------------------------------------
-- 5. REVOKE INSECURE DIRECT PRIVILEGES FROM PUBLIC
-- ----------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;

-- Ensure authenticated can only access permitted tables via RLS
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- Ensure service_role has full elevated access for automated background jobs
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

COMMIT;
