-- Migration: 20261111000006_create_budgets.sql
-- Create table for Budgets with Realtime synchronization

CREATE TABLE IF NOT EXISTS public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL DEFAULT 'default_user',
  category TEXT NOT NULL,
  amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  period TEXT NOT NULL DEFAULT 'monthly',
  month_year TEXT NOT NULL DEFAULT to_char(CURRENT_DATE, 'YYYY-MM'),
  alert_threshold INTEGER NOT NULL DEFAULT 80,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Enable RLS
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'budgets' AND policyname = 'Allow public select on budgets'
  ) THEN
    CREATE POLICY "Allow public select on budgets" ON public.budgets FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'budgets' AND policyname = 'Allow public insert on budgets'
  ) THEN
    CREATE POLICY "Allow public insert on budgets" ON public.budgets FOR INSERT WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'budgets' AND policyname = 'Allow public update on budgets'
  ) THEN
    CREATE POLICY "Allow public update on budgets" ON public.budgets FOR UPDATE USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'budgets' AND policyname = 'Allow public delete on budgets'
  ) THEN
    CREATE POLICY "Allow public delete on budgets" ON public.budgets FOR DELETE USING (true);
  END IF;
END $$;

-- Realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'budgets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.budgets;
  END IF;
END $$;
