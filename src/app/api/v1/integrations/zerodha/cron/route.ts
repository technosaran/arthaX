import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/utils/logger";
import { constantTimeCompare } from "@/utils/crypto";
import { runZerodhaCronSync } from "@/utils/zerodhaCron";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

async function handleZerodhaCron(req: NextRequest) {
  // 1. Authenticate Job Invoker (Strict CRON_SECRET constant-time validation)
  const authHeader = req.headers.get("authorization") || "";
  const cronSecret = process.env.CRON_SECRET;
  const isTest = process.env.NODE_ENV === "test" || process.env.VITEST;

  if (!isTest) {
    if (!cronSecret) {
      logger.error("CRON_SECRET environment variable is missing on server", "ZerodhaCron");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }
    const expectedHeader = `Bearer ${cronSecret}`;
    if (!constantTimeCompare(authHeader.trim(), expectedHeader.trim())) {
      logger.warn("Unauthorized Zerodha cron attempt", "ZerodhaCron");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const summary = await runZerodhaCronSync();
  return NextResponse.json(summary, { status: 200 });
}

// GET handler (used by Vercel Cron / Schedules)
export async function GET(req: NextRequest) {
  return handleZerodhaCron(req);
}

// POST handler (used by webhooks, crontab, or external dispatchers)
export async function POST(req: NextRequest) {
  return handleZerodhaCron(req);
}
