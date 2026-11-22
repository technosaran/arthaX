-- ============================================================================
-- Migration: 20261127000000_database_idempotency_outbox_and_provenance.sql
-- Description: Database-Enforced Idempotency, Transactional Job Outbox,
--              One-Time OAuth State Nonces, and Financial Provenance Audit Trail
-- Authors: ArthaX Financial Systems & Security Architecture
-- Date: 2026-11-22
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. DATABASE-ENFORCED IDEMPOTENCY TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  idempotency_key text NOT NULL,
  operation_type text NOT NULL, -- 'TRANSFER', 'EXPENSE_CREATE', 'INCOME_CREATE', 'STATEMENT_IMPORT'
  request_fingerprint text NOT NULL, -- SHA-256 of canonical request payload
  status text NOT NULL DEFAULT 'PROCESSING' CHECK (status IN ('PROCESSING', 'COMPLETED', 'FAILED')),
  response_status integer,
  response_body jsonb,
  locked_until timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_idempotency_user_key UNIQUE (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_user_status ON public.idempotency_keys(user_id, status);
CREATE INDEX IF NOT EXISTS idx_idempotency_locked_until ON public.idempotency_keys(locked_until);

ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own idempotency records" ON public.idempotency_keys;
CREATE POLICY "Users can view own idempotency records" ON public.idempotency_keys
  FOR SELECT TO authenticated USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can insert own idempotency records" ON public.idempotency_keys;
CREATE POLICY "Users can insert own idempotency records" ON public.idempotency_keys
  FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can update own idempotency records" ON public.idempotency_keys;
CREATE POLICY "Users can update own idempotency records" ON public.idempotency_keys
  FOR UPDATE TO authenticated USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

-- Stored procedure to atomically claim or inspect an idempotency key
CREATE OR REPLACE FUNCTION public.fn_claim_idempotency_key(
  p_user_id text,
  p_key text,
  p_operation_type text,
  p_fingerprint text,
  p_lease_seconds integer DEFAULT 60
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing record;
  v_now timestamptz := timezone('utc'::text, now());
  v_lock_until timestamptz := v_now + (p_lease_seconds || ' seconds')::interval;
  v_caller_id text := auth.uid()::text;
  v_caller_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
BEGIN
  IF v_caller_role != 'service_role' AND (v_caller_id IS NULL OR v_caller_id != p_user_id) THEN
    RAISE EXCEPTION 'fn_claim_idempotency_key: Unauthorized caller % for user %', v_caller_id, p_user_id;
  END IF;

  SELECT * INTO v_existing
  FROM public.idempotency_keys
  WHERE user_id = p_user_id AND idempotency_key = p_key
  FOR UPDATE;

  IF FOUND THEN
    -- If request fingerprint does not match, reject as fingerprint mismatch conflict
    IF v_existing.request_fingerprint != p_fingerprint THEN
      RETURN jsonb_build_object(
        'action', 'REJECTED_MISMATCH',
        'message', 'Idempotency key reused with mismatched payload fingerprint'
      );
    END IF;

    -- If already completed, return cached response
    IF v_existing.status = 'COMPLETED' THEN
      RETURN jsonb_build_object(
        'action', 'CACHED_RESPONSE',
        'response_status', v_existing.response_status,
        'response_body', v_existing.response_body
      );
    END IF;

    -- If still processing and lock has not expired, return concurrent in-flight conflict
    IF v_existing.status = 'PROCESSING' AND v_existing.locked_until > v_now THEN
      RETURN jsonb_build_object(
        'action', 'IN_FLIGHT_CONFLICT',
        'message', 'Concurrent operation with same idempotency key is actively processing'
      );
    END IF;

    -- If previously failed or lock expired, re-claim the lock
    UPDATE public.idempotency_keys
    SET status = 'PROCESSING',
        locked_until = v_lock_until,
        updated_at = v_now
    WHERE id = v_existing.id;

    RETURN jsonb_build_object(
      'action', 'RECLAIMED',
      'id', v_existing.id
    );
  END IF;

  -- Novel key: insert novel processing record
  INSERT INTO public.idempotency_keys (
    user_id, idempotency_key, operation_type, request_fingerprint, status, locked_until
  )
  VALUES (
    p_user_id, p_key, p_operation_type, p_fingerprint, 'PROCESSING', v_lock_until
  );

  RETURN jsonb_build_object(
    'action', 'CLAIMED'
  );
END;
$$;

-- Stored procedure to complete an idempotency record with cached result
CREATE OR REPLACE FUNCTION public.fn_complete_idempotency_key(
  p_user_id text,
  p_key text,
  p_response_status integer,
  p_response_body jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id text := auth.uid()::text;
  v_caller_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
BEGIN
  IF v_caller_role != 'service_role' AND (v_caller_id IS NULL OR v_caller_id != p_user_id) THEN
    RAISE EXCEPTION 'fn_complete_idempotency_key: Unauthorized caller % for user %', v_caller_id, p_user_id;
  END IF;

  UPDATE public.idempotency_keys
  SET status = 'COMPLETED',
      response_status = p_response_status,
      response_body = p_response_body,
      updated_at = timezone('utc'::text, now())
  WHERE user_id = p_user_id AND idempotency_key = p_key;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. ONE-TIME OAUTH STATE NONCES TABLE (CSRF & REPLAY MITIGATION)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.oauth_state_nonces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  nonce text NOT NULL UNIQUE,
  code_challenge text,
  code_verifier_hash text,
  consumed boolean NOT NULL DEFAULT false,
  consumed_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_oauth_nonces_user ON public.oauth_state_nonces(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_nonces_expires ON public.oauth_state_nonces(expires_at);

ALTER TABLE public.oauth_state_nonces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own oauth nonces" ON public.oauth_state_nonces;
CREATE POLICY "Users can view own oauth nonces" ON public.oauth_state_nonces
  FOR SELECT TO authenticated USING (auth.uid()::text = user_id);

-- Procedure to atomically consume an OAuth nonce (Enforces strictly one-time execution)
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
  -- Strict caller authorization: must be service_role OR the matching authenticated user
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
-- 3. DURABLE TRANSACTIONAL JOB OUTBOX TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  job_type text NOT NULL, -- 'GMAIL_SYNC', 'STATEMENT_PARSE', 'RECONCILIATION', 'PORTFOLIO_SYNC', 'NETWORTH_SNAPSHOT', 'CASHFLOW_FORECAST'
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  priority integer NOT NULL DEFAULT 5, -- 1=Urgent/High, 5=Normal, 10=Low
  status text NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'DEAD_LETTER')),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  visibility_timeout timestamptz,
  locked_by text,
  last_error text,
  result jsonb,
  scheduled_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_job_outbox_queue ON public.job_outbox(status, priority, scheduled_at) 
  WHERE status = 'QUEUED';
CREATE INDEX IF NOT EXISTS idx_job_outbox_user ON public.job_outbox(user_id, status);
CREATE INDEX IF NOT EXISTS idx_job_outbox_visibility ON public.job_outbox(visibility_timeout) 
  WHERE status = 'PROCESSING';

ALTER TABLE public.job_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own outbox jobs" ON public.job_outbox;
CREATE POLICY "Users can view own outbox jobs" ON public.job_outbox
  FOR SELECT TO authenticated USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can insert own outbox jobs" ON public.job_outbox;
CREATE POLICY "Users can insert own outbox jobs" ON public.job_outbox
  FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);

-- Stored procedure: Claim next outbox batch with concurrency limit per user & FOR UPDATE SKIP LOCKED
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
  -- Strict worker daemon authorization: only service_role workers can claim jobs
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

-- Stored procedure: Complete outbox job
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

-- Stored procedure: Fail outbox job with exponential backoff or dead-letter queueing
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
    -- Move to DEAD_LETTER
    UPDATE public.job_outbox
    SET status = 'DEAD_LETTER',
        last_error = p_error,
        locked_by = NULL,
        visibility_timeout = NULL,
        updated_at = v_now
    WHERE id = p_job_id;
  ELSE
    -- Retry with exponential backoff: delay * 2^(attempts-1)
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

-- Stored procedure: Recover stale processing jobs whose visibility timeout expired
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
-- 4. FINANCIAL PROVENANCE AND AUDIT COLUMNS
-- ----------------------------------------------------------------------------
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS source_statement_id uuid REFERENCES public.bank_statements(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS provenance_metadata jsonb DEFAULT '{}'::jsonb;

ALTER TABLE public.income
  ADD COLUMN IF NOT EXISTS source_statement_id uuid REFERENCES public.bank_statements(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS provenance_metadata jsonb DEFAULT '{}'::jsonb;

ALTER TABLE public.transfers
  ADD COLUMN IF NOT EXISTS source_statement_id uuid REFERENCES public.bank_statements(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS provenance_metadata jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_expenses_source_statement ON public.expenses(source_statement_id) WHERE source_statement_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_income_source_statement ON public.income(source_statement_id) WHERE source_statement_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transfers_source_statement ON public.transfers(source_statement_id) WHERE source_statement_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 5. REVOKE DEFAULT PRIVILEGES & GRANT ACCORDING TO LEAST PRIVILEGE
-- ----------------------------------------------------------------------------
-- Revoke all default execution privileges from PUBLIC and anon
REVOKE ALL ON FUNCTION public.fn_claim_idempotency_key(TEXT, TEXT, TEXT, TEXT, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_complete_idempotency_key(TEXT, TEXT, INTEGER, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_consume_oauth_nonce(TEXT, TEXT) FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.fn_claim_outbox_jobs(TEXT, INTEGER, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_complete_outbox_job(UUID, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_fail_outbox_job(UUID, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_recover_stale_outbox_jobs(INTEGER) FROM PUBLIC, anon, authenticated;

-- User-safe procedures granted to authenticated callers and service_role
GRANT EXECUTE ON FUNCTION public.fn_claim_idempotency_key(TEXT, TEXT, TEXT, TEXT, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_complete_idempotency_key(TEXT, TEXT, INTEGER, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_consume_oauth_nonce(TEXT, TEXT) TO authenticated, service_role;

-- Worker daemon procedures restricted STRICTLY to service_role
GRANT EXECUTE ON FUNCTION public.fn_claim_outbox_jobs(TEXT, INTEGER, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_complete_outbox_job(UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_fail_outbox_job(UUID, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_recover_stale_outbox_jobs(INTEGER) TO service_role;

COMMIT;
