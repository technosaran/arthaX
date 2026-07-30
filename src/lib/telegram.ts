/**
 * Shared Telegram Bot API helper
 * Used by both telegram-sync webhook and telegram-alerts cron routes
 */

/**
 * Send a message to a Telegram chat with automatic Markdown fallback.
 * If Telegram rejects the Markdown parse, retries as plain text.
 */
export async function sendTelegramMessage(
  chatId: string,
  text: string,
  replyMarkup?: any
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error("Missing TELEGRAM_BOT_TOKEN in environment variables");
    return;
  }

  try {
    const payload: any = {
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
    };
    if (replyMarkup) {
      payload.reply_markup = replyMarkup;
    }

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errBody = await res.text();
      console.error(`Telegram API error (${res.status}): ${errBody}`);
      // If Telegram failed due to Markdown entity parsing issues, retry as plain text
      if (res.status === 400 && /can't parse entities/i.test(errBody)) {
        const plainPayload: any = { chat_id: chatId, text };
        if (replyMarkup) plainPayload.reply_markup = replyMarkup;
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(plainPayload),
        });
      }
    }
  } catch (error) {
    console.error("Failed to send Telegram message:", error);
  }
}

/**
 * Acknowledge an inline keyboard callback query tap from Telegram UI
 */
export async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
    });
  } catch (err) {
    console.error("Failed to answer callback query:", err);
  }
}

/**
 * Register official bot commands with Telegram API so users get auto-complete when typing '/'
 */
export async function setTelegramBotCommands(): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    const commands = [
      { command: "balance", description: "💳 Accounts & Net Worth" },
      { command: "summary", description: "📊 Monthly Flow & Savings" },
      { command: "history", description: "📜 Recent Transactions" },
      { command: "ai", description: "🤖 AI Wealth Score & Insights" },
      { command: "budget", description: "🎯 Category Budgets Status" },
      { command: "goals", description: "🏆 Financial Goals Progress" },
      { command: "help", description: "💡 Commands & Assistant Guide" },
    ];
    await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commands }),
    });
  } catch (err) {
    console.error("Failed to set Telegram bot commands:", err);
  }
}

/**
 * Get curated brand/bank emoji icon matching web app brand registry
 */
export function getBrandEmoji(name: string): string {
  if (!name) return "💳";
  const clean = name.toLowerCase().trim();
  if (/sbi|state bank/i.test(clean)) return "🏦";
  if (/hdfc/i.test(clean)) return "💳";
  if (/icici/i.test(clean)) return "🏦";
  if (/axis/i.test(clean)) return "💳";
  if (/kotak/i.test(clean)) return "🏦";
  if (/pnb|bob|canara|union|boi|iob|uco/i.test(clean)) return "🏛️";
  if (/swiggy|zomato|eats|food/i.test(clean)) return "🍔";
  if (/uber|ola|rapido|cab|taxi/i.test(clean)) return "🚗";
  if (/amazon|flipkart|myntra|ajio|shopping/i.test(clean)) return "🛍️";
  if (/apple|iphone|mac/i.test(clean)) return "🍎";
  if (/google|pay|gpay/i.test(clean)) return "🌐";
  if (/netflix|spotify|prime|pvr|movie/i.test(clean)) return "🎬";
  if (/starbucks|coffee|cafe|tea/i.test(clean)) return "☕";
  if (/petrol|fuel|shell|bpcl|hpcl/i.test(clean)) return "⛽";
  if (/salary|payroll|stipend/i.test(clean)) return "💼";
  if (/dividend|interest|stock|share|crypto|btc|eth/i.test(clean)) return "💎";
  if (/rent|house|electricity|bill|utility/i.test(clean)) return "💡";
  return "🏷️";
}
