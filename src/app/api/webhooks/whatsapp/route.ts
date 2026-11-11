import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { parseExpenseMessage, matchAccount } from "@/utils/expenseParser";
import { sendWhatsAppTextMessage } from "@/utils/whatsapp";
import { invalidateCachedData, getUserCacheKey, CACHE_KEYS } from "@/utils/redis";

/**
 * Webhook Verification Handler (GET)
 * Meta WhatsApp Cloud API uses this endpoint during webhook configuration to verify ownership.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || "arthax_secure_token";

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
    const body = await req.json();

    // 1. Support direct testing (e.g. from Postman, curl, or ArthaX test panel)
    let messageText = "";
    let senderPhone = "";
    let phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
    let explicitUserId = "";

    if (body.text) {
      messageText = body.text;
      senderPhone = body.phone || "test_user";
      explicitUserId = body.user_id || "";
    } else if (body.entry && body.entry[0]?.changes && body.entry[0].changes[0]?.value) {
      // Official Meta WhatsApp Cloud API Payload
      const value = body.entry[0].changes[0].value;
      phoneNumberId = value.metadata?.phone_number_id || phoneNumberId;

      const messageObj = value.messages?.[0];
      if (!messageObj) {
        // Status updates (delivered, read, etc.)
        return NextResponse.json({ status: "acknowledged_status_update" });
      }

      senderPhone = messageObj.from || "";
      if (messageObj.type === "text" && messageObj.text?.body) {
        messageText = messageObj.text.body;
      } else {
        // Non-text message (voice note, image, sticker)
        if (senderPhone) {
          await sendWhatsAppTextMessage({
            phoneNumberId,
            to: senderPhone,
            message: "⚠️ Please send text messages to log expenses (e.g. *Dinner 500 HDFC* or *Petrol 1200 Cash*).",
          });
        }
        return NextResponse.json({ status: "ignored_non_text_message" });
      }
    }

    if (!messageText.trim()) {
      return NextResponse.json({ error: "Empty or unrecognized message" }, { status: 400 });
    }

    // 2. Resolve User ID
    // Check if an authorized user ID is configured, or lookup the user
    let userId = explicitUserId || process.env.WHATSAPP_AUTHORIZED_USER_ID;

    if (!userId) {
      // Find the first registered user in user_settings or accounts as default
      const { data: fallbackUser } = await supabaseAdmin
        .from("user_settings")
        .select("id")
        .limit(1)
        .maybeSingle();

      if (fallbackUser?.id) {
        userId = fallbackUser.id;
      } else {
        const { data: accUser } = await supabaseAdmin
          .from("accounts")
          .select("user_id")
          .limit(1)
          .maybeSingle();
        userId = accUser?.user_id || "default_user";
      }
    }

    // 3. Fetch Accounts for this User
    const { data: accounts, error: accErr } = await supabaseAdmin
      .from("accounts")
      .select("id, name, type, balance, last_four")
      .eq("user_id", userId);

    if (accErr) {
      console.error("[WhatsApp Webhook] Error fetching accounts:", accErr);
    }

    const userAccounts = accounts || [];

    // 4. Parse the Message (Amount, Category, Title, Account)
    const parsed = parseExpenseMessage(messageText, userAccounts);

    if (!parsed.amount || parsed.amount <= 0) {
      const helpMsg =
        `⚠️ Could not find a valid amount in:\n"${messageText}"\n\n` +
        `💡 *Try formats like:*\n` +
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

    // 5. Match the Target Account
    const targetAccount = matchAccount(parsed.accountQuery, userAccounts);

    // 6. Insert Expense into Supabase
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
          notes: `Automated via WhatsApp ("${messageText}")`,
        },
      ])
      .select()
      .single();

    if (expErr) {
      console.error("[WhatsApp Webhook] Failed to insert expense:", expErr);
      return NextResponse.json({ error: "Failed to record expense", details: expErr.message }, { status: 500 });
    }

    // 7. Deduct Balance from the Account
    let updatedBalance = 0;
    if (targetAccount) {
      updatedBalance = Math.max(0, Number(targetAccount.balance) - parsed.amount);
      const { error: updErr } = await supabaseAdmin
        .from("accounts")
        .update({ balance: updatedBalance })
        .eq("id", targetAccount.id)
        .eq("user_id", userId);

      if (updErr) {
        console.error("[WhatsApp Webhook] Failed to deduct balance:", updErr);
      }
    }

    // 8. Invalidate Redis Caches
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
      console.warn("[WhatsApp Webhook] Redis cache invalidation warning:", cErr);
    }

    // 9. Format Confirmation Message & Reply to WhatsApp
    const currencyFormatter = new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    });

    const replyMsg =
      `✅ *Expense Logged!*\n\n` +
      `💸 *Amount:* ${currencyFormatter.format(parsed.amount)}\n` +
      `🏷️ *Category:* ${parsed.category}\n` +
      `📝 *Note:* ${parsed.title}\n` +
      `🏦 *Account:* ${targetAccount ? targetAccount.name : "None (Unassigned)"}\n` +
      (targetAccount ? `💳 *New Balance:* ${currencyFormatter.format(updatedBalance)}\n\n` : "\n") +
      `_Logged automatically in ArthaX_ ⚡`;

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
