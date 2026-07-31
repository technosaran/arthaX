-- Migration: Cleanup Unused Indexes
-- Date: 2026-08-01
-- Purpose: Remove redundant or unused indexes flagged by Supabase performance linter.

DROP INDEX IF EXISTS public.profiles_sms_sync_token_idx;
DROP INDEX IF EXISTS public.idx_goals_user_id;

-- Re-create lightweight conditional indexes if needed for lookup queries
CREATE INDEX IF NOT EXISTS idx_profiles_sms_sync_token ON public.profiles(sms_sync_token) WHERE sms_sync_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON public.goals(user_id);
