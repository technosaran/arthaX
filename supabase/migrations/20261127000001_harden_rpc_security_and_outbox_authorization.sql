-- ============================================================================
-- Migration: 20261127000001_harden_rpc_security_and_outbox_authorization.sql
-- Description: Enterprise Database Security Hardening: Revoke Unauthorized Function
--              Execution Privileges, Enforce Service-Role Caller Verification on Outbox Workers,
--              and Authorize OAuth Nonce Consumption.
-- Authors: ArthaX Financial Architecture & Security Audit
-- Date: 2026-11-22
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. HARDEN SECURITY DEFINER: OAUTH NONCE CONSUMPTION
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_consume_oauth_nonce(
  p_user_id text,
  p_nonce text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id text := auth.uid()::text;
  v_caller_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
  v_rec record;
  v_now timestamptz := timezone('utc'::text, now());
BEGIN
  -- Caller authorization: strictly service_role OR the matching authenticated user
  IF v_caller_role != 'service_role' AND (v_caller_id IS NULL OR v_caller_id != p_user_id) THEN
    RAISE EXCEPTION 'fn_consume_oauth_nonce: Unauthorized caller % attempting to consume nonce for %', v_caller_id, p_user_id;
  END IF;

  SELECT * INTO v_rec
  FROM public.oauth_state_nonces
  WHERE nonce = p_nonce AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_rec.consumed OR v_rec.expires_at < v_now THEN
    RETURN false;
  END IF;

  UPDATE public.oauth_state_nonces
  SET consumed = true,
      consumed_at = v_now
  WHERE id = v_rec.id;

  RETURN true;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. HARDEN SECURITY DEFINER: OUTBOX WORKER DAEMON RPCs
-- ----------------------------------------------------------------------------
-- fn_claim_outbox_jobs: Restrict strictly to service_role workers
CREATE OR REPLACE FUNCTION public.fn_claim_outbox_jobs(
  p_worker_id text,
  p_batch_size integer DEFAULT 5,
  p_lease_seconds integer DEFAULT 120,
  p_max_per_user integer DEFAULT 2
)
RETURNS TABLE (
  job_id uuid,
  target_user_id text,
  target_job_type text,
  job_payload jsonb,
  job_priority integer,
  current_attempts integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
  v_now timestamptz := timezone('utc'::text, now());
  v_lease_until timestamptz := v_now + (p_lease_seconds || ' seconds')::interval;
BEGIN
  IF v_caller_role != 'service_role' THEN
    RAISE EXCEPTION 'fn_claim_outbox_jobs: Access denied. Only service_role worker processes may claim outbox jobs.';
  END IF;

  RETURN QUERY
  WITH candidate_jobs AS (
    SELECT j.id
    FROM public.job_outbox j
    WHERE j.status = 'QUEUED'
      AND j.scheduled_at <= v_now
      AND (
        SELECT count(*)
        FROM public.job_outbox active_user_jobs
        WHERE active_user_jobs.user_id = j.user_id
          AND active_user_jobs.status = 'PROCESSING'
          AND active_user_jobs.visibility_timeout > v_now
      ) < p_max_per_user
    ORDER BY j.priority ASC, j.scheduled_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  ),
  claimed AS (
    UPDATE public.job_outbox u
    SET status = 'PROCESSING',
        locked_by = p_worker_id,
        visibility_timeout = v_lease_until,
        attempts = u.attempts + 1,
        updated_at = v_now
    FROM candidate_jobs c
    WHERE u.id = c.id
    RETURNING u.id, u.user_id, u.job_type, u.payload, u.priority, u.attempts
  )
  SELECT c.id, c.user_id, c.job_type, c.payload, c.priority, c.attempts
  FROM claimed c;
END;
$$;

-- fn_complete_outbox_job: Restrict strictly to service_role workers
CREATE OR REPLACE FUNCTION public.fn_complete_outbox_job(
  p_job_id uuid,
  p_result jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
BEGIN
  IF v_caller_role != 'service_role' THEN
    RAISE EXCEPTION 'fn_complete_outbox_job: Access denied. Only service_role worker processes may complete outbox jobs.';
  END IF;

  UPDATE public.job_outbox
  SET status = 'COMPLETED',
      result = p_result,
      locked_by = NULL,
      visibility_timeout = NULL,
      updated_at = timezone('utc'::text, now())
  WHERE id = p_job_id;
END;
$$;

-- fn_fail_outbox_job: Restrict strictly to service_role workers
CREATE OR REPLACE FUNCTION public.fn_fail_outbox_job(
  p_job_id uuid,
  p_error text,
  p_retry_delay_seconds integer DEFAULT 30
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
  v_job record;
  v_now timestamptz := timezone('utc'::text, now());
BEGIN
  IF v_caller_role != 'service_role' THEN
    RAISE EXCEPTION 'fn_fail_outbox_job: Access denied. Only service_role worker processes may fail outbox jobs.';
  END IF;

  SELECT * INTO v_job FROM public.job_outbox WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  IF v_job.attempts >= v_job.max_attempts THEN
    UPDATE public.job_outbox
    SET status = 'DEAD_LETTER',
        last_error = p_error,
        locked_by = NULL,
        visibility_timeout = NULL,
        updated_at = v_now
    WHERE id = p_job_id;
  ELSE
    UPDATE public.job_outbox
    SET status = 'QUEUED',
        scheduled_at = v_now + ((p_retry_delay_seconds * power(2, v_job.attempts - 1)) || ' seconds')::interval,
        last_error = p_error,
        locked_by = NULL,
        visibility_timeout = NULL,
        updated_at = v_now
    WHERE id = p_job_id;
  END IF;
END;
$$;

-- fn_recover_stale_outbox_jobs: Restrict strictly to service_role workers
CREATE OR REPLACE FUNCTION public.fn_recover_stale_outbox_jobs(
  p_stale_threshold_seconds integer DEFAULT 300
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
  v_recovered_count integer := 0;
  v_now timestamptz := timezone('utc'::text, now());
BEGIN
  IF v_caller_role != 'service_role' THEN
    RAISE EXCEPTION 'fn_recover_stale_outbox_jobs: Access denied. Only service_role worker processes may recover outbox jobs.';
  END IF;

  WITH stale_candidates AS (
    SELECT id
    FROM public.job_outbox
    WHERE status = 'PROCESSING'
      AND visibility_timeout IS NOT NULL
      AND visibility_timeout < v_now
    FOR UPDATE SKIP LOCKED
  ),
  reset_jobs AS (
    UPDATE public.job_outbox u
    SET status = CASE WHEN u.attempts >= u.max_attempts THEN 'DEAD_LETTER' ELSE 'QUEUED' END,
        locked_by = NULL,
        visibility_timeout = NULL,
        last_error = coalesce(last_error, 'Job visibility lease timed out (recovered)'),
        updated_at = v_now
    FROM stale_candidates s
    WHERE u.id = s.id
    RETURNING u.id
  )
  SELECT count(*) INTO v_recovered_count FROM reset_jobs;

  RETURN v_recovered_count;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. REVOCATION OF UNNECESSARY GRANTS AND LEAST-PRIVILEGE ROLE RESTRICTION
-- ----------------------------------------------------------------------------
-- Revoke all execution permissions from PUBLIC and anon on all sensitive functions
REVOKE ALL ON FUNCTION public.fn_claim_idempotency_key(TEXT, TEXT, TEXT, TEXT, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_complete_idempotency_key(TEXT, TEXT, INTEGER, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_consume_oauth_nonce(TEXT, TEXT) FROM PUBLIC, anon;

-- Revoke worker functions from authenticated callers
REVOKE ALL ON FUNCTION public.fn_claim_outbox_jobs(TEXT, INTEGER, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_complete_outbox_job(UUID, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_fail_outbox_job(UUID, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_recover_stale_outbox_jobs(INTEGER) FROM PUBLIC, anon, authenticated;

-- Grant execution privileges strictly according to role responsibility
GRANT EXECUTE ON FUNCTION public.fn_claim_idempotency_key(TEXT, TEXT, TEXT, TEXT, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_complete_idempotency_key(TEXT, TEXT, INTEGER, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_consume_oauth_nonce(TEXT, TEXT) TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.fn_claim_outbox_jobs(TEXT, INTEGER, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_complete_outbox_job(UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_fail_outbox_job(UUID, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_recover_stale_outbox_jobs(INTEGER) TO service_role;

COMMIT;
