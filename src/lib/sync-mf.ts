/**
 * AMFI India Mutual Fund Live NAV Sync Service
 * Uses 100% free AMFI India Open API (https://api.mfapi.in/mf/{scheme_code})
 * No API key required.
 */

import { createClient } from "@supabase/supabase-js";
import { logger } from "./logger";

export interface MFNavResult {
  schemeCode: string;
  schemeName: string;
  nav: number;
  date: string;
}

/**
 * Fetch latest NAV for a specific Indian Mutual Fund scheme code from AMFI API
 */
export async function fetchLiveMFNav(schemeCode: string): Promise<MFNavResult | null> {
  if (!schemeCode) return null;
  try {
    const res = await fetch(`https://api.mfapi.in/mf/${schemeCode}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;

    const data = await res.json();
    if (data && data.data && data.data.length > 0) {
      const latest = data.data[0];
      const nav = parseFloat(latest.nav);
      if (!isNaN(nav)) {
        return {
          schemeCode,
          schemeName: data.meta?.scheme_name || "Mutual Fund",
          nav,
          date: latest.date,
        };
      }
    }
    return null;
  } catch (err) {
    logger.error(`[AMFI MF Sync Error] Failed for scheme ${schemeCode}: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/**
 * Sync NAVs for all active mutual funds in the user's portfolio
 */
export async function syncAllMutualFundPrices(): Promise<{ updatedCount: number; error?: string }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return { updatedCount: 0, error: "Supabase credentials missing" };
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    let updatedCount = 0;

    // 1. Sync dedicated mutual_funds table
    const { data: dedicatedMf } = await supabase.from("mutual_funds").select("*");
    if (dedicatedMf && dedicatedMf.length > 0) {
      for (const mf of dedicatedMf) {
        const schemeCode = (mf.scheme_code || mf.fund_symbol || "").replace(/[^0-9]/g, "");
        if (!schemeCode || schemeCode.length < 5) continue;

        const navInfo = await fetchLiveMFNav(schemeCode);
        if (navInfo && navInfo.nav > 0) {
          const oldNav = mf.current_nav || mf.avg_nav || navInfo.nav;
          const dayChange = navInfo.nav - oldNav;
          const dayChangePct = oldNav > 0 ? (dayChange / oldNav) * 100 : 0;

          await supabase
            .from("mutual_funds")
            .update({
              previous_nav: oldNav,
              current_nav: navInfo.nav,
              day_change: Number(dayChange.toFixed(4)),
              day_change_percent: Number(dayChangePct.toFixed(2)),
              last_nav_updated_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", mf.id);

          updatedCount++;
        }
      }
    }

    // 2. Sync investments table (type = mutual_fund)
    const { data: mfList } = await supabase
      .from("investments")
      .select("id, symbol, name, current_price, quantity")
      .eq("type", "mutual_fund");

    if (mfList && mfList.length > 0) {
      for (const mf of mfList) {
        const schemeCode = mf.symbol?.replace(/[^0-9]/g, "");
        if (!schemeCode || schemeCode.length < 5) continue;

        const navInfo = await fetchLiveMFNav(schemeCode);
        if (navInfo && navInfo.nav > 0 && navInfo.nav !== mf.current_price) {
          await supabase
            .from("investments")
            .update({
              current_price: navInfo.nav,
              updated_at: new Date().toISOString(),
            })
            .eq("id", mf.id);

          updatedCount++;
        }
      }
    }

    return { updatedCount };
  } catch (err: any) {
    logger.error("[AMFI MF Sync All Error]:", err);
    return { updatedCount: 0, error: err.message };
  }
}
