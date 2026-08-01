-- Migration: Comprehensive Supabase Security & Performance Hardening
-- Date: 2026-08-01
-- Purpose: 
-- 1. Fix "Auth RLS Initialization Plan" by wrapping auth.uid() inside (SELECT auth.uid()).
-- 2. Fix "Multiple Permissive Policies" by dropping duplicate/overlapping policies and establishing a single, unified policy per table.
-- 3. Fix "Public Can Execute SECURITY DEFINER Function" by explicitly revoking PUBLIC permissions and setting search_path.
-- 4. Clean up unused indexes on profiles and goals.

-- ==============================================================================
-- PART 1: UNIFIED RLS POLICIES & AUTH.UID() OPTIMIZATION
-- ==============================================================================

DO $$
DECLARE
  pol RECORD;
  t TEXT;
  user_tables TEXT[] := ARRAY[
    'accounts', 'transactions', 'transfers', 'ledger_logs',
    'incomes', 'expenses', 'budgets', 'goals', 'liabilities',
    'investments', 'stock_trades', 'mutual_funds', 'mutual_fund_trades',
    'bonds', 'bond_transactions', 'alternative_assets', 'forex_accounts',
    'forex_trades', 'forex_transactions', 'fno_trades', 'family_members',
    'family_allowances', 'family_transfers'
  ];
BEGIN
  -- 1. Profiles Table
  EXECUTE 'ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;';
  FOR pol IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles;', pol.policyname);
  END LOOP;

  EXECUTE 'CREATE POLICY "profiles_owner_all" ON public.profiles FOR ALL TO authenticated USING (id = (SELECT auth.uid())) WITH CHECK (id = (SELECT auth.uid()));';

  -- 2. User Data Tables
  FOREACH t IN ARRAY user_tables LOOP
    EXECUTE format('ALTER TABLE IF EXISTS public.%I ENABLE ROW LEVEL SECURITY;', t);
    
    -- Drop all existing policies on table to eliminate duplicates/multiple permissive policies
    FOR pol IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t) LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', pol.policyname, t);
    END LOOP;

    -- Create single unified policy using (SELECT auth.uid()) for performance
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));',
      t || '_owner_all', t
    );
  END LOOP;
END $$;


-- ==============================================================================
-- PART 2: SECURITY DEFINER FUNCTION HARDENING
-- ==============================================================================

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
          SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e'
      )
  ) LOOP
    BEGIN
      -- Ensure safe search path for all security definer functions
      EXECUTE 'ALTER FUNCTION ' || r.sig || ' SET search_path = public, pg_temp;';
      
      IF r.return_type = 'trigger' THEN
        EXECUTE 'REVOKE EXECUTE ON FUNCTION ' || r.sig || ' FROM PUBLIC, anon, authenticated;';
      ELSIF r.func_name IN ('get_telegram_user_context', 'record_expense_by_sms', 'record_income_by_sms') THEN
        -- Functions required by anonymous webhook / SMS endpoints
        EXECUTE 'REVOKE EXECUTE ON FUNCTION ' || r.sig || ' FROM PUBLIC;';
        EXECUTE 'GRANT EXECUTE ON FUNCTION ' || r.sig || ' TO anon, authenticated, service_role;';
      ELSE
        -- Restrict all other SECURITY DEFINER functions to authenticated users and service_role only
        EXECUTE 'REVOKE EXECUTE ON FUNCTION ' || r.sig || ' FROM PUBLIC, anon;';
        EXECUTE 'GRANT EXECUTE ON FUNCTION ' || r.sig || ' TO authenticated, service_role;';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipping function %: %', r.sig, SQLERRM;
    END;
  END LOOP;
END $$;


-- ==============================================================================
-- PART 3: UNUSED INDEX CLEANUP
-- ==============================================================================

DROP INDEX IF EXISTS public.profiles_sms_sync_token_idx;
DROP INDEX IF EXISTS public.idx_goals_user_id;

-- Re-create optimized indexes
CREATE INDEX IF NOT EXISTS idx_profiles_sms_sync_token ON public.profiles(sms_sync_token) WHERE sms_sync_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON public.goals(user_id);
