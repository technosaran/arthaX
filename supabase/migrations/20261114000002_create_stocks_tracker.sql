-- Migration: 20261114000002_create_stocks_tracker.sql
-- Description: Indian Stock Market & Zerodha Kite Tracker for ArthaX
-- Supports manual entry, portfolio tracking, real-time Indian stock quotes (NSE/BSE), and transactions

-- 1. Create stock_holdings table
CREATE TABLE IF NOT EXISTS public.stock_holdings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL DEFAULT coalesce(auth.uid()::text, 'default_user'),
  symbol text NOT NULL,
  exchange text NOT NULL DEFAULT 'NSE' CHECK (exchange IN ('NSE', 'BSE')),
  company_name text NOT NULL,
  sector text DEFAULT 'Other',
  quantity numeric(14, 4) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  avg_buy_price numeric(15, 2) NOT NULL DEFAULT 0 CHECK (avg_buy_price >= 0),
  currency varchar(3) NOT NULL DEFAULT 'INR',
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  notes text,
  target_price numeric(15, 2) NULL,
  stop_loss numeric(15, 2) NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_user_symbol_exchange UNIQUE (user_id, symbol, exchange)
);

-- 2. Create stock_transactions table
CREATE TABLE IF NOT EXISTS public.stock_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL DEFAULT coalesce(auth.uid()::text, 'default_user'),
  holding_id uuid REFERENCES public.stock_holdings(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  exchange text NOT NULL DEFAULT 'NSE' CHECK (exchange IN ('NSE', 'BSE')),
  type text NOT NULL CHECK (type IN ('BUY', 'SELL')),
  quantity numeric(14, 4) NOT NULL CHECK (quantity > 0),
  price numeric(15, 2) NOT NULL CHECK (price >= 0),
  brokerage_charges numeric(10, 2) DEFAULT 0,
  transaction_date date NOT NULL DEFAULT current_date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Indices
CREATE INDEX IF NOT EXISTS idx_stock_holdings_user ON public.stock_holdings(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_holdings_symbol ON public.stock_holdings(symbol);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_user ON public.stock_transactions(user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_holding ON public.stock_transactions(holding_id);

-- 4. Enable RLS
ALTER TABLE public.stock_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transactions ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
DROP POLICY IF EXISTS "Users can view own stock holdings" ON public.stock_holdings;
CREATE POLICY "Users can view own stock holdings" ON public.stock_holdings FOR SELECT TO authenticated USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can insert own stock holdings" ON public.stock_holdings;
CREATE POLICY "Users can insert own stock holdings" ON public.stock_holdings FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can update own stock holdings" ON public.stock_holdings;
CREATE POLICY "Users can update own stock holdings" ON public.stock_holdings FOR UPDATE TO authenticated USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can delete own stock holdings" ON public.stock_holdings;
CREATE POLICY "Users can delete own stock holdings" ON public.stock_holdings FOR DELETE TO authenticated USING (auth.uid()::text = user_id);

-- Transactions RLS
DROP POLICY IF EXISTS "Users can view own stock transactions" ON public.stock_transactions;
CREATE POLICY "Users can view own stock transactions" ON public.stock_transactions FOR SELECT TO authenticated USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can insert own stock transactions" ON public.stock_transactions;
CREATE POLICY "Users can insert own stock transactions" ON public.stock_transactions FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can update own stock transactions" ON public.stock_transactions;
CREATE POLICY "Users can update own stock transactions" ON public.stock_transactions FOR UPDATE TO authenticated USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can delete own stock transactions" ON public.stock_transactions;
CREATE POLICY "Users can delete own stock transactions" ON public.stock_transactions FOR DELETE TO authenticated USING (auth.uid()::text = user_id);

-- Also allow anon/service fallback in dev if needed
DROP POLICY IF EXISTS "Allow anon dev select stock holdings" ON public.stock_holdings;
CREATE POLICY "Allow anon dev select stock holdings" ON public.stock_holdings FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "Allow anon dev insert stock holdings" ON public.stock_holdings;
CREATE POLICY "Allow anon dev insert stock holdings" ON public.stock_holdings FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "Allow anon dev update stock holdings" ON public.stock_holdings;
CREATE POLICY "Allow anon dev update stock holdings" ON public.stock_holdings FOR UPDATE TO anon USING (true);
DROP POLICY IF EXISTS "Allow anon dev delete stock holdings" ON public.stock_holdings;
CREATE POLICY "Allow anon dev delete stock holdings" ON public.stock_holdings FOR DELETE TO anon USING (true);

DROP POLICY IF EXISTS "Allow anon dev select stock transactions" ON public.stock_transactions;
CREATE POLICY "Allow anon dev select stock transactions" ON public.stock_transactions FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "Allow anon dev insert stock transactions" ON public.stock_transactions;
CREATE POLICY "Allow anon dev insert stock transactions" ON public.stock_transactions FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "Allow anon dev update stock transactions" ON public.stock_transactions;
CREATE POLICY "Allow anon dev update stock transactions" ON public.stock_transactions FOR UPDATE TO anon USING (true);
DROP POLICY IF EXISTS "Allow anon dev delete stock transactions" ON public.stock_transactions;
CREATE POLICY "Allow anon dev delete stock transactions" ON public.stock_transactions FOR DELETE TO anon USING (true);

-- Realtime publication for stock_holdings
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_holdings;
  END IF;
END $$;
