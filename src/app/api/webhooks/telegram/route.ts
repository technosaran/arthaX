import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { parseExpenseMessage, matchAccount, AccountSummary } from "@/utils/expenseParser";
import {
  sendTelegramMessage,
  verifyTelegramSecret,
  formatExpenseConfirmation,
  formatBalanceSummary,
  formatRecentExpenses,
  formatSpendingSummary,
  formatWelcomeMessage,
  formatHelpMessage,
  getTelegramWebhookInfo,
} from "@/utils/telegram";
import { invalidateCachedData, getUserCacheKey, CACHE_KEYS } from "@/utils/redis";
import { getLocalDateString, getCurrentMonthYear } from "@/utils/monthUtils";
import { generateFinancialAnswer } from "@/utils/gemini";

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    date: number;
    text?: string;
    chat: {
      id: number | string;
      type: string;
      first_name?: string;
      username?: string;
    };
    from?: {
      id: number | string;
      first_name?: string;
      last_name?: string;
      username?: string;
    };
  };
  edited_message?: TelegramUpdate["message"];
  callback_query?: {
    id: string;
    data?: string;
    from: {
      id: number | string;
      first_name?: string;
      username?: string;
    };
    message?: TelegramUpdate["message"];
  };
}

/**
 * Diagnostic & Health Check Endpoint (GET)
 * Verifies if Telegram Bot credentials and webhooks are active.
 */
export async function GET() {
  const isConfigured = Boolean(process.env.TELEGRAM_BOT_TOKEN);
  const botUsername = process.env.TELEGRAM_BOT_USERNAME || "Artha_X_bot";

  if (!isConfigured) {
    return NextResponse.json({
      status: "unconfigured",
      configured: false,
      message: "TELEGRAM_BOT_TOKEN is not set in environment variables.",
      bot_username: botUsername,
    });
  }

  const webhookInfo = await getTelegramWebhookInfo();

  return NextResponse.json({
    status: "ok",
    configured: true,
    bot_username: botUsername,
    webhook: webhookInfo.success ? webhookInfo.info : { error: webhookInfo.error },
  });
}

/**
 * Telegram Webhook Handler (POST)
 * Receives incoming messages and commands from Telegram Bot API,
 * resolves user multi-tenancy, handles bot commands, records expenses atomically,
 * and replies instantly with formatted financial telemetry.
 */
export async function POST(req: NextRequest) {
  try {
    // -------------------------------------------------------------
    // 1. Authenticate Request via Secret Token
    // -------------------------------------------------------------
    const secretHeader = req.headers.get("x-telegram-bot-api-secret-token");
    if (!verifyTelegramSecret(secretHeader)) {
      console.warn("[Telegram Webhook] Invalid secret token detected.");
      return NextResponse.json({ error: "Unauthorized: Invalid secret token" }, { status: 401 });
    }

    let update: TelegramUpdate;
    try {
      update = (await req.json()) as TelegramUpdate;
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    // Support standard message, edited message, or callback query
    const message = update.message || update.edited_message || update.callback_query?.message;
    const text = (message?.text || update.callback_query?.data || "").trim();
    const chatId = message?.chat?.id || update.callback_query?.from?.id;
    const senderUsername = message?.from?.username || update.callback_query?.from?.username || "";
    const senderFirstName = message?.from?.first_name || update.callback_query?.from?.first_name || "Friend";
    const messageId = message?.message_id;

    if (!chatId || !text) {
      return NextResponse.json({ status: "acknowledged_non_text_or_empty" });
    }

    const chatIdStr = String(chatId);
    const botUsername = process.env.TELEGRAM_BOT_USERNAME || "Artha_X_bot";

    // -------------------------------------------------------------
    // 2. Resolve User ID from Database
    // -------------------------------------------------------------
    let userId: string | null = null;
    let userName = senderFirstName;

    // Check user_settings by telegram_chat_id
    const { data: userRecord } = await supabaseAdmin
      .from("user_settings")
      .select("id, name, telegram_chat_id, telegram_username")
      .eq("telegram_chat_id", chatIdStr)
      .limit(1)
      .maybeSingle();

    if (userRecord?.id) {
      userId = userRecord.id;
      userName = userRecord.name || userName;
    }

    // Check family_members by telegram_chat_id if not found in primary user_settings
    if (!userId) {
      const { data: familyMember } = await supabaseAdmin
        .from("family_members")
        .select("user_id, name")
        .eq("telegram_chat_id", chatIdStr)
        .limit(1)
        .maybeSingle();

      if (familyMember?.user_id) {
        userId = familyMember.user_id;
        userName = familyMember.name || userName;
      }
    }

    // Optional environment fallback for single-tenant instances
    if (!userId) {
      userId = process.env.TELEGRAM_AUTHORIZED_USER_ID || process.env.WHATSAPP_AUTHORIZED_USER_ID || null;
    }

    // -------------------------------------------------------------
    // 3. Handle Linking Commands (/link <token> or /start <token>)
    // -------------------------------------------------------------
    const isStartCommand = text.startsWith("/start");
    const isLinkCommand = text.startsWith("/link");

    if (isStartCommand || isLinkCommand) {
      const parts = text.split(/\s+/);
      const linkCandidate = parts[1]?.trim();

      if (linkCandidate) {
        // Attempt linking with user_settings via link token or user ID
        const { data: targetUser } = await supabaseAdmin
          .from("user_settings")
          .select("id, name, telegram_link_token")
          .or(`telegram_link_token.eq.${linkCandidate},id.eq.${linkCandidate}`)
          .limit(1)
          .maybeSingle();

        if (targetUser?.id) {
          await supabaseAdmin
            .from("user_settings")
            .update({
              telegram_chat_id: chatIdStr,
              telegram_username: senderUsername || null,
              telegram_linked_at: new Date().toISOString(),
              telegram_link_token: null, // Consume one-time token if used
            })
            .eq("id", targetUser.id);

          try {
            await invalidateCachedData([getUserCacheKey(targetUser.id, CACHE_KEYS.PORTFOLIO)]);
          } catch {}

          await sendTelegramMessage({
            chatId,
            text:
              `🎉 <b>arthaX Account Successfully Linked!</b>\n\n` +
              `Welcome <b>${targetUser.name || "User"}</b>. Your Telegram chat is now connected to your arthaX workspace.\n\n` +
              `<b>Try logging an expense:</b>\n` +
              `• <code>Dinner 500 HDFC</code>\n` +
              `• <code>Petrol 1200 Cash</code>\n` +
              `• <code>Uber 320</code>\n` +
              `• Or paste/forward your bank transaction SMS!\n\n` +
              `Type /help to see all commands & features.`,
          });

          return NextResponse.json({ success: true, linked: true, user_id: targetUser.id });
        } else {
          await sendTelegramMessage({
            chatId,
            text:
              `❌ <b>Invalid or Expired Link Code</b>\n\n` +
              `We couldn't find an arthaX account matching <code>${linkCandidate}</code>.\n\n` +
              `Please open <b>arthaX &gt; Settings &gt; Integrations &gt; Telegram</b> to view or generate your link code.`,
          });
          return NextResponse.json({ success: false, error: "Invalid link code" });
        }
      }
    }

    // -------------------------------------------------------------
    // 4. Handle Unlinked Users
    // -------------------------------------------------------------
    if (!userId) {
      if (text === "/help") {
        await sendTelegramMessage({
          chatId,
          text: formatHelpMessage(botUsername),
        });
        return NextResponse.json({ status: "help_sent_unlinked" });
      }

      await sendTelegramMessage({
        chatId,
        text: formatWelcomeMessage({
          botUsername,
          isLinked: false,
          userName: senderFirstName,
        }),
      });

      return NextResponse.json({
        status: "unlinked_instructions_sent",
        chat_id: chatIdStr,
      });
    }

    // -------------------------------------------------------------
    // 5. Handle Authenticated Commands
    // -------------------------------------------------------------

    // /start (already linked)
    if (text === "/start") {
      await sendTelegramMessage({
        chatId,
        text: formatWelcomeMessage({
          botUsername,
          isLinked: true,
          userName,
        }),
      });
      return NextResponse.json({ status: "start_greeted" });
    }

    // /help
    if (text === "/help") {
      await sendTelegramMessage({
        chatId,
        text: formatHelpMessage(botUsername),
      });
      return NextResponse.json({ status: "help_sent" });
    }

    // /unlink
    if (text === "/unlink") {
      await supabaseAdmin
        .from("user_settings")
        .update({
          telegram_chat_id: null,
          telegram_username: null,
        })
        .eq("id", userId);

      await supabaseAdmin
        .from("family_members")
        .update({
          telegram_chat_id: null,
          telegram_username: null,
        })
        .eq("telegram_chat_id", chatIdStr);

      await sendTelegramMessage({
        chatId,
        text:
          `👋 <b>Telegram Disconnected</b>\n\n` +
          `Your Telegram chat has been unlinked from arthaX. You can re-link at any time using <code>/link &lt;token&gt;</code>.`,
      });

      return NextResponse.json({ status: "unlinked_successfully" });
    }

    // /balance or /accounts
    if (text === "/balance" || text === "/accounts") {
      const { data: accounts } = await supabaseAdmin
        .from("accounts")
        .select("name, type, balance, last_four")
        .eq("user_id", userId)
        .order("balance", { ascending: false });

      await sendTelegramMessage({
        chatId,
        text: formatBalanceSummary(accounts || []),
      });

      return NextResponse.json({ status: "balance_sent" });
    }

    // /recent or /history
    if (text === "/recent" || text === "/history") {
      const { data: expenses } = await supabaseAdmin
        .from("expenses")
        .select("title, amount, category, expense_date, accounts(name)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5);

      const mappedExpenses = (expenses || []).map((e) => {
        const acc = e.accounts as { name?: string } | { name?: string }[] | null;
        const accountName = Array.isArray(acc) ? acc[0]?.name : acc?.name;
        return {
          title: e.title,
          amount: Number(e.amount) || 0,
          category: e.category,
          expense_date: e.expense_date,
          account_name: accountName,
        };
      });

      await sendTelegramMessage({
        chatId,
        text: formatRecentExpenses(mappedExpenses),
      });

      return NextResponse.json({ status: "recent_sent" });
    }

    // /summary or /today
    if (text === "/summary" || text === "/today") {
      const today = getLocalDateString(new Date(), "Asia/Kolkata");
      const currentMonth = getCurrentMonthYear();
      const monthStart = `${currentMonth}-01`;

      const { data: monthExpenses } = await supabaseAdmin
        .from("expenses")
        .select("amount, category, expense_date")
        .eq("user_id", userId)
        .gte("expense_date", monthStart)
        .lte("expense_date", today);

      let todayTotal = 0;
      let monthTotal = 0;
      const categoryTotals: Record<string, number> = {};

      (monthExpenses || []).forEach((e) => {
        const amt = Number(e.amount) || 0;
        monthTotal += amt;
        if (e.expense_date === today) {
          todayTotal += amt;
        }
        categoryTotals[e.category] = (categoryTotals[e.category] || 0) + amt;
      });

      let topCategory = "";
      let topCategoryAmt = 0;
      for (const [cat, amt] of Object.entries(categoryTotals)) {
        if (amt > topCategoryAmt) {
          topCategoryAmt = amt;
          topCategory = cat;
        }
      }

      await sendTelegramMessage({
        chatId,
        text: formatSpendingSummary({
          todayTotal,
          monthTotal,
          expenseCount: monthExpenses?.length || 0,
          topCategory,
        }),
      });

      return NextResponse.json({ status: "summary_sent" });
    }

    // /ai <query> or /ask <query>
    if (text.startsWith("/ai") || text.startsWith("/ask")) {
      const queryPrompt = text.replace(/^\/(?:ai|ask)\s*/i, "").trim();
      if (!queryPrompt) {
        await sendTelegramMessage({
          chatId,
          text: `🤖 <b>arthaX AI Assistant</b>\n\nAsk me anything about your finances or money management:\n• <code>/ai How can I save 20% on groceries?</code>\n• <code>/ai Explain debt avalanche vs snowball</code>\n• <code>/ai How to start an emergency fund?</code>`,
        });
        return NextResponse.json({ status: "ai_help_prompted" });
      }

      const { data: accounts } = await supabaseAdmin
        .from("accounts")
        .select("name, balance, type")
        .eq("user_id", userId);

      const geminiRes = await generateFinancialAnswer({
        prompt: queryPrompt,
        userName,
        accountsSummary: (accounts || []).map((a) => ({
          name: a.name,
          balance: Number(a.balance) || 0,
          type: a.type,
        })),
      });

      if (geminiRes.success && geminiRes.text) {
        await sendTelegramMessage({
          chatId,
          text: `💡 <b>arthaX AI</b>\n\n${geminiRes.text}`,
        });
        return NextResponse.json({ success: true, status: "ai_answered", response: geminiRes.text });
      } else {
        await sendTelegramMessage({
          chatId,
          text: `⚠️ <i>AI service temporarily unavailable. Please try again shortly.</i>`,
        });
        return NextResponse.json({ success: false, error: geminiRes.error });
      }
    }

    // -------------------------------------------------------------
    // 6. Natural Language Expense & Bank SMS Debit Parsing
    // -------------------------------------------------------------

    // Idempotency check: prevent duplicate insertion on webhook retries
    const idempotencyTag = messageId ? `[telegram_${messageId}]` : null;
    if (idempotencyTag) {
      const { data: existingExpense } = await supabaseAdmin
        .from("expenses")
        .select("id, title, amount")
        .ilike("notes", `%${idempotencyTag}%`)
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

    // Fetch user's active accounts
    const { data: accounts, error: accErr } = await supabaseAdmin
      .from("accounts")
      .select("id, name, type, balance, last_four")
      .eq("user_id", userId);

    if (accErr) {
      console.error("[Telegram Webhook] Error fetching accounts:", accErr);
    }

    const userAccounts: AccountSummary[] = (accounts || []).map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      balance: Number(a.balance) || 0,
      last_four: a.last_four,
    }));

    // Parse expense from natural text or bank SMS
    const parsed = parseExpenseMessage(text, userAccounts);

    if (!parsed.amount || parsed.amount <= 0) {
      // If Gemini AI is configured, generate an intelligent conversational/financial answer
      if (process.env.GEMINI_API_KEY) {
        const geminiRes = await generateFinancialAnswer({
          prompt: text,
          userName,
          accountsSummary: userAccounts.map((a) => ({
            name: a.name,
            balance: a.balance,
            type: a.type,
          })),
        });

        if (geminiRes.success && geminiRes.text) {
          await sendTelegramMessage({
            chatId,
            text: `💡 <b>arthaX AI</b>\n\n${geminiRes.text}`,
          });

          return NextResponse.json({
            success: true,
            status: "ai_answered",
            response: geminiRes.text,
          });
        }
      }

      await sendTelegramMessage({
        chatId,
        text:
          `❓ <b>Could not recognize an expense amount</b>\n\n` +
          `Message received: <i>"${text}"</i>\n\n` +
          `<b>Try formats like:</b>\n` +
          `• <code>Dinner 500 HDFC</code>\n` +
          `• <code>Petrol 1200 Cash</code>\n` +
          `• <code>Groceries 450 SBI</code>\n` +
          `• <code>Uber 320</code>\n` +
          `• Or forward your bank SMS debit notification!`,
      });

      return NextResponse.json({
        success: false,
        message: "No valid amount parsed",
        sample_format: "Dinner 500 HDFC",
      });
    }

    // Match target account
    const targetAccount = matchAccount(parsed.accountQuery, userAccounts);

    // Record expense via Atomic RPC
    const expenseDate = getLocalDateString(new Date(), "Asia/Kolkata");
    const notesContent = idempotencyTag
      ? `Automated via Telegram ${idempotencyTag} ("${text}")`
      : `Automated via Telegram ("${text}")`;

    const { data: rpcResult, error: rpcErr } = await supabaseAdmin.rpc("fn_record_expense_atomic", {
      p_user_id: userId,
      p_title: parsed.title,
      p_amount: parsed.amount,
      p_category: parsed.category,
      p_account_id: targetAccount?.id || null,
      p_expense_date: expenseDate,
      p_notes: notesContent,
      p_tags: ["telegram", "automated"],
    });

    if (rpcErr) {
      console.error("[Telegram Webhook] Atomic expense creation failed:", rpcErr);
      await sendTelegramMessage({
        chatId,
        text: `⚠️ <b>Error recording expense:</b> ${rpcErr.message}`,
      });
      return NextResponse.json({ error: "Failed to record expense", details: rpcErr.message }, { status: 500 });
    }

    const updatedBalance = rpcResult?.new_balance ?? 0;
    const accountName = rpcResult?.account_name || (targetAccount ? targetAccount.name : "None (Unassigned)");

    // Invalidate Redis caches
    try {
      await invalidateCachedData([
        getUserCacheKey(userId, CACHE_KEYS.EXPENSES),
        getUserCacheKey(userId, CACHE_KEYS.ACCOUNTS),
        getUserCacheKey(userId, CACHE_KEYS.PORTFOLIO),
        getUserCacheKey(userId, CACHE_KEYS.LEDGER),
        getUserCacheKey(userId, CACHE_KEYS.BUDGETS),
      ]);
    } catch (cErr) {
      console.warn("[Telegram Webhook] Redis cache invalidation warning:", cErr);
    }

    // Reply confirmation via Telegram
    const confirmationText = formatExpenseConfirmation({
      amount: parsed.amount,
      category: parsed.category,
      title: parsed.title,
      accountName,
      newBalance: targetAccount ? updatedBalance : undefined,
    });

    await sendTelegramMessage({
      chatId,
      text: confirmationText,
    });

    return NextResponse.json({
      success: true,
      data: {
        expense_id: rpcResult?.expense_id,
        deducted_account: accountName,
        new_balance: updatedBalance,
        confirmation_sent: true,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[Telegram Webhook] Error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
