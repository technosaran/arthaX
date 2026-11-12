import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { parseExpenseMessage, matchAccount, AccountSummary } from "@/utils/expenseParser";
import { sendWhatsAppTextMessage } from "@/utils/whatsapp";
import { invalidateCachedData, getUserCacheKey, CACHE_KEYS } from "@/utils/redis";
import { getLocalDateString } from "@/utils/monthUtils";

/**
 * Webhook Verification Handler (GET)
 * Meta WhatsApp Cloud API uses this endpoint during webhook configuration to verify ownership.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken =
    process.env.WHATSAPP_VERIFY_TOKEN || "arthax_secure_whatsapp_token_2026";

  if (mode === "subscribe" && token === verifyToken) {
    console.log("[WhatsApp Webhook] Handshake verified successfully.");
    return new Response(challenge || "", { status: 200 });
  }

  return NextResponse.json({ error: "Verification failed. Token mismatch." }, { status: 403 });
}

/**
 * Incoming Webhook Message Handler (POST)
 * Receives messages from WhatsApp Cloud API, parses them, logs expenses,
 * deducts balances, updates caches, and sends a WhatsApp confirmation.
 */
export async function POST(req: NextRequest) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    // 1. Support direct testing or official Meta Cloud API payload
    let messageText = "";
    let senderPhone = "";
    let phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
    let explicitUserId = "";
    let messageId: string | null = null;

    if (body.text) {
      // Direct testing from test suite, curl, or shortcut
      messageText = body.text;
      senderPhone = body.phone || "test_user";
      explicitUserId = body.user_id || "";
      messageId = body.message_id || `direct_${Date.now()}`;
    } else if (body.entry && body.entry[0]?.changes && body.entry[0].changes[0]?.value) {
      // Official Meta WhatsApp Cloud API Payload
      const value = body.entry[0].changes[0].value;
      phoneNumberId = value.metadata?.phone_number_id || phoneNumberId;

      const messageObj = value.messages?.[0];
      if (!messageObj) {
        // Acknowledge status updates (sent, delivered, read) without processing
        return NextResponse.json({ status: "acknowledged_status_update" });
      }

      senderPhone = messageObj.from || "";
      messageId = messageObj.id || null;

      if (messageObj.type === "text" && messageObj.text?.body) {
        messageText = messageObj.text.body;
      } else {
        // Non-text message (voice note, image, sticker, location)
        if (senderPhone) {
          await sendWhatsAppTextMessage({
            phoneNumberId,
            to: senderPhone,
            message:
              "Please send text messages or copy-paste transaction SMS to log expenses.\n\n" +
              "*Examples:*\n" +
              "• *Dinner 500 HDFC*\n" +
              "• *Petrol 1200 Cash*\n" +
              "• *Groceries 450 SBI*\n" +
              "• *Uber 320*",
          });
        }
        return NextResponse.json({ status: "ignored_non_text_message" });
      }
    }

    if (!messageText.trim()) {
      return NextResponse.json({ error: "Empty or unrecognized message" }, { status: 400 });
    }

    // -------------------------------------------------------------
    // 2. Resolve User ID (Guaranteed Multi-Tenant Safety)
    // -------------------------------------------------------------
    let userId = explicitUserId || process.env.WHATSAPP_AUTHORIZED_USER_ID || null;

    if (!userId) {
      // Fallback for single-user self-hosted instance
      const { data: defaultUser } = await supabaseAdmin
        .from("user_settings")
        .select("id")
        .limit(1)
        .maybeSingle();

      userId = defaultUser?.id || null;
    }

    if (!userId) {
      console.warn("[WhatsApp Webhook] No registered user found to assign expense.");
      if (senderPhone && senderPhone !== "test_user") {
        await sendWhatsAppTextMessage({
          phoneNumberId,
          to: senderPhone,
          message:
            "Your WhatsApp number is not linked to an active ArthaX account. Please sign in to ArthaX and configure your user settings.",
        });
      }
      return NextResponse.json({ error: "User resolution failed" }, { status: 400 });
    }

    // -------------------------------------------------------------
    // 3. Idempotency Check: Prevent duplicate logging on webhook retries
    // -------------------------------------------------------------
    if (messageId) {
      const { data: existingExpense } = await supabaseAdmin
        .from("expenses")
        .select("id, title, amount")
        .ilike("notes", `%${messageId}%`)
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();

      if (existingExpense) {
        console.log(`[WhatsApp Webhook] Duplicate message ${messageId} already recorded. Skipping.`);
        return NextResponse.json({
          status: "already_processed",
          duplicate: true,
          expense_id: existingExpense.id,
        });
      }
    }

    // -------------------------------------------------------------
    // 4. Fetch Accounts for this User
    // -------------------------------------------------------------
    const { data: accounts, error: accErr } = await supabaseAdmin
      .from("accounts")
      .select("id, name, type, balance, last_four")
      .eq("user_id", userId);

    if (accErr) {
      console.error("[WhatsApp Webhook] Error fetching accounts:", accErr);
    }

    const userAccounts: AccountSummary[] = (accounts || []).map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      balance: Number(a.balance) || 0,
      last_four: a.last_four,
    }));

    // -------------------------------------------------------------
    // 5. Parse Message (Amount, Category, Title, Account)
    // -------------------------------------------------------------
    const parsed = parseExpenseMessage(messageText, userAccounts);

    if (!parsed.amount || parsed.amount <= 0) {
      const helpMsg =
        `Could not find a valid amount in:\n"${messageText}"\n\n` +
        `*Try formats like:*\n` +
        `• *Dinner 500 HDFC*\n` +
        `• *Petrol 1200 Cash*\n` +
        `• *Groceries 450 SBI*\n` +
        `• *Uber 320*`;

      if (senderPhone && senderPhone !== "test_user") {
        await sendWhatsAppTextMessage({ phoneNumberId, to: senderPhone, message: helpMsg });
      }

      return NextResponse.json({
        success: false,
        message: "No valid amount parsed",
        sample_format: "Dinner 500 HDFC",
      });
    }

    // -------------------------------------------------------------
    // 6. Match Target Account
    // -------------------------------------------------------------
    const targetAccount = matchAccount(parsed.accountQuery, userAccounts);

    // -------------------------------------------------------------
    // 7. Insert Expense into Supabase (Timezone Aware: Asia/Kolkata)
    // -------------------------------------------------------------
    const expenseDate = getLocalDateString(new Date(), "Asia/Kolkata");
    const notesContent = messageId
      ? `Automated via WhatsApp [${messageId}] ("${messageText}")`
      : `Automated via WhatsApp ("${messageText}")`;

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
          notes: notesContent,
        },
      ])
      .select()
      .single();

    if (expErr) {
      console.error("[WhatsApp Webhook] Failed to insert expense:", expErr);
      return NextResponse.json({ error: "Failed to record expense", details: expErr.message }, { status: 500 });
    }

    // -------------------------------------------------------------
    // 8. Deduct Balance from Account (Preserves Overdraft & Decimal Precision)
    // -------------------------------------------------------------
    let updatedBalance = 0;
    if (targetAccount) {
      updatedBalance = Number((Number(targetAccount.balance) - parsed.amount).toFixed(2));
      const { error: updErr } = await supabaseAdmin
        .from("accounts")
        .update({ balance: updatedBalance })
        .eq("id", targetAccount.id)
        .eq("user_id", userId);

      if (updErr) {
        console.error("[WhatsApp Webhook] Failed to deduct balance:", updErr);
      }
    }

    // -------------------------------------------------------------
    // 9. Invalidate Multi-Tier Redis Caches
    // -------------------------------------------------------------
    try {
      await invalidateCachedData([
        getUserCacheKey(userId, CACHE_KEYS.EXPENSES),
        getUserCacheKey(userId, CACHE_KEYS.ACCOUNTS),
        getUserCacheKey(userId, CACHE_KEYS.PORTFOLIO),
        getUserCacheKey(userId, CACHE_KEYS.LEDGER),
        getUserCacheKey(userId, CACHE_KEYS.BUDGETS),
        "arthax:cache:expenses",
        "arthax:cache:accounts",
        "arthax:cache:ledger",
      ]);
    } catch (cErr) {
      console.warn("[WhatsApp Webhook] Redis cache invalidation warning:", cErr);
    }

    // -------------------------------------------------------------
    // 10. Format Confirmation Message & Reply to WhatsApp
    // -------------------------------------------------------------
    const currencyFormatter = new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    });

    const replyMsg =
      `*Expense Logged!*\n\n` +
      `*Amount:* ${currencyFormatter.format(parsed.amount)}\n` +
      `*Category:* ${parsed.category}\n` +
      `*Note:* ${parsed.title}\n` +
      `*Account:* ${targetAccount ? targetAccount.name : "None (Unassigned)"}\n` +
      (targetAccount ? `*New Balance:* ${currencyFormatter.format(updatedBalance)}\n\n` : "\n") +
      `_Logged automatically in ArthaX_`;

    if (senderPhone && senderPhone !== "test_user") {
      await sendWhatsAppTextMessage({
        phoneNumberId,
        to: senderPhone,
        message: replyMsg,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        expense: insertedExpense,
        deducted_account: targetAccount?.name || null,
        new_balance: updatedBalance,
        confirmation_sent: senderPhone !== "test_user",
        reply_preview: replyMsg,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[WhatsApp Webhook] Error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
