-- Add is_protected column to accounts if not exists
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS is_protected BOOLEAN NOT NULL DEFAULT FALSE;

-- Mark Cash Reserve accounts as protected
UPDATE public.accounts
SET is_protected = TRUE
WHERE type = 'cash' OR name ILIKE '%cash%';

-- Create Zerodha Funds account for all existing users who do not have one
INSERT INTO public.accounts (user_id, name, type, balance, currency, bank_name, color, is_protected)
SELECT DISTINCT user_id, 'Zerodha Funds', 'investment', 0, 'INR', 'Zerodha', '#f6540b', TRUE
FROM public.accounts a
WHERE NOT EXISTS (
  SELECT 1 FROM public.accounts z 
  WHERE z.user_id = a.user_id AND (z.name ILIKE '%zerodha%' OR z.bank_name ILIKE '%zerodha%')
);
