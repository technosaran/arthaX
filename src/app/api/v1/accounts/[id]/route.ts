import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createApiRoute } from "@/lib/backend/routeHandler";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { apiError, apiNotFound, apiSuccess } from "@/utils/apiResponse";
import { invalidateUserCaches } from "@/lib/backend/cacheInvalidation";
import { getProtectedAccountReason } from "@/utils/accountGuards";
import { logger } from "@/utils/logger";

const AccountIdParamSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Invalid account ID");

function isMissingRpcError(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  if (err.code === "PGRST202" || err.code === "42883") return true;
  const msg = (err.message || "").toLowerCase();
  return msg.includes("could not find the function") || msg.includes("does not exist");
}

interface AccountInspection {
  account: {
    id: string;
    name: string;
    type: string;
    balance: number;
    last_four: string | null;
  };
  linkedTransfersCount: number;
  linkedStatementsCount: number;
}

async function inspectAccountAndLinks(
  userId: string,
  rawId: string | undefined,
  req: NextRequest,
  requestId: string
): Promise<{ data?: AccountInspection; errorResponse?: NextResponse }> {
  const idCheck = AccountIdParamSchema.safeParse(rawId);
  if (!idCheck.success) {
    return {
      errorResponse: apiError("Invalid account ID.", "VALIDATION_ERROR", 422, idCheck.error.format(), req),
    };
  }

  const accountId = idCheck.data;

  const { data: account, error: fetchErr } = await supabaseAdmin
    .from("accounts")
    .select("id, name, type, balance, last_four")
    .eq("id", accountId)
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchErr) {
    logger.error("Failed to fetch account details", "AccountsAPI", fetchErr, {
      userId,
      accountId,
      requestId,
    });
    return {
      errorResponse: apiError(fetchErr.message || "Failed to inspect account.", "DATABASE_ERROR", 500, undefined, req),
    };
  }

  if (!account) {
    return {
      errorResponse: apiNotFound("Account card not found or already removed.", req),
    };
  }

  const protectedReason = getProtectedAccountReason(account);
  if (protectedReason) {
    return {
      errorResponse: apiError(protectedReason, "PROTECTED_ACCOUNT", 400, undefined, req),
    };
  }

  const [transfersCountRes, statementsCountRes] = await Promise.all([
    supabaseAdmin
      .from("transfers")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .or(`from_account_id.eq.${accountId},to_account_id.eq.${accountId}`),
    supabaseAdmin
      .from("bank_statements")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("account_id", accountId),
  ]);

  if (transfersCountRes.error) {
    return {
      errorResponse: apiError(
        transfersCountRes.error.message || "Failed to check linked transfers.",
        "DATABASE_ERROR",
        500,
        undefined,
        req
      ),
    };
  }
  if (statementsCountRes.error) {
    return {
      errorResponse: apiError(
        statementsCountRes.error.message || "Failed to check linked statements.",
        "DATABASE_ERROR",
        500,
        undefined,
        req
      ),
    };
  }

  return {
    data: {
      account: {
        id: account.id,
        name: account.name,
        type: account.type,
        balance: Number(account.balance) || 0,
        last_four: account.last_four ?? null,
      },
      linkedTransfersCount: transfersCountRes.count ?? 0,
      linkedStatementsCount: statementsCountRes.count ?? 0,
    },
  };
}

export const GET = createApiRoute<unknown, { id: string }>({
  auth: "required",
  rateLimit: { limit: 120, windowSeconds: 60 },
  handler: async ({ req, userId, params, requestId }) => {
    const inspected = await inspectAccountAndLinks(userId!, params?.id, req, requestId);
    if (inspected.errorResponse) return inspected.errorResponse;

    const { account, linkedTransfersCount, linkedStatementsCount } = inspected.data!;
    return apiSuccess(
      {
        accountId: account.id,
        accountName: account.name,
        linkedTransfersCount,
        linkedStatementsCount,
      },
      undefined,
      200,
      req
    );
  },
});

export const DELETE = createApiRoute<unknown, { id: string }>({
  auth: "required",
  rateLimit: { limit: 60, windowSeconds: 60 },
  handler: async ({ req, userId, params, query, requestId }) => {
    const inspected = await inspectAccountAndLinks(userId!, params?.id, req, requestId);
    if (inspected.errorResponse) return inspected.errorResponse;

    const { account, linkedTransfersCount, linkedStatementsCount } = inspected.data!;
    const accountId = account.id;
    const force = query.get("force") === "true";

    if ((linkedTransfersCount > 0 || linkedStatementsCount > 0) && !force) {
      const parts: string[] = [];
      if (linkedTransfersCount > 0) {
        parts.push(
          `${linkedTransfersCount} internal transfer ${linkedTransfersCount === 1 ? "record" : "records"}`
        );
      }
      if (linkedStatementsCount > 0) {
        parts.push(
          `${linkedStatementsCount} imported bank ${linkedStatementsCount === 1 ? "statement" : "statements"}`
        );
      }

      return apiError(
        `Cannot remove "${account.name}" without confirmation because it is linked to ${parts.join(" and ")}.`,
        "LINKED_RECORDS_EXIST",
        409,
        {
          accountId,
          accountName: account.name,
          linkedTransfersCount,
          linkedStatementsCount,
        },
        req
      );
    }

    // 4. Attempt single-transaction atomic deletion via PostgreSQL RPC
    let clearedTransfers = linkedTransfersCount;
    let clearedStatements = linkedStatementsCount;
    let deletedViaRpc = false;

    try {
      const rpcRes = await supabaseAdmin.rpc("fn_delete_account_atomic", {
        p_user_id: userId!,
        p_account_id: accountId,
        p_clear_transfers: force,
      });

      const rpcData = rpcRes?.data;
      const rpcError = rpcRes?.error;

      if (!rpcError && rpcData?.success) {
        deletedViaRpc = true;
        clearedTransfers = Number(rpcData.cleared_transfers ?? linkedTransfersCount);
        clearedStatements = Number(rpcData.cleared_statements ?? linkedStatementsCount);
      } else if (rpcError && !isMissingRpcError(rpcError)) {
        logger.error("Atomic account deletion RPC failed", "AccountsAPI", rpcError, {
          userId,
          accountId,
          requestId,
        });
        const status = rpcError.code === "23503" ? 409 : rpcError.code === "22023" ? 400 : 500;
        return apiError(
          rpcError.message || "Failed to remove account card.",
          "DATABASE_ERROR",
          status,
          undefined,
          req
        );
      }
    } catch (rpcInvokeErr) {
      logger.info("fn_delete_account_atomic RPC unavailable, using fallback deletion", "AccountsAPI", {
        userId,
        accountId,
        requestId,
        error: rpcInvokeErr instanceof Error ? rpcInvokeErr.message : String(rpcInvokeErr),
      });
    }

    // 5. Fallback deletion path when atomic RPC migration is not yet applied
    if (!deletedViaRpc) {
      if (linkedTransfersCount > 0) {
        const { error: trDelErr } = await supabaseAdmin
          .from("transfers")
          .delete()
          .eq("user_id", userId!)
          .or(`from_account_id.eq.${accountId},to_account_id.eq.${accountId}`);

        if (trDelErr) {
          logger.error("Failed to clear linked transfers before account delete", "AccountsAPI", trDelErr, {
            userId,
            accountId,
            requestId,
          });
          return apiError(
            trDelErr.message || "Failed to clear linked transfer records.",
            "DATABASE_ERROR",
            500,
            undefined,
            req
          );
        }
      }

      const { data: deletedAcc, error: accDelErr } = await supabaseAdmin
        .from("accounts")
        .delete()
        .eq("id", accountId)
        .eq("user_id", userId!)
        .select("id")
        .maybeSingle();

      if (accDelErr) {
        logger.error("Failed to delete account row", "AccountsAPI", accDelErr, {
          userId,
          accountId,
          requestId,
        });
        const status = accDelErr.code === "23503" ? 409 : 500;
        return apiError(accDelErr.message || "Could not remove the card.", "DATABASE_ERROR", status, undefined, req);
      }

      if (!deletedAcc) {
        return apiNotFound("Account card not found or already removed.", req);
      }

      // Non-blocking audit log
      try {
        await supabaseAdmin.from("financial_audit_logs").insert({
          user_id: userId!,
          entity_type: "account",
          entity_id: accountId,
          action: "DELETE",
          delta_amount: Number(account.balance) || 0,
          old_state: {
            name: account.name,
            type: account.type,
            balance: account.balance,
            cleared_transfers: clearedTransfers,
            cascaded_statements: clearedStatements,
          },
          performed_by: userId!,
        });
      } catch (auditErr) {
        logger.warn("Non-blocking audit log insert failed during account deletion", "AccountsAPI", {
          userId,
          accountId,
          error: auditErr instanceof Error ? auditErr.message : String(auditErr),
        });
      }
    }

    // 6. Purge affected server-side Redis caches
    await invalidateUserCaches(userId, [
      "ACCOUNTS",
      "TRANSFERS",
      "PORTFOLIO",
      "LEDGER",
      "EXPENSES",
      "INCOME",
      "ANALYTICS",
    ]);

    return apiSuccess(
      {
        deletedAccountId: accountId,
        accountName: account.name,
        clearedTransfers,
        clearedStatements,
      },
      undefined,
      200,
      req
    );
  },
});
