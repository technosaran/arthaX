import crypto from "crypto";

export interface SendTelegramMessageOptions {
  chatId: string | number;
  text: string;
  parseMode?: "HTML" | "Markdown" | "MarkdownV2";
  replyMarkup?: Record<string, unknown>;
}

export interface TelegramApiResponse<T = unknown> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

/**
 * Escapes special HTML characters so dynamic text can be safely interpolated in HTML parse_mode.
 */
export function escapeTelegramHtml(text: string): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Formats monetary amounts in Indian Rupee format
 */
export function formatCurrencyINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Sends a message via Telegram Bot API using fetch and AbortController timeout.
 */
export async function sendTelegramMessage({
  chatId,
  text,
  parseMode = "HTML",
  replyMarkup,
}: SendTelegramMessageOptions): Promise<{
  success: boolean;
  messageId?: number;
  error?: string;
  raw?: unknown;
}> {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    console.warn("[Telegram API] TELEGRAM_BOT_TOKEN is not configured in environment variables.");
    return {
      success: false,
      error: "TELEGRAM_BOT_TOKEN is not configured in environment variables.",
    };
  }

  const cleanChatId = String(chatId).trim();
  if (!cleanChatId) {
    return { success: false, error: "Invalid or empty Telegram chatId." };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const payload: Record<string, unknown> = {
      chat_id: cleanChatId,
      text,
      parse_mode: parseMode,
    };

    if (replyMarkup) {
      payload.reply_markup = replyMarkup;
    }

    const response = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    clearTimeout(timeoutId);

    const data = (await response.json()) as TelegramApiResponse<{ message_id: number }>;

    if (!response.ok || !data.ok) {
      console.error("[Telegram API] Telegram Error Response:", data);
      return {
        success: false,
        error: data.description || `HTTP ${response.status}: Failed to send message to Telegram`,
        raw: data,
      };
    }

    return {
      success: true,
      messageId: data.result?.message_id,
      raw: data,
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : "Network error contacting Telegram API";
    console.error("[Telegram API] Request failed:", errMsg);
    return { success: false, error: errMsg };
  }
}

/**
 * Configures the Telegram Bot Webhook endpoint with optional secret token.
 */
export async function setTelegramWebhook({
  webhookUrl,
  secretToken,
  allowedUpdates = ["message", "callback_query"],
}: {
  webhookUrl: string;
  secretToken?: string;
  allowedUpdates?: string[];
}): Promise<{ success: boolean; description?: string; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return { success: false, error: "TELEGRAM_BOT_TOKEN is not configured." };
  }

  try {
    const payload: Record<string, unknown> = {
      url: webhookUrl,
      allowed_updates: allowedUpdates,
    };

    if (secretToken) {
      payload.secret_token = secretToken;
    }

    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = (await res.json()) as TelegramApiResponse;
    if (!res.ok || !data.ok) {
      return { success: false, error: data.description || "Failed to set webhook" };
    }

    return { success: true, description: data.description };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error contacting Telegram API";
    return { success: false, error: message };
  }
}

/**
 * Fetches current Webhook status and health diagnostics from Telegram API.
 */
export async function getTelegramWebhookInfo(): Promise<{
  success: boolean;
  info?: Record<string, unknown>;
  error?: string;
}> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return { success: false, error: "TELEGRAM_BOT_TOKEN is not configured." };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    const data = (await res.json()) as TelegramApiResponse<Record<string, unknown>>;
    if (!res.ok || !data.ok) {
      return { success: false, error: data.description || "Failed to get webhook info" };
    }
    return { success: true, info: data.result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error contacting Telegram API";
    return { success: false, error: message };
  }
}

/**
 * Deletes the configured Telegram webhook.
 */
export async function deleteTelegramWebhook(): Promise<{ success: boolean; description?: string; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return { success: false, error: "TELEGRAM_BOT_TOKEN is not configured." };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`, {
      method: "POST",
    });
    const data = (await res.json()) as TelegramApiResponse;
    if (!res.ok || !data.ok) {
      return { success: false, error: data.description || "Failed to delete webhook" };
    }
    return { success: true, description: data.description };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error contacting Telegram API";
    return { success: false, error: message };
  }
}

/**
 * Acknowledges a Telegram callback query (from inline button clicks) to remove the loading state on the button.
 */
export async function answerTelegramCallbackQuery(
  callbackQueryId: string,
  text?: string
): Promise<{ success: boolean; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return { success: false, error: "TELEGRAM_BOT_TOKEN is not configured." };
  }

  try {
    const payload: Record<string, unknown> = { callback_query_id: callbackQueryId };
    if (text) payload.text = text;

    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error contacting Telegram API";
    return { success: false, error: message };
  }
}

/**
 * Validates the X-Telegram-Bot-Api-Secret-Token header using timing-safe comparison.
 */
export function verifyTelegramSecret(
  incomingSecret: string | null,
  configuredSecret?: string
): boolean {
  const secret = configuredSecret || process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) {
    // If no secret configured in environment, allow webhook through (useful for local dev/testing)
    return true;
  }
  if (!incomingSecret) {
    return false;
  }

  const bufIncoming = Buffer.from(incomingSecret);
  const bufConfigured = Buffer.from(secret);

  if (bufIncoming.length !== bufConfigured.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(bufIncoming, bufConfigured);
  } catch {
    return false;
  }
}

// -------------------------------------------------------------
// Sleek HTML Message Builders for ArthaX Telegram Bot
// -------------------------------------------------------------

export function formatExpenseConfirmation({
  amount,
  category,
  title,
  accountName,
  newBalance,
}: {
  amount: number;
  category: string;
  title: string;
  accountName: string;
  newBalance?: number;
}): string {
  const formattedAmount = formatCurrencyINR(amount);
  const formattedBalance = newBalance !== undefined ? formatCurrencyINR(newBalance) : null;

  return (
    `✅ <b>Expense Logged!</b>\n\n` +
    `💰 <b>Amount:</b> ${escapeTelegramHtml(formattedAmount)}\n` +
    `🏷️ <b>Category:</b> ${escapeTelegramHtml(category)}\n` +
    `📝 <b>Note:</b> ${escapeTelegramHtml(title)}\n` +
    `🏦 <b>Account:</b> ${escapeTelegramHtml(accountName)}\n` +
    (formattedBalance ? `💳 <b>New Balance:</b> ${escapeTelegramHtml(formattedBalance)}\n\n` : `\n`) +
    `<i>⚡ Logged automatically in arthaX</i>`
  );
}

export function formatBalanceSummary(
  accounts: Array<{
    name: string;
    type: string;
    balance: number;
    last_four?: string | null;
  }>
): string {
  if (!accounts || accounts.length === 0) {
    return (
      `💳 <b>Your Accounts &amp; Balances:</b>\n\n` +
      `<i>No active accounts found in your arthaX workspace.</i>\n\n` +
      `Log into arthaX to create bank accounts or cash reserves.`
    );
  }

  let totalBalance = 0;
  const lines = accounts.map((acc) => {
    totalBalance += Number(acc.balance) || 0;
    const four = acc.last_four ? ` (••${acc.last_four})` : "";
    return `• <b>${escapeTelegramHtml(acc.name)}${escapeTelegramHtml(four)}</b>: ${formatCurrencyINR(Number(acc.balance) || 0)} <span class="tg-spoiler"><i>[${escapeTelegramHtml(acc.type)}]</i></span>`;
  });

  return (
    `💳 <b>Your Accounts &amp; Balances:</b>\n\n` +
    lines.join("\n") +
    `\n\n` +
    `📊 <b>Total Liquid Portfolio:</b> ${formatCurrencyINR(totalBalance)}\n` +
    `<i>⚡ Real-time balance snapshot from arthaX</i>`
  );
}

export function formatRecentExpenses(
  expenses: Array<{
    title: string;
    amount: number;
    category: string;
    expense_date?: string;
    account_name?: string;
  }>
): string {
  if (!expenses || expenses.length === 0) {
    return `📜 <b>Recent Expenses:</b>\n\n<i>No expenses recorded yet.</i>\n\nStart logging expenses by sending messages like <code>Dinner 450 HDFC</code>!`;
  }

  const items = expenses.map((e, index) => {
    const dateStr = e.expense_date ? ` • ${e.expense_date}` : "";
    const accStr = e.account_name ? ` • ${e.account_name}` : "";
    return (
      `${index + 1}. <b>${escapeTelegramHtml(e.title)}</b> — <b>${formatCurrencyINR(Number(e.amount) || 0)}</b>\n` +
      `   <i>${escapeTelegramHtml(e.category)}${escapeTelegramHtml(accStr)}${escapeTelegramHtml(dateStr)}</i>`
    );
  });

  return (
    `📜 <b>Recent Expenses (Last 5):</b>\n\n` +
    items.join("\n\n") +
    `\n\n<i>⚡ Use /summary for monthly breakdown</i>`
  );
}

export function formatSpendingSummary({
  todayTotal,
  monthTotal,
  expenseCount,
  topCategory,
}: {
  todayTotal: number;
  monthTotal: number;
  expenseCount: number;
  topCategory?: string;
}): string {
  return (
    `📊 <b>Spending Summary:</b>\n\n` +
    `📅 <b>Today:</b> ${formatCurrencyINR(todayTotal)}\n` +
    `🗓️ <b>This Month:</b> ${formatCurrencyINR(monthTotal)}\n` +
    `🧾 <b>Total Transactions:</b> ${expenseCount}\n` +
    (topCategory ? `🏆 <b>Top Category:</b> ${escapeTelegramHtml(topCategory)}\n\n` : `\n`) +
    `<i>⚡ View interactive visual breakdown on your arthaX Dashboard</i>`
  );
}

export function formatWelcomeMessage({
  botUsername,
  isLinked,
  userName,
  linkToken,
}: {
  botUsername?: string;
  isLinked: boolean;
  userName?: string;
  linkToken?: string;
}): string {
  const botDisplay = botUsername ? ` (@${botUsername})` : "";
  if (isLinked) {
    return (
      `👋 <b>Welcome back, ${escapeTelegramHtml(userName || "Friend")}!</b>\n\n` +
      `Your Telegram is linked to your <b>arthaX</b> account${botDisplay}. You can log expenses right from this chat.\n\n` +
      `<b>Quick Examples:</b>\n` +
      `• <code>Dinner 500 HDFC</code>\n` +
      `• <code>Petrol 1200 Cash</code>\n` +
      `• <code>Groceries 450 SBI</code>\n` +
      `• <code>Uber 320</code>\n` +
      `• Or forward/copy-paste any bank debit SMS!\n\n` +
      `<b>Available Commands:</b>\n` +
      `• /balance - View accounts & balances\n` +
      `• /recent - View last 5 expenses\n` +
      `• /summary - View today & monthly totals\n` +
      `• /help - Full command guide\n` +
      `• /unlink - Disconnect this Telegram chat`
    );
  }

  const tokenSnippet = linkToken ? `<code>/link ${linkToken}</code>` : `<code>/link &lt;YOUR_LINK_TOKEN&gt;</code>`;

  return (
    `👋 <b>Welcome to arthaX on Telegram!</b>${botDisplay}\n\n` +
    `Log expenses in under 2 seconds, check bank balances, and track daily spending without opening a browser.\n\n` +
    `🔒 <b>Link Your arthaX Account:</b>\n` +
    `1. Open arthaX on web &gt; <b>Settings &gt; Integrations &gt; Telegram</b>\n` +
    `2. Copy your 6-character Link Code\n` +
    `3. Reply here with: ${tokenSnippet}\n\n` +
    `<i>Once linked, all your natural messages and copied bank SMS alerts will be categorized and recorded automatically!</i>`
  );
}

export function formatHelpMessage(botUsername?: string): string {
  const botTag = botUsername ? `(@${botUsername}) ` : "";
  return (
    `🤖 <b>arthaX Telegram Bot Guide ${botTag}</b>\n\n` +
    `<b>Natural Expense Logging:</b>\n` +
    `• <code>Dinner 650 HDFC</code>\n` +
    `• <code>Petrol 1200 Cash</code>\n` +
    `• <code>Uber 320</code>\n\n` +
    `<b>Bank Debit SMS Forwarding:</b>\n` +
    `• Forward or paste any debit SMS from HDFC, SBI, ICICI, Axis, etc.\n\n` +
    `<b>Record Income:</b>\n` +
    `• <code>Salary 85000 HDFC</code>\n` +
    `• <code>Freelance 15000 SBI</code>\n` +
    `• <code>Dividend 450 Cash</code>\n\n` +
    `<b>Account Transfers:</b>\n` +
    `• <code>Transfer 5000 from HDFC to Cash</code>\n` +
    `• <code>Moved 2000 SBI to ICICI</code>\n\n` +
    `<b>Commands:</b>\n` +
    `• /balance - View accounts & liquid portfolio\n` +
    `• /budget - Category budgets & progress bars\n` +
    `• /summary - Today & monthly income/spending\n` +
    `• /recent - Last 5 recorded transactions\n` +
    `• /undo - Cancel your last recorded transaction\n` +
    `• /ai &lt;query&gt; - Financial advice via Gemini AI\n` +
    `• /link &lt;token&gt; - Pair your Telegram account\n` +
    `• /unlink - Disconnect this chat\n\n` +
    `<i>Each user's data is strictly partitioned by their unique Telegram Chat ID and protected with PostgreSQL Row-Level Security.</i>`
  );
}

export function formatIncomeConfirmation({
  amount,
  category,
  title,
  accountName,
  newBalance,
}: {
  amount: number;
  category: string;
  title: string;
  accountName: string;
  newBalance?: number;
}): string {
  const formattedAmount = formatCurrencyINR(amount);
  const formattedBalance = newBalance !== undefined ? formatCurrencyINR(newBalance) : null;

  return (
    `💰 <b>Income Recorded!</b>\n\n` +
    `📈 <b>Amount:</b> +${escapeTelegramHtml(formattedAmount)}\n` +
    `🏷️ <b>Category:</b> ${escapeTelegramHtml(category)}\n` +
    `📝 <b>Source:</b> ${escapeTelegramHtml(title)}\n` +
    `🏦 <b>Deposited To:</b> ${escapeTelegramHtml(accountName)}\n` +
    (formattedBalance ? `💳 <b>New Balance:</b> ${escapeTelegramHtml(formattedBalance)}\n\n` : `\n`) +
    `<i>⚡ Logged automatically in arthaX</i>`
  );
}

export function formatTransferConfirmation({
  amount,
  fromAccountName,
  toAccountName,
  fromBalance,
  toBalance,
}: {
  amount: number;
  fromAccountName: string;
  toAccountName: string;
  fromBalance?: number;
  toBalance?: number;
}): string {
  const formattedAmount = formatCurrencyINR(amount);
  const fromBalStr = fromBalance !== undefined ? ` (Bal: ${formatCurrencyINR(fromBalance)})` : "";
  const toBalStr = toBalance !== undefined ? ` (Bal: ${formatCurrencyINR(toBalance)})` : "";

  return (
    `🔄 <b>Transfer Recorded!</b>\n\n` +
    `💸 <b>Amount:</b> ${escapeTelegramHtml(formattedAmount)}\n` +
    `📤 <b>From:</b> ${escapeTelegramHtml(fromAccountName)}${fromBalStr}\n` +
    `📥 <b>To:</b> ${escapeTelegramHtml(toAccountName)}${toBalStr}\n\n` +
    `<i>⚡ Balances updated atomically across accounts</i>`
  );
}

export function formatBudgetSummary({
  budgets,
  monthName,
}: {
  budgets: Array<{
    category: string;
    budgeted: number;
    spent: number;
    percent: number;
  }>;
  monthName: string;
}): string {
  if (!budgets || budgets.length === 0) {
    return (
      `🎯 <b>Budgets (${escapeTelegramHtml(monthName)}):</b>\n\n` +
      `<i>No active budgets found for this month.</i>\n\n` +
      `Set up monthly category limits in arthaX &gt; Budgets!`
    );
  }

  let totalBudgeted = 0;
  let totalSpent = 0;

  const lines = budgets.map((b) => {
    totalBudgeted += b.budgeted;
    totalSpent += b.spent;

    const remaining = b.budgeted - b.spent;
    const isOver = remaining < 0;

    // Build 10-segment visual progress bar: e.g. [██████░░░░]
    const filledCount = Math.min(10, Math.max(0, Math.round(b.percent / 10)));
    const emptyCount = 10 - filledCount;
    const bar = "█".repeat(filledCount) + "░".repeat(emptyCount);

    const statusNote = isOver
      ? `⚠️ <i>Over budget by ${formatCurrencyINR(Math.abs(remaining))}!</i>`
      : `Remaining: ${formatCurrencyINR(remaining)}`;

    return (
      `• <b>${escapeTelegramHtml(b.category)}</b>\n` +
      `  ${formatCurrencyINR(b.spent)} / ${formatCurrencyINR(b.budgeted)} [${bar}] ${b.percent}%\n` +
      `  ${statusNote}`
    );
  });

  const overallPercent = totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 100) : 0;

  return (
    `🎯 <b>Budgets Overview (${escapeTelegramHtml(monthName)}):</b>\n\n` +
    lines.join("\n\n") +
    `\n\n` +
    `📊 <b>Total:</b> ${formatCurrencyINR(totalSpent)} / ${formatCurrencyINR(totalBudgeted)} (${overallPercent}%)\n` +
    `<i>⚡ Monitored real-time against current expenses</i>`
  );
}

export function formatUndoConfirmation({
  type,
  title,
  amount,
  accountName,
  restoredBalance,
}: {
  type: "expense" | "income";
  title: string;
  amount: number;
  accountName: string;
  restoredBalance?: number;
}): string {
  const formattedAmount = formatCurrencyINR(amount);
  const balStr = restoredBalance !== undefined ? `\n💳 <b>Adjusted Balance:</b> ${formatCurrencyINR(restoredBalance)}` : "";
  const verb = type === "expense" ? "Refunded to" : "Deducted from";

  return (
    `↩️ <b>Transaction Reverted!</b>\n\n` +
    `🗑️ <b>Cancelled:</b> ${escapeTelegramHtml(title)} (${escapeTelegramHtml(formattedAmount)})\n` +
    `🏦 <b>${verb}:</b> ${escapeTelegramHtml(accountName)}${balStr}\n\n` +
    `<i>⚡ Your ledger and account balance have been restored</i>`
  );
}

// -------------------------------------------------------------
// Interactive Inline Keyboards
// -------------------------------------------------------------

export function getStandardInlineKeyboard(webUrl: string = "https://arthax.vercel.app") {
  return {
    inline_keyboard: [
      [
        { text: "💳 Balances", callback_data: "action:balance" },
        { text: "🎯 Budgets", callback_data: "action:budget" },
      ],
      [
        { text: "📊 Summary", callback_data: "action:summary" },
        { text: "📜 Recent", callback_data: "action:recent" },
      ],
      [
        { text: "🌐 Open arthaX Web", url: webUrl },
      ],
    ],
  };
}

export function getExpenseActionKeyboard(expenseId: string) {
  return {
    inline_keyboard: [
      [
        { text: "↩️ Undo", callback_data: `undo:expense:${expenseId}` },
        { text: "💳 Balances", callback_data: "action:balance" },
        { text: "🎯 Budgets", callback_data: "action:budget" },
      ],
    ],
  };
}

export function getIncomeActionKeyboard(incomeId: string) {
  return {
    inline_keyboard: [
      [
        { text: "↩️ Undo", callback_data: `undo:income:${incomeId}` },
        { text: "💳 Balances", callback_data: "action:balance" },
        { text: "📊 Summary", callback_data: "action:summary" },
      ],
    ],
  };
}

export function getUnlinkedInlineKeyboard(webUrl: string = "https://arthax.vercel.app") {
  return {
    inline_keyboard: [
      [
        { text: "🔗 Open arthaX to Connect", url: `${webUrl}/#settings` },
      ],
    ],
  };
}
