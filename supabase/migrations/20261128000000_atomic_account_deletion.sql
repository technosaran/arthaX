-- ============================================================================
-- Migration: 20261128000000_atomic_account_deletion.sql
-- Description: Transactional atomic account deletion procedure that safely
--              handles ON DELETE RESTRICT transfer references without altering
--              balances on remaining accounts.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_delete_account_atomic(
  p_user_id text,
  p_account_id uuid,
  p_clear_transfers boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id text := auth.uid()::text;
  v_caller_role text := public.fn_get_caller_role();
  v_acc record;
  v_transfer_count integer := 0;
  v_statement_count integer := 0;
  v_deleted_transfers integer := 0;
BEGIN
  IF p_user_id IS NULL OR trim(p_user_id) = '' OR p_user_id = 'default_user' THEN
    RAISE EXCEPTION 'Invalid user_id parameter provided for account deletion'
      USING ERRCODE = '22023';
  END IF;

  IF v_caller_role != 'service_role' AND (v_caller_id IS NULL OR v_caller_id != p_user_id) THEN
    RAISE EXCEPTION 'fn_delete_account_atomic: Unauthorized caller % for user %', v_caller_id, p_user_id
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_acc
  FROM public.accounts
  WHERE id = p_account_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account % not found or access denied.', p_account_id
      USING ERRCODE = 'P0002';
  END IF;

  -- Guard built-in Cash and integrated Zerodha cards
  IF v_acc.id = '00000000-0000-0000-0000-000000000001'::uuid
     OR upper(coalesce(v_acc.last_four, '')) = 'CASH'
     OR lower(coalesce(v_acc.type, '')) IN ('liquid cash', 'cash')
     OR lower(coalesce(v_acc.name, '')) IN ('cash in hand', 'cash wallet') THEN
    RAISE EXCEPTION 'Cash in Hand is a permanent built-in card and cannot be deleted.'
      USING ERRCODE = '22023';
  END IF;

  IF lower(coalesce(v_acc.name, '')) LIKE '%zerodha%'
     OR lower(coalesce(v_acc.name, '')) LIKE '%kite%' THEN
    RAISE EXCEPTION 'Zerodha Trading & Demat is an integrated account and cannot be deleted here.'
      USING ERRCODE = '22023';
  END IF;

  SELECT count(*)::integer INTO v_transfer_count
  FROM public.transfers
  WHERE user_id = p_user_id
    AND (from_account_id = p_account_id OR to_account_id = p_account_id);

  SELECT count(*)::integer INTO v_statement_count
  FROM public.bank_statements
  WHERE user_id = p_user_id
    AND account_id = p_account_id;

  IF v_transfer_count > 0 AND NOT p_clear_transfers THEN
    RAISE EXCEPTION 'Account "%" has % linked transfer record(s). Confirm removal to clear them before unlinking.', v_acc.name, v_transfer_count
      USING ERRCODE = '23503';
  END IF;

  -- Remove transfer log rows referencing this account (preserving remaining account balances)
  IF v_transfer_count > 0 THEN
    DELETE FROM public.transfers
    WHERE user_id = p_user_id
      AND (from_account_id = p_account_id OR to_account_id = p_account_id);
    GET DIAGNOSTICS v_deleted_transfers = ROW_COUNT;
  END IF;

  -- Delete the account; expenses/income/holdings set account_id=NULL, statements/canonical cascade
  DELETE FROM public.accounts
  WHERE id = p_account_id AND user_id = p_user_id;

  INSERT INTO public.financial_audit_logs (
    user_id, entity_type, entity_id, action, delta_amount, old_state
  ) VALUES (
    p_user_id,
    'account',
    p_account_id,
    'DELETE',
    v_acc.balance,
    jsonb_build_object(
      'name', v_acc.name,
      'type', v_acc.type,
      'balance', v_acc.balance,
      'cleared_transfers', v_deleted_transfers,
      'cascaded_statements', v_statement_count
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'deleted_account_id', p_account_id,
    'account_name', v_acc.name,
    'cleared_transfers', v_deleted_transfers,
    'cleared_statements', v_statement_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_delete_account_atomic(text, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_delete_account_atomic(text, uuid, boolean) TO authenticated, service_role;

COMMIT;
