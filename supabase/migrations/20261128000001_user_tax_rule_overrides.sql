-- ============================================================================
-- Migration: 20261128000001_user_tax_rule_overrides.sql
-- Description: Store per-user, per-assessment-year custom tax rule overrides
--              so future Budget / Tax Act changes can be updated without code changes.
-- ============================================================================

BEGIN;

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS tax_rule_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMIT;
