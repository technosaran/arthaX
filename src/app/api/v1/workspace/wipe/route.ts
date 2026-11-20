import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/utils/auth";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { invalidateCachedData, getUserCacheKey, CACHE_KEYS } from "@/utils/redis";
import { rateLimit } from "@/utils/rateLimit";
import { logger } from "@/utils/logger";
import { z } from "zod";

const WipeRequestSchema = z.object({
  confirmation: z.string().refine((val) => ["DELETE", "WIPE"].includes(val.trim().toUpperCase()), {
    message: "Confirmation phrase must be DELETE or WIPE",
  }),
});

async function handleWipe(req: NextRequest) {
  const { user, userId, error: authError } = await getAuthenticatedUser(req);
  if (!user || !userId) {
    return NextResponse.json({ success: false, error: authError || "Unauthorized" }, { status: 401 });
  }

  // Rate limiting to prevent abuse or denial-of-service wipes
  const rl = await rateLimit(`workspace_wipe:${userId}`, 5, 3600);
  if (!rl.success) {
    return NextResponse.json(
      { success: false, error: "Too many reset attempts. Please try again later." },
      { status: 429 }
    );
  }

  logger.warn(`[Audit Trail] User ${userId} initiated workspace wipe`, "WorkspaceWipe");

  try {
    const body = await req.json().catch(() => ({}));
    const parseResult = WipeRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Safety verification failed. Please provide confirmation: 'DELETE'.",
          details: parseResult.error.format(),
        },
        { status: 422 }
      );
    }

    // 1. Attempt atomic stored procedure execution in PostgreSQL
    let rpcSuccess = false;
    let rpcData: Record<string, unknown> | null = null;

    try {
      const { data, error } = await supabaseAdmin.rpc("fn_wipe_user_data", {
        p_user_id: userId,
      });

      if (!error && data?.success) {
        rpcSuccess = true;
        rpcData = data;
      } else if (error) {
        console.warn("[Master Wipe] RPC execution warning:", error.message);
      }
    } catch (rpcErr) {
      console.warn("[Master Wipe] RPC execution exception:", rpcErr);
    }

    // 2. Cascade-safe fallback if RPC is unavailable
    if (!rpcSuccess) {
      // 2a. Transfers (Restricted foreign keys on accounts)
      await supabaseAdmin.from("transfers").delete().eq("user_id", userId);

      // 2b. Recurring rules
      await supabaseAdmin.from("recurring_rules").delete().eq("user_id", userId);

      // 2c. Expenses & Income
      await supabaseAdmin.from("expenses").delete().eq("user_id", userId);
      await supabaseAdmin.from("income").delete().eq("user_id", userId);

      // 2d. Budgets
      await supabaseAdmin.from("budgets").delete().eq("user_id", userId);

      // 2e. Family finance tables
      await supabaseAdmin.from("family_responsibilities").delete().eq("user_id", userId);
      await supabaseAdmin.from("family_goals").delete().eq("user_id", userId);
      await supabaseAdmin.from("family_emergency_vault").delete().eq("user_id", userId);
      await supabaseAdmin.from("family_members").delete().eq("user_id", userId);

      // 2f. Financial audit logs, F&O derivatives, stocks, mutual funds, bonds, bullion, crypto & integrations
      await supabaseAdmin.from("bond_transactions").delete().eq("user_id", userId);
      await supabaseAdmin.from("bond_holdings").delete().eq("user_id", userId);
      await supabaseAdmin.from("bullion_transactions").delete().eq("user_id", userId);
      await supabaseAdmin.from("bullion_holdings").delete().eq("user_id", userId);
      await supabaseAdmin.from("crypto_trades").delete().eq("user_id", userId);
      await supabaseAdmin.from("crypto_holdings").delete().eq("user_id", userId);
      await supabaseAdmin.from("zerodha_integrations").delete().eq("user_id", userId);
      await supabaseAdmin.from("binance_integrations").delete().eq("user_id", userId);
      await supabaseAdmin.from("mutual_fund_transactions").delete().eq("user_id", userId);
      await supabaseAdmin.from("mutual_fund_holdings").delete().eq("user_id", userId);
      await supabaseAdmin.from("fno_trades").delete().eq("user_id", userId);
      await supabaseAdmin.from("fno_positions").delete().eq("user_id", userId);
      await supabaseAdmin.from("stock_transactions").delete().eq("user_id", userId);
      await supabaseAdmin.from("stock_holdings").delete().eq("user_id", userId);
      await supabaseAdmin.from("financial_audit_logs").delete().eq("user_id", userId);

      // 2g. Reset external telegram integration on user_settings
      await supabaseAdmin
        .from("user_settings")
        .update({
          telegram_chat_id: null,
          telegram_username: null,
          telegram_link_token: null,
          telegram_linked_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      // 2g. Accounts: preserve/seed Cash in Hand with 0.00 balance
      const { data: accounts } = await supabaseAdmin
        .from("accounts")
        .select("id, name, last_four")
        .eq("user_id", userId);

      const cashAccount = accounts?.find(
        (a) =>
          a.id === "00000000-0000-0000-0000-000000000001" ||
          a.last_four === "CASH" ||
          a.name.toLowerCase() === "cash in hand"
      );

      const toDelete = accounts?.filter((a) => a.id !== cashAccount?.id) || [];
      if (toDelete.length > 0) {
        await supabaseAdmin.from("accounts").delete().in("id", toDelete.map((a) => a.id));
      }

      if (cashAccount) {
        await supabaseAdmin
          .from("accounts")
          .update({ balance: 0.0, updated_at: new Date().toISOString() })
          .eq("id", cashAccount.id);
      } else {
        await supabaseAdmin.from("accounts").insert({
          user_id: userId,
          name: "Cash in Hand",
          type: "Liquid Cash",
          balance: 0.0,
          last_four: "CASH",
        });
      }
    }

    // 3. Purge all distributed Redis cache tiers for this user
    try {
      await invalidateCachedData([
        getUserCacheKey(userId, CACHE_KEYS.ACCOUNTS),
        getUserCacheKey(userId, CACHE_KEYS.INCOME),
        getUserCacheKey(userId, CACHE_KEYS.EXPENSES),
        getUserCacheKey(userId, CACHE_KEYS.TRANSFERS),
        getUserCacheKey(userId, CACHE_KEYS.SETTINGS),
        getUserCacheKey(userId, CACHE_KEYS.PORTFOLIO),
        getUserCacheKey(userId, CACHE_KEYS.LEDGER),
        getUserCacheKey(userId, CACHE_KEYS.BUDGETS),
        getUserCacheKey(userId, CACHE_KEYS.FAMILY_MEMBERS),
        getUserCacheKey(userId, CACHE_KEYS.FAMILY_RESPONSIBILITIES),
        getUserCacheKey(userId, CACHE_KEYS.STOCKS),
        getUserCacheKey(userId, CACHE_KEYS.MUTUAL_FUNDS),
        getUserCacheKey(userId, CACHE_KEYS.BONDS),
        getUserCacheKey(userId, CACHE_KEYS.BULLION),
        getUserCacheKey(userId, CACHE_KEYS.GOALS),
        getUserCacheKey(userId, CACHE_KEYS.ZERODHA),
        getUserCacheKey(userId, CACHE_KEYS.TELEGRAM),
        getUserCacheKey(userId, "crypto"),
        getUserCacheKey(userId, "fno"),
        "arthax:cache:accounts",
        "arthax:cache:ledger",
        "arthax:cache:portfolio",
      ]);
    } catch (cacheErr) {
      console.warn("[Master Wipe] Cache purge non-blocking error:", cacheErr);
    }

    return NextResponse.json({
      success: true,
      message: "Workspace and entire data successfully wiped. Default liquid account reset to zero.",
      timestamp: new Date().toISOString(),
      details: rpcData || { wiped: true },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to wipe workspace data";
    console.error("[Master Wipe] Error:", err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return handleWipe(req);
}

export async function DELETE(req: NextRequest) {
  return handleWipe(req);
}
