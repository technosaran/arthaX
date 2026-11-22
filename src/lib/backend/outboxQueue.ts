import { supabaseAdmin } from "@/utils/supabase/admin";
import { logger } from "@/utils/logger";

export type OutboxJobType =
  | "GMAIL_SYNC"
  | "STATEMENT_PARSE"
  | "RECONCILIATION"
  | "PORTFOLIO_SYNC"
  | "NETWORTH_SNAPSHOT"
  | "CASHFLOW_FORECAST";

export interface OutboxJob<TPayload = any> {
  id: string;
  user_id: string;
  job_type: OutboxJobType;
  payload: TPayload;
  priority: number;
  attempts: number;
}

/**
 * Enqueues a job into the durable PostgreSQL transactional outbox.
 * Priority: 1 (Critical), 5 (Normal), 10 (Low).
 */
export async function enqueueOutboxJob<TPayload = any>(
  userId: string,
  jobType: OutboxJobType,
  payload: TPayload,
  priority: number = 5,
  scheduledAt?: string
): Promise<{ id: string | null; error?: string }> {
  try {
    const { data, error } = await supabaseAdmin
      .from("job_outbox")
      .insert({
        user_id: userId,
        job_type: jobType,
        payload: payload as any,
        priority,
        status: "QUEUED",
        scheduled_at: scheduledAt || new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      logger.error("Failed to enqueue job in job_outbox", "OutboxQueue", error, { userId, jobType });
      return { id: null, error: error.message };
    }

    logger.info(`Enqueued ${jobType} job ${data.id} for user ${userId}`, "OutboxQueue");
    return { id: data.id };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("Exception enqueueing outbox job", "OutboxQueue", err, { userId, jobType });
    return { id: null, error: msg };
  }
}

/**
 * Claims a batch of jobs for processing using database row-level locking (FOR UPDATE SKIP LOCKED).
 * Enforces per-user concurrency limits and visibility lease timeout.
 */
export async function claimOutboxJobs(
  workerId: string,
  batchSize: number = 5,
  leaseSeconds: number = 120,
  maxPerUser: number = 2
): Promise<OutboxJob[]> {
  try {
    const { data, error } = await supabaseAdmin.rpc("fn_claim_outbox_jobs", {
      p_worker_id: workerId,
      p_batch_size: batchSize,
      p_lease_seconds: leaseSeconds,
      p_max_per_user: maxPerUser,
    });

    if (error) {
      logger.warn("RPC fn_claim_outbox_jobs error", "OutboxQueue", { error: error.message });
      return [];
    }

    if (!data || !Array.isArray(data)) return [];

    return data.map((row: any) => ({
      id: row.job_id,
      user_id: row.target_user_id,
      job_type: row.target_job_type as OutboxJobType,
      payload: row.job_payload,
      priority: row.job_priority,
      attempts: row.current_attempts,
    }));
  } catch (err: unknown) {
    logger.error("Exception claiming outbox jobs", "OutboxQueue", err);
    return [];
  }
}

/**
 * Marks a claimed job as COMPLETED with optional output result.
 */
export async function completeOutboxJob(jobId: string, result: Record<string, any> = {}): Promise<void> {
  try {
    const { error } = await supabaseAdmin.rpc("fn_complete_outbox_job", {
      p_job_id: jobId,
      p_result: result,
    });
    if (error) {
      logger.warn("Failed to complete outbox job", "OutboxQueue", { jobId, error: error.message });
    }
  } catch (err: unknown) {
    logger.error("Exception completing outbox job", "OutboxQueue", err, { jobId });
  }
}

/**
 * Marks a job as FAILED. If attempts < max_attempts, schedules retry with exponential backoff.
 * Otherwise moves job to DEAD_LETTER status.
 */
export async function failOutboxJob(jobId: string, error: string, retryDelaySeconds: number = 30): Promise<void> {
  try {
    const { error: rpcErr } = await supabaseAdmin.rpc("fn_fail_outbox_job", {
      p_job_id: jobId,
      p_error: error,
      p_retry_delay_seconds: retryDelaySeconds,
    });
    if (rpcErr) {
      logger.warn("Failed to fail outbox job", "OutboxQueue", { jobId, error: rpcErr.message });
    }
  } catch (err: unknown) {
    logger.error("Exception failing outbox job", "OutboxQueue", err, { jobId });
  }
}

/**
 * Recovers stale jobs whose visibility lease expired due to worker crash or network timeout.
 */
export async function recoverStaleOutboxJobs(staleThresholdSeconds: number = 300): Promise<number> {
  try {
    const { data, error } = await supabaseAdmin.rpc("fn_recover_stale_outbox_jobs", {
      p_stale_threshold_seconds: staleThresholdSeconds,
    });
    if (error) {
      logger.warn("Failed to recover stale outbox jobs", "OutboxQueue", { error: error.message });
      return 0;
    }
    return Number(data || 0);
  } catch (err: unknown) {
    logger.error("Exception recovering stale outbox jobs", "OutboxQueue", err);
    return 0;
  }
}
