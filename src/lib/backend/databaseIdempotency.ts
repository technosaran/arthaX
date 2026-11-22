import { supabaseAdmin } from "@/utils/supabase/admin";
import { logger } from "@/utils/logger";
import crypto from "crypto";

export interface IdempotencyClaimResult {
  action: "CLAIMED" | "RECLAIMED" | "CACHED_RESPONSE" | "IN_FLIGHT_CONFLICT" | "REJECTED_MISMATCH" | "FALLBACK";
  isFirstAttempt: boolean;
  cachedResponse?: {
    status: number;
    body: any;
  };
  message?: string;
}

/**
 * Computes deterministic canonical SHA-256 fingerprint for a request payload.
 */
export function computeRequestFingerprint(payload: unknown): string {
  if (payload === null || payload === undefined) {
    return crypto.createHash("sha256").update("EMPTY_PAYLOAD").digest("hex");
  }

  let serialized: string;
  if (typeof payload === "string") {
    serialized = payload;
  } else {
    // Sort keys recursively for canonical JSON representation
    const canonicalize = (obj: any): any => {
      if (obj === null || typeof obj !== "object") return obj;
      if (Array.isArray(obj)) return obj.map(canonicalize);
      return Object.keys(obj)
        .sort()
        .reduce((acc: any, key: string) => {
          acc[key] = canonicalize(obj[key]);
          return acc;
        }, {});
    };
    serialized = JSON.stringify(canonicalize(payload));
  }

  return crypto.createHash("sha256").update(serialized).digest("hex");
}

/**
 * Claims an idempotency key at the database level with transactional row locking.
 * Enforces:
 * 1. User-scoped isolation.
 * 2. Uniqueness of operation identifier.
 * 3. Payload fingerprint verification (detects payload tampering with reused key).
 * 4. Concurrent in-flight operation rejection.
 * 5. Replay of completed responses.
 */
export async function claimDatabaseIdempotency(
  userId: string,
  idempotencyKey: string,
  operationType: string,
  payload: unknown,
  leaseSeconds: number = 120
): Promise<IdempotencyClaimResult> {
  const fingerprint = computeRequestFingerprint(payload);

  try {
    const { data, error } = await supabaseAdmin.rpc("fn_claim_idempotency_key", {
      p_user_id: userId,
      p_key: idempotencyKey.trim(),
      p_operation_type: operationType,
      p_fingerprint: fingerprint,
      p_lease_seconds: leaseSeconds,
    });

    if (error) {
      // In tests or environments where RPC is not yet applied, fallback gracefully
      logger.warn("Database idempotency RPC notice, falling back", "IdempotencyGuard", {
        error: error.message,
      });
      return { action: "FALLBACK", isFirstAttempt: true };
    }

    const res = data as any;
    if (res?.action === "CACHED_RESPONSE") {
      return {
        action: "CACHED_RESPONSE",
        isFirstAttempt: false,
        cachedResponse: {
          status: res.response_status || 200,
          body: res.response_body,
        },
      };
    }

    if (res?.action === "IN_FLIGHT_CONFLICT" || res?.action === "REJECTED_MISMATCH") {
      return {
        action: res.action,
        isFirstAttempt: false,
        message: res.message || "Idempotency conflict",
      };
    }

    return {
      action: res?.action || "CLAIMED",
      isFirstAttempt: true,
    };
  } catch (err: unknown) {
    logger.warn("Exception during database idempotency claim", "IdempotencyGuard", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { action: "FALLBACK", isFirstAttempt: true };
  }
}

/**
 * Persists the final execution result and status code into the database idempotency record.
 */
export async function completeDatabaseIdempotency(
  userId: string,
  idempotencyKey: string,
  responseStatus: number,
  responseBody: unknown
): Promise<void> {
  try {
    const { error } = await supabaseAdmin.rpc("fn_complete_idempotency_key", {
      p_user_id: userId,
      p_key: idempotencyKey.trim(),
      p_response_status: responseStatus,
      p_response_body: responseBody as any,
    });

    if (error) {
      logger.warn("Failed to complete database idempotency record", "IdempotencyGuard", {
        error: error.message,
      });
    }
  } catch (err: unknown) {
    logger.warn("Exception completing database idempotency record", "IdempotencyGuard", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
