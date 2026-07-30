-- Add avatar_url column to family_members table if not exists
ALTER TABLE public.family_members ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Reload Schema Cache
NOTIFY pgrst, 'reload schema';
