import { NextResponse } from "next/server";
import { isBinanceEnabled, getBinanceGlobalCredentials } from "@/lib/binance/binance-config";

export async function GET() {
  const enabled = isBinanceEnabled();
  const { apiKey, apiSecret } = getBinanceGlobalCredentials();
  const configured = Boolean(apiKey && apiSecret);

  return NextResponse.json({
    enabled,
    configured,
  });
}
