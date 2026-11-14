import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getAuthenticatedUser } from "@/utils/auth";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { rateLimit } from "@/utils/rateLimit";
import { extractRequestId } from "@/utils/apiResponse";
import { logger } from "@/utils/logger";

function generateCode(): string {
  // Generates clean, human-readable 6-character uppercase alphanumeric code (e.g. AX-7K9P2X)
  const random = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `AX-${random}`;
}

export async function GET(req: NextRequest) {
  const requestId = extractRequestId(req);
  const { user, userId, error: authErr } = await getAuthenticatedUser(req);
  if (!user || !userId) {
    return NextResponse.json(
      { success: false, error: authErr || "Unauthorized", requestId },
      { status: 401, headers: { "X-Request-Id": requestId } }
    );
  }

  // Rate limit: 60 requests per minute per user
  const rl = await rateLimit(`tg_link_get:${userId}`, 60, 60);
  if (!rl.success) {
    return NextResponse.json(
      { success: false, error: "Too many requests. Please slow down.", requestId },
      { status: 429, headers: { "X-Request-Id": requestId } }
    );
  }

  try {
    const { data: settings } = await supabaseAdmin
      .from("user_settings")
      .select("id, name, telegram_chat_id, telegram_username, telegram_link_token, telegram_linked_at")
      .eq("id", userId)
      .maybeSingle();

    let linkToken = settings?.telegram_link_token;
    const userName = settings?.name || user.user_metadata?.full_name || user.email?.split("@")[0] || "User";

    // Generate link token if not present and not already linked
    if (!linkToken && !settings?.telegram_chat_id) {
      linkToken = generateCode();
      await supabaseAdmin
        .from("user_settings")
        .upsert(
          {
            id: userId,
            name: userName,
            telegram_link_token: linkToken,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );
    }

    const botUsername = process.env.TELEGRAM_BOT_USERNAME || "Artha_X_bot";
    const deepLink = linkToken
      ? `https://t.me/${botUsername}?start=${encodeURIComponent(linkToken)}`
      : `https://t.me/${botUsername}?start=${encodeURIComponent(userId)}`;

    return NextResponse.json(
      {
        success: true,
        is_linked: Boolean(settings?.telegram_chat_id),
        telegram_username: settings?.telegram_username || null,
        telegram_chat_id: settings?.telegram_chat_id || null,
        telegram_linked_at: settings?.telegram_linked_at || null,
        link_token: linkToken || null,
        bot_username: botUsername,
        deep_link: deepLink,
        requestId,
      },
      { headers: { "X-Request-Id": requestId } }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to retrieve telegram link status";
    logger.error("Error in GET telegram link status", "TelegramLinkAPI", err, { userId, requestId });
    return NextResponse.json(
      { success: false, error: msg, requestId },
      { status: 500, headers: { "X-Request-Id": requestId } }
    );
  }
}

export async function POST(req: NextRequest) {
  const requestId = extractRequestId(req);
  const { user, userId, error: authErr } = await getAuthenticatedUser(req);
  if (!user || !userId) {
    return NextResponse.json(
      { success: false, error: authErr || "Unauthorized", requestId },
      { status: 401, headers: { "X-Request-Id": requestId } }
    );
  }

  // Rate limit token generation/unlink actions: 15 per minute
  const rl = await rateLimit(`tg_link_post:${userId}`, 15, 60);
  if (!rl.success) {
    return NextResponse.json(
      { success: false, error: "Rate limit exceeded. Please try again shortly.", requestId },
      { status: 429, headers: { "X-Request-Id": requestId } }
    );
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { action?: string };
    const action = body.action || "generate_token";
    const botUsername = process.env.TELEGRAM_BOT_USERNAME || "Artha_X_bot";
    const userName = user.user_metadata?.full_name || user.email?.split("@")[0] || "User";

    if (action === "unlink") {
      const freshToken = generateCode();
      await supabaseAdmin
        .from("user_settings")
        .update({
          telegram_chat_id: null,
          telegram_username: null,
          telegram_linked_at: null,
          telegram_link_token: freshToken,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      await supabaseAdmin
        .from("family_members")
        .update({ telegram_chat_id: null, telegram_username: null })
        .eq("user_id", userId);

      logger.info(`User ${userId} unlinked Telegram`, "TelegramLinkAPI", { userId });

      return NextResponse.json(
        {
          success: true,
          is_linked: false,
          link_token: freshToken,
          message: "Telegram disconnected successfully.",
          requestId,
        },
        { headers: { "X-Request-Id": requestId } }
      );
    }

    // Default: generate fresh token
    const newToken = generateCode();
    await supabaseAdmin
      .from("user_settings")
      .upsert(
        {
          id: userId,
          name: userName,
          telegram_link_token: newToken,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

    const deepLink = `https://t.me/${botUsername}?start=${encodeURIComponent(newToken)}`;

    logger.info(`User ${userId} generated new link token: ${newToken}`, "TelegramLinkAPI", { userId });

    return NextResponse.json(
      {
        success: true,
        link_token: newToken,
        bot_username: botUsername,
        deep_link: deepLink,
        requestId,
      },
      { headers: { "X-Request-Id": requestId } }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update telegram token";
    logger.error("Error in POST telegram link", "TelegramLinkAPI", err, { userId, requestId });
    return NextResponse.json(
      { success: false, error: msg, requestId },
      { status: 500, headers: { "X-Request-Id": requestId } }
    );
  }
}
