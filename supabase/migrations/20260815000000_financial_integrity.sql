-- Migration: 20260815000000_financial_integrity.sql
-- Purpose: Add exact accounting fields to transactions and ledger_logs, fix bond reversal, enforce balance integrity.

-- 1. Add fields to transactions
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS gross_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS fees NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS taxes NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS net_amount NUMERIC;

-- Backfill transactions
UPDATE public.transactions 
SET gross_amount = amount, net_amount = amount 
WHERE net_amount IS NULL;

-- 2. Add fields to ledger_logs
ALTER TABLE public.ledger_logs
ADD COLUMN IF NOT EXISTS gross_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS fees NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS taxes NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS net_amount NUMERIC;

-- Backfill ledger_logs
UPDATE public.ledger_logs 
SET gross_amount = amount, net_amount = amount 
WHERE net_amount IS NULL;

-- 3. Add ledger_log_id to bond_transactions
ALTER TABLE public.bond_transactions
ADD COLUMN IF NOT EXISTS ledger_log_id UUID REFERENCES public.ledger_logs(id) ON DELETE SET NULL;

-- 4. Update revert_ledger_log to use exact inversion
CREATE OR REPLACE FUNCTION public.revert_ledger_log(p_log_id UUID, p_user_id UUID) RETURNS JSONB AS $$
DECLARE 
    v_log RECORD; 
    v_sub RECORD; 
    v_trade RECORD; 
    v_mf_trade RECORD; 
    v_bond_trade RECORD;
    v_forex_txn RECORD;
    v_item RECORD; 
    v_curr NUMERIC; 
    v_rev NUMERIC; 
    v_meta JSONB;
BEGIN
    IF p_user_id IS NULL OR (auth.role() = 'authenticated' AND p_user_id != auth.uid()) THEN 
        RAISE EXCEPTION 'Unauthorized'; 
    END IF;

    -- Using FOR UPDATE guarantees row lock, effectively making repeated reversals block and fail safely
    SELECT * INTO v_log FROM ledger_logs WHERE id = p_log_id AND user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Log not found'); END IF;

    -- Module-specific logic based on source_type
    IF v_log.action_type = 'CREATE' THEN
         DELETE FROM accounts WHERE id = v_log.account_id AND user_id = p_user_id;
    ELSIF v_log.action_type = 'DELETE' THEN
        v_meta := v_log.metadata;
        IF v_meta IS NOT NULL THEN
            INSERT INTO accounts (id, user_id, name, type, balance, color, institution, account_number, created_at)
            VALUES (
                (v_meta->>'id')::UUID, 
                (v_meta->>'user_id')::UUID, 
                v_meta->>'name', 
                v_meta->>'type', 
                (v_meta->>'balance')::NUMERIC, 
                v_meta->>'color', 
                v_meta->>'institution', 
                v_meta->>'account_number', 
                (v_meta->>'created_at')::TIMESTAMPTZ
            );
        END IF;
    ELSIF v_log.source_type = 'family_transfer' THEN
        SELECT * INTO v_sub FROM family_transfers WHERE id = v_log.source_id AND user_id = p_user_id FOR UPDATE;
        IF FOUND THEN
            UPDATE family_members SET balance = balance - v_sub.amount WHERE id = v_sub.family_member_id AND user_id = p_user_id;
            DELETE FROM family_transfers WHERE id = v_sub.id;
        END IF;
    ELSIF v_log.source_type = 'investment' THEN
        SELECT * INTO v_trade FROM stock_trades WHERE ledger_log_id = p_log_id AND user_id = p_user_id FOR UPDATE;
        IF FOUND THEN
            SELECT * INTO v_item FROM investments WHERE id = v_trade.investment_id AND user_id = p_user_id FOR UPDATE;
            IF v_trade.trade_type = 'buy' THEN
                IF (v_item.quantity - v_trade.quantity) <= 0 THEN
                    DELETE FROM investments WHERE id = v_item.id;
                ELSE
                    UPDATE investments SET 
                        quantity = quantity - v_trade.quantity, 
                        buy_price = CASE WHEN (quantity - v_trade.quantity) > 0 THEN ((quantity * buy_price) - v_trade.total_amount) / (quantity - v_trade.quantity) ELSE 0 END,
                        updated_at = NOW()
                    WHERE id = v_item.id;
                END IF;
            ELSE
                UPDATE investments SET 
                    quantity = quantity + v_trade.quantity, 
                    realized_pnl = COALESCE(realized_pnl, 0) - COALESCE(v_trade.realized_pnl, 0),
                    updated_at = NOW()
                WHERE id = v_item.id;
            END IF;
            DELETE FROM stock_trades WHERE id = v_trade.id;
        END IF;
    ELSIF v_log.source_type = 'mutual_fund' THEN
        SELECT * INTO v_mf_trade FROM mutual_fund_trades WHERE ledger_log_id = p_log_id AND user_id = p_user_id FOR UPDATE;
        IF FOUND THEN
            SELECT * INTO v_item FROM mutual_funds WHERE id = v_mf_trade.mf_id AND user_id = p_user_id FOR UPDATE;
            IF v_mf_trade.trade_type = 'BUY' THEN
                IF (v_item.units - v_mf_trade.units) <= 0 THEN
                    DELETE FROM mutual_funds WHERE id = v_item.id;
                ELSE
                    UPDATE mutual_funds SET 
                        units = units - v_mf_trade.units, 
                        avg_nav = CASE WHEN (units - v_mf_trade.units) > 0 THEN ((units * avg_nav) - v_mf_trade.amount) / (units - v_mf_trade.units) ELSE 0 END,
                        updated_at = NOW()
                    WHERE id = v_item.id;
                END IF;
            ELSE
                UPDATE mutual_funds SET 
                    units = units + v_mf_trade.units, 
                    realized_pnl = COALESCE(realized_pnl, 0) - COALESCE(v_mf_trade.realized_pnl, 0),
                    updated_at = NOW()
                WHERE id = v_item.id;
            END IF;
            DELETE FROM mutual_fund_trades WHERE id = v_mf_trade.id;
        END IF;
    ELSIF v_log.source_type = 'bond' THEN
        -- Exact lookup via ledger_log_id OR exact net_amount if legacy
        SELECT * INTO v_bond_trade FROM bond_transactions WHERE (ledger_log_id = p_log_id OR (bond_id = v_log.source_id AND amount = COALESCE(v_log.net_amount, v_log.amount))) AND user_id = p_user_id ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
        IF FOUND THEN
            SELECT * INTO v_item FROM bonds WHERE id = v_bond_trade.bond_id AND user_id = p_user_id FOR UPDATE;
            IF v_bond_trade.transaction_type = 'BUY' THEN
                UPDATE bonds SET 
                    quantity = quantity - v_bond_trade.quantity,
                    total_invested = total_invested - v_bond_trade.amount,
                    current_value = current_value - (v_item.current_price * v_bond_trade.quantity),
                    updated_at = NOW()
                WHERE id = v_item.id;
                IF (v_item.quantity - v_bond_trade.quantity) <= 0 THEN
                    DELETE FROM bonds WHERE id = v_item.id;
                END IF;
            ELSIF v_bond_trade.transaction_type = 'INTEREST' THEN
                UPDATE bonds SET 
                    total_interest_earned = COALESCE(total_interest_earned, 0) - v_bond_trade.interest_amount,
                    updated_at = NOW()
                WHERE id = v_item.id;
            END IF;
            DELETE FROM bond_transactions WHERE id = v_bond_trade.id;
        END IF;
    ELSIF v_log.source_type = 'forex' THEN
        SELECT * INTO v_forex_txn FROM forex_transactions WHERE id = v_log.source_id AND user_id = p_user_id FOR UPDATE;
        IF FOUND THEN
            IF v_forex_txn.transaction_type = 'DEPOSIT' THEN
                UPDATE forex_accounts SET 
                    balance = balance - v_forex_txn.amount,
                    total_deposited = total_deposited - v_forex_txn.amount,
                    updated_at = NOW()
                WHERE id = v_forex_txn.forex_account_id;
            ELSE
                UPDATE forex_accounts SET 
                    balance = balance + v_forex_txn.amount,
                    total_withdrawn = total_withdrawn - v_forex_txn.amount,
                    updated_at = NOW()
                WHERE id = v_forex_txn.forex_account_id;
            END IF;
            DELETE FROM forex_transactions WHERE id = v_forex_txn.id;
        END IF;
    ELSIF v_log.source_type = 'fno_trade' THEN
        SELECT * INTO v_sub FROM fno_trades WHERE id = v_log.source_id AND user_id = p_user_id FOR UPDATE;
        IF FOUND THEN
            IF v_log.id = v_sub.close_ledger_log_id THEN
                -- Reverting close position: restore to OPEN
                UPDATE fno_trades SET 
                    status = 'OPEN', 
                    exit_price = NULL, 
                    close_date = NULL, 
                    pnl = NULL, 
                    close_ledger_log_id = NULL,
                    updated_at = NOW()
                WHERE id = v_sub.id;
            ELSE
                -- Reverting open position: delete trade
                DELETE FROM fno_trades WHERE id = v_sub.id;
            END IF;
        END IF;
    ELSIF v_log.source_type = 'alternative_asset' THEN
        DELETE FROM alternative_assets WHERE id = v_log.source_id AND user_id = p_user_id;
    ELSIF v_log.source_type = 'liability' THEN
        DELETE FROM liabilities WHERE id = v_log.source_id AND user_id = p_user_id;
    ELSIF v_log.source_type = 'goal' THEN
        UPDATE goals SET current_amount = current_amount - v_log.amount, updated_at = NOW() WHERE id = v_log.source_id AND user_id = p_user_id;
    ELSIF v_log.source_type = 'transfer' THEN
        FOR v_sub IN SELECT * FROM ledger_logs WHERE source_id = v_log.source_id AND id != p_log_id AND user_id = p_user_id LOOP
            UPDATE accounts SET balance = balance + (CASE WHEN v_sub.action_type = 'TRANSFER_OUT' THEN COALESCE(v_sub.net_amount, v_sub.amount) ELSE -COALESCE(v_sub.net_amount, v_sub.amount) END) WHERE id = v_sub.account_id AND user_id = p_user_id;
        END LOOP;
        DELETE FROM transfers WHERE id = v_log.source_id AND user_id = p_user_id;
        DELETE FROM ledger_logs WHERE source_id = v_log.source_id AND id != p_log_id AND user_id = p_user_id;
    ELSIF v_log.source_type = 'income' THEN DELETE FROM incomes WHERE id = v_log.source_id AND user_id = p_user_id;
    ELSIF v_log.source_type = 'expense' THEN DELETE FROM expenses WHERE id = v_log.source_id AND user_id = p_user_id;
    END IF;

    DELETE FROM transactions WHERE ledger_log_id = p_log_id AND user_id = p_user_id;

    -- Common account balance reversal exactly by net_amount
    SELECT balance INTO v_curr FROM accounts WHERE id = v_log.account_id AND user_id = p_user_id FOR UPDATE;
    IF FOUND THEN
        v_rev := CASE 
            WHEN v_log.action_type IN ('ADJUST_DOWN', 'TRANSFER_OUT', 'SEND_MONEY', 'WITHDRAW') THEN COALESCE(v_log.net_amount, v_log.amount)
            WHEN v_log.action_type IN ('ADJUST_UP', 'TRANSFER_IN', 'SEND_MONEY_IN', 'DEPOSIT') THEN -COALESCE(v_log.net_amount, v_log.amount)
            ELSE 0 
        END;
        IF v_rev != 0 THEN
            UPDATE accounts SET balance = balance + v_rev WHERE id = v_log.account_id;
        END IF;
    END IF;

    DELETE FROM ledger_logs WHERE id = p_log_id;
    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Create integrity check function to enforce balance = opening + sum(ledger)
CREATE OR REPLACE FUNCTION public.check_account_integrity(p_account_id UUID) RETURNS BOOLEAN AS $$
DECLARE
    v_actual_balance NUMERIC;
    v_calculated_balance NUMERIC;
BEGIN
    SELECT balance INTO v_actual_balance FROM accounts WHERE id = p_account_id;
    
    SELECT COALESCE(SUM(
        CASE 
            WHEN action_type IN ('ADJUST_UP', 'TRANSFER_IN', 'SEND_MONEY_IN', 'DEPOSIT') THEN COALESCE(net_amount, amount)
            WHEN action_type IN ('ADJUST_DOWN', 'TRANSFER_OUT', 'SEND_MONEY', 'WITHDRAW') THEN -COALESCE(net_amount, amount)
            ELSE 0 
        END
    ), 0) INTO v_calculated_balance 
    FROM ledger_logs WHERE account_id = p_account_id AND action_type != 'CREATE';

    -- Assuming opening balance is 0 for simplicity, or recorded as a CREATE/ADJUST_UP action
    RETURN v_actual_balance = v_calculated_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
