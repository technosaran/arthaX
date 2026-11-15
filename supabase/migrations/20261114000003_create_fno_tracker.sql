-- Migration: 20261114000003_create_fno_tracker.sql
-- Description: Futures & Options (F&O) Derivatives Tracker powered by Zerodha Kite for ArthaX
-- Supports Options (CE/PE), Futures (FUT), Multi-Leg Strategies, Greeks, Realized/Unrealized MTM, and Zerodha Brokerage calculations

-- 1. Create fno_positions table
CREATE TABLE IF NOT EXISTS public.fno_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL DEFAULT coalesce(auth.uid()::text, 'default_user'),
  symbol text NOT NULL, -- e.g. 'NIFTY', 'BANKNIFTY', 'FINNIFTY', 'SENSEX', 'RELIANCE'
  instrument_type text NOT NULL CHECK (instrument_type IN ('CE', 'PE', 'FUT')),
  strike_price numeric(15, 2) NULL, -- NULL for Futures, exact strike for Options
  expiry_date date NOT NULL,
  side text NOT NULL CHECK (side IN ('BUY', 'SELL')),
  product text NOT NULL DEFAULT 'NRML' CHECK (product IN ('NRML', 'MIS', 'CNC')),
  lot_size integer NOT NULL DEFAULT 25 CHECK (lot_size > 0),
  lots numeric(10, 2) NOT NULL DEFAULT 1 CHECK (lots > 0),
  quantity numeric(14, 4) NOT NULL CHECK (quantity > 0),
  avg_price numeric(15, 2) NOT NULL DEFAULT 0 CHECK (avg_price >= 0),
  ltp numeric(15, 2) DEFAULT NULL,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
  exit_price numeric(15, 2) NULL,
  exit_date timestamptz NULL,
  target_price numeric(15, 2) NULL,
  stop_loss numeric(15, 2) NULL,
  strategy_name text DEFAULT 'Naked Position',
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Create fno_trades table
CREATE TABLE IF NOT EXISTS public.fno_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL DEFAULT coalesce(auth.uid()::text, 'default_user'),
  position_id uuid REFERENCES public.fno_positions(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  instrument_type text NOT NULL CHECK (instrument_type IN ('CE', 'PE', 'FUT')),
  strike_price numeric(15, 2) NULL,
  expiry_date date NOT NULL,
  side text NOT NULL CHECK (side IN ('BUY', 'SELL')),
  action text NOT NULL DEFAULT 'ENTRY' CHECK (action IN ('ENTRY', 'EXIT', 'PARTIAL_EXIT', 'ROLLOVER')),
  quantity numeric(14, 4) NOT NULL CHECK (quantity > 0),
  price numeric(15, 2) NOT NULL CHECK (price >= 0),
  brokerage numeric(10, 2) DEFAULT 20.00,
  exchange_charges numeric(10, 2) DEFAULT 0,
  gst numeric(10, 2) DEFAULT 0,
  stt numeric(10, 2) DEFAULT 0,
  pnl numeric(15, 2) DEFAULT 0,
  trade_date timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Indices for performant querying
CREATE INDEX IF NOT EXISTS idx_fno_positions_user_status ON public.fno_positions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_fno_positions_symbol ON public.fno_positions(symbol);
CREATE INDEX IF NOT EXISTS idx_fno_positions_expiry ON public.fno_positions(expiry_date);
CREATE INDEX IF NOT EXISTS idx_fno_trades_user_date ON public.fno_trades(user_id, trade_date DESC);
CREATE INDEX IF NOT EXISTS idx_fno_trades_position ON public.fno_trades(position_id);

-- 4. Enable RLS
ALTER TABLE public.fno_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fno_trades ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for authenticated users
DROP POLICY IF EXISTS "Users can view own fno positions" ON public.fno_positions;
CREATE POLICY "Users can view own fno positions" ON public.fno_positions FOR SELECT TO authenticated USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can insert own fno positions" ON public.fno_positions;
CREATE POLICY "Users can insert own fno positions" ON public.fno_positions FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can update own fno positions" ON public.fno_positions;
CREATE POLICY "Users can update own fno positions" ON public.fno_positions FOR UPDATE TO authenticated USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can delete own fno positions" ON public.fno_positions;
CREATE POLICY "Users can delete own fno positions" ON public.fno_positions FOR DELETE TO authenticated USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can view own fno trades" ON public.fno_trades;
CREATE POLICY "Users can view own fno trades" ON public.fno_trades FOR SELECT TO authenticated USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can insert own fno trades" ON public.fno_trades;
CREATE POLICY "Users can insert own fno trades" ON public.fno_trades FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can update own fno trades" ON public.fno_trades;
CREATE POLICY "Users can update own fno trades" ON public.fno_trades FOR UPDATE TO authenticated USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can delete own fno trades" ON public.fno_trades;
CREATE POLICY "Users can delete own fno trades" ON public.fno_trades FOR DELETE TO authenticated USING (auth.uid()::text = user_id);

-- 6. Fallback policies for development / anon
DROP POLICY IF EXISTS "Allow anon dev select fno positions" ON public.fno_positions;
CREATE POLICY "Allow anon dev select fno positions" ON public.fno_positions FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "Allow anon dev insert fno positions" ON public.fno_positions;
CREATE POLICY "Allow anon dev insert fno positions" ON public.fno_positions FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "Allow anon dev update fno positions" ON public.fno_positions;
CREATE POLICY "Allow anon dev update fno positions" ON public.fno_positions FOR UPDATE TO anon USING (true);
DROP POLICY IF EXISTS "Allow anon dev delete fno positions" ON public.fno_positions;
CREATE POLICY "Allow anon dev delete fno positions" ON public.fno_positions FOR DELETE TO anon USING (true);

DROP POLICY IF EXISTS "Allow anon dev select fno trades" ON public.fno_trades;
CREATE POLICY "Allow anon dev select fno trades" ON public.fno_trades FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "Allow anon dev insert fno trades" ON public.fno_trades;
CREATE POLICY "Allow anon dev insert fno trades" ON public.fno_trades FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "Allow anon dev update fno trades" ON public.fno_trades;
CREATE POLICY "Allow anon dev update fno trades" ON public.fno_trades FOR UPDATE TO anon USING (true);
DROP POLICY IF EXISTS "Allow anon dev delete fno trades" ON public.fno_trades;
CREATE POLICY "Allow anon dev delete fno trades" ON public.fno_trades FOR DELETE TO anon USING (true);

-- 7. Realtime publication
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.fno_positions;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.fno_trades;
  END IF;
END $$;
