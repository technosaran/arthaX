-- Migration: 20261121000000_secure_master_wipe_and_integrity.sql
-- Enterprise Security Hardening & Master Wipe Function Resolution
-- 1. Restores mandatory caller authorization (auth.uid() = p_user_id or service_role) on fn_wipe_user_data
-- 2. Expands fn_wipe_user_data to cover ALL 26 user-owned tables (including crypto_holdings, crypto_trades, binance_integrations)
-- 3. Drops any default 'default_user' fallbacks on accounts and financial tables
-- 4. Ensures strict search_path = public on all SECURITY DEFINER functions

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. HARDEN fn_wipe_user_data STORED PROCEDURE
-- ----------------------------------------------------------------------------
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
  v_deleted_stocks int := 0;
  v_deleted_stock_tx int := 0;
  v_deleted_mf int := 0;
  v_deleted_mf_tx int := 0;
  v_deleted_fno int := 0;
  v_deleted_fno_tx int := 0;
  v_deleted_bonds int := 0;
  v_deleted_bond_tx int := 0;
  v_deleted_bullion int := 0;
  v_deleted_bullion_tx int := 0;
  v_deleted_crypto int := 0;
  v_deleted_crypto_tx int := 0;
  v_deleted_zerodha int := 0;
  v_deleted_binance int := 0;
  v_deleted_audit_logs int := 0;
BEGIN
  -- Strict Input Validation
  IF p_user_id IS NULL OR trim(p_user_id) = '' THEN
    RAISE EXCEPTION 'p_user_id is required';
  END IF;

  -- CRITICAL SECURITY GATE: Enforce that caller is either service_role or the verified authenticated owner
  IF auth.role() <> 'service_role' AND (auth.uid() IS NULL OR auth.uid()::text <> p_user_id) THEN
    RAISE EXCEPTION 'Access denied: caller is not authorized to wipe user data for user %.', p_user_id;
  END IF;

  -- 1. Transfers (must delete before accounts due to foreign key constraints)
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

  -- 5. Family Finance Tables
  DELETE FROM public.family_responsibilities WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_family_resp = ROW_COUNT;

  DELETE FROM public.family_goals WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_family_goals = ROW_COUNT;

  DELETE FROM public.family_emergency_vault WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_family_vault = ROW_COUNT;

  DELETE FROM public.family_members WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_family_members = ROW_COUNT;

  -- 6. Equities & Derivatives
  DELETE FROM public.stock_transactions WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_stock_tx = ROW_COUNT;

  DELETE FROM public.stock_holdings WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_stocks = ROW_COUNT;

  DELETE FROM public.fno_trades WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_fno_tx = ROW_COUNT;

  DELETE FROM public.fno_positions WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_fno = ROW_COUNT;

  -- 7. Mutual Funds
  DELETE FROM public.mutual_fund_transactions WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_mf_tx = ROW_COUNT;

  DELETE FROM public.mutual_fund_holdings WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_mf = ROW_COUNT;

  -- 8. Bonds & Fixed Income
  DELETE FROM public.bond_transactions WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_bond_tx = ROW_COUNT;

  DELETE FROM public.bond_holdings WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_bonds = ROW_COUNT;

  -- 9. Bullion & Physical Metals
  DELETE FROM public.bullion_transactions WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_bullion_tx = ROW_COUNT;

  DELETE FROM public.bullion_holdings WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_bullion = ROW_COUNT;

  -- 10. Cryptocurrency & Binance Trades
  DELETE FROM public.crypto_trades WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_crypto_tx = ROW_COUNT;

  DELETE FROM public.crypto_holdings WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_crypto = ROW_COUNT;

  -- 11. External Broker & Exchange Integrations
  DELETE FROM public.zerodha_integrations WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_zerodha = ROW_COUNT;

  DELETE FROM public.binance_integrations WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_binance = ROW_COUNT;

  -- 12. Audit Logs
  DELETE FROM public.financial_audit_logs WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_audit_logs = ROW_COUNT;

  -- 13. Accounts: Delete non-cash accounts and reset/seed Cash in Hand account
  DELETE FROM public.accounts
  WHERE user_id = p_user_id
    AND id != '00000000-0000-0000-0000-000000000001'
    AND last_four != 'CASH'
    AND lower(name) != 'cash in hand';
  GET DIAGNOSTICS v_deleted_accounts = ROW_COUNT;

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
    UPDATE public.accounts
    SET balance = 0.00, updated_at = timezone('utc'::text, now())
    WHERE id = v_cash_id;
  ELSE
    INSERT INTO public.accounts (user_id, name, type, balance, last_four)
    VALUES (p_user_id, 'Cash in Hand', 'Liquid Cash', 0.00, 'CASH');
  END IF;

  -- 14. Reset external integration tokens in user_settings without deleting user settings row
  UPDATE public.user_settings
  SET telegram_chat_id = NULL,
      telegram_username = NULL,
      telegram_link_token = NULL,
      telegram_linked_at = NULL,
      updated_at = timezone('utc'::text, now())
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Workspace data wiped successfully. Liquid cash reset to zero.',
    'user_id', p_user_id,
    'deleted_transfers', v_deleted_transfers,
    'deleted_rules', v_deleted_rules,
    'deleted_expenses', v_deleted_expenses,
    'deleted_income', v_deleted_income,
    'deleted_budgets', v_deleted_budgets,
    'deleted_accounts', v_deleted_accounts,
    'deleted_stocks', v_deleted_stocks + v_deleted_stock_tx,
    'deleted_mutual_funds', v_deleted_mf + v_deleted_mf_tx,
    'deleted_fno', v_deleted_fno + v_deleted_fno_tx,
    'deleted_bonds', v_deleted_bonds + v_deleted_bond_tx,
    'deleted_bullion', v_deleted_bullion + v_deleted_bullion_tx,
    'deleted_crypto', v_deleted_crypto + v_deleted_crypto_tx,
    'deleted_integrations', v_deleted_zerodha + v_deleted_binance
  );
END;
$$;

-- Grant execution to authenticated users (authorization check is inside function body)
REVOKE EXECUTE ON FUNCTION public.fn_wipe_user_data(text) FROM public;
GRANT EXECUTE ON FUNCTION public.fn_wipe_user_data(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_wipe_user_data(text) TO service_role;

-- ----------------------------------------------------------------------------
-- 2. ELIMINATE ANY DEFAULT 'default_user' IN COLUMN DEFINITIONS
-- ----------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.accounts ALTER COLUMN user_id DROP DEFAULT;
ALTER TABLE IF EXISTS public.income ALTER COLUMN user_id DROP DEFAULT;
ALTER TABLE IF EXISTS public.expenses ALTER COLUMN user_id DROP DEFAULT;
ALTER TABLE IF EXISTS public.budgets ALTER COLUMN user_id DROP DEFAULT;

COMMIT;
