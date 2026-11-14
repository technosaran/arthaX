-- Migration: 20261113000001_create_wipe_user_data_function.sql
-- Function to perform an atomic, cascade-safe master wipe of all user data.

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
BEGIN
  IF p_user_id IS NULL OR trim(p_user_id) = '' THEN
    RAISE EXCEPTION 'p_user_id is required';
  END IF;

  -- 1. Transfers (must delete before accounts due to ON DELETE RESTRICT on accounts)
  DELETE FROM public.transfers WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_transfers = ROW_COUNT;

  -- 2. Recurring transaction rules
  DELETE FROM public.recurring_rules WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_rules = ROW_COUNT;

  -- 3. Expenses
  DELETE FROM public.expenses WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_expenses = ROW_COUNT;

  -- 4. Income
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

  -- 8. Identify existing Cash in Hand account
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

  -- Delete all other accounts
  IF v_cash_id IS NOT NULL THEN
    DELETE FROM public.accounts WHERE user_id = p_user_id AND id <> v_cash_id;
    GET DIAGNOSTICS v_deleted_accounts = ROW_COUNT;

    -- Reset Cash in Hand balance to 0.00
    UPDATE public.accounts
    SET balance = 0.00,
        updated_at = timezone('utc'::text, now())
    WHERE id = v_cash_id;
  ELSE
    DELETE FROM public.accounts WHERE user_id = p_user_id;
    GET DIAGNOSTICS v_deleted_accounts = ROW_COUNT;

    -- Create fresh default cash account
    INSERT INTO public.accounts (user_id, name, type, balance, last_four)
    VALUES (p_user_id, 'Cash in Hand', 'Liquid Cash', 0.00, 'CASH');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Workspace wiped successfully',
    'deleted_transfers', v_deleted_transfers,
    'deleted_rules', v_deleted_rules,
    'deleted_expenses', v_deleted_expenses,
    'deleted_income', v_deleted_income,
    'deleted_budgets', v_deleted_budgets,
    'deleted_accounts', v_deleted_accounts,
    'deleted_family_members', v_deleted_family_members,
    'deleted_family_goals', v_deleted_family_goals,
    'deleted_family_resp', v_deleted_family_resp,
    'deleted_family_vault', v_deleted_family_vault
  );
END;
$$;

-- Grant execution to authenticated users and service role
GRANT EXECUTE ON FUNCTION public.fn_wipe_user_data(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_wipe_user_data(text) TO service_role;
