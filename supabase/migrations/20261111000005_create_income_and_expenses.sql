-- Migration: 20261111000005_create_income_and_expenses.sql
-- Create tables for Income and Expenses with Realtime synchronization

-- 1. Create Income Table
CREATE TABLE IF NOT EXISTS public.income (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL DEFAULT coalesce(auth.uid()::text, 'default_user'),
  title TEXT NOT NULL,
  amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'Salary',
  frequency TEXT NOT NULL DEFAULT 'Monthly',
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  received_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Enable RLS for Income
ALTER TABLE public.income ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public select on income"
  ON public.income FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert on income"
  ON public.income FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update on income"
  ON public.income FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete on income"
  ON public.income FOR DELETE
  USING (true);

-- 2. Create Expenses Table
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL DEFAULT coalesce(auth.uid()::text, 'default_user'),
  title TEXT NOT NULL,
  amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'Food & Dining',
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Enable RLS for Expenses
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public select on expenses"
  ON public.expenses FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert on expenses"
  ON public.expenses FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update on expenses"
  ON public.expenses FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete on expenses"
  ON public.expenses FOR DELETE
  USING (true);

-- 3. Add to Realtime Publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'income'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.income;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'expenses'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses;
  END IF;
END $$;
