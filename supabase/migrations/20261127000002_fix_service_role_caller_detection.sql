-- ============================================================================
-- Migration: 20261127000002_fix_service_role_caller_detection.sql
-- Description: Standardize service_role and caller identity detection across
--              all security definer functions to support modern Supabase API keys
-- Authors: ArthaX Financial Architecture & Security Audit
-- Date: 2026-11-22
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. CALLER ROLE RESOLVER HELPER FUNCTION
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_get_caller_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(auth.role(), ''),
    nullif(current_setting('role', true), ''),
    ''
  );
$$;

GRANT EXECUTE ON FUNCTION public.fn_get_caller_role() TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. HARDEN OAUTH NONCE CONSUMPTION (SUPPORTS SERVICE_ROLE & MATCHING USER)
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
  v_caller_role text := public.fn_get_caller_role();
  v_rec record;
  v_now timestamptz := timezone('utc'::text, now());
BEGIN
  -- Strict caller authorization: must be service_role OR the matching authenticated user
  IF v_caller_role != 'service_role' AND (v_caller_id IS NULL OR v_caller_id != p_user_id) THEN
    RAISE EXCEPTION 'fn_consume_oauth_nonce: Unauthorized caller % attempting to consume nonce for % (role: %)', v_caller_id, p_user_id, v_caller_role;
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
-- 3. HARDEN IDEMPOTENCY FUNCTIONS
-- ----------------------------------------------------------------------------
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
  v_caller_role text := public.fn_get_caller_role();
BEGIN
  IF v_caller_role != 'service_role' AND (v_caller_id IS NULL OR v_caller_id != p_user_id) THEN
    RAISE EXCEPTION 'fn_claim_idempotency_key: Unauthorized caller % for user %', v_caller_id, p_user_id;
  END IF;

  SELECT * INTO v_existing
  FROM public.idempotency_keys
  WHERE user_id = p_user_id AND idempotency_key = p_key
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.request_fingerprint != p_fingerprint THEN
      RETURN jsonb_build_object(
        'action', 'REJECTED_MISMATCH',
        'message', 'Idempotency key reused with mismatched payload fingerprint'
      );
    END IF;

    IF v_existing.status = 'COMPLETED' THEN
      RETURN jsonb_build_object(
        'action', 'CACHED_RESPONSE',
        'response_status', v_existing.response_status,
        'response_body', v_existing.response_body
      );
    END IF;

    IF v_existing.status = 'PROCESSING' AND v_existing.locked_until > v_now THEN
      RETURN jsonb_build_object(
        'action', 'IN_FLIGHT_CONFLICT',
        'message', 'Concurrent operation with same idempotency key is actively processing'
      );
    END IF;

    UPDATE public.idempotency_keys
    SET status = 'PROCESSING',
        locked_until = v_lock_until,
        updated_at = v_now
    WHERE id = v_existing.id;

    RETURN jsonb_build_object(
      'action', 'LEASE_RENEWED'
    );
  END IF;

  INSERT INTO public.idempotency_keys (
    user_id,
    idempotency_key,
    operation_type,
    request_fingerprint,
    status,
    locked_until,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    p_key,
    p_operation_type,
    p_fingerprint,
    'PROCESSING',
    v_lock_until,
    v_now,
    v_now
  );

  RETURN jsonb_build_object(
    'action', 'CLAIMED'
  );
END;
$$;

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
  v_caller_role text := public.fn_get_caller_role();
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
-- 4. HARDEN OUTBOX WORKER FUNCTIONS
-- ----------------------------------------------------------------------------
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
  v_caller_role text := public.fn_get_caller_role();
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
  v_caller_role text := public.fn_get_caller_role();
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
  v_caller_role text := public.fn_get_caller_role();
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

CREATE OR REPLACE FUNCTION public.fn_recover_stale_outbox_jobs(
  p_stale_threshold_seconds integer DEFAULT 300
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role text := public.fn_get_caller_role();
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
-- 5. HARDEN FINANCIAL LEDGER & MASTER WIPE FUNCTIONS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.decrement_account_balance(
  p_account_id UUID,
  p_amount NUMERIC(15, 2)
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_owner_id TEXT;
  v_caller_id TEXT;
  v_caller_role TEXT;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'decrement_account_balance: Amount must be strictly positive (received %)', p_amount;
  END IF;

  SELECT user_id INTO v_owner_id FROM public.accounts WHERE id = p_account_id;
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'decrement_account_balance: Account % does not exist', p_account_id;
  END IF;

  v_caller_id := auth.uid()::text;
  v_caller_role := public.fn_get_caller_role();

  IF v_caller_role != 'service_role' AND (v_caller_id IS NULL OR v_caller_id != v_owner_id) THEN
    RAISE EXCEPTION 'decrement_account_balance: Unauthorized access to account %', p_account_id;
  END IF;

  UPDATE public.accounts
  SET balance = balance - p_amount,
      updated_at = NOW()
  WHERE id = p_account_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_account_balance(
  p_account_id UUID,
  p_amount NUMERIC(15, 2)
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_owner_id TEXT;
  v_caller_id TEXT;
  v_caller_role TEXT;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'increment_account_balance: Amount must be strictly positive (received %)', p_amount;
  END IF;

  SELECT user_id INTO v_owner_id FROM public.accounts WHERE id = p_account_id;
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'increment_account_balance: Account % does not exist', p_account_id;
  END IF;

  v_caller_id := auth.uid()::text;
  v_caller_role := public.fn_get_caller_role();

  IF v_caller_role != 'service_role' AND (v_caller_id IS NULL OR v_caller_id != v_owner_id) THEN
    RAISE EXCEPTION 'increment_account_balance: Unauthorized access to account %', p_account_id;
  END IF;

  UPDATE public.accounts
  SET balance = balance + p_amount,
      updated_at = NOW()
  WHERE id = p_account_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_record_expense_atomic(
  p_user_id TEXT,
  p_account_id UUID,
  p_amount NUMERIC(15, 2),
  p_category TEXT,
  p_expense_date DATE,
  p_description TEXT DEFAULT NULL,
  p_merchant TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_new_id UUID;
  v_caller_id TEXT;
  v_caller_role TEXT;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'fn_record_expense_atomic: Amount must be strictly positive';
  END IF;

  v_caller_id := auth.uid()::text;
  v_caller_role := public.fn_get_caller_role();

  IF v_caller_role != 'service_role' AND (v_caller_id IS NULL OR v_caller_id != p_user_id) THEN
    RAISE EXCEPTION 'fn_record_expense_atomic: Unauthorized tenant operation';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE id = p_account_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'fn_record_expense_atomic: Target account % does not belong to user %', p_account_id, p_user_id;
  END IF;

  INSERT INTO public.expenses (
    user_id, account_id, amount, category, expense_date, description, merchant
  )
  VALUES (
    p_user_id, p_account_id, p_amount, p_category, p_expense_date, p_description, p_merchant
  )
  RETURNING id INTO v_new_id;

  UPDATE public.accounts
  SET balance = balance - p_amount,
      updated_at = NOW()
  WHERE id = p_account_id AND user_id = p_user_id;

  RETURN v_new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_record_income_atomic(
  p_user_id TEXT,
  p_account_id UUID,
  p_amount NUMERIC(15, 2),
  p_source TEXT,
  p_income_date DATE,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_new_id UUID;
  v_caller_id TEXT;
  v_caller_role TEXT;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'fn_record_income_atomic: Amount must be strictly positive';
  END IF;

  v_caller_id := auth.uid()::text;
  v_caller_role := public.fn_get_caller_role();

  IF v_caller_role != 'service_role' AND (v_caller_id IS NULL OR v_caller_id != p_user_id) THEN
    RAISE EXCEPTION 'fn_record_income_atomic: Unauthorized tenant operation';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE id = p_account_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'fn_record_income_atomic: Target account % does not belong to user %', p_account_id, p_user_id;
  END IF;

  INSERT INTO public.income (
    user_id, account_id, amount, source, income_date, description
  )
  VALUES (
    p_user_id, p_account_id, p_amount, p_source, p_income_date, p_description
  )
  RETURNING id INTO v_new_id;

  UPDATE public.accounts
  SET balance = balance + p_amount,
      updated_at = NOW()
  WHERE id = p_account_id AND user_id = p_user_id;

  RETURN v_new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_wipe_user_data(p_user_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id TEXT;
  v_caller_role TEXT;
  v_cash_account_id UUID;
BEGIN
  v_caller_id := auth.uid()::text;
  v_caller_role := public.fn_get_caller_role();

  IF v_caller_role != 'service_role' AND (v_caller_id IS NULL OR v_caller_id != p_user_id) THEN
    RAISE EXCEPTION 'fn_wipe_user_data: Unauthorized master wipe request for user %', p_user_id;
  END IF;

  DELETE FROM public.statement_attachment_jobs WHERE statement_id IN (
    SELECT id FROM public.bank_statements WHERE user_id = p_user_id
  );
  DELETE FROM public.canonical_transactions WHERE user_id = p_user_id;
  DELETE FROM public.bank_statements WHERE user_id = p_user_id;
  DELETE FROM public.statement_password_hints WHERE user_id = p_user_id;
  DELETE FROM public.automation_jobs WHERE user_id = p_user_id;
  DELETE FROM public.user_classification_rules WHERE user_id = p_user_id;
  DELETE FROM public.net_worth_snapshots WHERE user_id = p_user_id;
  DELETE FROM public.idempotency_keys WHERE user_id = p_user_id;
  DELETE FROM public.job_outbox WHERE user_id = p_user_id;
  DELETE FROM public.oauth_state_nonces WHERE user_id = p_user_id;
  DELETE FROM public.expenses WHERE user_id = p_user_id;
  DELETE FROM public.income WHERE user_id = p_user_id;
  DELETE FROM public.budgets WHERE user_id = p_user_id;
  DELETE FROM public.goals WHERE user_id = p_user_id;
  DELETE FROM public.transfers WHERE user_id = p_user_id;
  DELETE FROM public.stock_holdings WHERE user_id = p_user_id;
  DELETE FROM public.stock_trades WHERE user_id = p_user_id;
  DELETE FROM public.mutual_fund_holdings WHERE user_id = p_user_id;
  DELETE FROM public.mutual_fund_transactions WHERE user_id = p_user_id;
  DELETE FROM public.bullion_holdings WHERE user_id = p_user_id;
  DELETE FROM public.bullion_transactions WHERE user_id = p_user_id;
  DELETE FROM public.fno_positions WHERE user_id = p_user_id;
  DELETE FROM public.fno_trades WHERE user_id = p_user_id;
  DELETE FROM public.crypto_holdings WHERE user_id = p_user_id;
  DELETE FROM public.crypto_trades WHERE user_id = p_user_id;
  DELETE FROM public.bond_holdings WHERE user_id = p_user_id;
  DELETE FROM public.user_integrations WHERE user_id = p_user_id;
  DELETE FROM public.accounts WHERE user_id = p_user_id;

  INSERT INTO public.accounts (user_id, name, type, balance, currency, is_default)
  VALUES (p_user_id, 'Cash Wallet', 'CASH', 0.00, 'INR', true)
  RETURNING id INTO v_cash_account_id;

  RETURN jsonb_build_object(
    'status', 'success',
    'user_id', p_user_id,
    'default_cash_account_id', v_cash_account_id,
    'timestamp', timezone('utc'::text, now())
  );
END;
$$;

-- Ensure execution grants
GRANT EXECUTE ON FUNCTION public.fn_consume_oauth_nonce(TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_claim_idempotency_key(TEXT, TEXT, TEXT, TEXT, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_complete_idempotency_key(TEXT, TEXT, INTEGER, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_claim_outbox_jobs(TEXT, INTEGER, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_complete_outbox_job(UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_fail_outbox_job(UUID, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_recover_stale_outbox_jobs(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.decrement_account_balance(UUID, NUMERIC) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_account_balance(UUID, NUMERIC) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_record_expense_atomic(TEXT, UUID, NUMERIC, TEXT, DATE, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_record_income_atomic(TEXT, UUID, NUMERIC, TEXT, DATE, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_wipe_user_data(TEXT) TO authenticated, service_role;

COMMIT;
