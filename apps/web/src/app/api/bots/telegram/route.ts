import { NextRequest } from "next/server";
import { POST as handleTelegramSync } from "@/app/api/transactions/telegram-sync/route";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return handleTelegramSync(request);
}
