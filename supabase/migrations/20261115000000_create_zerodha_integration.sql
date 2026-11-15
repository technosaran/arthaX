-- Migration: 20261115000000_create_zerodha_integration.sql
-- Description: Zerodha Kite Connect API Integration credentials and session state for ArthaX
-- Supports Personal Tier (₹0) and Connect Tier for automated sync of Stocks, F&O, and Mutual Funds

CREATE TABLE IF NOT EXISTS public.zerodha_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL DEFAULT coalesce(auth.uid()::text, 'default_user'),
  api_key text NOT NULL,
  api_secret text NOT NULL,
  request_token text NULL,
  access_token text NULL,
  public_token text NULL,
  token_generated_at timestamptz NULL,
  user_profile jsonb NULL, -- client_id, user_name, user_type, email, broker, exchanges
  last_sync_at timestamptz NULL,
  last_sync_status text NULL DEFAULT 'NEVER_SYNCED',
  last_sync_error text NULL,
  last_sync_summary jsonb NULL, -- { stocks_synced: 0, fno_synced: 0, mf_synced: 0 }
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_zerodha_integrations_user UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_zerodha_integrations_user ON public.zerodha_integrations(user_id);
ALTER TABLE public.zerodha_integrations ENABLE ROW LEVEL SECURITY;

-- Policies for Authenticated users
DROP POLICY IF EXISTS "Users can view own zerodha integration" ON public.zerodha_integrations;
CREATE POLICY "Users can view own zerodha integration" ON public.zerodha_integrations
  FOR SELECT TO authenticated
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can insert own zerodha integration" ON public.zerodha_integrations;
CREATE POLICY "Users can insert own zerodha integration" ON public.zerodha_integrations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can update own zerodha integration" ON public.zerodha_integrations;
CREATE POLICY "Users can update own zerodha integration" ON public.zerodha_integrations
  FOR UPDATE TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can delete own zerodha integration" ON public.zerodha_integrations;
CREATE POLICY "Users can delete own zerodha integration" ON public.zerodha_integrations
  FOR DELETE TO authenticated
  USING (auth.uid()::text = user_id);

-- Policies for Anon / Local Dev
DROP POLICY IF EXISTS "Allow anon dev select zerodha integration" ON public.zerodha_integrations;
CREATE POLICY "Allow anon dev select zerodha integration" ON public.zerodha_integrations
  FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS "Allow anon dev insert zerodha integration" ON public.zerodha_integrations;
CREATE POLICY "Allow anon dev insert zerodha integration" ON public.zerodha_integrations
  FOR INSERT TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon dev update zerodha integration" ON public.zerodha_integrations;
CREATE POLICY "Allow anon dev update zerodha integration" ON public.zerodha_integrations
  FOR UPDATE TO anon
  USING (true);

DROP POLICY IF EXISTS "Allow anon dev delete zerodha integration" ON public.zerodha_integrations;
CREATE POLICY "Allow anon dev delete zerodha integration" ON public.zerodha_integrations
  FOR DELETE TO anon
  USING (true);
