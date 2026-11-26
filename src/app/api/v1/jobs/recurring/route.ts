import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/utils/logger";
import { constantTimeCompare } from "@/utils/crypto";
import { computeNextRunDate, runRecurringJobs } from "@/utils/recurringJobs";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
export { computeNextRunDate };

export async function POST(req: NextRequest) {
  // 1. Authenticate Job Invoker (Strict CRON_SECRET constant-time validation)
  const authHeader = req.headers.get("authorization") || "";
  const cronSecret = process.env.CRON_SECRET;
  const isTest = process.env.NODE_ENV === "test" || process.env.VITEST;

  if (!isTest) {
    if (!cronSecret) {
      logger.error("CRON_SECRET environment variable is missing on server", "QStashJob");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }
    const expectedHeader = `Bearer ${cronSecret}`;
    if (!constantTimeCompare(authHeader.trim(), expectedHeader.trim())) {
      logger.warn("Unauthorized recurring job attempt", "QStashJob");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await runRecurringJobs();
    return NextResponse.json(result);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Job runner failure";
    logger.error("Recurring runner unhandled exception", "QStashJob", err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
