import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getAuthenticatedUser } from "@/utils/auth";
import { supabaseAdmin } from "@/utils/supabase/admin";

function generateCode(): string {
  // Generates clean, human-readable 6-character uppercase alphanumeric code (e.g. AX-7K9P2X)
  const random = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `AX-${random}`;
}

export async function GET(req: NextRequest) {
  const { user, userId, error: authErr } = await getAuthenticatedUser(req);
  if (!user || !userId) {
    return NextResponse.json({ success: false, error: authErr || "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: settings } = await supabaseAdmin
      .from("user_settings")
      .select("id, telegram_chat_id, telegram_username, telegram_link_token, telegram_linked_at")
      .eq("id", userId)
      .maybeSingle();

    let linkToken = settings?.telegram_link_token;

    // Generate link token if not present
    if (!linkToken && !settings?.telegram_chat_id) {
      linkToken = generateCode();
      await supabaseAdmin
        .from("user_settings")
        .upsert(
          {
            id: userId,
            telegram_link_token: linkToken,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );
    }

    const botUsername = process.env.TELEGRAM_BOT_USERNAME || "Artha_X_bot";

    return NextResponse.json({
      success: true,
      is_linked: Boolean(settings?.telegram_chat_id),
      telegram_username: settings?.telegram_username || null,
      telegram_chat_id: settings?.telegram_chat_id || null,
      telegram_linked_at: settings?.telegram_linked_at || null,
      link_token: linkToken || null,
      bot_username: botUsername,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to retrieve telegram link status";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { user, userId, error: authErr } = await getAuthenticatedUser(req);
  if (!user || !userId) {
    return NextResponse.json({ success: false, error: authErr || "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { action?: string };
    const action = body.action || "generate_token";

    if (action === "unlink") {
      await supabaseAdmin
        .from("user_settings")
        .update({
          telegram_chat_id: null,
          telegram_username: null,
          telegram_linked_at: null,
          telegram_link_token: generateCode(),
        })
        .eq("id", userId);

      await supabaseAdmin
        .from("family_members")
        .update({ telegram_chat_id: null, telegram_username: null })
        .eq("user_id", userId);

      return NextResponse.json({
        success: true,
        is_linked: false,
        message: "Telegram disconnected successfully.",
      });
    }

    // Default: generate fresh token
    const newToken = generateCode();
    await supabaseAdmin
      .from("user_settings")
      .upsert(
        {
          id: userId,
          telegram_link_token: newToken,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

    const botUsername = process.env.TELEGRAM_BOT_USERNAME || "Artha_X_bot";

    return NextResponse.json({
      success: true,
      link_token: newToken,
      bot_username: botUsername,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update telegram token";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
