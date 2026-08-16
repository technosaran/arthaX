-- Migration: Add Insurance Tracker

CREATE TABLE IF NOT EXISTS public.insurance_policies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  policy_name TEXT NOT NULL,
  policy_number TEXT,
  type TEXT NOT NULL, -- Life, Health, Auto, Property, Other
  coverage_amount NUMERIC NOT NULL DEFAULT 0,
  premium_amount NUMERIC NOT NULL DEFAULT 0,
  premium_frequency TEXT NOT NULL DEFAULT 'annual', -- monthly, quarterly, annual
  next_due_date DATE,
  documents_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS
ALTER TABLE public.insurance_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own insurance policies" 
  ON public.insurance_policies FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own insurance policies" 
  ON public.insurance_policies FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own insurance policies" 
  ON public.insurance_policies FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own insurance policies" 
  ON public.insurance_policies FOR DELETE 
  USING (auth.uid() = user_id);

-- RPC for fetching
CREATE OR REPLACE FUNCTION get_insurance_v1()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  result jsonb;
BEGIN
  -- Get the current authenticated user's ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT jsonb_build_object(
    'insurancePolicies', COALESCE(
      (SELECT jsonb_agg(row_to_json(ip)) 
       FROM (
         SELECT * FROM insurance_policies 
         WHERE user_id = v_user_id 
         ORDER BY next_due_date ASC NULLS LAST
       ) ip
      ), 
      '[]'::jsonb
    )
  ) INTO result;

  RETURN result;
END;
$$;
