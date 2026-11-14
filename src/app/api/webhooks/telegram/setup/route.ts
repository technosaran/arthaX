import { NextRequest, NextResponse } from "next/server";
import { setTelegramWebhook, getTelegramWebhookInfo, deleteTelegramWebhook, setTelegramBotCommands } from "@/utils/telegram";

/**
 * Telegram Webhook Setup & Inspection Endpoint
 * GET: Retrieves current webhook registration info from Telegram API
 * POST: Automatically registers or updates the webhook URL and syncs bot slash commands
 * DELETE: Unregisters the webhook
 */

export async function GET() {
  const info = await getTelegramWebhookInfo();
  return NextResponse.json(info);
}

export async function POST(req: NextRequest) {
  try {
    let body: { webhook_url?: string; secret_token?: string } = {};
    try {
      body = (await req.json()) as typeof body;
    } catch {}

    // Infer default URL from request host if not explicitly provided
    let webhookUrl = body.webhook_url;
    if (!webhookUrl) {
      const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
      const proto = req.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
      webhookUrl = `${proto}://${host}/api/webhooks/telegram`;
    }

    const secretToken = body.secret_token || process.env.TELEGRAM_WEBHOOK_SECRET;

    const res = await setTelegramWebhook({
      webhookUrl,
      secretToken,
    });

    // Also register native slash commands menu on Telegram
    const commandsRes = await setTelegramBotCommands();

    return NextResponse.json({
      target_url: webhookUrl,
      result: res,
      commands: commandsRes,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error configuring Telegram webhook";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  const res = await deleteTelegramWebhook();
  return NextResponse.json(res);
}
