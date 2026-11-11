-- Migration: 20261111000007_enable_replica_identity_full.sql
-- Enables REPLICA IDENTITY FULL across all tables to guarantee complete row data
-- (including old column values on UPDATE and DELETE) for real-time cross-device sync.

ALTER TABLE public.accounts REPLICA IDENTITY FULL;
ALTER TABLE public.user_settings REPLICA IDENTITY FULL;
ALTER TABLE public.income REPLICA IDENTITY FULL;
ALTER TABLE public.expenses REPLICA IDENTITY FULL;
ALTER TABLE public.budgets REPLICA IDENTITY FULL;

-- Ensure all tables are explicitly in the supabase_realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'accounts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.accounts;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'user_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_settings;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'income'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.income;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'expenses'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'budgets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.budgets;
  END IF;
END $$;
