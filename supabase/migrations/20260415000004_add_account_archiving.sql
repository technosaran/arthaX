ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;

CREATE OR REPLACE FUNCTION delete_account_atomic_v2(p_user_id UUID, p_account_id UUID) RETURNS JSONB AS $$
DECLARE 
    v_acc RECORD;
    v_txn_count INT;
BEGIN
    IF p_user_id IS NULL OR (auth.role() = 'authenticated' AND p_user_id != auth.uid()) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
    SELECT * INTO v_acc FROM accounts WHERE id = p_account_id AND user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;

    -- Protect built-in accounts
    IF v_acc.name ILIKE '%Cash%' OR v_acc.name ILIKE '%Zerodha%' THEN
        RAISE EXCEPTION 'Built-in accounts (Cash Reserve, Zerodha Funds) are permanent and cannot be deleted.';
    END IF;

    -- Check if it has any ledger_logs
    SELECT COUNT(*) INTO v_txn_count FROM ledger_logs WHERE account_id = p_account_id;

    IF v_txn_count > 0 THEN
        UPDATE accounts SET is_archived = true WHERE id = p_account_id;
        INSERT INTO ledger_logs (user_id, account_id, account_name, action_type, amount, previous_balance, new_balance, details, metadata)
        VALUES (p_user_id, p_account_id, v_acc.name, 'ARCHIVE', v_acc.balance, v_acc.balance, v_acc.balance, 'Archived account: ' || v_acc.name, to_jsonb(v_acc));
        RETURN jsonb_build_object('success', true, 'message', 'Account archived due to existing transactions');
    ELSE
        DELETE FROM accounts WHERE id = p_account_id;
        INSERT INTO ledger_logs (user_id, account_id, account_name, action_type, amount, previous_balance, new_balance, details, metadata)
        VALUES (p_user_id, p_account_id, v_acc.name, 'DELETE', v_acc.balance, v_acc.balance, 0, 'Deleted account: ' || v_acc.name, to_jsonb(v_acc));
        RETURN jsonb_build_object('success', true, 'message', 'Account deleted successfully');
    END IF;
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
