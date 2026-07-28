import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export const dynamic = "force-dynamic";

function getCronSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing Supabase URL or Service Key");
  }
  return createClient<Database>(supabaseUrl, serviceKey);
}

/**
 * Natural Language Transaction Text Parser
 * Examples:
 * - "350 lunch HDFC"
 * - "Spent 1200 on petrol SBI"
 * - "Salary 50000 HDFC"
 * - "250 coffee cash"
 */
function parseTransactionText(text: string): {
  amount: number;
  type: "expense" | "income";
  category: string;
  bankMatch?: string;
  description: string;
} | null {
  const clean = text.trim();
  if (!clean) return null;

  // Extract amount
  const amountMatch = clean.match(/(?:rs\.?|₹|\$)?\s*(\d+(?:\.\d{1,2})?)/i);
  if (!amountMatch) return null;

  const amount = parseFloat(amountMatch[1]);
  if (isNaN(amount) || amount <= 0) return null;

  const lower = clean.toLowerCase();

  // Detect type (income vs expense)
  const isIncome = lower.includes("salary") || lower.includes("income") || lower.includes("credit") || lower.includes("received") || lower.includes("refund");
  const type: "expense" | "income" = isIncome ? "income" : "expense";

  // Category detection
  let category = "others";
  if (lower.includes("food") || lower.includes("lunch") || lower.includes("dinner") || lower.includes("coffee") || lower.includes("eat") || lower.includes("swiggy") || lower.includes("zomato")) {
    category = "food";
  } else if (lower.includes("petrol") || lower.includes("diesel") || lower.includes("fuel") || lower.includes("cab") || lower.includes("uber") || lower.includes("ola") || lower.includes("travel")) {
    category = "travel";
  } else if (lower.includes("grocery") || lower.includes("groceries") || lower.includes("supermarket") || lower.includes("mart")) {
    category = "groceries";
  } else if (lower.includes("rent") || lower.includes("bill") || lower.includes("power") || lower.includes("wifi") || lower.includes("recharge")) {
    category = "bills";
  } else if (lower.includes("shopping") || lower.includes("cloth") || lower.includes("dress") || lower.includes("amazon") || lower.includes("flipkart")) {
    category = "shopping";
  } else if (isIncome) {
    category = "salary";
  }

  // Bank account detection
  let bankMatch: string | undefined = undefined;
  if (lower.includes("sbi")) bankMatch = "SBI";
  else if (lower.includes("hdfc")) bankMatch = "HDFC";
  else if (lower.includes("icici")) bankMatch = "ICICI";
  else if (lower.includes("axis")) bankMatch = "Axis";
  else if (lower.includes("kotak")) bankMatch = "Kotak";
  else if (lower.includes("cash")) bankMatch = "Cash";

  // Form clean description
  const descriptionWords = clean
    .replace(/(?:rs\.?|₹|\$)?\s*\d+(?:\.\d{1,2})?/gi, "")
    .replace(/\b(sbi|hdfc|icici|axis|kotak|cash|spent|on|paid|via)\b/gi, "")
    .trim();

  const description = descriptionWords.length > 0
    ? descriptionWords.charAt(0).toUpperCase() + descriptionWords.slice(1)
    : (isIncome ? "Income Entry" : "Expense Entry");

  return { amount, type, category, bankMatch, description };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const message = body?.message;

    if (!message || !message.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat?.id;
    const text = message.text;

    const parsed = parseTransactionText(text);
    if (!parsed) {
      return NextResponse.json({ ok: true });
    }

    const supabase = getCronSupabaseClient();
    const todayStr = new Date().toISOString().split("T")[0];

    // Find first user account or matched account
    const { data: accounts } = await supabase
      .from("accounts")
      .select("*")
      .limit(10);

    const firstAccount = accounts && accounts.length > 0 ? accounts[0] : null;
    const matchedAccount = parsed.bankMatch
      ? accounts?.find(a => (a.bank_name || a.name).toLowerCase().includes(parsed.bankMatch!.toLowerCase()))
      : firstAccount;

    const userId = matchedAccount?.user_id || accounts?.[0]?.user_id;

    if (!userId) {
      return NextResponse.json({ ok: true, message: "No active user found to record transaction." });
    }

    if (parsed.type === "expense") {
      await supabase.from("expenses").insert({
        user_id: userId,
        amount: parsed.amount,
        category: parsed.category,
        description: parsed.description,
        account_id: matchedAccount?.id || null,
        date: todayStr,
        created_at: new Date().toISOString(),
      });

      // Deduct balance from matched account if present
      if (matchedAccount) {
        await supabase.from("accounts").update({
          balance: matchedAccount.balance - parsed.amount,
        }).eq("id", matchedAccount.id);
      }
    } else {
      await supabase.from("incomes").insert({
        user_id: userId,
        amount: parsed.amount,
        category: parsed.category,
        description: parsed.description,
        account_id: matchedAccount?.id || null,
        date: todayStr,
        created_at: new Date().toISOString(),
      });

      // Add balance to matched account if present
      if (matchedAccount) {
        await supabase.from("accounts").update({
          balance: matchedAccount.balance + parsed.amount,
        }).eq("id", matchedAccount.id);
      }
    }

    // Optional Telegram reply if BOT token is present
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (botToken && chatId) {
      const replyText = `✅ *Recorded ${parsed.type === "expense" ? "Expense" : "Income"}*\n\n` +
        `• *Amount*: ₹${parsed.amount.toLocaleString("en-IN")}\n` +
        `• *Category*: ${parsed.category.toUpperCase()}\n` +
        `• *Details*: ${parsed.description}\n` +
        `• *Account*: ${matchedAccount?.name || "Cash Reserve"}`;

      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: replyText,
          parse_mode: "Markdown",
        }),
      });
    }

    return NextResponse.json({
      ok: true,
      transaction: parsed,
      account: matchedAccount?.name || "Default Account",
    });
  } catch (err: any) {
    console.error("Telegram bot webhook error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
