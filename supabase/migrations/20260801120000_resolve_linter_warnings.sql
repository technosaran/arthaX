-- Migration: Resolve All Supabase Linter Warnings
-- Date: 2026-08-01
-- Purpose: Address security definer linter warnings by converting read-only RPCs to SECURITY INVOKER, 
--          hardening search paths, revoking PUBLIC permissions, and restricting role execution grants.

-- 1. Convert Read-Only functions to SECURITY INVOKER (runs under calling user's RLS context)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_summary_v1') THEN
    ALTER FUNCTION public.get_summary_v1() SECURITY INVOKER;
  END IF;
END $$;

-- 2. Revoke PUBLIC execution on specific SECURITY DEFINER RPCs reported by Linter
DO $$
BEGIN
  -- Telegram Context Lookup
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_telegram_user_context') THEN
    ALTER FUNCTION public.get_telegram_user_context(text) SET search_path = public, pg_temp;
    REVOKE EXECUTE ON FUNCTION public.get_telegram_user_context(text) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.get_telegram_user_context(text) TO anon, authenticated, service_role;
  END IF;

  -- SMS Expense & Income Recorders
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'record_expense_by_sms') THEN
    ALTER FUNCTION public.record_expense_by_sms(text, text, numeric, text, date, uuid) SET search_path = public, pg_temp;
    REVOKE EXECUTE ON FUNCTION public.record_expense_by_sms(text, text, numeric, text, date, uuid) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.record_expense_by_sms(text, text, numeric, text, date, uuid) TO anon, authenticated, service_role;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'record_income_by_sms') THEN
    ALTER FUNCTION public.record_income_by_sms(text, text, numeric, text, date, uuid) SET search_path = public, pg_temp;
    REVOKE EXECUTE ON FUNCTION public.record_income_by_sms(text, text, numeric, text, date, uuid) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.record_income_by_sms(text, text, numeric, text, date, uuid) TO anon, authenticated, service_role;
  END IF;

  -- Family Operations
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'pay_family_allowance') THEN
    ALTER FUNCTION public.pay_family_allowance(uuid, uuid, uuid) SET search_path = public, pg_temp;
    REVOKE EXECUTE ON FUNCTION public.pay_family_allowance(uuid, uuid, uuid) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.pay_family_allowance(uuid, uuid, uuid) TO authenticated, service_role;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'process_family_transfer_v2') THEN
    ALTER FUNCTION public.process_family_transfer_v2(uuid, uuid, uuid, numeric, text, text) SET search_path = public, pg_temp;
    REVOKE EXECUTE ON FUNCTION public.process_family_transfer_v2(uuid, uuid, uuid, numeric, text, text) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.process_family_transfer_v2(uuid, uuid, uuid, numeric, text, text) TO authenticated, service_role;
  END IF;

  -- Mutual Fund Investment Recorder
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'record_mf_investment_v4') THEN
    ALTER FUNCTION public.record_mf_investment_v4(uuid, text, text, numeric, numeric, text, text, text, date, uuid, numeric, text) SET search_path = public, pg_temp;
    REVOKE EXECUTE ON FUNCTION public.record_mf_investment_v4(uuid, text, text, numeric, numeric, text, text, text, date, uuid, numeric, text) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.record_mf_investment_v4(uuid, text, text, numeric, numeric, text, text, text, date, uuid, numeric, text) TO authenticated, service_role;
  END IF;

  -- User Data Reset & Revert Log
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'reset_user_data') THEN
    ALTER FUNCTION public.reset_user_data(uuid) SET search_path = public, pg_temp;
    REVOKE EXECUTE ON FUNCTION public.reset_user_data(uuid) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.reset_user_data(uuid) TO authenticated, service_role;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'revert_ledger_log') THEN
    ALTER FUNCTION public.revert_ledger_log(uuid, uuid) SET search_path = public, pg_temp;
    REVOKE EXECUTE ON FUNCTION public.revert_ledger_log(uuid, uuid) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.revert_ledger_log(uuid, uuid) TO authenticated, service_role;
  END IF;
END $$;

-- 3. Dynamic Sweeper: Harden search paths and revoke PUBLIC execute rights on all SECURITY DEFINER functions in public schema
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT p.oid::regprocedure AS sig, p.proname AS func_name, t.typname AS return_type
        FROM pg_proc p
        JOIN pg_type t ON p.prorettype = t.oid
        WHERE p.pronamespace = 'public'::regnamespace
          AND p.prosecdef = true
          AND NOT EXISTS (
              SELECT 1 
              FROM pg_depend d 
              WHERE d.objid = p.oid 
                AND d.deptype = 'e'
          )
    ) LOOP
        BEGIN
            -- Ensure safe search path
            EXECUTE 'ALTER FUNCTION ' || r.sig || ' SET search_path = public, pg_temp;';
            
            IF r.return_type = 'trigger' THEN
                EXECUTE 'REVOKE EXECUTE ON FUNCTION ' || r.sig || ' FROM PUBLIC, anon, authenticated;';
            ELSIF r.func_name IN ('get_telegram_user_context', 'record_expense_by_sms', 'record_income_by_sms') THEN
                -- Functions required by anonymous webhook/SMS calls
                EXECUTE 'REVOKE EXECUTE ON FUNCTION ' || r.sig || ' FROM PUBLIC;';
                EXECUTE 'GRANT EXECUTE ON FUNCTION ' || r.sig || ' TO anon, authenticated, service_role;';
            ELSE
                -- All other security definer functions restricted to authenticated & service_role
                EXECUTE 'REVOKE EXECUTE ON FUNCTION ' || r.sig || ' FROM PUBLIC, anon;';
                EXECUTE 'GRANT EXECUTE ON FUNCTION ' || r.sig || ' TO authenticated, service_role;';
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Skipping function % due to error: %', r.sig, SQLERRM;
        END;
    END LOOP;
END $$;
