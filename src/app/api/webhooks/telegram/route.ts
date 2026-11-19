import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { matchAccount, AccountSummary } from "@/utils/expenseParser";
import { classifyFinancialMessage } from "@/utils/financeParser";
import {
  sendTelegramMessage,
  sendTelegramPhoto,
  getQuickChartSpendingUrl,
  verifyTelegramSecret,
  escapeTelegramHtml,
  answerTelegramCallbackQuery,
  formatExpenseConfirmation,
  formatIncomeConfirmation,
  formatTransferConfirmation,
  formatBalanceSummary,
  formatRecentExpenses,
  formatSpendingSummary,
  formatBudgetSummary,
  formatBudgetSetConfirmation,
  formatUndoConfirmation,
  formatWelcomeMessage,
  formatHelpMessage,
  formatStatusMessage,
  formatPortfolioOverview,
  formatStocksSummary,
  formatStockQuote,
  formatStockAddConfirmation,
  formatMutualFundsSummary,
  formatBullionSummary,
  getStandardInlineKeyboard,
  getExpenseActionKeyboard,
  getIncomeActionKeyboard,
  getUnlinkedInlineKeyboard,
  getTelegramWebhookInfo,
  extractTelegramLinkCandidate,
  normalizeLinkTokenCandidates,
  formatCurrencyINR,
  getTelegramFileBuffer,
  getAmbiguousExpenseKeyboard,
} from "@/utils/telegram";
import { invalidateCachedData, getUserCacheKey, CACHE_KEYS } from "@/utils/redis";
import { getLocalDateString, getCurrentMonthYear, formatMonthDisplay } from "@/utils/monthUtils";
import { generateFinancialAnswer, parseFinancialInputWithGemini, ParsedFinancialAI } from "@/utils/gemini";
import { fetchStockQuote } from "@/app/api/v1/stocks/quote/route";
import { rateLimit, checkAndSetIdempotency } from "@/utils/rateLimit";
import { logger } from "@/utils/logger";

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    date: number;
    text?: string;
    caption?: string;
    photo?: Array<{
      file_id: string;
      file_unique_id: string;
      width: number;
      height: number;
      file_size?: number;
    }>;
    voice?: {
      file_id: string;
      file_unique_id: string;
      duration: number;
      mime_type?: string;
      file_size?: number;
    };
    audio?: {
      file_id: string;
      file_unique_id: string;
      duration: number;
      mime_type?: string;
      file_size?: number;
      title?: string;
    };
    document?: {
      file_id: string;
      file_unique_id: string;
      file_name?: string;
      mime_type?: string;
      file_size?: number;
    };
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
 * High-Performance Multi-Tenant Telegram Bot Webhook (POST)
 * Supports all financial actions: Expenses, Income, Transfers, Budgets, Balances,
 * Visual Charts, Stocks, Net Worth, Mutual Funds, Bullion, Undo, Status, and Gemini AI (Voice, Photos, Text).
 */
export async function POST(req: NextRequest) {
  try {
    // -------------------------------------------------------------
    // 1. Authenticate Request via Secret Token
    // -------------------------------------------------------------
    const secretHeader = req.headers.get("x-telegram-bot-api-secret-token");
    if (!verifyTelegramSecret(secretHeader)) {
      logger.warn("[Telegram Webhook] Invalid secret token detected.");
      return NextResponse.json({ error: "Unauthorized: Invalid secret token" }, { status: 401 });
    }

    let update: TelegramUpdate;
    try {
      update = (await req.json()) as TelegramUpdate;
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const isCallback = Boolean(update.callback_query);
    const callbackId = update.callback_query?.id;
    const message = update.message || update.edited_message || update.callback_query?.message;

    const voiceObj = message?.voice;
    const audioObj = message?.audio;
    const photoArray = message?.photo;
    const documentObj = message?.document;
    const hasMedia = Boolean(voiceObj || audioObj || (photoArray && photoArray.length > 0) || documentObj);

    const captionText = message?.caption || "";
    let rawText = (update.callback_query?.data || message?.text || captionText).trim();
    const chatId = message?.chat?.id || update.callback_query?.from?.id;
    const senderUsername = message?.from?.username || update.callback_query?.from?.username || "";
    const senderFirstName = message?.from?.first_name || update.callback_query?.from?.first_name || "Friend";
    const messageId = message?.message_id;

    if (!chatId || (!rawText && !hasMedia)) {
      return NextResponse.json({ status: "acknowledged_empty" });
    }

    const chatIdStr = String(chatId);
    const botUsername = process.env.TELEGRAM_BOT_USERNAME || "Artha_X_bot";
    const webAppUrl = process.env.NEXT_PUBLIC_APP_URL || "https://arthax.vercel.app";

    // Deduplicate updates to prevent double processing
    if (update.update_id) {
      const isFresh = await checkAndSetIdempotency(`tg_update:${update.update_id}`, 600);
      if (!isFresh) {
        return NextResponse.json({ status: "duplicate_update_ignored" });
      }
    }

    // Rate limiting per chat: 45 messages per minute
    const rl = await rateLimit(`tg_chat:${chatIdStr}`, 45, 60);
    if (!rl.success) {
      await sendTelegramMessage({
        chatId,
        text: "⚠️ <i>You are sending messages too quickly. Please pause for a moment.</i>",
      });
      return NextResponse.json({ status: "rate_limited" }, { status: 429 });
    }

    if (isCallback && callbackId) {
      await answerTelegramCallbackQuery(callbackId);
    }

    // -------------------------------------------------------------
    // 2. Strict Multi-Tenant User Resolution (Zero Cross-Talk)
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

    // Check family_members by telegram_chat_id
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

    // -------------------------------------------------------------
    // 3. Pairing & Linking Commands (/link, /start, loose tokens, email, or TELEGRAM_AUTHORIZED_USER_ID)
    // -------------------------------------------------------------
    const linkCandidate = extractTelegramLinkCandidate(rawText);

    if (linkCandidate || (!userId && (rawText.startsWith("/start") || rawText === "start"))) {
      let matchedUserId: string | null = null;
      let matchedUserName: string = "User";

      if (linkCandidate) {
        const tokenCandidates = normalizeLinkTokenCandidates(linkCandidate);

        // A. Match strictly by secure Link Token in user_settings (Prevents Account Takeover)
        const { data: targetUser } = await supabaseAdmin
          .from("user_settings")
          .select("id, name, telegram_link_token")
          .in("telegram_link_token", tokenCandidates)
          .limit(1)
          .maybeSingle();

        if (targetUser?.id) {
          matchedUserId = targetUser.id;
          matchedUserName = targetUser.name || "User";
        }
      }

      // Single-User / Owner Fallback via TELEGRAM_AUTHORIZED_USER_ID on /start
      if (!matchedUserId && !userId && (rawText === "/start" || rawText === "start")) {
        const authUserId = process.env.TELEGRAM_AUTHORIZED_USER_ID;
        if (authUserId) {
          const { data: authUser } = await supabaseAdmin
            .from("user_settings")
            .select("id, name")
            .eq("id", authUserId)
            .limit(1)
            .maybeSingle();

          if (authUser?.id) {
            matchedUserId = authUser.id;
            matchedUserName = authUser.name || "Owner";
          }
        }
      }

      if (matchedUserId) {
        // Bind Telegram Chat ID to the matching user
        await supabaseAdmin
          .from("user_settings")
          .update({
            telegram_chat_id: chatIdStr,
            telegram_username: senderUsername || null,
            telegram_linked_at: new Date().toISOString(),
            telegram_link_token: null, // Consume one-time token
            updated_at: new Date().toISOString(),
          })
          .eq("id", matchedUserId);

        try {
          await invalidateCachedData([
            getUserCacheKey(matchedUserId, CACHE_KEYS.PORTFOLIO),
            getUserCacheKey(matchedUserId, CACHE_KEYS.ACCOUNTS),
            getUserCacheKey(matchedUserId, CACHE_KEYS.SETTINGS),
          ]);
        } catch {}

        logger.info(`Telegram chat ${chatIdStr} linked to user ${matchedUserId}`, "TelegramBot");

        await sendTelegramMessage({
          chatId,
          text:
            `🎉 <b>arthaX Workspace Successfully Connected!</b>\n\n` +
            `Welcome <b>${escapeTelegramHtml(matchedUserName)}</b>. Your Telegram chat is now paired.\n\n` +
            `<b>You can perform all actions directly from this chat:</b>\n` +
            `• 🎙️ <b>Voice:</b> Send a voice note to log transactions, check balances, or check investments.\n` +
            `• 📸 <b>Photos:</b> Send receipts, bills, or UPI payment screenshots to scan & log.\n` +
            `• 💳 <b>Balances:</b> <code>/balance</code> or ask "what is my balance?"\n` +
            `• 📈 <b>Charts:</b> <code>/chart</code> to get an instant visual breakdown image\n` +
            `• 💼 <b>Portfolio:</b> <code>/portfolio</code> for total net worth\n` +
            `• 💹 <b>Stocks:</b> <code>/stocks</code> or <code>/quote RELIANCE</code>\n` +
            `• 🎯 <b>Budgets:</b> <code>/budget</code> or <code>/setbudget Food 5000</code>\n` +
            `• 💰 <b>Transactions:</b> <code>Dinner 500 HDFC</code> or <code>Salary 85000 HDFC</code>\n\n` +
            `Tap the quick actions below to explore:`,
          replyMarkup: getStandardInlineKeyboard(webAppUrl),
        });

        return NextResponse.json({ success: true, linked: true, user_id: matchedUserId });
      } else if (linkCandidate) {
        await sendTelegramMessage({
          chatId,
          text:
            `❌ <b>Invalid Link Code</b>\n\n` +
            `We couldn't find an arthaX account matching <code>${escapeTelegramHtml(linkCandidate)}</code>.\n\n` +
            `Open <b>arthaX &gt; Settings &gt; Integrations &gt; Telegram</b> to view your 6-character code or click the one-click connect button.`,
          replyMarkup: getUnlinkedInlineKeyboard(webAppUrl),
        });
        return NextResponse.json({ success: false, error: "Invalid link code" });
      }
    }

    // -------------------------------------------------------------
    // 4. Handle Unlinked Users (Strict Multi-Tenant Protection)
    // -------------------------------------------------------------
    if (!userId) {
      if (rawText === "/help" || rawText === "help") {
        await sendTelegramMessage({
          chatId,
          text: formatHelpMessage(botUsername),
          replyMarkup: getUnlinkedInlineKeyboard(webAppUrl),
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
        replyMarkup: getUnlinkedInlineKeyboard(webAppUrl),
      });

      return NextResponse.json({
        status: "unlinked_instructions_sent",
        chat_id: chatIdStr,
      });
    }

    // Handle /start or /help for already linked users
    if (rawText === "/start" || rawText === "start" || rawText === "/help" || rawText === "help") {
      await sendTelegramMessage({
        chatId,
        text:
          rawText.includes("help")
            ? formatHelpMessage(botUsername)
            : formatWelcomeMessage({
                botUsername,
                isLinked: true,
                userName,
              }),
        replyMarkup: getStandardInlineKeyboard(webAppUrl),
      });
      return NextResponse.json({ status: "welcome_sent_linked" });
    }

    // Fetch user accounts for context & balance resolution
    const { data: accounts } = await supabaseAdmin
      .from("accounts")
      .select("id, name, type, balance, last_four")
      .eq("user_id", userId);

    const userAccounts: AccountSummary[] = (accounts || []).map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      balance: Number(a.balance) || 0,
      last_four: a.last_four,
    }));

    // -------------------------------------------------------------
    // 5. Interactive Inline Callback Queries (1-Tap Buttons)
    // -------------------------------------------------------------
    if (isCallback && rawText.startsWith("cat:")) {
      const parts = rawText.split(":");
      const expenseId = parts[1];
      const newCategory = parts.slice(2).join(":");

      if (expenseId && newCategory) {
        const { error: updErr } = await supabaseAdmin
          .from("expenses")
          .update({ category: newCategory })
          .eq("id", expenseId)
          .eq("user_id", userId);

        if (!updErr) {
          await invalidateCachedData([
            getUserCacheKey(userId, CACHE_KEYS.EXPENSES),
            getUserCacheKey(userId, CACHE_KEYS.PORTFOLIO),
            getUserCacheKey(userId, CACHE_KEYS.BUDGETS),
          ]);

          await sendTelegramMessage({
            chatId,
            text: `✅ <b>Category Updated!</b>\n\nCategorized under <b>${escapeTelegramHtml(newCategory)}</b>.`,
            replyMarkup: getExpenseActionKeyboard(expenseId),
          });
          return NextResponse.json({ success: true, updated_category: newCategory });
        }
      }
    }

    if (isCallback && rawText.startsWith("undo:")) {
      const parts = rawText.split(":");
      const undoType = parts[1]; // "expense" | "income"
      const targetId = parts[2];

      if (undoType === "expense" && targetId) {
        const { data: delResult, error: delErr } = await supabaseAdmin.rpc("fn_delete_expense_atomic", {
          p_expense_id: targetId,
          p_user_id: userId,
        });

        if (delErr) {
          await sendTelegramMessage({ chatId, text: `⚠️ <b>Could not undo expense:</b> ${delErr.message}` });
          return NextResponse.json({ error: delErr.message });
        }

        await invalidateCachedData([
          getUserCacheKey(userId, CACHE_KEYS.EXPENSES),
          getUserCacheKey(userId, CACHE_KEYS.ACCOUNTS),
          getUserCacheKey(userId, CACHE_KEYS.PORTFOLIO),
          getUserCacheKey(userId, CACHE_KEYS.LEDGER),
          getUserCacheKey(userId, CACHE_KEYS.BUDGETS),
        ]);

        await sendTelegramMessage({
          chatId,
          text: formatUndoConfirmation({
            type: "expense",
            title: delResult?.title || "Expense",
            amount: Number(delResult?.amount) || 0,
            accountName: delResult?.account_name || "Account",
            restoredBalance: delResult?.new_balance,
          }),
        });
        return NextResponse.json({ success: true, undone: "expense" });
      }

      if (undoType === "income" && targetId) {
        const { data: delResult, error: delErr } = await supabaseAdmin.rpc("fn_delete_income_atomic", {
          p_income_id: targetId,
          p_user_id: userId,
        });

        if (delErr) {
          await sendTelegramMessage({ chatId, text: `⚠️ <b>Could not undo income:</b> ${delErr.message}` });
          return NextResponse.json({ error: delErr.message });
        }

        await invalidateCachedData([
          getUserCacheKey(userId, CACHE_KEYS.INCOME),
          getUserCacheKey(userId, CACHE_KEYS.ACCOUNTS),
          getUserCacheKey(userId, CACHE_KEYS.PORTFOLIO),
          getUserCacheKey(userId, CACHE_KEYS.LEDGER),
        ]);

        await sendTelegramMessage({
          chatId,
          text: formatUndoConfirmation({
            type: "income",
            title: delResult?.title || "Income",
            amount: Number(delResult?.amount) || 0,
            accountName: delResult?.account_name || "Account",
            restoredBalance: delResult?.new_balance,
          }),
        });
        return NextResponse.json({ success: true, undone: "income" });
      }
    }

    // -------------------------------------------------------------
    // 6. Multimodal Voice Audio & Photo Parsing (Gemini AI)
    // -------------------------------------------------------------
    let voiceTranscription = "";
    let voicePrefix = "";
    let aiMediaParsed: ParsedFinancialAI | null = null;
    const isAudio = Boolean(voiceObj || audioObj);
    const isPhoto = Boolean(
      (photoArray && photoArray.length > 0) || (documentObj && documentObj.mime_type?.startsWith("image/"))
    );

    if (hasMedia) {
      const fileId =
        voiceObj?.file_id ||
        audioObj?.file_id ||
        photoArray?.[photoArray.length - 1]?.file_id ||
        documentObj?.file_id;

      if (fileId) {
        const fileRes = await getTelegramFileBuffer(fileId);
        if (fileRes) {
          aiMediaParsed = await parseFinancialInputWithGemini({
            text: captionText,
            mediaBase64: fileRes.buffer.toString("base64"),
            mediaMimeType: fileRes.mimeType,
            userName,
            accountsSummary: userAccounts.map((a) => ({ name: a.name, balance: a.balance, type: a.type })),
          });

          if (isAudio && aiMediaParsed?.transcribedText) {
            voiceTranscription = aiMediaParsed.transcribedText;
            voicePrefix = `🎙️ <i>"${escapeTelegramHtml(voiceTranscription)}"</i>\n\n`;
            if (!rawText) {
              rawText = voiceTranscription;
            }
          }

          // Handle Photo of Receipt / Invoice / UPI Payment Screenshot directly
          if (isPhoto && aiMediaParsed) {
            const expenseDate = getLocalDateString(new Date(), "Asia/Kolkata");

            if (aiMediaParsed.intent === "income" && (aiMediaParsed.amount || 0) > 0) {
              // Photo of Payment Received / Salary Slip / Credit Screenshot
              const targetAccount = matchAccount(aiMediaParsed.accountQuery, userAccounts);
              const { data: rpcResult, error: rpcErr } = await supabaseAdmin.rpc("fn_record_income_atomic", {
                p_user_id: userId,
                p_title: aiMediaParsed.title || "Payment Received",
                p_amount: aiMediaParsed.amount,
                p_category: aiMediaParsed.category || "Salary",
                p_frequency: "One-time",
                p_account_id: targetAccount?.id || null,
                p_received_date: expenseDate,
                p_notes: `Scanned from photo (${captionText || "Payment Screenshot"})`,
                p_tags: ["telegram", "photo", "income"],
              });

              if (!rpcErr) {
                await invalidateCachedData([
                  getUserCacheKey(userId, CACHE_KEYS.INCOME),
                  getUserCacheKey(userId, CACHE_KEYS.ACCOUNTS),
                  getUserCacheKey(userId, CACHE_KEYS.PORTFOLIO),
                  getUserCacheKey(userId, CACHE_KEYS.LEDGER),
                ]);

                await sendTelegramMessage({
                  chatId,
                  text:
                    `📸 <b>Payment Received Scanned &amp; Logged!</b>\n\n` +
                    formatIncomeConfirmation({
                      amount: aiMediaParsed.amount!,
                      category: aiMediaParsed.category || "Salary",
                      title: aiMediaParsed.title || "Payment Received",
                      accountName: rpcResult?.account_name || targetAccount?.name || "None",
                      newBalance: rpcResult?.new_balance,
                    }),
                  replyMarkup: getIncomeActionKeyboard(rpcResult?.income_id),
                });
                return NextResponse.json({ success: true, photo_income_id: rpcResult?.income_id });
              }
            } else if ((aiMediaParsed.amount || 0) > 0) {
              // Photo of Receipt / Bill / Debit Screenshot
              const targetAccount = matchAccount(aiMediaParsed.accountQuery, userAccounts);
              const amt = aiMediaParsed.amount!;
              const title = aiMediaParsed.title || "Receipt Scan";
              const category = aiMediaParsed.category || "Other & Contingency";

              const { data: rpcResult, error: rpcErr } = await supabaseAdmin.rpc("fn_record_expense_atomic", {
                p_user_id: userId,
                p_title: title,
                p_amount: amt,
                p_category: category,
                p_account_id: targetAccount?.id || null,
                p_expense_date: expenseDate,
                p_notes: `🧾 Receipt Photo Scan${captionText ? ` ("${captionText}")` : ""}`,
                p_tags: ["telegram", "receipt", "photo"],
              });

              if (!rpcErr) {
                await invalidateCachedData([
                  getUserCacheKey(userId, CACHE_KEYS.EXPENSES),
                  getUserCacheKey(userId, CACHE_KEYS.ACCOUNTS),
                  getUserCacheKey(userId, CACHE_KEYS.PORTFOLIO),
                  getUserCacheKey(userId, CACHE_KEYS.LEDGER),
                  getUserCacheKey(userId, CACHE_KEYS.BUDGETS),
                ]);

                await sendTelegramMessage({
                  chatId,
                  text:
                    `🧾 <b>Receipt Scanned &amp; Logged!</b>\n\n` +
                    formatExpenseConfirmation({
                      amount: amt,
                      category,
                      title,
                      accountName: rpcResult?.account_name || targetAccount?.name || "None",
                      newBalance: targetAccount ? rpcResult?.new_balance : undefined,
                    }),
                  replyMarkup: getExpenseActionKeyboard(rpcResult?.expense_id),
                });
                return NextResponse.json({ success: true, expense_id: rpcResult?.expense_id });
              }
            }
          }
        }
      }
    }

    // -------------------------------------------------------------
    // 7. Route Voice Intents or Text Commands to Unified Handlers
    // -------------------------------------------------------------
    const intentHint = aiMediaParsed?.intent;

    // A. Chart Action (/chart, "spending chart", voice "show my chart", or action:chart)
    const isChartQuery =
      intentHint === "chart_query" ||
      rawText === "/chart" ||
      rawText === "action:chart" ||
      /^(?:chart|spending chart|pie chart|show chart|view chart|visual breakdown)$/i.test(rawText.trim());

    if (isChartQuery) {
      const currentMonth = getCurrentMonthYear();
      const monthStart = `${currentMonth}-01`;
      const today = getLocalDateString(new Date(), "Asia/Kolkata");
      const monthName = formatMonthDisplay(currentMonth);

      const { data: monthExpenses } = await supabaseAdmin
        .from("expenses")
        .select("amount, category")
        .eq("user_id", userId)
        .gte("expense_date", monthStart)
        .lte("expense_date", today);

      const categoryTotals: Record<string, number> = {};
      let totalSpent = 0;

      (monthExpenses || []).forEach((e) => {
        const amt = Number(e.amount) || 0;
        totalSpent += amt;
        categoryTotals[e.category] = (categoryTotals[e.category] || 0) + amt;
      });

      const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);

      if (sortedCategories.length === 0 || totalSpent === 0) {
        await sendTelegramMessage({
          chatId,
          text:
            `${voicePrefix}📊 <b>No expenses recorded for ${escapeTelegramHtml(monthName)} yet!</b>\n\n` +
            `Start logging expenses by voice, photo, or text (e.g. <code>Dinner 450 HDFC</code>) to generate your visual spending chart.`,
          replyMarkup: getStandardInlineKeyboard(webAppUrl),
        });
        return NextResponse.json({ status: "chart_empty" });
      }

      const categories = sortedCategories.map((c) => c[0]);
      const amounts = sortedCategories.map((c) => c[1]);
      const chartUrl = getQuickChartSpendingUrl({
        categories,
        amounts,
        title: `Spending: ${monthName}`,
      });

      const topCat = sortedCategories[0];
      const caption =
        `${voicePrefix}📈 <b>Visual Spending Breakdown (${escapeTelegramHtml(monthName)})</b>\n\n` +
        `💰 <b>Total Spent:</b> ${formatCurrencyINR(totalSpent)}\n` +
        `🏆 <b>Top Expense:</b> ${escapeTelegramHtml(topCat[0])} (${formatCurrencyINR(topCat[1])})\n` +
        `🧾 <b>Transactions:</b> ${monthExpenses?.length || 0}\n\n` +
        `<i>⚡ Real-time analytics from your arthaX ledger</i>`;

      const photoRes = await sendTelegramPhoto({
        chatId,
        photo: chartUrl,
        caption,
        replyMarkup: getStandardInlineKeyboard(webAppUrl),
      });

      if (!photoRes.success) {
        const lines = sortedCategories.slice(0, 6).map(([cat, amt]) => {
          const pct = Math.round((amt / totalSpent) * 100);
          return `• <b>${escapeTelegramHtml(cat)}</b>: ${formatCurrencyINR(amt)} (${pct}%)`;
        });
        await sendTelegramMessage({
          chatId,
          text: `${caption}\n\n<b>Top Categories:</b>\n` + lines.join("\n"),
          replyMarkup: getStandardInlineKeyboard(webAppUrl),
        });
      }

      return NextResponse.json({ success: true, status: "chart_sent" });
    }

    // B. Total Net Worth & Portfolio Overview (/portfolio, /networth, voice, or action:portfolio)
    const isPortfolioQuery =
      intentHint === "portfolio_query" ||
      rawText === "/portfolio" ||
      rawText === "/networth" ||
      rawText === "action:portfolio" ||
      /^(?:portfolio|net worth|my net worth|total assets|wealth summary)$/i.test(rawText.trim());

    if (isPortfolioQuery) {
      const [accountsRes, stocksRes, mfRes, bullionRes] = await Promise.all([
        supabaseAdmin.from("accounts").select("balance").eq("user_id", userId),
        supabaseAdmin.from("stock_holdings").select("quantity, avg_buy_price").eq("user_id", userId),
        supabaseAdmin.from("mutual_fund_holdings").select("invested_amount, units, current_nav, avg_nav").eq("user_id", userId),
        supabaseAdmin.from("bullion_holdings").select("total_buy_price, weight_grams, metal").eq("user_id", userId),
      ]);

      const accountsTotal = (accountsRes.data || []).reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
      const stocksTotal = (stocksRes.data || []).reduce((sum, s) => sum + (Number(s.quantity) * Number(s.avg_buy_price) || 0), 0);
      const mfTotal = (mfRes.data || []).reduce((sum, m) => {
        const val = (Number(m.current_nav) || Number(m.avg_nav) || 0) * Number(m.units);
        return sum + (val > 0 ? val : Number(m.invested_amount) || 0);
      }, 0);
      const bullionTotal = (bullionRes.data || []).reduce((sum, b) => sum + (Number(b.total_buy_price) || 0), 0);
      const netWorth = accountsTotal + stocksTotal + mfTotal + bullionTotal;

      await sendTelegramMessage({
        chatId,
        text: `${voicePrefix}${formatPortfolioOverview({
          accountsTotal,
          stocksTotal,
          mfTotal,
          bullionTotal,
          netWorth,
          userName,
        })}`,
        replyMarkup: getStandardInlineKeyboard(webAppUrl),
      });

      return NextResponse.json({ success: true, status: "portfolio_sent" });
    }

    // C. Stocks Portfolio (/stocks, "my stocks", voice, or action:stocks)
    const isStocksQuery =
      intentHint === "stocks_query" ||
      rawText === "/stocks" ||
      rawText === "/holdings" ||
      rawText === "action:stocks" ||
      /^(?:stocks|my stocks|stock holdings|shares|stock portfolio)$/i.test(rawText.trim());

    if (isStocksQuery) {
      const { data: holdings } = await supabaseAdmin
        .from("stock_holdings")
        .select("symbol, exchange, company_name, quantity, avg_buy_price")
        .eq("user_id", userId)
        .gt("quantity", 0)
        .order("symbol", { ascending: true });

      const stockList = holdings || [];
      let totalInvested = 0;

      const mappedHoldings = stockList.map((s) => {
        const qty = Number(s.quantity) || 0;
        const avg = Number(s.avg_buy_price) || 0;
        const invested = qty * avg;
        totalInvested += invested;
        return {
          symbol: s.symbol,
          exchange: s.exchange || "NSE",
          quantity: qty,
          avg_buy_price: avg,
        };
      });

      await sendTelegramMessage({
        chatId,
        text: `${voicePrefix}${formatStocksSummary({
          holdings: mappedHoldings,
          totalInvested,
          totalCurrent: totalInvested, // baseline
          totalPnl: 0,
          totalPnlPercent: 0,
        })}`,
        replyMarkup: getStandardInlineKeyboard(webAppUrl),
      });

      return NextResponse.json({ success: true, status: "stocks_sent" });
    }

    // D. Live Stock Quote (/quote <symbol>, voice "quote Tata Motors", "price of RELIANCE")
    const quoteMatch = rawText.match(/^\/quote\s+([a-zA-Z0-9_.:]+)$/i) ||
      rawText.match(/^(?:quote|price of|stock price of|ltp of)\s+([a-zA-Z0-9_.:]+)$/i);

    if (quoteMatch || (intentHint === "quote_query" && aiMediaParsed?.symbol)) {
      const targetSymbol = (quoteMatch ? quoteMatch[1] : aiMediaParsed?.symbol) || "";
      const [sym, ex] = targetSymbol.split(":");
      const cleanSym = sym.trim().toUpperCase().replace(/\.(NS|BO)$/, "");
      const exchange: "NSE" | "BSE" = ex && ex.trim().toUpperCase() === "BSE" ? "BSE" : "NSE";

      const quote = await fetchStockQuote(cleanSym, exchange);
      if (!quote || quote.currentPrice === 0) {
        await sendTelegramMessage({
          chatId,
          text:
            `${voicePrefix}⚠️ <b>Quote Not Found:</b> Could not fetch live quote for <code>${escapeTelegramHtml(cleanSym)}:${exchange}</code>.\n\n` +
            `Please check the ticker symbol (e.g. <code>RELIANCE</code>, <code>TCS</code>, <code>INFY</code>, <code>TATAMOTORS</code>).`,
        });
        return NextResponse.json({ success: false, error: "Stock quote not found" });
      }

      await sendTelegramMessage({
        chatId,
        text: `${voicePrefix}${formatStockQuote(quote)}`,
        replyMarkup: getStandardInlineKeyboard(webAppUrl),
      });

      return NextResponse.json({ success: true, status: "quote_sent", symbol: cleanSym });
    }

    // E. Add Stock Holding (/addstock <symbol> <quantity> <price> [exchange])
    const addStockMatch = rawText.match(/^\/addstock\s+([a-zA-Z0-9_.]+)\s+([0-9.]+)\s+([0-9.]+)(?:\s+(NSE|BSE))?$/i);
    if (addStockMatch || (intentHint === "add_stock" && aiMediaParsed?.symbol && (aiMediaParsed?.quantity || 0) > 0 && (aiMediaParsed?.price || 0) > 0)) {
      const sym = (addStockMatch ? addStockMatch[1] : aiMediaParsed?.symbol)!.toUpperCase().trim();
      const qty = addStockMatch ? parseFloat(addStockMatch[2]) : (aiMediaParsed?.quantity || 1);
      const price = addStockMatch ? parseFloat(addStockMatch[3]) : (aiMediaParsed?.price || 0);
      const exchange = ((addStockMatch?.[4] || aiMediaParsed?.exchange || "NSE").toUpperCase() === "BSE" ? "BSE" : "NSE") as "NSE" | "BSE";

      const { data: existing } = await supabaseAdmin
        .from("stock_holdings")
        .select("id, quantity, avg_buy_price")
        .eq("user_id", userId)
        .eq("symbol", sym)
        .eq("exchange", exchange)
        .maybeSingle();

      let holdingId = existing?.id;

      if (existing) {
        const existingQty = Number(existing.quantity) || 0;
        const existingAvg = Number(existing.avg_buy_price) || 0;
        const newQty = existingQty + qty;
        const newAvg = newQty > 0 ? ((existingQty * existingAvg) + (qty * price)) / newQty : price;

        await supabaseAdmin
          .from("stock_holdings")
          .update({
            quantity: newQty,
            avg_buy_price: +newAvg.toFixed(2),
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        const { data: newHolding } = await supabaseAdmin
          .from("stock_holdings")
          .insert({
            user_id: userId,
            symbol: sym,
            exchange,
            company_name: sym,
            quantity: qty,
            avg_buy_price: price,
          })
          .select("id")
          .single();
        holdingId = newHolding?.id;
      }

      if (holdingId) {
        const today = getLocalDateString(new Date(), "Asia/Kolkata");
        await supabaseAdmin.from("stock_transactions").insert({
          user_id: userId,
          holding_id: holdingId,
          symbol: sym,
          exchange,
          type: "BUY",
          quantity: qty,
          price,
          transaction_date: today,
          notes: "Recorded via Telegram",
        });
      }

      await invalidateCachedData([getUserCacheKey(userId, CACHE_KEYS.PORTFOLIO)]);

      await sendTelegramMessage({
        chatId,
        text: `${voicePrefix}${formatStockAddConfirmation({ symbol: sym, quantity: qty, price, exchange })}`,
        replyMarkup: getStandardInlineKeyboard(webAppUrl),
      });

      return NextResponse.json({ success: true, status: "stock_added" });
    }

    // F. Mutual Funds Portfolio (/mf, /mutualfunds, voice, or action:mf)
    const isMfQuery =
      intentHint === "mf_query" ||
      rawText === "/mf" ||
      rawText === "/mutualfunds" ||
      rawText === "action:mf" ||
      /^(?:mutual funds|my mf|mutual fund portfolio|sips|my sips)$/i.test(rawText.trim());

    if (isMfQuery) {
      const { data: holdings } = await supabaseAdmin
        .from("mutual_fund_holdings")
        .select("scheme_name, units, avg_nav, current_nav, invested_amount, is_sip_active, sip_amount")
        .eq("user_id", userId)
        .gt("units", 0)
        .order("invested_amount", { ascending: false });

      const mfList = holdings || [];
      let totalInvested = 0;
      let totalCurrent = 0;

      const mapped = mfList.map((m) => {
        const inv = Number(m.invested_amount) || 0;
        const units = Number(m.units) || 0;
        const nav = Number(m.current_nav) || Number(m.avg_nav) || 0;
        const curVal = units * nav || inv;
        totalInvested += inv;
        totalCurrent += curVal;
        return {
          scheme_name: m.scheme_name,
          units,
          avg_nav: Number(m.avg_nav) || 0,
          current_nav: Number(m.current_nav) || undefined,
          invested_amount: inv,
          is_sip_active: m.is_sip_active,
          sip_amount: Number(m.sip_amount) || 0,
        };
      });

      const totalPnl = totalCurrent - totalInvested;

      await sendTelegramMessage({
        chatId,
        text: `${voicePrefix}${formatMutualFundsSummary({
          holdings: mapped,
          totalInvested,
          totalCurrent,
          totalPnl,
        })}`,
        replyMarkup: getStandardInlineKeyboard(webAppUrl),
      });

      return NextResponse.json({ success: true, status: "mf_sent" });
    }

    // G. Bullion & Precious Metals (/bullion, /gold, /silver, voice, or action:bullion)
    const isBullionQuery =
      intentHint === "bullion_query" ||
      rawText === "/bullion" ||
      rawText === "/gold" ||
      rawText === "/silver" ||
      rawText === "action:bullion" ||
      /^(?:gold|silver|bullion|my gold|my silver|precious metals)$/i.test(rawText.trim());

    if (isBullionQuery) {
      const { data: holdings } = await supabaseAdmin
        .from("bullion_holdings")
        .select("metal, weight_grams, total_buy_price, purity, quantity")
        .eq("user_id", userId);

      let goldGrams = 0;
      let goldValue = 0;
      let silverGrams = 0;
      let silverValue = 0;

      (holdings || []).forEach((b) => {
        const w = (Number(b.weight_grams) || 0) * (Number(b.quantity) || 1);
        const val = Number(b.total_buy_price) || 0;
        if (b.metal === "GOLD") {
          goldGrams += w;
          goldValue += val > 0 ? val : w * 8000;
        } else if (b.metal === "SILVER") {
          silverGrams += w;
          silverValue += val > 0 ? val : w * 95;
        }
      });

      const totalValue = goldValue + silverValue;

      await sendTelegramMessage({
        chatId,
        text: `${voicePrefix}${formatBullionSummary({
          goldGrams,
          goldValue,
          silverGrams,
          silverValue,
          totalValue,
        })}`,
        replyMarkup: getStandardInlineKeyboard(webAppUrl),
      });

      return NextResponse.json({ success: true, status: "bullion_sent" });
    }

    // H. Set / Update Budget (/setbudget <category> <amount>, voice "set food budget to 8000")
    const isSetBudget =
      intentHint === "set_budget" ||
      rawText.startsWith("/setbudget") ||
      /^set\s+budget\s*(?:for)?\s*/i.test(rawText.trim());

    if (isSetBudget) {
      let catInput = aiMediaParsed?.category || "";
      let amt = aiMediaParsed?.amount || 0;

      if (!catInput || amt <= 0) {
        const clean = rawText.replace(/^\/setbudget\s*/i, "").replace(/^set\s+budget\s*(?:for)?\s*/i, "").trim();
        const match = clean.match(/^([a-zA-Z\s&]+?)\s*(?:to|=)?\s*(?:rs\.?|inr|₹)?\s*([0-9]+(?:\.[0-9]+)?)$/i);
        if (match) {
          catInput = match[1].trim();
          amt = parseFloat(match[2]);
        }
      }

      if (!catInput || amt <= 0) {
        await sendTelegramMessage({
          chatId,
          text:
            `${voicePrefix}🎯 <b>Set Category Budget:</b>\n\nUse format: <code>/setbudget &lt;Category&gt; &lt;Amount&gt;</code>\n\n` +
            `<b>Examples:</b>\n` +
            `• <code>/setbudget Food 8000</code>\n` +
            `• <code>/setbudget Shopping 5000</code>\n` +
            `• <code>/setbudget Transport 3000</code>`,
        });
        return NextResponse.json({ status: "setbudget_prompted" });
      }

      const standardCategories = [
        "Food & Dining",
        "Groceries & Essentials",
        "Transport & Fuel",
        "Utilities & Bills",
        "Housing & Rent",
        "Shopping & Lifestyle",
        "Electronics & Gadgets",
        "Health & Medical",
        "Fitness & Sports",
        "Entertainment & OTT",
        "Subscriptions & SaaS",
        "Personal Care & Grooming",
        "Education & Learning",
        "Vehicle & Servicing",
        "Investments & Wealth",
        "Family & Child Care",
        "Gifts & Celebrations",
        "Other & Contingency",
      ];

      const resolvedCat = standardCategories.find((c) => c.toLowerCase().includes(catInput.toLowerCase())) || catInput;
      const currentMonth = getCurrentMonthYear();
      const monthName = formatMonthDisplay(currentMonth);

      const { data: existing } = await supabaseAdmin
        .from("budgets")
        .select("id")
        .eq("user_id", userId)
        .eq("category", resolvedCat)
        .eq("month_year", currentMonth)
        .maybeSingle();

      if (existing?.id) {
        await supabaseAdmin.from("budgets").update({ amount: amt }).eq("id", existing.id);
      } else {
        await supabaseAdmin.from("budgets").insert({
          user_id: userId,
          category: resolvedCat,
          amount: amt,
          month_year: currentMonth,
          period: "monthly",
          alert_threshold: 80,
        });
      }

      await invalidateCachedData([getUserCacheKey(userId, CACHE_KEYS.BUDGETS)]);

      await sendTelegramMessage({
        chatId,
        text: `${voicePrefix}${formatBudgetSetConfirmation({ category: resolvedCat, amount: amt, monthName })}`,
        replyMarkup: getStandardInlineKeyboard(webAppUrl),
      });

      return NextResponse.json({ success: true, status: "budget_set", category: resolvedCat, amount: amt });
    }

    // I. Undo Last Transaction (/undo, "undo", "cancel last", voice "undo last transaction")
    const isUndo =
      intentHint === "undo" ||
      rawText === "/undo" ||
      /^(undo|cancel last|delete last|remove last|undo last)$/i.test(rawText.trim());

    if (isUndo) {
      const { data: latestExp } = await supabaseAdmin
        .from("expenses")
        .select("id, title, amount")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestExp) {
        const { data: delResult, error: delErr } = await supabaseAdmin.rpc("fn_delete_expense_atomic", {
          p_expense_id: latestExp.id,
          p_user_id: userId,
        });

        if (!delErr) {
          await invalidateCachedData([
            getUserCacheKey(userId, CACHE_KEYS.EXPENSES),
            getUserCacheKey(userId, CACHE_KEYS.ACCOUNTS),
            getUserCacheKey(userId, CACHE_KEYS.PORTFOLIO),
            getUserCacheKey(userId, CACHE_KEYS.LEDGER),
            getUserCacheKey(userId, CACHE_KEYS.BUDGETS),
          ]);

          await sendTelegramMessage({
            chatId,
            text: `${voicePrefix}${formatUndoConfirmation({
              type: "expense",
              title: delResult?.title || latestExp.title,
              amount: Number(delResult?.amount) || latestExp.amount,
              accountName: delResult?.account_name || "Account",
              restoredBalance: delResult?.new_balance,
            })}`,
          });
          return NextResponse.json({ success: true, undone: latestExp.id });
        }
      }

      await sendTelegramMessage({
        chatId,
        text: `${voicePrefix}ℹ️ <b>Nothing to undo:</b> No recent transactions found in your workspace.`,
      });
      return NextResponse.json({ status: "nothing_to_undo" });
    }

    // J. Status Command (/status or action:status)
    if (rawText === "/status" || rawText === "status" || rawText === "action:status") {
      const { data: accountsList } = await supabaseAdmin.from("accounts").select("id, name, balance").eq("user_id", userId);
      const totalAccounts = accountsList?.length || 0;
      const totalPortfolio = (accountsList || []).reduce((sum, a) => sum + (Number(a.balance) || 0), 0);

      const { data: userSet } = await supabaseAdmin
        .from("user_settings")
        .select("telegram_linked_at")
        .eq("id", userId)
        .maybeSingle();

      await sendTelegramMessage({
        chatId,
        text: `${voicePrefix}${formatStatusMessage({
          userName,
          accountCount: totalAccounts,
          totalPortfolio,
          botUsername,
          linkedAt: userSet?.telegram_linked_at || null,
        })}`,
        replyMarkup: getStandardInlineKeyboard(webAppUrl),
      });

      return NextResponse.json({ status: "status_sent" });
    }

    // K. Disconnect Chat (/unlink)
    if (rawText === "/unlink") {
      await supabaseAdmin
        .from("user_settings")
        .update({ telegram_chat_id: null, telegram_username: null, telegram_linked_at: null })
        .eq("id", userId);

      await supabaseAdmin
        .from("family_members")
        .update({ telegram_chat_id: null, telegram_username: null })
        .eq("telegram_chat_id", chatIdStr);

      await sendTelegramMessage({
        chatId,
        text:
          `👋 <b>Telegram Disconnected</b>\n\n` +
          `Your Telegram chat is no longer linked to arthaX. You can re-link at any time using <code>/link &lt;token&gt;</code>.`,
        replyMarkup: getUnlinkedInlineKeyboard(webAppUrl),
      });

      return NextResponse.json({ status: "unlinked_successfully" });
    }

    // L. Balance Inquiry (/balance, /accounts, voice "what is my balance?", or action:balance)
    const isBalance =
      intentHint === "balance_query" ||
      rawText === "/balance" ||
      rawText === "/accounts" ||
      rawText === "action:balance" ||
      /^(?:what is my balance|check balance|my balance|balance|accounts|how much in|what are my balances)/i.test(rawText.trim());

    if (isBalance) {
      const targetAcc = userAccounts.find((a) => rawText.toLowerCase().includes(a.name.toLowerCase()));
      if (targetAcc) {
        await sendTelegramMessage({
          chatId,
          text: `${voicePrefix}💳 <b>${escapeTelegramHtml(targetAcc.name)} Balance:</b> ₹${targetAcc.balance.toLocaleString("en-IN")}`,
          replyMarkup: getStandardInlineKeyboard(webAppUrl),
        });
        return NextResponse.json({ status: "balance_sent" });
      }

      await sendTelegramMessage({
        chatId,
        text: `${voicePrefix}${formatBalanceSummary(userAccounts)}`,
        replyMarkup: getStandardInlineKeyboard(webAppUrl),
      });
      return NextResponse.json({ status: "balance_sent" });
    }

    // M. Category Budgets Overview (/budget, /budgets, voice, or action:budget)
    const isBudget =
      intentHint === "budget_query" ||
      rawText === "/budget" ||
      rawText === "/budgets" ||
      rawText === "action:budget" ||
      /^(?:budgets|my budget|how are my budgets|budget status)$/i.test(rawText.trim());

    if (isBudget) {
      const currentMonth = getCurrentMonthYear();
      const monthStart = `${currentMonth}-01`;
      const today = getLocalDateString(new Date(), "Asia/Kolkata");
      const monthName = formatMonthDisplay(currentMonth);

      const [budgetRecordsRes, expensesRes] = await Promise.all([
        supabaseAdmin.from("budgets").select("category, amount").eq("user_id", userId),
        supabaseAdmin
          .from("expenses")
          .select("category, amount")
          .eq("user_id", userId)
          .gte("expense_date", monthStart)
          .lte("expense_date", today),
      ]);

      const spentMap: Record<string, number> = {};
      (expensesRes.data || []).forEach((e) => {
        spentMap[e.category] = (spentMap[e.category] || 0) + (Number(e.amount) || 0);
      });

      const budgetList = (budgetRecordsRes.data || []).map((b) => {
        const budgeted = Number(b.amount) || 0;
        const spent = spentMap[b.category] || 0;
        const percent = budgeted > 0 ? Math.round((spent / budgeted) * 100) : 0;
        return { category: b.category, budgeted, spent, percent };
      });

      await sendTelegramMessage({
        chatId,
        text: `${voicePrefix}${formatBudgetSummary({ budgets: budgetList, monthName })}`,
        replyMarkup: getStandardInlineKeyboard(webAppUrl),
      });

      return NextResponse.json({ status: "budget_sent" });
    }

    // N. Recent Expenses (/recent, /history, voice, or action:recent)
    if (rawText === "/recent" || rawText === "/history" || rawText === "action:recent") {
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
        text: `${voicePrefix}${formatRecentExpenses(mappedExpenses)}`,
        replyMarkup: getStandardInlineKeyboard(webAppUrl),
      });

      return NextResponse.json({ status: "recent_sent" });
    }

    // O. Spending Summary (/summary, /today, /report, voice, or action:summary)
    const isSpending =
      intentHint === "spending_query" ||
      rawText === "/summary" ||
      rawText === "/today" ||
      rawText === "/report" ||
      rawText === "action:summary" ||
      /^(?:how much did i spend|monthly spend|total spent|summary|my spend|spending|today spend)$/i.test(rawText.trim());

    if (isSpending) {
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
        text: `${voicePrefix}${formatSpendingSummary({
          todayTotal,
          monthTotal,
          expenseCount: monthExpenses?.length || 0,
          topCategory,
        })}`,
        replyMarkup: getStandardInlineKeyboard(webAppUrl),
      });

      return NextResponse.json({ status: "summary_sent" });
    }

    // P. AI Financial Advice (/ai <query>, /ask <query>, voice question, or advice intent)
    const isAiPrompt = rawText.startsWith("/ai") || rawText.startsWith("/ask") || (intentHint === "advice" && Boolean(aiMediaParsed?.adviceResponse));
    if (isAiPrompt) {
      const queryPrompt = rawText.replace(/^\/(?:ai|ask)\s*/i, "").trim() || voiceTranscription;

      if (!queryPrompt) {
        await sendTelegramMessage({
          chatId,
          text:
            `🤖 <b>arthaX AI Financial Assistant</b>\n\n` +
            `Ask me anything about budgeting, saving, or wealth management:\n` +
            `• <code>/ai How can I save 20% on groceries?</code>\n` +
            `• <code>/ai Explain debt avalanche vs snowball</code>\n` +
            `• <code>/ai Can I afford a 15k vacation next month?</code>\n` +
            `• Or simply send a voice note with your question!`,
        });
        return NextResponse.json({ status: "ai_help_prompted" });
      }

      if (aiMediaParsed?.adviceResponse) {
        await sendTelegramMessage({
          chatId,
          text: `${voicePrefix}💡 <b>arthaX AI</b>\n\n${aiMediaParsed.adviceResponse}`,
          replyMarkup: getStandardInlineKeyboard(webAppUrl),
        });
        return NextResponse.json({ success: true, status: "ai_answered" });
      }

      const geminiRes = await generateFinancialAnswer({
        prompt: queryPrompt,
        userName,
        accountsSummary: userAccounts.map((a) => ({ name: a.name, balance: a.balance, type: a.type })),
      });

      if (geminiRes.success && geminiRes.text) {
        await sendTelegramMessage({
          chatId,
          text: `${voicePrefix}💡 <b>arthaX AI</b>\n\n${geminiRes.text}`,
          replyMarkup: getStandardInlineKeyboard(webAppUrl),
        });
        return NextResponse.json({ success: true, status: "ai_answered", response: geminiRes.text });
      } else {
        await sendTelegramMessage({
          chatId,
          text: `${voicePrefix}⚠️ <i>AI service temporarily unavailable. Please try again shortly.</i>`,
        });
        return NextResponse.json({ success: false, error: geminiRes.error });
      }
    }

    // -------------------------------------------------------------
    // 8. Natural Language & Regex Transaction Parser
    // -------------------------------------------------------------
    const idempotencyTag = messageId ? `[telegram_${messageId}]` : null;

    // Pure Standalone Number (e.g. "623", "500") -> 1-Tap Category Picker Keyboard
    const isPureNumber = /^(?:rs\.?|inr|₹)?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:rs\.?|inr|₹)?$/i.test(rawText.trim());
    if (isPureNumber) {
      const pureAmount = parseFloat(rawText.replace(/[^0-9.]/g, ""));
      if (pureAmount > 0) {
        const expenseDate = getLocalDateString(new Date(), "Asia/Kolkata");
        const defaultAccount = userAccounts[0] || null;

        const { data: rpcResult, error: rpcErr } = await supabaseAdmin.rpc("fn_record_expense_atomic", {
          p_user_id: userId,
          p_title: "Quick Expense",
          p_amount: pureAmount,
          p_category: "Other & Contingency",
          p_account_id: defaultAccount?.id || null,
          p_expense_date: expenseDate,
          p_notes: `Automated via Telegram ("${rawText}")`,
          p_tags: ["telegram", "quick_number"],
        });

        if (!rpcErr) {
          await invalidateCachedData([
            getUserCacheKey(userId, CACHE_KEYS.EXPENSES),
            getUserCacheKey(userId, CACHE_KEYS.ACCOUNTS),
            getUserCacheKey(userId, CACHE_KEYS.PORTFOLIO),
            getUserCacheKey(userId, CACHE_KEYS.LEDGER),
            getUserCacheKey(userId, CACHE_KEYS.BUDGETS),
          ]);

          const accountName = rpcResult?.account_name || defaultAccount?.name || "Cash";
          await sendTelegramMessage({
            chatId,
            text:
              `${voicePrefix}⚡ <b>Logged ${formatCurrencyINR(pureAmount)}</b> from <b>${escapeTelegramHtml(accountName)}</b>\n\n` +
              `Tap below to set the category:`,
            replyMarkup: getAmbiguousExpenseKeyboard(rpcResult?.expense_id),
          });

          return NextResponse.json({ success: true, expense_id: rpcResult?.expense_id });
        }
      }
    }

    // AI Semantic Resolution & Intent Extraction
    let aiParsed: ParsedFinancialAI | null = aiMediaParsed;
    if (!aiParsed && process.env.GEMINI_API_KEY && !rawText.startsWith("/")) {
      aiParsed = await parseFinancialInputWithGemini({
        text: rawText,
        userName,
        accountsSummary: userAccounts.map((a) => ({ name: a.name, balance: a.balance, type: a.type })),
      });
    }

    if (aiParsed?.intent === "advice" && aiParsed.adviceResponse) {
      await sendTelegramMessage({
        chatId,
        text: `${voicePrefix}💡 <b>arthaX AI</b>\n\n${aiParsed.adviceResponse}`,
        replyMarkup: getStandardInlineKeyboard(webAppUrl),
      });
      return NextResponse.json({ success: true, status: "ai_advice" });
    }

    // Direct /expense command e.g. "/expense Coffee 150 Cash"
    const directExpMatch = rawText.match(/^\/expense\s+([a-zA-Z0-9\s&]+?)\s+(?:rs\.?|inr|₹)?\s*([0-9]+(?:\.[0-9]+)?)(?:\s+([a-zA-Z0-9]+))?$/i);
    if (directExpMatch) {
      aiParsed = {
        intent: "expense",
        title: directExpMatch[1].trim(),
        amount: parseFloat(directExpMatch[2]),
        category: "Other & Contingency",
        accountQuery: directExpMatch[3]?.trim() || "",
        confidence: 1,
      };
    }

    // Direct /income command e.g. "/income Freelance 25000 SBI"
    const directIncMatch = rawText.match(/^\/income\s+([a-zA-Z0-9\s&]+?)\s+(?:rs\.?|inr|₹)?\s*([0-9]+(?:\.[0-9]+)?)(?:\s+([a-zA-Z0-9]+))?$/i);
    if (directIncMatch) {
      aiParsed = {
        intent: "income",
        title: directIncMatch[1].trim(),
        amount: parseFloat(directIncMatch[2]),
        category: "Salary",
        accountQuery: directIncMatch[3]?.trim() || "",
        confidence: 1,
      };
    }

    // Fallback to classic intent classifier if AI did not return a definitive financial action
    const intent =
      aiParsed && aiParsed.intent && aiParsed.intent !== "unknown" && aiParsed.intent !== "advice" && (aiParsed.amount || 0) > 0
        ? {
            type: aiParsed.intent as "expense" | "income" | "transfer",
            data: {
              amount: aiParsed.amount || 0,
              title: aiParsed.title || (aiParsed.intent === "income" ? "Income" : "Expense"),
              category: aiParsed.category || (aiParsed.intent === "income" ? "Salary" : "Other & Contingency"),
              accountQuery: aiParsed.accountQuery,
              fromAccountQuery: aiParsed.fromAccountQuery || "",
              toAccountQuery: aiParsed.toAccountQuery || "",
              rawText,
            },
          }
        : classifyFinancialMessage(rawText, userAccounts);

    // Case A: Transfer between accounts
    if (intent.type === "transfer") {
      const fromAcc = matchAccount(intent.data.fromAccountQuery, userAccounts);
      const toAcc = matchAccount(intent.data.toAccountQuery, userAccounts);

      if (!fromAcc || !toAcc || fromAcc.id === toAcc.id) {
        await sendTelegramMessage({
          chatId,
          text:
            `${voicePrefix}⚠️ <b>Could not match distinct accounts for transfer</b>\n\n` +
            `From: <code>${escapeTelegramHtml(intent.data.fromAccountQuery)}</code>\n` +
            `To: <code>${escapeTelegramHtml(intent.data.toAccountQuery)}</code>\n\n` +
            `Your accounts: ${userAccounts.map((a) => `<b>${escapeTelegramHtml(a.name)}</b>`).join(", ")}`,
        });
        return NextResponse.json({ success: false, error: "Account match failed" });
      }

      const todayDate = getLocalDateString(new Date(), "Asia/Kolkata");
      const { data: tResult, error: tErr } = await supabaseAdmin.rpc("fn_record_transfer_atomic", {
        p_user_id: userId,
        p_from_account_id: fromAcc.id,
        p_to_account_id: toAcc.id,
        p_amount: intent.data.amount,
        p_transfer_date: todayDate,
        p_notes: `Automated via Telegram ("${rawText}")`,
      });

      if (tErr) {
        await sendTelegramMessage({ chatId, text: `${voicePrefix}⚠️ <b>Transfer failed:</b> ${tErr.message}` });
        return NextResponse.json({ error: tErr.message });
      }

      await invalidateCachedData([
        getUserCacheKey(userId, CACHE_KEYS.ACCOUNTS),
        getUserCacheKey(userId, CACHE_KEYS.TRANSFERS),
        getUserCacheKey(userId, CACHE_KEYS.PORTFOLIO),
        getUserCacheKey(userId, CACHE_KEYS.LEDGER),
      ]);

      await sendTelegramMessage({
        chatId,
        text: `${voicePrefix}${formatTransferConfirmation({
          amount: intent.data.amount,
          fromAccountName: fromAcc.name,
          toAccountName: toAcc.name,
          fromBalance: tResult?.from_new_balance,
          toBalance: tResult?.to_new_balance,
        })}`,
        replyMarkup: getStandardInlineKeyboard(webAppUrl),
      });

      return NextResponse.json({ success: true, transfer: true });
    }

    // Case B: Income (Credits / Salary / Freelance / Dividends)
    if (intent.type === "income") {
      const targetAccount = matchAccount(intent.data.accountQuery, userAccounts);
      const todayDate = getLocalDateString(new Date(), "Asia/Kolkata");
      const notesContent = idempotencyTag
        ? `Automated via Telegram ${idempotencyTag} ("${rawText}")`
        : `Automated via Telegram ("${rawText}")`;

      const { data: rpcResult, error: rpcErr } = await supabaseAdmin.rpc("fn_record_income_atomic", {
        p_user_id: userId,
        p_title: intent.data.title,
        p_amount: intent.data.amount,
        p_category: intent.data.category,
        p_frequency: "One-time",
        p_account_id: targetAccount?.id || null,
        p_received_date: todayDate,
        p_notes: notesContent,
        p_tags: ["telegram", "automated", "income"],
      });

      if (rpcErr) {
        await sendTelegramMessage({ chatId, text: `${voicePrefix}⚠️ <b>Error recording income:</b> ${rpcErr.message}` });
        return NextResponse.json({ error: rpcErr.message }, { status: 500 });
      }

      await invalidateCachedData([
        getUserCacheKey(userId, CACHE_KEYS.INCOME),
        getUserCacheKey(userId, CACHE_KEYS.ACCOUNTS),
        getUserCacheKey(userId, CACHE_KEYS.PORTFOLIO),
        getUserCacheKey(userId, CACHE_KEYS.LEDGER),
      ]);

      const updatedBalance = rpcResult?.new_balance;
      const accountName = rpcResult?.account_name || (targetAccount ? targetAccount.name : "None");

      await sendTelegramMessage({
        chatId,
        text: `${voicePrefix}${formatIncomeConfirmation({
          amount: intent.data.amount,
          category: intent.data.category,
          title: intent.data.title,
          accountName,
          newBalance: updatedBalance,
        })}`,
        replyMarkup: getIncomeActionKeyboard(rpcResult?.income_id),
      });

      return NextResponse.json({ success: true, income_id: rpcResult?.income_id });
    }

    // Case C: Expense (Standard purchase, debit alert, Swiggy, Uber, etc.)
    if (intent.type === "expense") {
      const targetAccount = matchAccount(intent.data.accountQuery, userAccounts);
      const expenseDate = getLocalDateString(new Date(), "Asia/Kolkata");
      const notesContent = idempotencyTag
        ? `Automated via Telegram ${idempotencyTag} ("${rawText}")`
        : `Automated via Telegram ("${rawText}")`;

      const { data: rpcResult, error: rpcErr } = await supabaseAdmin.rpc("fn_record_expense_atomic", {
        p_user_id: userId,
        p_title: intent.data.title,
        p_amount: intent.data.amount,
        p_category: intent.data.category,
        p_account_id: targetAccount?.id || null,
        p_expense_date: expenseDate,
        p_notes: notesContent,
        p_tags: ["telegram", "automated"],
      });

      if (rpcErr) {
        await sendTelegramMessage({ chatId, text: `${voicePrefix}⚠️ <b>Error recording expense:</b> ${rpcErr.message}` });
        return NextResponse.json({ error: rpcErr.message }, { status: 500 });
      }

      await invalidateCachedData([
        getUserCacheKey(userId, CACHE_KEYS.EXPENSES),
        getUserCacheKey(userId, CACHE_KEYS.ACCOUNTS),
        getUserCacheKey(userId, CACHE_KEYS.PORTFOLIO),
        getUserCacheKey(userId, CACHE_KEYS.LEDGER),
        getUserCacheKey(userId, CACHE_KEYS.BUDGETS),
      ]);

      const updatedBalance = rpcResult?.new_balance;
      const accountName = rpcResult?.account_name || (targetAccount ? targetAccount.name : "None");

      await sendTelegramMessage({
        chatId,
        text: `${voicePrefix}${formatExpenseConfirmation({
          amount: intent.data.amount,
          category: intent.data.category,
          title: intent.data.title,
          accountName,
          newBalance: targetAccount ? updatedBalance : undefined,
        })}`,
        replyMarkup: getExpenseActionKeyboard(rpcResult?.expense_id),
      });

      return NextResponse.json({
        success: true,
        data: {
          expense_id: rpcResult?.expense_id,
          account: accountName,
          new_balance: updatedBalance,
        },
      });
    }

    // Case D: General Conversational Query -> Gemini AI
    if (process.env.GEMINI_API_KEY) {
      const geminiRes = await generateFinancialAnswer({
        prompt: rawText,
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
          text: `${voicePrefix}💡 <b>arthaX AI</b>\n\n${geminiRes.text}`,
          replyMarkup: getStandardInlineKeyboard(webAppUrl),
        });

        return NextResponse.json({
          success: true,
          status: "ai_answered",
          response: geminiRes.text,
        });
      }
    }

    // Fallback if unrecognized
    await sendTelegramMessage({
      chatId,
      text:
        `${voicePrefix}❓ <b>Could not recognize transaction or command</b>\n\n` +
        `Message received: <i>"${escapeTelegramHtml(rawText)}"</i>\n\n` +
        `<b>Examples:</b>\n` +
        `• <b>Voice:</b> Hold the mic button and say <i>"Spent 350 on coffee with HDFC"</i>\n` +
        `• <b>Photo:</b> Send any receipt, bill, or UPI payment screenshot\n` +
        `• <b>Expense:</b> <code>Dinner 500 HDFC</code>\n` +
        `• <b>Income:</b> <code>Salary 85000 HDFC</code>\n` +
        `• <b>Transfer:</b> <code>Transfer 5000 HDFC to Cash</code>\n` +
        `• <b>Chart:</b> <code>/chart</code>\n` +
        `• <b>Portfolio:</b> <code>/portfolio</code>\n` +
        `• <b>Stocks:</b> <code>/stocks</code> or <code>/quote RELIANCE</code>\n` +
        `• <b>AI:</b> <code>/ai How to save more?</code>`,
      replyMarkup: getStandardInlineKeyboard(webAppUrl),
    });

    return NextResponse.json({ success: false, message: "Unrecognized message" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[Telegram Webhook] Error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
