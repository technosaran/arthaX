-- Migration: 20261118000000_fix_security_and_wipe.sql
-- Enterprise Security Hardening & Master Wipe Data Expansion
-- 1. Drops dangerous public 'anon' policies on physical bullion holdings & transactions (eliminates home safe location disclosure hazard).
-- 2. Restricts bond holdings & transactions to strictly authenticated users matching auth.uid() (eliminates default_user leakage).
-- 3. Updates fn_wipe_user_data to cascade across bonds, bullion, and Zerodha integrations.

-- ============================================================================
-- 1. DROP INSECURE ANON POLICIES ON BULLION DATA
-- ============================================================================
DROP POLICY IF EXISTS "Allow anon dev select bullion holdings" ON public.bullion_holdings;
DROP POLICY IF EXISTS "Allow anon dev insert bullion holdings" ON public.bullion_holdings;
DROP POLICY IF EXISTS "Allow anon dev update bullion holdings" ON public.bullion_holdings;
DROP POLICY IF EXISTS "Allow anon dev delete bullion holdings" ON public.bullion_holdings;

DROP POLICY IF EXISTS "Allow anon dev select bullion transactions" ON public.bullion_transactions;
DROP POLICY IF EXISTS "Allow anon dev insert bullion transactions" ON public.bullion_transactions;
DROP POLICY IF EXISTS "Allow anon dev update bullion transactions" ON public.bullion_transactions;
DROP POLICY IF EXISTS "Allow anon dev delete bullion transactions" ON public.bullion_transactions;

-- Ensure RLS is active and authenticated users own their records
ALTER TABLE IF EXISTS public.bullion_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bullion_transactions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. BOND TABLES TENANT ISOLATION (ELIMINATE default_user)
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own bond holdings" ON public.bond_holdings;
CREATE POLICY "Users can view own bond holdings" ON public.bond_holdings
  FOR SELECT TO authenticated
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can view own bond transactions" ON public.bond_transactions;
CREATE POLICY "Users can view own bond transactions" ON public.bond_transactions
  FOR SELECT TO authenticated
  USING (auth.uid()::text = user_id);

-- ============================================================================
-- 3. EXPAND MASTER WIPE FUNCTION TO COVER ALL ASSET CLASSES & INTEGRATIONS
-- ============================================================================
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
  v_deleted_bonds int := 0;
  v_deleted_bullion int := 0;
  v_deleted_zerodha int := 0;
BEGIN
  IF p_user_id IS NULL OR trim(p_user_id) = '' THEN
    RAISE EXCEPTION 'p_user_id is required';
  END IF;

  -- 1. Transfers (delete before accounts due to foreign key constraints)
  DELETE FROM public.transfers WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_transfers = ROW_COUNT;

  -- 2. Recurring rules
  DELETE FROM public.recurring_rules WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_rules = ROW_COUNT;

  -- 3. Expenses & Income
  DELETE FROM public.expenses WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_expenses = ROW_COUNT;

  DELETE FROM public.income WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_income = ROW_COUNT;

  -- 4. Budgets
  DELETE FROM public.budgets WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_budgets = ROW_COUNT;

  -- 5. Family tables
  DELETE FROM public.family_responsibilities WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_family_resp = ROW_COUNT;

  DELETE FROM public.family_goals WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_family_goals = ROW_COUNT;

  DELETE FROM public.family_emergency_vault WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_family_vault = ROW_COUNT;

  DELETE FROM public.family_members WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_family_members = ROW_COUNT;

  -- 6. Equities & Mutual Funds & Derivatives
  DELETE FROM public.mutual_fund_transactions WHERE user_id = p_user_id;
  DELETE FROM public.mutual_fund_holdings WHERE user_id = p_user_id;
  DELETE FROM public.fno_trades WHERE user_id = p_user_id;
  DELETE FROM public.fno_positions WHERE user_id = p_user_id;
  DELETE FROM public.stock_transactions WHERE user_id = p_user_id;
  DELETE FROM public.stock_holdings WHERE user_id = p_user_id;
  DELETE FROM public.financial_audit_logs WHERE user_id = p_user_id;

  -- 7. Bonds & Fixed Income
  DELETE FROM public.bond_transactions WHERE user_id = p_user_id;
  DELETE FROM public.bond_holdings WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_bonds = ROW_COUNT;

  -- 8. Bullion & Physical Metals
  DELETE FROM public.bullion_transactions WHERE user_id = p_user_id;
  DELETE FROM public.bullion_holdings WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_bullion = ROW_COUNT;

  -- 9. Zerodha Integrations
  DELETE FROM public.zerodha_integrations WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_zerodha = ROW_COUNT;

  -- 10. Accounts: preserve/seed Cash in Hand with 0.00 balance
  DELETE FROM public.accounts
  WHERE user_id = p_user_id
    AND id != '00000000-0000-0000-0000-000000000001'
    AND last_four != 'CASH'
    AND lower(name) != 'cash in hand';
  GET DIAGNOSTICS v_deleted_accounts = ROW_COUNT;

  -- Reset balance of remaining Cash account, or insert it if missing
  SELECT id INTO v_cash_id
  FROM public.accounts
  WHERE user_id = p_user_id
    AND (id = '00000000-0000-0000-0000-000000000001' OR last_four = 'CASH' OR lower(name) = 'cash in hand')
  LIMIT 1;

  IF v_cash_id IS NOT NULL THEN
    UPDATE public.accounts
    SET balance = 0.00, updated_at = now()
    WHERE id = v_cash_id;
  ELSE
    INSERT INTO public.accounts (id, user_id, name, type, balance, last_four, created_at, updated_at)
    VALUES (
      '00000000-0000-0000-0000-000000000001',
      p_user_id,
      'Cash in Hand',
      'Liquid Cash',
      0.00,
      'CASH',
      now(),
      now()
    );
  END IF;

  RETURN jsonb_build_object(
    'status', 'success',
    'deleted', jsonb_build_object(
      'expenses', v_deleted_expenses,
      'income', v_deleted_income,
      'transfers', v_deleted_transfers,
      'budgets', v_deleted_budgets,
      'rules', v_deleted_rules,
      'family_members', v_deleted_family_members,
      'accounts', v_deleted_accounts,
      'bonds', v_deleted_bonds,
      'bullion', v_deleted_bullion,
      'zerodha', v_deleted_zerodha
    )
  );
END;
$$;
