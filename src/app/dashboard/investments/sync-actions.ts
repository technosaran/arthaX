"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export async function triggerMarketAndDividendSync() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const [marketRes, dividendRes] = await Promise.allSettled([
      fetch(`${origin}/api/cron/market-sync`, { cache: "no-store" }),
      fetch(`${origin}/api/cron/dividend-detector`, { cache: "no-store" }),
    ]);

    let marketData = null;
    let dividendData = null;

    if (marketRes.status === "fulfilled" && marketRes.value.ok) {
      marketData = await marketRes.value.json();
    }
    if (dividendRes.status === "fulfilled" && dividendRes.value.ok) {
      dividendData = await dividendRes.value.json();
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/investments");
    revalidatePath("/dashboard/stocks");
    revalidatePath("/dashboard/mutual-funds");
    revalidatePath("/dashboard/income");

    return {
      success: true,
      marketData,
      dividendData,
      message: `Market Sync & Dividend Detection Complete! Mutual Funds: ${marketData?.mutualFundsUpdated ?? 0} updated, Stocks: ${marketData?.stocksUpdated ?? 0} updated, Dividends: ${dividendData?.dividendsLogged ?? 0} logged.`,
    };
  } catch (err: any) {
    return { error: err.message || "Failed to sync market prices and dividends." };
  }
}
