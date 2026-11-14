import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { parseExpenseMessage, matchAccount, AccountSummary } from "@/utils/expenseParser";
import { classifyFinancialMessage } from "@/utils/financeParser";
import { invalidateCachedData, getUserCacheKey, CACHE_KEYS } from "@/utils/redis";
import { getLocalDateString, getCurrentMonthYear } from "@/utils/monthUtils";

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
      userId =
        body.user_id ||
        process.env.SHORTCUTS_AUTHORIZED_USER_ID ||
        process.env.WHATSAPP_AUTHORIZED_USER_ID ||
        process.env.TELEGRAM_AUTHORIZED_USER_ID ||
        null;
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
    // 3. Detect Action Type: Balance, Summary, Transfer, Income, or Expense
    // -------------------------------------------------------------
    const cleanLower = rawText.trim().toLowerCase();

    // 3A. Balance Inquiry (e.g., "What is my balance?", "Balance", "How much in SBI?")
    const isBalanceQuery = /^(?:what is my balance|check balance|my balance|balance|accounts|how much in|net worth)/i.test(cleanLower);
    if (isBalanceQuery) {
      // Check if querying a specific account (e.g., "how much in SBI", "balance HDFC")
      const specificAccount = userAccounts.find((a) => cleanLower.includes(a.name.toLowerCase()));
      if (specificAccount) {
        return NextResponse.json({
          success: true,
          speech: `You have ${Math.round(specificAccount.balance)} rupees in ${specificAccount.name}.`,
          display: `${specificAccount.name}: ₹${specificAccount.balance.toLocaleString("en-IN")}`,
          data: { account: specificAccount.name, balance: specificAccount.balance },
        });
      }

      const totalBalance = userAccounts.reduce((sum, a) => sum + a.balance, 0);
      const topAccountsStr = userAccounts
        .slice(0, 3)
        .map((a) => `${a.name}: ${Math.round(a.balance)} rupees`)
        .join(", ");

      const speech = userAccounts.length > 0
        ? `Your total balance is ${Math.round(totalBalance)} rupees across ${userAccounts.length} accounts. ${topAccountsStr}.`
        : `Your total balance is 0 rupees.`;

      return NextResponse.json({
        success: true,
        speech,
        display: `Total Balance: ₹${totalBalance.toLocaleString("en-IN")}`,
        data: { total: totalBalance, accounts: userAccounts },
      });
    }

    // 3B. Monthly Spending Summary (e.g., "How much did I spend this month?", "Summary")
    const isSummaryQuery = /^(?:how much did i spend|monthly spend|total spent|summary|my spend|spending)/i.test(cleanLower);
    if (isSummaryQuery) {
      const currentMonth = getCurrentMonthYear();
      const monthStart = `${currentMonth}-01`;
      const today = getLocalDateString(new Date(), "Asia/Kolkata");

      const { data: monthExpenses } = await supabaseAdmin
        .from("expenses")
        .select("amount")
        .eq("user_id", userId)
        .gte("expense_date", monthStart)
        .lte("expense_date", today);

      const totalSpent = (monthExpenses || []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

      return NextResponse.json({
        success: true,
        speech: `You have spent ${Math.round(totalSpent)} rupees this month.`,
        display: `This Month's Spending: ₹${totalSpent.toLocaleString("en-IN")}`,
        data: { totalSpent },
      });
    }

    // 3C. Classify Financial Intent (Transfer vs Income vs Expense)
    const intent = classifyFinancialMessage(rawText, userAccounts);

    // Intent: Inter-Account Transfer (e.g., "Transfer 5000 from HDFC to Cash")
    if (intent.type === "transfer") {
      const fromAcc = matchAccount(intent.data.fromAccountQuery, userAccounts);
      const toAcc = matchAccount(intent.data.toAccountQuery, userAccounts);

      if (!fromAcc || !toAcc) {
        return NextResponse.json({
          success: false,
          speech: `I couldn't identify both accounts for the transfer in "${rawText}". Try saying: Transfer 5000 from HDFC to Cash.`,
          display: `Could not identify transfer accounts in: "${rawText}"`,
        });
      }

      const todayDate = getLocalDateString(new Date(), "Asia/Kolkata");
      const { data: tResult, error: tErr } = await supabaseAdmin.rpc("fn_record_transfer_atomic", {
        p_user_id: userId,
        p_from_account_id: fromAcc.id,
        p_to_account_id: toAcc.id,
        p_amount: intent.data.amount,
        p_transfer_date: todayDate,
        p_notes: `Logged via Siri Voice: "${rawText}"`,
      });

      if (tErr) {
        return NextResponse.json({
          success: false,
          speech: `Transfer failed: ${tErr.message}`,
          display: `Error: ${tErr.message}`,
        }, { status: 500 });
      }

      await invalidateCachedData([
        getUserCacheKey(userId, CACHE_KEYS.ACCOUNTS),
        getUserCacheKey(userId, CACHE_KEYS.TRANSFERS),
        getUserCacheKey(userId, CACHE_KEYS.PORTFOLIO),
        getUserCacheKey(userId, CACHE_KEYS.LEDGER),
      ]);

      return NextResponse.json({
        success: true,
        speech: `Transferred ${intent.data.amount} rupees from ${fromAcc.name} to ${toAcc.name}. New ${fromAcc.name} balance is ${Math.round(tResult?.from_new_balance ?? 0)} rupees.`,
        display: `Transferred ₹${intent.data.amount}: ${fromAcc.name} ➡️ ${toAcc.name}`,
        data: {
          transfer_id: tResult?.transfer_id,
          from: fromAcc.name,
          to: toAcc.name,
          amount: intent.data.amount,
        },
      });
    }

    // Intent: Income Credit (e.g., "Salary 60000 credited to HDFC")
    if (intent.type === "income") {
      const targetAccount = matchAccount(intent.data.accountQuery, userAccounts);
      const todayDate = getLocalDateString(new Date(), "Asia/Kolkata");

      const { data: incResult, error: incErr } = await supabaseAdmin.rpc("fn_record_income_atomic", {
        p_user_id: userId,
        p_title: intent.data.title,
        p_amount: intent.data.amount,
        p_category: intent.data.category,
        p_frequency: "one-time",
        p_account_id: targetAccount?.id || null,
        p_received_date: todayDate,
        p_notes: `Logged via Siri Voice: "${rawText}"`,
        p_tags: ["siri", "voice", "income"],
      });

      if (incErr) {
        return NextResponse.json({
          success: false,
          speech: `Income logging failed: ${incErr.message}`,
          display: `Error: ${incErr.message}`,
        }, { status: 500 });
      }

      await invalidateCachedData([
        getUserCacheKey(userId, CACHE_KEYS.INCOME),
        getUserCacheKey(userId, CACHE_KEYS.ACCOUNTS),
        getUserCacheKey(userId, CACHE_KEYS.PORTFOLIO),
        getUserCacheKey(userId, CACHE_KEYS.LEDGER),
      ]);

      const updatedBal = incResult?.new_balance ?? 0;
      const accountName = incResult?.account_name || (targetAccount ? targetAccount.name : "Unassigned");

      return NextResponse.json({
        success: true,
        speech: targetAccount
          ? `Logged income of ${intent.data.amount} rupees for ${intent.data.title} into ${accountName}. New balance is ${Math.round(updatedBal)} rupees.`
          : `Logged income of ${intent.data.amount} rupees for ${intent.data.title}.`,
        display: `Income: ₹${intent.data.amount} (${intent.data.title}) into ${accountName}`,
        data: {
          income_id: incResult?.income_id,
          account: accountName,
          amount: intent.data.amount,
          new_balance: updatedBal,
        },
      });
    }

    // Intent: Expense (Default natural language & debit SMS)
    const parsed = parseExpenseMessage(rawText, userAccounts);

    if (!parsed.amount || parsed.amount <= 0) {
      return NextResponse.json({
        success: false,
        speech: `I couldn't understand "${rawText}". Try saying: Spent 250 on lunch with SBI, or: What is my balance?`,
        display: `Could not parse financial intent from: "${rawText}"`,
      });
    }

    const targetAccount = matchAccount(parsed.accountQuery, userAccounts);
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
