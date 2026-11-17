-- Migration: 20261117000000_create_bullion_tracker.sql
-- Description: Physical Gold and Silver Bullion Portfolio Tracker for ArthaX
-- Supports real-time valuation, multi-purity (24K, 22K, 18K, 14K, 999, 925),
-- physical storage tracking (Home Safe, Bank Locker, Digital Vault),
-- hallmarks (HUID/BIS), making charges, and buy/sell transaction ledger.

-- 1. Create bullion_holdings table
CREATE TABLE IF NOT EXISTS public.bullion_holdings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL DEFAULT coalesce(auth.uid()::text, 'default_user'),
  metal text NOT NULL CHECK (metal IN ('GOLD', 'SILVER')),
  name text NOT NULL,
  item_type text NOT NULL DEFAULT 'COIN' CHECK (item_type IN ('COIN', 'BAR', 'JEWELRY', 'SOVEREIGN', 'BULLION', 'UTENSIL', 'OTHER')),
  purity text NOT NULL,
  purity_percentage numeric(5, 2) NOT NULL DEFAULT 99.90 CHECK (purity_percentage > 0 AND purity_percentage <= 100),
  weight_grams numeric(14, 4) NOT NULL CHECK (weight_grams > 0),
  quantity numeric(10, 2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  buy_price_per_gram numeric(15, 2) NOT NULL CHECK (buy_price_per_gram >= 0),
  making_charges numeric(15, 2) NOT NULL DEFAULT 0 CHECK (making_charges >= 0),
  tax_gst numeric(15, 2) NOT NULL DEFAULT 0 CHECK (tax_gst >= 0),
  total_buy_price numeric(15, 2) NOT NULL CHECK (total_buy_price >= 0),
  purchase_date date NOT NULL DEFAULT current_date,
  storage_location text NOT NULL DEFAULT 'Home Safe',
  cert_id text NULL,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Create bullion_transactions table
CREATE TABLE IF NOT EXISTS public.bullion_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL DEFAULT coalesce(auth.uid()::text, 'default_user'),
  holding_id uuid REFERENCES public.bullion_holdings(id) ON DELETE CASCADE,
  metal text NOT NULL CHECK (metal IN ('GOLD', 'SILVER')),
  type text NOT NULL CHECK (type IN ('BUY', 'SELL')),
  weight_grams numeric(14, 4) NOT NULL CHECK (weight_grams > 0),
  price_per_gram numeric(15, 2) NOT NULL CHECK (price_per_gram >= 0),
  making_charges numeric(15, 2) NOT NULL DEFAULT 0,
  tax_gst numeric(15, 2) NOT NULL DEFAULT 0,
  total_amount numeric(15, 2) NOT NULL CHECK (total_amount >= 0),
  transaction_date date NOT NULL DEFAULT current_date,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Indices
CREATE INDEX IF NOT EXISTS idx_bullion_holdings_user ON public.bullion_holdings(user_id);
CREATE INDEX IF NOT EXISTS idx_bullion_holdings_metal ON public.bullion_holdings(metal);
CREATE INDEX IF NOT EXISTS idx_bullion_holdings_storage ON public.bullion_holdings(storage_location);
CREATE INDEX IF NOT EXISTS idx_bullion_transactions_user ON public.bullion_transactions(user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_bullion_transactions_holding ON public.bullion_transactions(holding_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.bullion_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bullion_transactions ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for Authenticated Users
DROP POLICY IF EXISTS "Users can view own bullion holdings" ON public.bullion_holdings;
CREATE POLICY "Users can view own bullion holdings" ON public.bullion_holdings
  FOR SELECT TO authenticated USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can insert own bullion holdings" ON public.bullion_holdings;
CREATE POLICY "Users can insert own bullion holdings" ON public.bullion_holdings
  FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can update own bullion holdings" ON public.bullion_holdings;
CREATE POLICY "Users can update own bullion holdings" ON public.bullion_holdings
  FOR UPDATE TO authenticated USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can delete own bullion holdings" ON public.bullion_holdings;
CREATE POLICY "Users can delete own bullion holdings" ON public.bullion_holdings
  FOR DELETE TO authenticated USING (auth.uid()::text = user_id);

-- Transactions RLS
DROP POLICY IF EXISTS "Users can view own bullion transactions" ON public.bullion_transactions;
CREATE POLICY "Users can view own bullion transactions" ON public.bullion_transactions
  FOR SELECT TO authenticated USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can insert own bullion transactions" ON public.bullion_transactions;
CREATE POLICY "Users can insert own bullion transactions" ON public.bullion_transactions
  FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can update own bullion transactions" ON public.bullion_transactions;
CREATE POLICY "Users can update own bullion transactions" ON public.bullion_transactions
  FOR UPDATE TO authenticated USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can delete own bullion transactions" ON public.bullion_transactions;
CREATE POLICY "Users can delete own bullion transactions" ON public.bullion_transactions
  FOR DELETE TO authenticated USING (auth.uid()::text = user_id);

-- 6. Development Anon Policies (matching existing schema conventions)
DROP POLICY IF EXISTS "Allow anon dev select bullion holdings" ON public.bullion_holdings;
CREATE POLICY "Allow anon dev select bullion holdings" ON public.bullion_holdings FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Allow anon dev insert bullion holdings" ON public.bullion_holdings;
CREATE POLICY "Allow anon dev insert bullion holdings" ON public.bullion_holdings FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon dev update bullion holdings" ON public.bullion_holdings;
CREATE POLICY "Allow anon dev update bullion holdings" ON public.bullion_holdings FOR UPDATE TO anon USING (true);

DROP POLICY IF EXISTS "Allow anon dev delete bullion holdings" ON public.bullion_holdings;
CREATE POLICY "Allow anon dev delete bullion holdings" ON public.bullion_holdings FOR DELETE TO anon USING (true);

DROP POLICY IF EXISTS "Allow anon dev select bullion transactions" ON public.bullion_transactions;
CREATE POLICY "Allow anon dev select bullion transactions" ON public.bullion_transactions FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Allow anon dev insert bullion transactions" ON public.bullion_transactions;
CREATE POLICY "Allow anon dev insert bullion transactions" ON public.bullion_transactions FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon dev update bullion transactions" ON public.bullion_transactions;
CREATE POLICY "Allow anon dev update bullion transactions" ON public.bullion_transactions FOR UPDATE TO anon USING (true);

DROP POLICY IF EXISTS "Allow anon dev delete bullion transactions" ON public.bullion_transactions;
CREATE POLICY "Allow anon dev delete bullion transactions" ON public.bullion_transactions FOR DELETE TO anon USING (true);

-- 7. Realtime Publication
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bullion_holdings;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bullion_transactions;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;
