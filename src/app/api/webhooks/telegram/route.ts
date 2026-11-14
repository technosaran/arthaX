import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { matchAccount, AccountSummary } from "@/utils/expenseParser";
import { classifyFinancialMessage } from "@/utils/financeParser";
import {
  sendTelegramMessage,
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
  formatUndoConfirmation,
  formatWelcomeMessage,
  formatHelpMessage,
  getStandardInlineKeyboard,
  getExpenseActionKeyboard,
  getIncomeActionKeyboard,
  getUnlinkedInlineKeyboard,
  getTelegramWebhookInfo,
} from "@/utils/telegram";
import { invalidateCachedData, getUserCacheKey, CACHE_KEYS } from "@/utils/redis";
import { getLocalDateString, getCurrentMonthYear, formatMonthDisplay } from "@/utils/monthUtils";
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
 * Supports all financial actions: Expenses, Income, Transfers, Budgets, Balances, Undo, and Gemini AI.
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

    const isCallback = Boolean(update.callback_query);
    const callbackId = update.callback_query?.id;
    const message = update.message || update.edited_message || update.callback_query?.message;
    const rawText = (update.callback_query?.data || message?.text || "").trim();
    const chatId = message?.chat?.id || update.callback_query?.from?.id;
    const senderUsername = message?.from?.username || update.callback_query?.from?.username || "";
    const senderFirstName = message?.from?.first_name || update.callback_query?.from?.first_name || "Friend";
    const messageId = message?.message_id;

    if (!chatId || !rawText) {
      return NextResponse.json({ status: "acknowledged_empty" });
    }

    const chatIdStr = String(chatId);
    const botUsername = process.env.TELEGRAM_BOT_USERNAME || "Artha_X_bot";
    const webAppUrl = process.env.NEXT_PUBLIC_APP_URL || "https://arthax.vercel.app";

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
    // 3. Pairing & Linking Commands (/link <token_or_email> or /start <token>)
    // -------------------------------------------------------------
    if (rawText.startsWith("/start") || rawText.startsWith("/link")) {
      const parts = rawText.split(/\s+/);
      const linkCandidate = parts[1]?.trim();

      if (linkCandidate) {
        let matchedUserId: string | null = null;
        let matchedUserName: string = "User";

        const rawCandidate = linkCandidate.trim();
        const upperCandidate = rawCandidate.toUpperCase();
        const normalizedToken = upperCandidate.replace(/_/g, "-");

        // Build list of possible token representations
        const tokenCandidates = Array.from(
          new Set([
            rawCandidate,
            upperCandidate,
            normalizedToken,
            normalizedToken.startsWith("AX-") ? normalizedToken.slice(3) : `AX-${normalizedToken}`,
          ])
        );

        // A. Match by Link Token in user_settings
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

        // B. Match by User ID directly (UUID or text id)
        if (!matchedUserId) {
          const { data: userById } = await supabaseAdmin
            .from("user_settings")
            .select("id, name")
            .eq("id", rawCandidate)
            .limit(1)
            .maybeSingle();
          if (userById?.id) {
            matchedUserId = userById.id;
            matchedUserName = userById.name || "User";
          }
        }

        // C. If email provided (e.g. /link user@example.com)
        if (!matchedUserId && linkCandidate.includes("@")) {
          const { data: usersList } = await supabaseAdmin.auth.admin.listUsers();
          const foundAuth = (usersList?.users || []).find(
            (u) => u.email?.toLowerCase() === linkCandidate.toLowerCase()
          );
          if (foundAuth?.id) {
            matchedUserId = foundAuth.id;
            const { data: uSet } = await supabaseAdmin
              .from("user_settings")
              .select("name")
              .eq("id", foundAuth.id)
              .maybeSingle();
            matchedUserName = uSet?.name || foundAuth.email?.split("@")[0] || "User";
          }
        }

        // D. Check family_members by email or phone
        if (!matchedUserId) {
          const { data: fm } = await supabaseAdmin
            .from("family_members")
            .select("id, user_id, name")
            .or(`email.ilike.${rawCandidate},phone.eq.${rawCandidate}`)
            .limit(1)
            .maybeSingle();

          if (fm?.user_id) {
            await supabaseAdmin
              .from("family_members")
              .update({
                telegram_chat_id: chatIdStr,
                telegram_username: senderUsername || null,
              })
              .eq("id", fm.id);

            await sendTelegramMessage({
              chatId,
              text:
                `🎉 <b>Family Member Connected!</b>\n\n` +
                `Welcome <b>${escapeTelegramHtml(fm.name)}</b>. Your Telegram chat is now linked to record shared household expenses.\n\n` +
                `<b>Try:</b> <code>Dinner 450 HDFC</code> or forward any bank debit SMS!`,
              replyMarkup: getStandardInlineKeyboard(webAppUrl),
            });
            return NextResponse.json({ success: true, linked_family_member: fm.id });
          }
        }

        if (matchedUserId) {
          // Bind Telegram Chat ID to the matching user
          await supabaseAdmin
            .from("user_settings")
            .upsert(
              {
                id: matchedUserId,
                telegram_chat_id: chatIdStr,
                telegram_username: senderUsername || null,
                telegram_linked_at: new Date().toISOString(),
                telegram_link_token: null, // Consume one-time token
              },
              { onConflict: "id" }
            );

          try {
            await invalidateCachedData([
              getUserCacheKey(matchedUserId, CACHE_KEYS.PORTFOLIO),
              getUserCacheKey(matchedUserId, CACHE_KEYS.ACCOUNTS),
            ]);
          } catch {}

          await sendTelegramMessage({
            chatId,
            text:
              `🎉 <b>arthaX Workspace Successfully Connected!</b>\n\n` +
              `Welcome <b>${escapeTelegramHtml(matchedUserName)}</b>. Your Telegram chat is now paired.\n\n` +
              `<b>You can now perform everything directly here:</b>\n` +
              `• <b>Log Expense:</b> <code>Dinner 500 HDFC</code>\n` +
              `• <b>Log Income:</b> <code>Salary 85000 HDFC</code>\n` +
              `• <b>Transfer:</b> <code>Transfer 5000 HDFC to Cash</code>\n` +
              `• <b>Forward SMS:</b> Paste any bank debit or credit notification!\n` +
              `• <b>Ask AI:</b> <code>/ai How to save on grocery bills?</code>\n\n` +
              `Use the quick actions below to manage your finances on the go:`,
            replyMarkup: getStandardInlineKeyboard(webAppUrl),
          });

          return NextResponse.json({ success: true, linked: true, user_id: matchedUserId });
        } else {
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
    }

    // -------------------------------------------------------------
    // 4. Handle Unlinked Users (Strict Protection)
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
        text: formatWelcomeMessage({
          botUsername,
          isLinked: true,
          userName,
        }),
        replyMarkup: getStandardInlineKeyboard(webAppUrl),
      });
      return NextResponse.json({ status: "welcome_sent_linked" });
    }

    // -------------------------------------------------------------
    // 5. Handle Interactive Inline Callback Buttons
    // -------------------------------------------------------------
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
    // 6. Handle Authenticated Commands & Action Buttons
    // -------------------------------------------------------------

    // /start
    if (rawText === "/start") {
      await sendTelegramMessage({
        chatId,
        text: formatWelcomeMessage({
          botUsername,
          isLinked: true,
          userName,
        }),
        replyMarkup: getStandardInlineKeyboard(webAppUrl),
      });
      return NextResponse.json({ status: "start_greeted" });
    }

    // /help
    if (rawText === "/help") {
      await sendTelegramMessage({
        chatId,
        text: formatHelpMessage(botUsername),
        replyMarkup: getStandardInlineKeyboard(webAppUrl),
      });
      return NextResponse.json({ status: "help_sent" });
    }

    // /unlink
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

    // /balance or action:balance
    if (rawText === "/balance" || rawText === "/accounts" || rawText === "action:balance") {
      const { data: accounts } = await supabaseAdmin
        .from("accounts")
        .select("name, type, balance, last_four")
        .eq("user_id", userId)
        .order("balance", { ascending: false });

      await sendTelegramMessage({
        chatId,
        text: formatBalanceSummary(accounts || []),
        replyMarkup: getStandardInlineKeyboard(webAppUrl),
      });

      return NextResponse.json({ status: "balance_sent" });
    }

    // /budget or action:budget
    if (rawText === "/budget" || rawText === "/budgets" || rawText === "action:budget") {
      const currentMonth = getCurrentMonthYear();
      const monthStart = `${currentMonth}-01`;
      const today = getLocalDateString(new Date(), "Asia/Kolkata");
      const monthName = formatMonthDisplay(currentMonth);

      // Fetch user budgets
      const { data: budgetRecords } = await supabaseAdmin
        .from("budgets")
        .select("category, amount")
        .eq("user_id", userId);

      // Fetch monthly expenses by category
      const { data: expenses } = await supabaseAdmin
        .from("expenses")
        .select("category, amount")
        .eq("user_id", userId)
        .gte("expense_date", monthStart)
        .lte("expense_date", today);

      const spentMap: Record<string, number> = {};
      (expenses || []).forEach((e) => {
        spentMap[e.category] = (spentMap[e.category] || 0) + (Number(e.amount) || 0);
      });

      const budgetList = (budgetRecords || []).map((b) => {
        const budgeted = Number(b.amount) || 0;
        const spent = spentMap[b.category] || 0;
        const percent = budgeted > 0 ? Math.round((spent / budgeted) * 100) : 0;
        return { category: b.category, budgeted, spent, percent };
      });

      await sendTelegramMessage({
        chatId,
        text: formatBudgetSummary({ budgets: budgetList, monthName }),
        replyMarkup: getStandardInlineKeyboard(webAppUrl),
      });

      return NextResponse.json({ status: "budget_sent" });
    }

    // /recent or action:recent
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
        text: formatRecentExpenses(mappedExpenses),
        replyMarkup: getStandardInlineKeyboard(webAppUrl),
      });

      return NextResponse.json({ status: "recent_sent" });
    }

    // /summary or action:summary
    if (rawText === "/summary" || rawText === "/today" || rawText === "/report" || rawText === "action:summary") {
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
        replyMarkup: getStandardInlineKeyboard(webAppUrl),
      });

      return NextResponse.json({ status: "summary_sent" });
    }

    // /undo command
    if (rawText === "/undo") {
      // Find latest expense
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
            text: formatUndoConfirmation({
              type: "expense",
              title: delResult?.title || latestExp.title,
              amount: Number(delResult?.amount) || Number(latestExp.amount),
              accountName: delResult?.account_name || "Account",
              restoredBalance: delResult?.new_balance,
            }),
          });
          return NextResponse.json({ success: true, undone: "expense" });
        }
      }

      await sendTelegramMessage({
        chatId,
        text: `ℹ️ <b>Nothing to undo:</b> No recent transactions found in your workspace.`,
      });
      return NextResponse.json({ status: "nothing_to_undo" });
    }

    // /ai <prompt> or /ask <prompt>
    if (rawText.startsWith("/ai") || rawText.startsWith("/ask")) {
      const queryPrompt = rawText.replace(/^\/(?:ai|ask)\s*/i, "").trim();
      if (!queryPrompt) {
        await sendTelegramMessage({
          chatId,
          text: `🤖 <b>arthaX AI Assistant</b>\n\nAsk me anything about your finances or wealth management:\n• <code>/ai How can I save 20% on groceries?</code>\n• <code>/ai Explain debt avalanche vs snowball</code>\n• <code>/ai How to start an emergency fund?</code>`,
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
          replyMarkup: getStandardInlineKeyboard(webAppUrl),
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
    // 7. Full Financial Message Parsing (Expense, Income, Transfer, AI)
    // -------------------------------------------------------------
    const idempotencyTag = messageId ? `[telegram_${messageId}]` : null;

    // Fetch user accounts
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

    // Classify Financial Intent
    const intent = classifyFinancialMessage(rawText, userAccounts);

    // Case A: Transfer between accounts
    if (intent.type === "transfer") {
      const fromAcc = matchAccount(intent.data.fromAccountQuery, userAccounts);
      const toAcc = matchAccount(intent.data.toAccountQuery, userAccounts);

      if (!fromAcc || !toAcc || fromAcc.id === toAcc.id) {
        await sendTelegramMessage({
          chatId,
          text:
            `⚠️ <b>Could not match distinct accounts for transfer</b>\n\n` +
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
        await sendTelegramMessage({ chatId, text: `⚠️ <b>Transfer failed:</b> ${tErr.message}` });
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
        text: formatTransferConfirmation({
          amount: intent.data.amount,
          fromAccountName: fromAcc.name,
          toAccountName: toAcc.name,
          fromBalance: tResult?.from_new_balance,
          toBalance: tResult?.to_new_balance,
        }),
        replyMarkup: getStandardInlineKeyboard(webAppUrl),
      });

      return NextResponse.json({ success: true, transfer: true });
    }

    // Case B: Income (Credits / Salary / Freelance / Received Money)
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
        await sendTelegramMessage({ chatId, text: `⚠️ <b>Error recording income:</b> ${rpcErr.message}` });
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
        text: formatIncomeConfirmation({
          amount: intent.data.amount,
          category: intent.data.category,
          title: intent.data.title,
          accountName,
          newBalance: updatedBalance,
        }),
        replyMarkup: getIncomeActionKeyboard(rpcResult?.income_id),
      });

      return NextResponse.json({ success: true, income_id: rpcResult?.income_id });
    }

    // Case C: Expense (Standard purchase, debit alert, Swiggy, fuel, etc.)
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
        await sendTelegramMessage({ chatId, text: `⚠️ <b>Error recording expense:</b> ${rpcErr.message}` });
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
        text: formatExpenseConfirmation({
          amount: intent.data.amount,
          category: intent.data.category,
          title: intent.data.title,
          accountName,
          newBalance: targetAccount ? updatedBalance : undefined,
        }),
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

    // Case D: Unknown query / conversational -> Intelligent Gemini AI Assistant
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
          text: `💡 <b>arthaX AI</b>\n\n${geminiRes.text}`,
          replyMarkup: getStandardInlineKeyboard(webAppUrl),
        });

        return NextResponse.json({
          success: true,
          status: "ai_answered",
          response: geminiRes.text,
        });
      }
    }

    // Fallback if AI disabled or unavailable
    await sendTelegramMessage({
      chatId,
      text:
        `❓ <b>Could not recognize transaction</b>\n\n` +
        `Message received: <i>"${escapeTelegramHtml(rawText)}"</i>\n\n` +
        `<b>Examples:</b>\n` +
        `• <b>Expense:</b> <code>Dinner 500 HDFC</code>\n` +
        `• <b>Income:</b> <code>Salary 85000 HDFC</code>\n` +
        `• <b>Transfer:</b> <code>Transfer 5000 HDFC to Cash</code>\n` +
        `• <b>AI Help:</b> <code>/ai How to cut expenses?</code>\n` +
        `• Or forward any bank SMS alert!`,
      replyMarkup: getStandardInlineKeyboard(webAppUrl),
    });

    return NextResponse.json({ success: false, message: "Unrecognized message" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[Telegram Webhook] Error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
