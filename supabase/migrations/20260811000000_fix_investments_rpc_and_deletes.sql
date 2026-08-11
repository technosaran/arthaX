-- Migration: 20260811000000_fix_investments_rpc_and_deletes.sql
-- Purpose: 
-- 1. Increase trade history LIMIT in get_investments_v1 from 50 to 250 records.
-- 2. Harden record_mf_investment_v4 to match on fund_symbol OR scheme_code to prevent duplicates.
-- 3. Add mutual_fund support to atomic_delete_entity.
-- 4. Supabase Database Linter Security Hardening: Revoke anon execution permissions on sensitive RPCs.

-- ============================================================================
-- 1. get_investments_v1 with expanded history limits
-- ============================================================================
CREATE OR REPLACE FUNCTION get_investments_v1()
RETURNS JSON AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_result JSON;
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    SELECT json_build_object(
        'investments', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.investments WHERE user_id = v_user_id ORDER BY current_price * quantity DESC) t),
        'mutualFunds', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.mutual_funds WHERE user_id = v_user_id) t),
        'bonds', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.bonds WHERE user_id = v_user_id ORDER BY maturity_date ASC) t),
        'alternativeAssets', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.alternative_assets WHERE user_id = v_user_id ORDER BY current_value DESC) t),
        'stockTrades', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.stock_trades WHERE user_id = v_user_id ORDER BY trade_date DESC LIMIT 250) t),
        'mutualFundTrades', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.mutual_fund_trades WHERE user_id = v_user_id ORDER BY date DESC LIMIT 250) t),
        'bondTransactions', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.bond_transactions WHERE user_id = v_user_id ORDER BY transaction_date DESC LIMIT 250) t),
        'fnoTrades', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.fno_trades WHERE user_id = v_user_id ORDER BY trade_date DESC, created_at DESC LIMIT 250) t)
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;

-- ============================================================================
-- 2. record_mf_investment_v4 with dual scheme_code & fund_symbol lookup
-- ============================================================================
CREATE OR REPLACE FUNCTION record_mf_investment_v4(
    p_user_id UUID, 
    p_fund_name TEXT, 
    p_scheme_code TEXT, 
    p_units NUMERIC, 
    p_nav NUMERIC, 
    p_investment_type TEXT, 
    p_category TEXT, 
    p_amc_name TEXT, 
    p_date DATE, 
    p_account_id UUID, 
    p_stamp_duty NUMERIC DEFAULT 0, 
    p_trade_type TEXT DEFAULT 'buy'
) RETURNS JSONB AS $$
DECLARE 
    v_mf_id UUID; 
    v_total NUMERIC; 
    v_old_bal NUMERIC; 
    v_acc_name TEXT; 
    v_log_id UUID; 
    v_exist RECORD; 
    v_pnl NUMERIC := 0;
BEGIN
    IF p_user_id IS NULL OR (auth.role() = 'authenticated' AND p_user_id != auth.uid()) THEN 
        RAISE EXCEPTION 'Unauthorized'; 
    END IF;
    IF p_units <= 0 THEN 
        RAISE EXCEPTION 'Units must be positive'; 
    END IF;

    v_total := CASE WHEN p_trade_type = 'buy' THEN (p_units * p_nav) + p_stamp_duty ELSE (p_units * p_nav) - p_stamp_duty END;

    IF p_account_id IS NOT NULL THEN
        SELECT balance, name INTO v_old_bal, v_acc_name FROM accounts WHERE id = p_account_id AND user_id = p_user_id FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;
        IF p_trade_type = 'buy' AND v_old_bal < v_total THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
    END IF;

    -- Match using fund_symbol OR scheme_code to prevent duplicate rows
    SELECT * INTO v_exist FROM mutual_funds 
    WHERE user_id = p_user_id AND (fund_symbol = p_scheme_code OR scheme_code = p_scheme_code) 
    FOR UPDATE;

    IF p_trade_type = 'buy' THEN
        IF v_exist IS NOT NULL THEN
            UPDATE mutual_funds 
            SET units = units + p_units, 
                avg_nav = ((units * avg_nav) + v_total) / (units + p_units), 
                current_nav = p_nav, 
                scheme_code = COALESCE(scheme_code, p_scheme_code),
                fund_symbol = COALESCE(fund_symbol, p_scheme_code),
                updated_at = NOW() 
            WHERE id = v_exist.id;
            v_mf_id := v_exist.id;
        ELSE
            INSERT INTO mutual_funds (user_id, fund_name, fund_symbol, scheme_code, units, avg_nav, current_nav, investment_type, category, amc_name)
            VALUES (p_user_id, p_fund_name, p_scheme_code, p_scheme_code, p_units, v_total / p_units, p_nav, p_investment_type, p_category, p_amc_name) 
            RETURNING id INTO v_mf_id;
        END IF;
    ELSE
        IF v_exist IS NULL OR v_exist.units < p_units THEN RAISE EXCEPTION 'Insufficient units'; END IF;
        v_pnl := v_total - (v_exist.avg_nav * p_units);
        UPDATE mutual_funds 
        SET units = units - p_units, 
            realized_pnl = COALESCE(realized_pnl, 0) + v_pnl, 
            current_nav = p_nav, 
            updated_at = NOW() 
        WHERE id = v_exist.id;
        v_mf_id := v_exist.id;
    END IF;

    IF p_account_id IS NOT NULL THEN
        UPDATE accounts SET balance = CASE WHEN p_trade_type = 'buy' THEN balance - v_total ELSE balance + v_total END WHERE id = p_account_id;

        INSERT INTO ledger_logs (user_id, account_id, account_name, action_type, amount, previous_balance, new_balance, details, source_id, source_type)
        VALUES (p_user_id, p_account_id, v_acc_name, CASE WHEN p_trade_type = 'buy' THEN 'ADJUST_DOWN' ELSE 'ADJUST_UP' END, v_total, v_old_bal, CASE WHEN p_trade_type = 'buy' THEN v_old_bal - v_total ELSE v_old_bal + v_total END, (CASE WHEN p_trade_type = 'buy' THEN 'Subscribed ' ELSE 'Redeemed ' END) || p_units || ' units in ' || p_fund_name, v_mf_id, 'mutual_fund')
        RETURNING id INTO v_log_id;

        INSERT INTO transactions (user_id, account_id, description, amount, type, category, date, source_id, source_type, ledger_log_id)
        VALUES (p_user_id, p_account_id, (CASE WHEN p_trade_type = 'buy' THEN 'MF Buy: ' ELSE 'MF Sell: ' END) || p_fund_name, v_total, CASE WHEN p_trade_type = 'buy' THEN 'expense' ELSE 'income' END, 'Investments', p_date, v_mf_id, 'mutual_fund', v_log_id);
    END IF;

    INSERT INTO mutual_fund_trades (user_id, mf_id, fund_name, trade_type, units, nav, amount, date, ledger_log_id, realized_pnl)
    VALUES (p_user_id, v_mf_id, p_fund_name, UPPER(p_trade_type), p_units, p_nav, v_total, p_date, v_log_id, v_pnl);

    RETURN jsonb_build_object('success', true, 'mf_id', v_mf_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- 3. atomic_delete_entity with mutual_fund support
-- ============================================================================
CREATE OR REPLACE FUNCTION atomic_delete_entity(
    p_user_id UUID,
    p_entity_type TEXT,
    p_entity_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_log_id UUID;
    v_res JSONB;
BEGIN
    IF p_user_id IS NULL OR (auth.role() = 'authenticated' AND p_user_id != auth.uid()) THEN 
        RAISE EXCEPTION 'Unauthorized'; 
    END IF;

    -- Loop through associated ledger logs in reverse order
    FOR v_log_id IN 
        SELECT id FROM ledger_logs 
        WHERE source_id = p_entity_id AND source_type = p_entity_type AND user_id = p_user_id
        ORDER BY created_at DESC 
    LOOP
        v_res := revert_ledger_log(v_log_id, p_user_id);
    END LOOP;

    -- Safely delete entity record
    IF p_entity_type = 'alternative_asset' THEN
        DELETE FROM alternative_assets WHERE id = p_entity_id AND user_id = p_user_id;
    ELSIF p_entity_type = 'liability' THEN
        DELETE FROM liabilities WHERE id = p_entity_id AND user_id = p_user_id;
    ELSIF p_entity_type = 'forex_account' THEN
        DELETE FROM forex_accounts WHERE id = p_entity_id AND user_id = p_user_id;
    ELSIF p_entity_type = 'investment' THEN
        DELETE FROM investments WHERE id = p_entity_id AND user_id = p_user_id;
    ELSIF p_entity_type = 'mutual_fund' THEN
        DELETE FROM mutual_funds WHERE id = p_entity_id AND user_id = p_user_id;
    ELSIF p_entity_type = 'goal' THEN
        DELETE FROM goals WHERE id = p_entity_id AND user_id = p_user_id;
    ELSIF p_entity_type = 'recipient' THEN
        DELETE FROM recipients WHERE id = p_entity_id AND user_id = p_user_id;
    ELSIF p_entity_type = 'budget' THEN
        DELETE FROM budgets WHERE id = p_entity_id AND user_id = p_user_id;
    END IF;

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- 4. DATABASE LINTER SECURITY HARDENING (REVOKE ANON EXECUTION)
-- ============================================================================
REVOKE EXECUTE ON FUNCTION public.process_transfer FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_transfer TO authenticated;

REVOKE EXECUTE ON FUNCTION public.record_mf_investment_v4 FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_mf_investment_v4 TO authenticated;

REVOKE EXECUTE ON FUNCTION public.reset_user_data FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_user_data TO authenticated;

REVOKE EXECUTE ON FUNCTION public.revert_ledger_log FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revert_ledger_log TO authenticated;

REVOKE EXECUTE ON FUNCTION public.forex_log_trade FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.forex_log_trade TO authenticated;

REVOKE EXECUTE ON FUNCTION public.update_forex_trade_atomic FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_forex_trade_atomic TO authenticated;

REVOKE EXECUTE ON FUNCTION public.pay_family_allowance FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pay_family_allowance TO authenticated;

REVOKE EXECUTE ON FUNCTION public.process_family_transfer_v2 FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_family_transfer_v2 TO authenticated;

REVOKE EXECUTE ON FUNCTION public.link_telegram_account FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_telegram_account TO authenticated;
