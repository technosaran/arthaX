-- Migration: 20261120000000_patch_security_vulnerabilities.sql
-- Enterprise Multi-Tenant Security Hardening:
-- 1. Drops legacy permissive policies containing 'OR user_id = default_user' on Binance, Crypto, Bonds, and Bullion tables.
-- 2. Restricts all table operations strictly to the authenticated tenant matching auth.uid()::text = user_id.
-- 3. Enforces Row-Level Security across all financial asset and integration tables.

BEGIN;

-- ============================================================================
-- 1. BINANCE INTEGRATIONS TABLE
-- ============================================================================
ALTER TABLE IF EXISTS public.binance_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own binance integration" ON public.binance_integrations;
CREATE POLICY "Users can view own binance integration" ON public.binance_integrations
  FOR SELECT TO authenticated
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can insert own binance integration" ON public.binance_integrations;
CREATE POLICY "Users can insert own binance integration" ON public.binance_integrations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can update own binance integration" ON public.binance_integrations;
CREATE POLICY "Users can update own binance integration" ON public.binance_integrations
  FOR UPDATE TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can delete own binance integration" ON public.binance_integrations;
CREATE POLICY "Users can delete own binance integration" ON public.binance_integrations
  FOR DELETE TO authenticated
  USING (auth.uid()::text = user_id);

-- ============================================================================
-- 2. CRYPTO HOLDINGS TABLE
-- ============================================================================
ALTER TABLE IF EXISTS public.crypto_holdings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own crypto holdings" ON public.crypto_holdings;
CREATE POLICY "Users can view own crypto holdings" ON public.crypto_holdings
  FOR SELECT TO authenticated
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can insert own crypto holdings" ON public.crypto_holdings;
CREATE POLICY "Users can insert own crypto holdings" ON public.crypto_holdings
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can update own crypto holdings" ON public.crypto_holdings;
CREATE POLICY "Users can update own crypto holdings" ON public.crypto_holdings
  FOR UPDATE TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can delete own crypto holdings" ON public.crypto_holdings;
CREATE POLICY "Users can delete own crypto holdings" ON public.crypto_holdings
  FOR DELETE TO authenticated
  USING (auth.uid()::text = user_id);

-- ============================================================================
-- 3. CRYPTO TRADES TABLE
-- ============================================================================
ALTER TABLE IF EXISTS public.crypto_trades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own crypto trades" ON public.crypto_trades;
CREATE POLICY "Users can view own crypto trades" ON public.crypto_trades
  FOR SELECT TO authenticated
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can insert own crypto trades" ON public.crypto_trades;
CREATE POLICY "Users can insert own crypto trades" ON public.crypto_trades
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can update own crypto trades" ON public.crypto_trades;
CREATE POLICY "Users can update own crypto trades" ON public.crypto_trades
  FOR UPDATE TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can delete own crypto trades" ON public.crypto_trades;
CREATE POLICY "Users can delete own crypto trades" ON public.crypto_trades
  FOR DELETE TO authenticated
  USING (auth.uid()::text = user_id);

-- ============================================================================
-- 4. HARDEN BONDS & BULLION POLICIES (ELIMINATE ANY REMAINING default_user)
-- ============================================================================
ALTER TABLE IF EXISTS public.bond_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bond_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bullion_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bullion_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own bond holdings" ON public.bond_holdings;
CREATE POLICY "Users can view own bond holdings" ON public.bond_holdings
  FOR SELECT TO authenticated
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can insert own bond holdings" ON public.bond_holdings;
CREATE POLICY "Users can insert own bond holdings" ON public.bond_holdings
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can update own bond holdings" ON public.bond_holdings;
CREATE POLICY "Users can update own bond holdings" ON public.bond_holdings
  FOR UPDATE TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can delete own bond holdings" ON public.bond_holdings;
CREATE POLICY "Users can delete own bond holdings" ON public.bond_holdings
  FOR DELETE TO authenticated
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can view own bond transactions" ON public.bond_transactions;
CREATE POLICY "Users can view own bond transactions" ON public.bond_transactions
  FOR SELECT TO authenticated
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can insert own bond transactions" ON public.bond_transactions;
CREATE POLICY "Users can insert own bond transactions" ON public.bond_transactions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can update own bond transactions" ON public.bond_transactions;
CREATE POLICY "Users can update own bond transactions" ON public.bond_transactions
  FOR UPDATE TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can delete own bond transactions" ON public.bond_transactions;
CREATE POLICY "Users can delete own bond transactions" ON public.bond_transactions
  FOR DELETE TO authenticated
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can view own bullion holdings" ON public.bullion_holdings;
CREATE POLICY "Users can view own bullion holdings" ON public.bullion_holdings
  FOR SELECT TO authenticated
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can insert own bullion holdings" ON public.bullion_holdings;
CREATE POLICY "Users can insert own bullion holdings" ON public.bullion_holdings
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can update own bullion holdings" ON public.bullion_holdings;
CREATE POLICY "Users can update own bullion holdings" ON public.bullion_holdings
  FOR UPDATE TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can delete own bullion holdings" ON public.bullion_holdings;
CREATE POLICY "Users can delete own bullion holdings" ON public.bullion_holdings
  FOR DELETE TO authenticated
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can view own bullion transactions" ON public.bullion_transactions;
CREATE POLICY "Users can view own bullion transactions" ON public.bullion_transactions
  FOR SELECT TO authenticated
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can insert own bullion transactions" ON public.bullion_transactions;
CREATE POLICY "Users can insert own bullion transactions" ON public.bullion_transactions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can update own bullion transactions" ON public.bullion_transactions;
CREATE POLICY "Users can update own bullion transactions" ON public.bullion_transactions
  FOR UPDATE TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can delete own bullion transactions" ON public.bullion_transactions;
CREATE POLICY "Users can delete own bullion transactions" ON public.bullion_transactions
  FOR DELETE TO authenticated
  USING (auth.uid()::text = user_id);

COMMIT;
