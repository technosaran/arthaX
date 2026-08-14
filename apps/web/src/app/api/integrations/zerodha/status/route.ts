import { NextResponse } from "next/server";
import { isZerodhaEnabled, getZerodhaGlobalCredentials } from "@/lib/zerodha/zerodha-config";

export async function GET() {
  const enabled = isZerodhaEnabled();
  const { apiKey, apiSecret } = getZerodhaGlobalCredentials();
  const configured = Boolean(apiKey && apiSecret);

  return NextResponse.json({
    enabled,
    configured,
  });
}
