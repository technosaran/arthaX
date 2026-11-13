import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
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
 * Validates Meta WhatsApp HMAC-SHA256 signature
 */
function verifyMetaSignature(rawBody: string, signatureHeader: string | null, appSecret: string): boolean {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
    return false;
  }
  const expectedHash = signatureHeader.replace("sha256=", "").trim();
  const hmac = crypto.createHmac("sha256", appSecret);
  const calculatedHash = hmac.update(rawBody).digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedHash, "hex"),
      Buffer.from(calculatedHash, "hex")
    );
  } catch {
    return false;
  }
}

/**
 * Incoming Webhook Message Handler (POST)
 * Receives messages from WhatsApp Cloud API, parses them, logs expenses atomically,
 * updates caches, and sends a WhatsApp confirmation.
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const appSecret = process.env.WHATSAPP_APP_SECRET;
    const signature = req.headers.get("x-hub-signature-256");

    // Enforce HMAC-SHA256 signature verification in production if app secret is configured
    if (appSecret) {
      const isValid = verifyMetaSignature(rawBody, signature, appSecret);
      if (!isValid) {
        console.warn("[WhatsApp Webhook] Invalid HMAC signature detected.");
        return NextResponse.json({ error: "Unauthorized: Invalid webhook signature." }, { status: 401 });
      }
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    // 1. Support direct testing or official Meta Cloud API payload
    let messageText = "";
    let senderPhone = "";
    let phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
    let explicitUserId = "";
    let messageId: string | null = null;

    if (typeof body.text === "string") {
      messageText = body.text;
      senderPhone = typeof body.phone === "string" ? body.phone : "test_user";
      explicitUserId = typeof body.user_id === "string" ? body.user_id : "";
      messageId = typeof body.message_id === "string" ? body.message_id : `direct_${Date.now()}`;
    } else if (Array.isArray(body.entry) && body.entry[0]) {
      const entryObj = body.entry[0] as { changes?: Array<{ value?: { metadata?: { phone_number_id?: string }; messages?: Array<{ id?: string; from?: string; type?: string; text?: { body?: string } }> } }> };
      const changeVal = entryObj.changes?.[0]?.value;
      if (changeVal) {
        phoneNumberId = changeVal.metadata?.phone_number_id || phoneNumberId;
        const messageObj = changeVal.messages?.[0];

        if (!messageObj) {
          return NextResponse.json({ status: "acknowledged_status_update" });
        }

        senderPhone = messageObj.from || "";
        messageId = messageObj.id || null;

        if (messageObj.type === "text" && messageObj.text?.body) {
          messageText = messageObj.text.body;
        } else {
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
    }

    if (!messageText.trim()) {
      return NextResponse.json({ error: "Empty or unrecognized message" }, { status: 400 });
    }

    // -------------------------------------------------------------
    // 2. Resolve User ID strictly (Eliminated unsafe limit(1) fallback)
    // -------------------------------------------------------------
    let userId = explicitUserId || process.env.WHATSAPP_AUTHORIZED_USER_ID || null;

    // Check if phone matches user in user_settings or family_members
    if (!userId && senderPhone && senderPhone !== "test_user") {
      const { data: memberRecord } = await supabaseAdmin
        .from("family_members")
        .select("user_id")
        .eq("phone", senderPhone)
        .limit(1)
        .maybeSingle();

      if (memberRecord?.user_id) {
        userId = memberRecord.user_id;
      }
    }

    if (!userId) {
      console.warn(`[WhatsApp Webhook] Unmapped sender phone: ${senderPhone}. Rejecting to prevent cross-tenant corruption.`);
      if (senderPhone && senderPhone !== "test_user") {
        await sendWhatsAppTextMessage({
          phoneNumberId,
          to: senderPhone,
          message:
            "Your WhatsApp number is not linked to an active ArthaX account. Please configure your phone number in ArthaX Settings.",
        });
      }
      return NextResponse.json({ error: "User resolution failed. Phone not linked." }, { status: 403 });
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
      .select("id, name, type, balance, last_four, classification")
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
    // 7. Insert Expense via ATOMIC RPC (Row-locked balance deduction & audit log)
    // -------------------------------------------------------------
    const expenseDate = getLocalDateString(new Date(), "Asia/Kolkata");
    const notesContent = messageId
      ? `Automated via WhatsApp [${messageId}] ("${messageText}")`
      : `Automated via WhatsApp ("${messageText}")`;

    const { data: rpcResult, error: rpcErr } = await supabaseAdmin.rpc("fn_record_expense_atomic", {
      p_user_id: userId,
      p_title: parsed.title,
      p_amount: parsed.amount,
      p_category: parsed.category,
      p_account_id: targetAccount?.id || null,
      p_expense_date: expenseDate,
      p_notes: notesContent,
      p_tags: ["whatsapp", "automated"],
    });

    if (rpcErr) {
      console.error("[WhatsApp Webhook] Atomic expense creation failed:", rpcErr);
      return NextResponse.json({ error: "Failed to record expense", details: rpcErr.message }, { status: 500 });
    }

    const updatedBalance = rpcResult?.new_balance ?? 0;
    const accountName = rpcResult?.account_name || (targetAccount ? targetAccount.name : "None (Unassigned)");

    // -------------------------------------------------------------
    // 8. Invalidate Multi-Tier Redis Caches
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
      console.warn("[WhatsApp Webhook] Redis cache invalidation warning:", cErr);
    }

    // -------------------------------------------------------------
    // 9. Format Confirmation Message & Reply to WhatsApp
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
      `*Account:* ${accountName}\n` +
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
        expense_id: rpcResult?.expense_id,
        deducted_account: accountName,
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
