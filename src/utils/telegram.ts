import crypto from "crypto";

export interface SendTelegramMessageOptions {
  chatId: string | number;
  text: string;
  parseMode?: "HTML" | "Markdown" | "MarkdownV2";
  replyMarkup?: Record<string, unknown>;
}

export interface SendTelegramPhotoOptions {
  chatId: string | number;
  photo: string;
  caption?: string;
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
 * Sends a photo or visual chart via Telegram Bot API with optional HTML caption and buttons.
 */
export async function sendTelegramPhoto({
  chatId,
  photo,
  caption,
  parseMode = "HTML",
  replyMarkup,
}: SendTelegramPhotoOptions): Promise<{
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
    const timeoutId = setTimeout(() => controller.abort(), 9000);

    const url = `https://api.telegram.org/bot${token}/sendPhoto`;
    const payload: Record<string, unknown> = {
      chat_id: cleanChatId,
      photo,
      parse_mode: parseMode,
    };

    if (caption) {
      payload.caption = caption;
    }

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
      console.warn("[Telegram API] sendPhoto failed:", data);
      return {
        success: false,
        error: data.description || `HTTP ${response.status}: Failed to send photo to Telegram`,
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
    console.error("[Telegram API] Photo request failed:", errMsg);
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
 * Registers native slash command autocomplete menu with Telegram Bot API
 */
export async function setTelegramBotCommands(): Promise<{ success: boolean; description?: string; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return { success: false, error: "TELEGRAM_BOT_TOKEN is not configured." };
  }

  const commands = [
    { command: "balance", description: "View accounts & liquid balances" },
    { command: "summary", description: "Today & monthly spending summary" },
    { command: "chart", description: "Visual spending breakdown chart" },
    { command: "portfolio", description: "Total Net Worth & asset overview" },
    { command: "stocks", description: "Indian stock portfolio & P&L" },
    { command: "quote", description: "Live stock quote (e.g. /quote RELIANCE)" },
    { command: "mf", description: "Mutual funds & SIP summary" },
    { command: "bullion", description: "Physical gold & silver holdings" },
    { command: "budget", description: "Category budgets & progress bars" },
    { command: "setbudget", description: "Set budget (e.g. /setbudget Food 5000)" },
    { command: "recent", description: "Last 5 recorded transactions" },
    { command: "undo", description: "Cancel last recorded transaction" },
    { command: "status", description: "Check connection & sync status" },
    { command: "ai", description: "Ask financial advice via Gemini AI" },
    { command: "help", description: "Full bot guide, voice & photo examples" },
    { command: "unlink", description: "Disconnect this Telegram chat" },
  ];

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commands }),
    });

    const data = (await res.json()) as TelegramApiResponse;
    if (!res.ok || !data.ok) {
      return { success: false, error: data.description || "Failed to set bot commands" };
    }
    return { success: true, description: "Commands registered successfully" };
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
  const secret = configuredSecret !== undefined ? configuredSecret : process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error("[Telegram Security] TELEGRAM_WEBHOOK_SECRET is not configured in production. Rejecting incoming webhook.");
      return false;
    }
    // If no secret configured in environment during development/testing, allow webhook through
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
// Telegram Deep Linking & Token Resolution Helpers
// -------------------------------------------------------------

/**
 * Parses and extracts a potential account linking token or identifier from user input.
 * Supports:
 * - /start <token>, /start@Bot <token>, /start=<token>
 * - /link <token>, /link@Bot <token>, /link:<token>
 * - /connect <token>, link <token>, connect <token>
 * - Standalone "AX-7K9P2X", "AX_7K9P2X", "AX7K9P2X"
 * - Standalone 6-character hex/alphanumeric code "7K9P2X" or "365CA9"
 * - Standalone Email address
 * - Standalone UUID
 */
export function extractTelegramLinkCandidate(text: string): string | null {
  if (!text) return null;
  const trimmed = text.trim();

  // 1. Slash commands: /start, /link, /connect (with optional @bot and token)
  const cmdMatch = trimmed.match(/^\/(?:start|link|connect)(?:@[a-zA-Z0-9_]+)?(?:[\s=:]+([^\s]+))?$/i);
  if (cmdMatch) {
    return cmdMatch[1]?.trim() || null;
  }

  // 2. Natural commands: "link 365CA9", "connect AX-365CA9", "pair AX-365CA9"
  const naturalMatch = trimmed.match(/^(?:link|connect|pair)[\s=:]+([^\s]+)$/i);
  if (naturalMatch) {
    return naturalMatch[1]?.trim() || null;
  }

  // 3. Standalone AX token format: "AX-7K9P2X", "AX_7K9P2X", "AX7K9P2X"
  const axMatch = trimmed.match(/^AX[-_]?([a-zA-Z0-9]{6})$/i);
  if (axMatch) {
    return `AX-${axMatch[1].toUpperCase()}`;
  }

  // 4. Standalone 6-character alphanumeric code: "365CA9" or "7K9P2X"
  if (/^[a-zA-Z0-9]{6}$/.test(trimmed)) {
    return `AX-${trimmed.toUpperCase()}`;
  }

  // 5. Standalone Email
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  // 6. Standalone UUID
  if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

/**
 * Generates all normalized search variations of a link token candidate
 * to guarantee robust database matching regardless of casing, hyphens, or prefixes.
 */
export function normalizeLinkTokenCandidates(candidate: string): string[] {
  if (!candidate) return [];
  const raw = candidate.trim();
  const upper = raw.toUpperCase();
  const normalized = upper.replace(/_/g, "-");

  const results = new Set<string>([raw, upper, normalized]);

  if (normalized.startsWith("AX-")) {
    results.add(normalized.slice(3));
  } else if (/^[A-Z0-9]{6}$/.test(normalized)) {
    results.add(`AX-${normalized}`);
  }

  return Array.from(results);
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
    const isValidLastFour = acc.last_four && acc.last_four.toUpperCase() !== "CASH" && /^\d+$/.test(acc.last_four.trim());
    const four = isValidLastFour ? ` (••${acc.last_four})` : "";
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
      `Your Telegram is linked to your <b>arthaX</b> account${botDisplay}. You can perform all financial actions right from this chat:\n\n` +
      `🎙️ <b>Voice &amp; Audio:</b> Send a voice note to log transactions, check balances, or ask advice!\n` +
      `📸 <b>Receipts &amp; Bills:</b> Send a photo of any receipt, bill, or UPI payment screenshot to scan &amp; record.\n\n` +
      `<b>Quick Examples:</b>\n` +
      `• <code>Dinner 500 HDFC</code>\n` +
      `• <code>Salary 85000 HDFC</code>\n` +
      `• <code>Transfer 5000 from HDFC to Cash</code>\n` +
      `• <code>Petrol 1200 Cash</code>\n` +
      `• <code>Groceries 450 SBI</code>\n` +
      `• <code>Uber 320</code>\n` +
      `• Or forward/copy-paste any bank debit SMS!\n\n` +
      `<b>Available Commands:</b>\n` +
      `• /balance - View accounts & balances\n` +
      `• /summary - View today & monthly totals\n` +
      `• /chart - Visual spending breakdown chart\n` +
      `• /portfolio - Total Net Worth & investments\n` +
      `• /stocks - Indian stock portfolio & P&L\n` +
      `• /quote &lt;symbol&gt; - Live stock quotes (e.g. /quote RELIANCE)\n` +
      `• /recent - View last 5 expenses\n` +
      `• /budget - Category budgets & progress\n` +
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
    `<i>Once linked, all your natural messages, voice notes, photos, and copied bank SMS alerts will be categorized and recorded automatically!</i>`
  );
}

export function formatHelpMessage(botUsername?: string): string {
  const botTag = botUsername ? `(@${botUsername}) ` : "";
  return (
    `🤖 <b>arthaX Telegram Bot Guide ${botTag}</b>\n\n` +
    `🎙️ <b>Voice Actions (Speak to Bot):</b>\n` +
    `• <i>"Logged 450 for lunch with HDFC"</i>\n` +
    `• <i>"Received 75000 salary in SBI"</i>\n` +
    `• <i>"What is my bank balance?"</i>\n` +
    `• <i>"Show my spending chart"</i>\n` +
    `• <i>"What is my total net worth?"</i>\n` +
    `• <i>"How is my stock portfolio doing?"</i>\n\n` +
    `📸 <b>Receipts &amp; Screenshots:</b>\n` +
    `• Send photos of restaurant receipts, fuel slips, or grocery bills\n` +
    `• Send UPI payment screenshots (GPay, PhonePe, Paytm, BHIM)\n` +
    `• AI extracts merchant, amount, category, and logs it automatically!\n\n` +
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
    `• /setbudget &lt;category&gt; &lt;amount&gt; - Set monthly budget limit\n` +
    `• /summary - Today & monthly income/spending\n` +
    `• /chart - Visual spending breakdown chart image\n` +
    `• /portfolio - Total Net Worth & investments\n` +
    `• /stocks - Indian stock portfolio & P&L\n` +
    `• /quote &lt;symbol&gt; - Live stock quote (e.g. /quote RELIANCE)\n` +
    `• /addstock &lt;sym&gt; &lt;qty&gt; &lt;price&gt; - Record stock purchase\n` +
    `• /mf - Mutual fund portfolio & SIP summary\n` +
    `• /bullion - Physical gold & silver holdings\n` +
    `• /recent - Last 5 recorded transactions\n` +
    `• /undo - Cancel your last recorded transaction\n` +
    `• /ai &lt;query&gt; - Financial advice via Gemini AI\n` +
    `• /status - Check sync & connection status\n` +
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

export function formatStatusMessage({
  userName,
  accountCount,
  totalPortfolio,
  botUsername,
  linkedAt,
}: {
  userName: string;
  accountCount: number;
  totalPortfolio: number;
  botUsername?: string;
  linkedAt?: string | null;
}): string {
  const botDisplay = botUsername ? ` (@${botUsername})` : "";
  const linkedStr = linkedAt
    ? new Date(linkedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "Active";

  return (
    `⚡ <b>arthaX Connection Status</b>\n\n` +
    `🟢 <b>Status:</b> Connected &amp; Synchronized\n` +
    `👤 <b>Workspace:</b> ${escapeTelegramHtml(userName)}\n` +
    `💳 <b>Linked Accounts:</b> ${accountCount}\n` +
    `💰 <b>Liquid Portfolio:</b> ${formatCurrencyINR(totalPortfolio)}\n` +
    `📅 <b>Connected Since:</b> ${escapeTelegramHtml(linkedStr)}\n` +
    `🤖 <b>Bot Engine:</b> arthaX Core v2.0${botDisplay}\n\n` +
    `<i>⚡ All natural messages and forwarded bank SMS are processed in real-time.</i>`
  );
}

export function formatPortfolioOverview({
  accountsTotal,
  stocksTotal,
  mfTotal,
  bullionTotal,
  bondsTotal = 0,
  cryptoTotal = 0,
  liabilitiesTotal = 0,
  netWorth,
  userName,
}: {
  accountsTotal: number;
  stocksTotal: number;
  mfTotal: number;
  bullionTotal: number;
  bondsTotal?: number;
  cryptoTotal?: number;
  liabilitiesTotal?: number;
  netWorth: number;
  userName?: string;
}): string {
  const greeting = userName ? ` (${escapeTelegramHtml(userName)})` : "";
  let text =
    `💼 <b>Total Net Worth &amp; Portfolio${greeting}</b>\n\n` +
    `🏦 <b>Bank &amp; Cash Accounts:</b> ${formatCurrencyINR(accountsTotal)}\n` +
    `💹 <b>Indian Equities (Stocks):</b> ${formatCurrencyINR(stocksTotal)}\n` +
    `📊 <b>Mutual Funds &amp; SIPs:</b> ${formatCurrencyINR(mfTotal)}\n` +
    `🪙 <b>Bullion (Gold &amp; Silver):</b> ${formatCurrencyINR(bullionTotal)}\n`;

  if (bondsTotal > 0) {
    text += `🛡️ <b>Bonds &amp; Sovereign Debt:</b> ${formatCurrencyINR(bondsTotal)}\n`;
  }
  if (cryptoTotal > 0) {
    text += `⚡ <b>Crypto Assets:</b> ${formatCurrencyINR(cryptoTotal)}\n`;
  }
  if (liabilitiesTotal > 0) {
    text += `💳 <b>Total Liabilities:</b> -${formatCurrencyINR(liabilitiesTotal)}\n`;
  }

  text +=
    `━━━━━━━━━━━━━━━━━━━\n` +
    `💎 <b>Total Net Worth:</b>\n` +
    `<b>${formatCurrencyINR(netWorth)}</b>\n\n` +
    `<i>⚡ Real-time consolidated valuation across all assets</i>`;

  return text;
}

export function formatStocksSummary({
  holdings,
  totalInvested,
  totalCurrent,
  totalPnl,
  totalPnlPercent,
}: {
  holdings: Array<{
    symbol: string;
    exchange: string;
    quantity: number;
    avg_buy_price: number;
    current_price?: number;
    pnl?: number;
    pnl_percent?: number;
  }>;
  totalInvested: number;
  totalCurrent: number;
  totalPnl: number;
  totalPnlPercent: number;
}): string {
  if (!holdings || holdings.length === 0) {
    return (
      `💹 <b>Indian Stock Holdings:</b>\n\n` +
      `<i>No stock holdings recorded yet.</i>\n\n` +
      `Add stocks with <code>/addstock &lt;SYMBOL&gt; &lt;QTY&gt; &lt;PRICE&gt;</code> or connect Zerodha in Settings!`
    );
  }

  const pnlSign = totalPnl >= 0 ? "+" : "";
  const pnlEmoji = totalPnl >= 0 ? "🟢" : "🔴";

  const rows = holdings.slice(0, 8).map((h) => {
    const curPriceStr = h.current_price ? ` @ ${formatCurrencyINR(h.current_price)}` : "";
    const pnlStr = h.pnl !== undefined
      ? ` (${h.pnl >= 0 ? "+" : ""}${formatCurrencyINR(h.pnl)})`
      : "";
    return `• <b>${escapeTelegramHtml(h.symbol)}</b> (${h.quantity} shares)${curPriceStr}\n` +
      `  Avg: ${formatCurrencyINR(h.avg_buy_price)}${pnlStr}`;
  });

  return (
    `💹 <b>Indian Stock Portfolio:</b>\n\n` +
    rows.join("\n\n") +
    `\n\n━━━━━━━━━━━━━━━━━━━\n` +
    `💰 <b>Invested:</b> ${formatCurrencyINR(totalInvested)}\n` +
    (totalCurrent > 0 ? `📈 <b>Current Value:</b> ${formatCurrencyINR(totalCurrent)}\n` : "") +
    `${pnlEmoji} <b>Total P&amp;L:</b> ${pnlSign}${formatCurrencyINR(totalPnl)} (${pnlSign}${totalPnlPercent.toFixed(2)}%)\n\n` +
    `<i>⚡ Use /quote &lt;SYMBOL&gt; for live stock quotes</i>`
  );
}

export function formatStockQuote(quote: {
  symbol: string;
  exchange: string;
  companyName?: string;
  currentPrice: number;
  previousClose?: number;
  change: number;
  changePercent: number;
  dayHigh?: number;
  dayLow?: number;
}): string {
  const isPositive = quote.change >= 0;
  const pnlSign = isPositive ? "+" : "";
  const pnlEmoji = isPositive ? "🟢" : "🔴";

  return (
    `📈 <b>${escapeTelegramHtml(quote.companyName || quote.symbol)}</b> (<code>${escapeTelegramHtml(quote.symbol)}:${escapeTelegramHtml(quote.exchange)}</code>)\n\n` +
    `💵 <b>LTP:</b> ${formatCurrencyINR(quote.currentPrice)}\n` +
    `${pnlEmoji} <b>Change:</b> ${pnlSign}${formatCurrencyINR(quote.change)} (${pnlSign}${quote.changePercent.toFixed(2)}%)\n` +
    (quote.dayHigh && quote.dayLow
      ? `📊 <b>Range:</b> ${formatCurrencyINR(quote.dayLow)} - ${formatCurrencyINR(quote.dayHigh)}\n`
      : "") +
    (quote.previousClose ? `⏮️ <b>Prev Close:</b> ${formatCurrencyINR(quote.previousClose)}\n\n` : "\n") +
    `<i>⚡ Real-time market feed from NSE/BSE</i>`
  );
}

export function formatMutualFundsSummary({
  holdings,
  totalInvested,
  totalCurrent,
  totalPnl,
}: {
  holdings: Array<{
    scheme_name: string;
    units: number;
    avg_nav: number;
    current_nav?: number;
    invested_amount: number;
    is_sip_active?: boolean;
    sip_amount?: number;
  }>;
  totalInvested: number;
  totalCurrent: number;
  totalPnl: number;
}): string {
  if (!holdings || holdings.length === 0) {
    return (
      `📊 <b>Mutual Funds Portfolio:</b>\n\n` +
      `<i>No mutual fund holdings found.</i>\n\n` +
      `Import your Zerodha Coin or CAS statement in arthaX &gt; Mutual Funds.`
    );
  }

  const pnlSign = totalPnl >= 0 ? "+" : "";
  const pnlEmoji = totalPnl >= 0 ? "🟢" : "🔴";
  const pnlPercent = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

  const rows = holdings.slice(0, 6).map((mf) => {
    const sipTag = mf.is_sip_active ? ` <i>[SIP: ${formatCurrencyINR(Number(mf.sip_amount) || 0)}]</i>` : "";
    const navVal = (mf.current_nav || mf.avg_nav) * mf.units;
    return `• <b>${escapeTelegramHtml(mf.scheme_name.slice(0, 35))}...</b>${sipTag}\n` +
      `  Units: ${mf.units.toFixed(2)} | Invested: ${formatCurrencyINR(mf.invested_amount)} | Value: ${formatCurrencyINR(navVal)}`;
  });

  return (
    `📊 <b>Mutual Funds Portfolio:</b>\n\n` +
    rows.join("\n\n") +
    `\n\n━━━━━━━━━━━━━━━━━━━\n` +
    `💰 <b>Invested:</b> ${formatCurrencyINR(totalInvested)}\n` +
    `📈 <b>Current Value:</b> ${formatCurrencyINR(totalCurrent)}\n` +
    `${pnlEmoji} <b>Total P&amp;L:</b> ${pnlSign}${formatCurrencyINR(totalPnl)} (${pnlSign}${pnlPercent.toFixed(2)}%)\n\n` +
    `<i>⚡ Daily updated AMFI NAV valuation</i>`
  );
}

export function formatBullionSummary({
  goldGrams,
  goldValue,
  silverGrams,
  silverValue,
  totalValue,
}: {
  goldGrams: number;
  goldValue: number;
  silverGrams: number;
  silverValue: number;
  totalValue: number;
}): string {
  if (goldGrams === 0 && silverGrams === 0) {
    return (
      `🪙 <b>Bullion &amp; Precious Metals:</b>\n\n` +
      `<i>No gold or silver holdings recorded yet.</i>\n\n` +
      `Track your coins, bars, and jewelry in arthaX &gt; Bullion Tracker!`
    );
  }

  return (
    `🪙 <b>Physical Bullion Portfolio:</b>\n\n` +
    `🟡 <b>Gold Holdings:</b> ${goldGrams.toFixed(2)} grams (~${formatCurrencyINR(goldValue)})\n` +
    `⚪ <b>Silver Holdings:</b> ${silverGrams.toFixed(2)} grams (~${formatCurrencyINR(silverValue)})\n\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `💎 <b>Total Bullion Valuation:</b> ${formatCurrencyINR(totalValue)}\n\n` +
    `<i>⚡ Valued with live 24K Gold and 999 Silver bullion rates</i>`
  );
}

export function formatBudgetSetConfirmation({
  category,
  amount,
  monthName,
}: {
  category: string;
  amount: number;
  monthName: string;
}): string {
  return (
    `🎯 <b>Budget Set Successfully!</b>\n\n` +
    `🏷️ <b>Category:</b> ${escapeTelegramHtml(category)}\n` +
    `💰 <b>Monthly Limit:</b> ${formatCurrencyINR(amount)}\n` +
    `📅 <b>Period:</b> ${escapeTelegramHtml(monthName)}\n\n` +
    `<i>⚡ Monitored real-time against your logged expenses</i>`
  );
}

export function formatStockAddConfirmation({
  symbol,
  quantity,
  price,
  exchange,
}: {
  symbol: string;
  quantity: number;
  price: number;
  exchange: string;
}): string {
  return (
    `💹 <b>Stock Holding Recorded!</b>\n\n` +
    `📌 <b>Symbol:</b> <code>${escapeTelegramHtml(symbol)}:${escapeTelegramHtml(exchange)}</code>\n` +
    `🔢 <b>Quantity:</b> ${quantity} shares\n` +
    `💵 <b>Buy Price:</b> ${formatCurrencyINR(price)}\n` +
    `💰 <b>Total Value:</b> ${formatCurrencyINR(quantity * price)}\n\n` +
    `<i>⚡ Synced directly with your arthaX portfolio</i>`
  );
}

export function getQuickChartSpendingUrl({
  categories,
  amounts,
  title = "Monthly Spending",
}: {
  categories: string[];
  amounts: number[];
  title?: string;
}): string {
  if (!categories.length || !amounts.length) {
    return "";
  }

  const colors = [
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#ec4899",
    "#06b6d4",
    "#14b8a6",
    "#f97316",
    "#6366f1",
  ];

  const chartConfig = {
    type: "doughnut",
    data: {
      labels: categories.slice(0, 8),
      datasets: [
        {
          data: amounts.slice(0, 8),
          backgroundColor: colors.slice(0, Math.min(categories.length, 8)),
          borderColor: "#18181b",
          borderWidth: 2,
        },
      ],
    },
    options: {
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: "#e4e4e7",
            font: { size: 12, family: "sans-serif" },
            padding: 12,
          },
        },
        title: {
          display: true,
          text: title,
          color: "#f4f4f5",
          font: { size: 16, weight: "bold", family: "sans-serif" },
          padding: { top: 10, bottom: 15 },
        },
      },
    },
  };

  const encoded = encodeURIComponent(JSON.stringify(chartConfig));
  return `https://quickchart.io/chart?c=${encoded}&w=500&h=350&bkg=%2309090b`;
}

// -------------------------------------------------------------
// Interactive Inline Keyboards
// -------------------------------------------------------------

export function getStandardInlineKeyboard(webUrl: string = "https://arthax.vercel.app") {
  return {
    inline_keyboard: [
      [
        { text: "💳 Balances", callback_data: "action:balance" },
        { text: "📊 Summary", callback_data: "action:summary" },
      ],
      [
        { text: "🎯 Budgets", callback_data: "action:budget" },
        { text: "📈 Chart", callback_data: "action:chart" },
      ],
      [
        { text: "💼 Portfolio", callback_data: "action:portfolio" },
        { text: "💹 Stocks", callback_data: "action:stocks" },
      ],
      [
        { text: "📜 Recent", callback_data: "action:recent" },
        { text: "⚡ Status", callback_data: "action:status" },
      ],
      [
        { text: "🌐 Open arthaX Dashboard", url: webUrl },
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

/**
 * Downloads a file (voice, audio, photo, document) from Telegram servers using getFile API
 */
export async function getTelegramFileBuffer(fileId: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;

  try {
    const fileRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
    const fileData = await fileRes.json();
    if (!fileData.ok || !fileData.result?.file_path) {
      console.error("[Telegram getFile] Error:", fileData);
      return null;
    }
    const filePath = fileData.result.file_path;
    const downloadUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;
    const res = await fetch(downloadUrl);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let mimeType = "application/octet-stream";
    if (filePath.endsWith(".oga") || filePath.endsWith(".ogg")) mimeType = "audio/ogg";
    else if (filePath.endsWith(".mp3")) mimeType = "audio/mp3";
    else if (filePath.endsWith(".m4a")) mimeType = "audio/m4a";
    else if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) mimeType = "image/jpeg";
    else if (filePath.endsWith(".png")) mimeType = "image/png";
    else if (filePath.endsWith(".pdf")) mimeType = "application/pdf";

    return { buffer, mimeType };
  } catch (err) {
    console.error("[Telegram getTelegramFileBuffer Error]:", err);
    return null;
  }
}

/**
 * Interactive 1-Tap Category Picker Keyboard for Ambiguous Expenses
 */
export function getAmbiguousExpenseKeyboard(expenseId: string) {
  return {
    inline_keyboard: [
      [
        { text: "🍔 Food", callback_data: `cat:${expenseId}:Food & Dining` },
        { text: "🛒 Groceries", callback_data: `cat:${expenseId}:Groceries & Essentials` },
        { text: "🚗 Fuel/Ride", callback_data: `cat:${expenseId}:Transport & Fuel` },
      ],
      [
        { text: "🛍️ Shopping", callback_data: `cat:${expenseId}:Shopping & Lifestyle` },
        { text: "⚡ Bills", callback_data: `cat:${expenseId}:Utilities & Bills` },
        { text: "💊 Health", callback_data: `cat:${expenseId}:Health & Medical` },
      ],
      [
        { text: "↩️ Undo", callback_data: `undo:expense:${expenseId}` },
        { text: "💳 Balances", callback_data: "action:balance" },
      ],
    ],
  };
}

