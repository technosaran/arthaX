import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { parseExpenseMessage, matchAccount, AccountSummary } from "@/utils/expenseParser";
import { invalidateCachedData, getUserCacheKey, CACHE_KEYS } from "@/utils/redis";
import { getLocalDateString } from "@/utils/monthUtils";

interface ShortcutRequestBody {
  text?: string;
  query?: string;
  expense?: string;
  api_key?: string;
  user_id?: string;
}

/**
 * Apple Siri & iOS Shortcuts Voice Logging Endpoint
 * Supports voice logging via "Hey Siri, Log Expense" or iOS Shortcuts automation.
 * Authenticates via Supabase Access Token (Bearer) or Shortcuts API Key (x-api-key).
 */
export async function POST(req: NextRequest) {
  try {
    let body: ShortcutRequestBody;
    try {
      body = (await req.json()) as ShortcutRequestBody;
    } catch {
      return NextResponse.json(
        {
          success: false,
          speech: "Invalid request format.",
          display: "Malformed JSON payload.",
        },
        { status: 400 }
      );
    }

    const rawText = body.text || body.query || body.expense || "";

    if (!rawText || typeof rawText !== "string" || !rawText.trim()) {
      return NextResponse.json(
        {
          success: false,
          speech: "I didn't hear what you spent. Please try saying: Dinner 250 SBI.",
          display: "Missing expense details. Example: Dinner 250 SBI",
        },
        { status: 400 }
      );
    }

    // -------------------------------------------------------------
    // 1. Authenticate Request
    // -------------------------------------------------------------
    const authHeader = req.headers.get("authorization") || "";
    const apiKeyHeader =
      req.headers.get("x-api-key") ||
      req.nextUrl.searchParams.get("key") ||
      body.api_key ||
      "";
    const configuredApiKey = process.env.SHORTCUTS_API_KEY;

    let userId: string | null = null;

    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "").trim();
      const {
        data: { user },
        error: authErr,
      } = await supabaseAdmin.auth.getUser(token);
      if (user && !authErr) {
        userId = user.id;
      }
    }

    if (!userId && configuredApiKey && apiKeyHeader === configuredApiKey) {
      userId = body.user_id || process.env.WHATSAPP_AUTHORIZED_USER_ID || null;
    }

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          speech: "Authentication failed. Please verify your Siri Shortcut API key or sign-in token.",
          display: "Unauthorized: Missing or invalid API key / Bearer token.",
        },
        { status: 401 }
      );
    }

    // Verify user exists in database to prevent orphaned records
    const { data: userRecord } = await supabaseAdmin
      .from("user_settings")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (!userRecord) {
      const { data: accCheck } = await supabaseAdmin
        .from("accounts")
        .select("user_id")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();

      if (!accCheck) {
        return NextResponse.json(
          {
            success: false,
            speech: "Could not find an ArthaX profile for this account ID.",
            display: "User profile not found in database.",
          },
          { status: 404 }
        );
      }
    }

    // -------------------------------------------------------------
    // 2. Fetch User Accounts
    // -------------------------------------------------------------
    const { data: accounts, error: accErr } = await supabaseAdmin
      .from("accounts")
      .select("id, name, type, balance, last_four, classification")
      .eq("user_id", userId);

    if (accErr) {
      console.error("[Siri Endpoint] Error fetching accounts:", accErr);
    }

    const userAccounts: AccountSummary[] = (accounts || []).map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      balance: Number(a.balance) || 0,
      last_four: a.last_four,
    }));

    // -------------------------------------------------------------
    // 3. Parse Natural Language Input
    // -------------------------------------------------------------
    const parsed = parseExpenseMessage(rawText, userAccounts);

    if (!parsed.amount || parsed.amount <= 0) {
      return NextResponse.json({
        success: false,
        speech: `I couldn't find an amount in "${rawText}". Try saying: Spent 250 on lunch with SBI.`,
        display: `Could not parse amount from: "${rawText}"`,
      });
    }

    // -------------------------------------------------------------
    // 4. Match Account
    // -------------------------------------------------------------
    const targetAccount = matchAccount(parsed.accountQuery, userAccounts);

    // -------------------------------------------------------------
    // 5. Record Expense via ATOMIC RPC (Row-locked balance deduction & audit log)
    // -------------------------------------------------------------
    const expenseDate = getLocalDateString(new Date(), "Asia/Kolkata");

    const { data: rpcResult, error: rpcErr } = await supabaseAdmin.rpc("fn_record_expense_atomic", {
      p_user_id: userId,
      p_title: parsed.title,
      p_amount: parsed.amount,
      p_category: parsed.category,
      p_account_id: targetAccount?.id || null,
      p_expense_date: expenseDate,
      p_notes: `Logged via Siri Voice Shortcut: "${rawText}"`,
      p_tags: ["siri", "voice", "automated"],
    });

    if (rpcErr) {
      console.error("[Siri Endpoint] Atomic expense insertion failed:", rpcErr);
      return NextResponse.json(
        {
          success: false,
          speech: "Sorry, I ran into an error saving that expense to your database.",
          details: rpcErr.message,
        },
        { status: 500 }
      );
    }

    const updatedBalance = rpcResult?.new_balance ?? 0;
    const accountName = rpcResult?.account_name || (targetAccount ? targetAccount.name : "Unassigned");

    // -------------------------------------------------------------
    // 6. Invalidate Multi-Tier Cache Keys
    // -------------------------------------------------------------
    try {
      await invalidateCachedData([
        getUserCacheKey(userId, CACHE_KEYS.EXPENSES),
        getUserCacheKey(userId, CACHE_KEYS.ACCOUNTS),
        getUserCacheKey(userId, CACHE_KEYS.PORTFOLIO),
        getUserCacheKey(userId, CACHE_KEYS.LEDGER),
        getUserCacheKey(userId, CACHE_KEYS.BUDGETS),
      ]);
    } catch (cErr) {
      console.warn("[Siri Endpoint] Redis cache invalidation warning:", cErr);
    }

    const currencyFormatter = new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    });

    const formattedAmount = currencyFormatter.format(parsed.amount);
    const formattedBalance = currencyFormatter.format(updatedBalance);

    const speechText = targetAccount
      ? `Logged ${parsed.amount} rupees for ${parsed.title}. Deducted from ${accountName}. Remaining balance is ${Math.round(updatedBalance)} rupees.`
      : `Logged ${parsed.amount} rupees for ${parsed.title} under ${parsed.category}.`;

    const displayText = targetAccount
      ? `Logged ${formattedAmount} for ${parsed.title} (${parsed.category})\nAccount: ${accountName}\nRemaining: ${formattedBalance}`
      : `Logged ${formattedAmount} for ${parsed.title} (${parsed.category})\nAccount: None`;

    return NextResponse.json({
      success: true,
      speech: speechText,
      display: displayText,
      data: {
        expense_id: rpcResult?.expense_id,
        account: accountName,
        deducted: parsed.amount,
        remaining_balance: updatedBalance,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[Siri Endpoint] Unhandled error:", err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
