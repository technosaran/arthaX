import { NextRequest, NextResponse } from "next/server";
import { setTelegramWebhook, getTelegramWebhookInfo, deleteTelegramWebhook, setTelegramBotCommands } from "@/utils/telegram";
import { constantTimeCompare } from "@/utils/crypto";

/**
 * Validates admin authorization for Telegram webhook maintenance.
 * Protects against hostile webhook redirection and man-in-the-middle attacks.
 */
function verifyAdminAuth(req: NextRequest): boolean {
  if (process.env.NODE_ENV === "test" || process.env.VITEST) {
    return true;
  }

  const adminKey = process.env.ADMIN_API_KEY || process.env.CRON_SECRET;
  if (!adminKey) {
    // If no admin secret is configured, fail-closed to prevent exposure
    return false;
  }

  const providedKey =
    req.headers.get("x-admin-key") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    "";

  return constantTimeCompare(providedKey.trim(), adminKey.trim());
}

/**
 * Telegram Webhook Setup & Inspection Endpoint
 * GET: Retrieves current webhook registration info from Telegram API
 * POST: Automatically registers or updates the webhook URL and syncs bot slash commands
 * DELETE: Unregisters the webhook
 */

export async function GET(req: NextRequest) {
  if (!verifyAdminAuth(req)) {
    return NextResponse.json({ error: "Unauthorized: Admin privileges required." }, { status: 401 });
  }

  const info = await getTelegramWebhookInfo();
  return NextResponse.json(info);
}

export async function POST(req: NextRequest) {
  if (!verifyAdminAuth(req)) {
    return NextResponse.json({ error: "Unauthorized: Admin privileges required." }, { status: 401 });
  }

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

export async function DELETE(req: NextRequest) {
  if (!verifyAdminAuth(req)) {
    return NextResponse.json({ error: "Unauthorized: Admin privileges required." }, { status: 401 });
  }

  const res = await deleteTelegramWebhook();
  return NextResponse.json(res);
}
