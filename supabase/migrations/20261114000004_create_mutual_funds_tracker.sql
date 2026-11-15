-- Migration: 20261114000003_create_mutual_funds_tracker.sql
-- Description: Indian Mutual Funds & Zerodha Coin Portfolio Tracker for ArthaX
-- Supports AMFI scheme tracking, daily NAVs, SIP management, Zerodha Coin statement imports, and transactions

-- 1. Create mutual_fund_holdings table
CREATE TABLE IF NOT EXISTS public.mutual_fund_holdings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL DEFAULT coalesce(auth.uid()::text, 'default_user'),
  scheme_code text NOT NULL,
  scheme_name text NOT NULL,
  fund_house text NOT NULL DEFAULT 'Other',
  category text NOT NULL DEFAULT 'Equity',
  sub_category text NULL,
  plan_type text NOT NULL DEFAULT 'Direct' CHECK (plan_type IN ('Direct', 'Regular')),
  dividend_option text NOT NULL DEFAULT 'Growth' CHECK (dividend_option IN ('Growth', 'IDCW', 'Bonus')),
  folio_number text NOT NULL DEFAULT 'COIN_DEMAT',
  units numeric(16, 4) NOT NULL DEFAULT 0 CHECK (units >= 0),
  avg_nav numeric(15, 4) NOT NULL DEFAULT 0 CHECK (avg_nav >= 0),
  invested_amount numeric(15, 2) NOT NULL DEFAULT 0 CHECK (invested_amount >= 0),
  current_nav numeric(15, 4) NOT NULL DEFAULT 0 CHECK (current_nav >= 0),
  previous_nav numeric(15, 4) DEFAULT 0,
  nav_date date NULL,
  isin text NULL,
  is_sip_active boolean NOT NULL DEFAULT false,
  sip_amount numeric(15, 2) DEFAULT 0 CHECK (sip_amount >= 0),
  sip_frequency text DEFAULT 'MONTHLY' CHECK (sip_frequency IN ('WEEKLY', 'MONTHLY', 'QUARTERLY')),
  sip_day integer DEFAULT 1 CHECK (sip_day >= 1 AND sip_day <= 31),
  sip_step_up_percent numeric(5, 2) DEFAULT 0 CHECK (sip_step_up_percent >= 0),
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_user_scheme_folio UNIQUE (user_id, scheme_code, folio_number)
);

-- 2. Create mutual_fund_transactions table
CREATE TABLE IF NOT EXISTS public.mutual_fund_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL DEFAULT coalesce(auth.uid()::text, 'default_user'),
  holding_id uuid REFERENCES public.mutual_fund_holdings(id) ON DELETE CASCADE,
  scheme_code text NOT NULL,
  scheme_name text NOT NULL,
  type text NOT NULL CHECK (type IN ('SIP', 'BUY', 'SELL', 'SWITCH_IN', 'SWITCH_OUT')),
  units numeric(16, 4) NOT NULL CHECK (units > 0),
  nav numeric(15, 4) NOT NULL CHECK (nav >= 0),
  amount numeric(15, 2) NOT NULL CHECK (amount >= 0),
  stamp_duty numeric(10, 2) DEFAULT 0,
  transaction_date date NOT NULL DEFAULT current_date,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Indices
CREATE INDEX IF NOT EXISTS idx_mf_holdings_user ON public.mutual_fund_holdings(user_id);
CREATE INDEX IF NOT EXISTS idx_mf_holdings_scheme ON public.mutual_fund_holdings(scheme_code);
CREATE INDEX IF NOT EXISTS idx_mf_holdings_category ON public.mutual_fund_holdings(category);
CREATE INDEX IF NOT EXISTS idx_mf_transactions_user ON public.mutual_fund_transactions(user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_mf_transactions_holding ON public.mutual_fund_transactions(holding_id);

-- 4. Enable RLS
ALTER TABLE public.mutual_fund_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mutual_fund_transactions ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for Authenticated Users
DROP POLICY IF EXISTS "Users can view own mutual fund holdings" ON public.mutual_fund_holdings;
CREATE POLICY "Users can view own mutual fund holdings" ON public.mutual_fund_holdings FOR SELECT TO authenticated USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can insert own mutual fund holdings" ON public.mutual_fund_holdings;
CREATE POLICY "Users can insert own mutual fund holdings" ON public.mutual_fund_holdings FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can update own mutual fund holdings" ON public.mutual_fund_holdings;
CREATE POLICY "Users can update own mutual fund holdings" ON public.mutual_fund_holdings FOR UPDATE TO authenticated USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can delete own mutual fund holdings" ON public.mutual_fund_holdings;
CREATE POLICY "Users can delete own mutual fund holdings" ON public.mutual_fund_holdings FOR DELETE TO authenticated USING (auth.uid()::text = user_id);

-- Transactions RLS Policies for Authenticated Users
DROP POLICY IF EXISTS "Users can view own mutual fund transactions" ON public.mutual_fund_transactions;
CREATE POLICY "Users can view own mutual fund transactions" ON public.mutual_fund_transactions FOR SELECT TO authenticated USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can insert own mutual fund transactions" ON public.mutual_fund_transactions;
CREATE POLICY "Users can insert own mutual fund transactions" ON public.mutual_fund_transactions FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can update own mutual fund transactions" ON public.mutual_fund_transactions;
CREATE POLICY "Users can update own mutual fund transactions" ON public.mutual_fund_transactions FOR UPDATE TO authenticated USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can delete own mutual fund transactions" ON public.mutual_fund_transactions;
CREATE POLICY "Users can delete own mutual fund transactions" ON public.mutual_fund_transactions FOR DELETE TO authenticated USING (auth.uid()::text = user_id);

-- 6. Fallback dev / anon policies
DROP POLICY IF EXISTS "Allow anon dev select mf holdings" ON public.mutual_fund_holdings;
CREATE POLICY "Allow anon dev select mf holdings" ON public.mutual_fund_holdings FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "Allow anon dev insert mf holdings" ON public.mutual_fund_holdings;
CREATE POLICY "Allow anon dev insert mf holdings" ON public.mutual_fund_holdings FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "Allow anon dev update mf holdings" ON public.mutual_fund_holdings;
CREATE POLICY "Allow anon dev update mf holdings" ON public.mutual_fund_holdings FOR UPDATE TO anon USING (true);
DROP POLICY IF EXISTS "Allow anon dev delete mf holdings" ON public.mutual_fund_holdings;
CREATE POLICY "Allow anon dev delete mf holdings" ON public.mutual_fund_holdings FOR DELETE TO anon USING (true);

DROP POLICY IF EXISTS "Allow anon dev select mf transactions" ON public.mutual_fund_transactions;
CREATE POLICY "Allow anon dev select mf transactions" ON public.mutual_fund_transactions FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "Allow anon dev insert mf transactions" ON public.mutual_fund_transactions;
CREATE POLICY "Allow anon dev insert mf transactions" ON public.mutual_fund_transactions FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "Allow anon dev update mf transactions" ON public.mutual_fund_transactions;
CREATE POLICY "Allow anon dev update mf transactions" ON public.mutual_fund_transactions FOR UPDATE TO anon USING (true);
DROP POLICY IF EXISTS "Allow anon dev delete mf transactions" ON public.mutual_fund_transactions;
CREATE POLICY "Allow anon dev delete mf transactions" ON public.mutual_fund_transactions FOR DELETE TO anon USING (true);

-- 7. Realtime publication
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mutual_fund_holdings;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mutual_fund_transactions;
  END IF;
END $$;
