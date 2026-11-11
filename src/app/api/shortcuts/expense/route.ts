import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { parseExpenseMessage, matchAccount } from "@/utils/expenseParser";
import { invalidateCachedData, getUserCacheKey, CACHE_KEYS } from "@/utils/redis";

/**
 * Apple Siri & iOS Shortcuts Endpoint
 * Supports voice logging via "Hey Siri, Log Expense"
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawText = body.text || body.query || body.expense || "";

    if (!rawText.trim()) {
      return NextResponse.json(
        {
          success: false,
          speech: "I didn't hear what you spent. Please try saying: Dinner 250 SBI.",
          display: "⚠️ Missing expense details.",
        },
        { status: 400 }
      );
    }

    // Default to the authorized user (Saran)
    const userId =
      body.user_id ||
      process.env.WHATSAPP_AUTHORIZED_USER_ID ||
      "640cb47d-abe8-4182-85d5-347f5ccd4aa2";

    // 1. Fetch user accounts
    const { data: accounts, error: accErr } = await supabaseAdmin
      .from("accounts")
      .select("id, name, type, balance, last_four")
      .eq("user_id", userId);

    if (accErr) {
      console.error("[Siri Endpoint] Error fetching accounts:", accErr);
    }

    const userAccounts = accounts || [];

    // 2. Parse natural language input
    const parsed = parseExpenseMessage(rawText, userAccounts);

    if (!parsed.amount || parsed.amount <= 0) {
      return NextResponse.json({
        success: false,
        speech: `I couldn't find an amount in "${rawText}". Try saying: Spent 250 on lunch with SBI.`,
        display: `⚠️ Could not parse amount from: "${rawText}"`,
      });
    }

    // 3. Match Account
    const targetAccount = matchAccount(parsed.accountQuery, userAccounts);

    // 4. Record Expense
    const expenseDate = new Date().toISOString().split("T")[0];
    const { data: insertedExpense, error: expErr } = await supabaseAdmin
      .from("expenses")
      .insert([
        {
          user_id: userId,
          title: parsed.title,
          amount: parsed.amount,
          category: parsed.category,
          account_id: targetAccount?.id || null,
          expense_date: expenseDate,
          notes: `Logged via Siri Voice Shortcut: "${rawText}"`,
        },
      ])
      .select()
      .single();

    if (expErr) {
      console.error("[Siri Endpoint] Failed to insert expense:", expErr);
      return NextResponse.json(
        {
          success: false,
          speech: "Sorry, I ran into an error saving that expense to your database.",
          details: expErr.message,
        },
        { status: 500 }
      );
    }

    // 5. Deduct Balance
    let updatedBalance = 0;
    if (targetAccount) {
      updatedBalance = Math.max(0, Number(targetAccount.balance) - parsed.amount);
      await supabaseAdmin
        .from("accounts")
        .update({ balance: updatedBalance })
        .eq("id", targetAccount.id)
        .eq("user_id", userId);
    }

    // 6. Invalidate Redis Cache
    try {
      await invalidateCachedData([
        getUserCacheKey(userId, CACHE_KEYS.EXPENSES),
        getUserCacheKey(userId, CACHE_KEYS.ACCOUNTS),
        getUserCacheKey(userId, CACHE_KEYS.LEDGER),
        "arthax:cache:expenses",
        "arthax:cache:accounts",
        "arthax:cache:ledger",
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
    const accountName = targetAccount ? targetAccount.name : "Cash";

    const speechText = `Logged ${parsed.amount} rupees for ${parsed.title}. Deducted from ${accountName}. Remaining balance is ${Math.round(updatedBalance)} rupees.`;
    const displayText = `✅ Logged ${formattedAmount} for ${parsed.title} (${parsed.category})\n🏦 Account: ${accountName}\n💳 Remaining: ${formattedBalance}`;

    return NextResponse.json({
      success: true,
      speech: speechText,
      display: displayText,
      data: {
        expense: insertedExpense,
        account: accountName,
        deducted: parsed.amount,
        remaining_balance: updatedBalance,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
