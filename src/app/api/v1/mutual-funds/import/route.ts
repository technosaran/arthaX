import { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/utils/auth";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { apiUnauthorized, apiError, apiSuccess } from "@/utils/apiResponse";
import { rateLimit } from "@/utils/rateLimit";
import { invalidateUserCaches } from "@/lib/backend/cacheInvalidation";
import { inferCategoryAndAsset, inferFundHouse } from "../search/route";

interface ParsedImportRow {
  schemeCode: string;
  schemeName: string;
  fundHouse: string;
  category: string;
  assetClass: "Equity" | "Debt" | "Hybrid" | "Commodity" | "Other";
  folioNumber: string;
  units: number;
  avgNav: number;
  investedAmount: number;
  currentNav: number;
  isin?: string | null;
  planType: "Direct" | "Regular";
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export async function POST(req: NextRequest) {
  const { user, userId, error: authError } = await getAuthenticatedUser(req);

  if (!user || !userId) {
    return apiUnauthorized(authError || "Unauthorized", req);
  }

  // Rate limit: 15 imports per minute to prevent DoS & resource exhaustion
  const rl = await rateLimit(`mf_import:${userId}`, 15, 60);
  if (!rl.success) {
    return apiError("Too many import requests. Please wait a moment.", "RATE_LIMITED", 429, undefined, req);
  }

  try {
    const body = await req.json();
    let rowsToProcess: Record<string, unknown>[] = [];

    if (body.csvText && typeof body.csvText === "string") {
      // Bound max CSV payload size (1MB limit)
      if (body.csvText.length > 1024 * 1024) {
        return apiError("CSV payload too large. Maximum size is 1MB.", "BAD_REQUEST", 400, undefined, req);
      }

      // Parse CSV text
      const lines = body.csvText
        .split(/\r?\n/)
        .map((l: string) => l.trim())
        .filter(Boolean);

      if (lines.length < 2) {
        return apiError("CSV must contain a header row and at least one data row.", "BAD_REQUEST", 400, undefined, req);
      }

      if (lines.length > 500) {
        return apiError("CSV exceeds the maximum limit of 500 rows per import.", "BAD_REQUEST", 400, undefined, req);
      }

      const headers = parseCSVLine(lines[0]).map((h) =>
        h.toLowerCase().replace(/[^a-z0-9]/g, "")
      );

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length <= 1) continue;

        const rowObj: Record<string, string> = {};
        headers.forEach((h, idx) => {
          rowObj[h] = values[idx] || "";
        });
        rowsToProcess.push(rowObj);
      }
    } else if (Array.isArray(body.holdings)) {
      if (body.holdings.length > 500) {
        return apiError("Holdings array exceeds maximum limit of 500 items.", "BAD_REQUEST", 400, undefined, req);
      }
      rowsToProcess = body.holdings;
    } else {
      return apiError("Please provide either 'csvText' or 'holdings' array in request body.", "BAD_REQUEST", 400, undefined, req);
    }

    if (rowsToProcess.length === 0) {
      return apiError("No valid rows found to import.", "BAD_REQUEST", 400, undefined, req);
    }

    const parsedItems: ParsedImportRow[] = [];

    for (const row of rowsToProcess) {
      // Flexible column resolution for Zerodha Console & Coin formats
      const keys = Object.keys(row);
      const getVal = (patterns: string[]): string => {
        for (const p of patterns) {
          const match = keys.find((k) => k.toLowerCase().replace(/[^a-z0-9]/g, "").includes(p));
          if (match && row[match] !== undefined && row[match] !== null) {
            return String(row[match]).trim();
          }
        }
        return "";
      };

      const rawSchemeName = getVal(["schemename", "fundname", "scheme", "symbol", "instrument"]);
      if (!rawSchemeName || rawSchemeName.toLowerCase().includes("total") || rawSchemeName.toLowerCase().includes("disclaimer")) {
        continue;
      }

      const rawUnits = getVal(["quantity", "units", "qty", "balance"]);
      const rawAvgNav = getVal(["averageprice", "avgprice", "avgnav", "buyprice", "costprice"]);
      const rawCurrentNav = getVal(["lastprice", "closingprice", "currentnav", "nav", "ltp"]);
      const rawInvested = getVal(["investedvalue", "investedamount", "invested", "costvalue"]);
      const rawFolio = getVal(["folio", "foliono", "folionumber"]) || "COIN_DEMAT";
      const rawIsin = getVal(["isin"]);
      const rawSchemeCode = getVal(["schemecode", "code", "amficode"]);

      const parsedUnits = parseFloat(rawUnits.replace(/,/g, ""));
      const parsedAvgNav = parseFloat(rawAvgNav.replace(/,/g, ""));
      const parsedCurrentNav = parseFloat(rawCurrentNav.replace(/,/g, ""));
      const parsedInvested = parseFloat(rawInvested.replace(/,/g, ""));

      const units = !isNaN(parsedUnits) && isFinite(parsedUnits) && parsedUnits > 0 ? parsedUnits : 0;
      const avgNav = !isNaN(parsedAvgNav) && isFinite(parsedAvgNav) && parsedAvgNav > 0 ? parsedAvgNav : 0;
      const currentNav = !isNaN(parsedCurrentNav) && isFinite(parsedCurrentNav) && parsedCurrentNav > 0 ? parsedCurrentNav : avgNav;
      const invested =
        !isNaN(parsedInvested) && isFinite(parsedInvested) && parsedInvested > 0
          ? parsedInvested
          : (units > 0 && avgNav > 0 ? +(units * avgNav).toFixed(2) : 0);

      if (units <= 0 && invested <= 0) continue;

      const { category, assetClass } = inferCategoryAndAsset(rawSchemeName);
      const fundHouse = inferFundHouse(rawSchemeName);
      const isDirect = /direct/i.test(rawSchemeName);

      // Derive or preserve scheme code
      let schemeCode = rawSchemeCode;
      if (!schemeCode) {
        // Deterministic hash based on scheme name if not provided
        let hash = 0;
        for (let j = 0; j < rawSchemeName.length; j++) {
          hash = (hash << 5) - hash + rawSchemeName.charCodeAt(j);
          hash |= 0;
        }
        schemeCode = String(Math.abs(hash)).slice(0, 6).padStart(6, "1");
      }

      parsedItems.push({
        schemeCode,
        schemeName: rawSchemeName,
        fundHouse,
        category,
        assetClass,
        folioNumber: rawFolio,
        units,
        avgNav: avgNav > 0 ? avgNav : +(invested / Math.max(units, 0.0001)).toFixed(4),
        investedAmount: invested,
        currentNav,
        isin: rawIsin || null,
        planType: isDirect ? "Direct" : "Regular",
      });
    }

    if (parsedItems.length === 0) {
      return apiError(
        "Could not detect valid mutual fund holding rows in the file. Ensure columns include Scheme Name, Units/Quantity, and Avg Price/Invested.",
        "BAD_REQUEST",
        400,
        undefined,
        req
      );
    }

    // Upsert into mutual_fund_holdings
    let importedCount = 0;
    let updatedCount = 0;
    const finalHoldings: Record<string, unknown>[] = [];

    for (const item of parsedItems) {
      const { data: existing } = await supabaseAdmin
        .from("mutual_fund_holdings")
        .select("id")
        .eq("user_id", userId)
        .eq("scheme_code", item.schemeCode)
        .eq("folio_number", item.folioNumber)
        .maybeSingle();

      if (existing) {
        const { data: updated } = await supabaseAdmin
          .from("mutual_fund_holdings")
          .update({
            scheme_name: item.schemeName,
            fund_house: item.fundHouse,
            category: item.category,
            plan_type: item.planType,
            units: item.units,
            avg_nav: item.avgNav,
            invested_amount: item.investedAmount,
            current_nav: item.currentNav,
            isin: item.isin,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .select()
          .single();

        if (updated) {
          updatedCount++;
          finalHoldings.push(updated);
        }
      } else {
        const { data: inserted } = await supabaseAdmin
          .from("mutual_fund_holdings")
          .insert({
            user_id: userId,
            scheme_code: item.schemeCode,
            scheme_name: item.schemeName,
            fund_house: item.fundHouse,
            category: item.category,
            plan_type: item.planType,
            dividend_option: "Growth",
            folio_number: item.folioNumber,
            units: item.units,
            avg_nav: item.avgNav,
            invested_amount: item.investedAmount,
            current_nav: item.currentNav,
            previous_nav: item.currentNav,
            isin: item.isin,
            nav_date: new Date().toISOString().split("T")[0],
          })
          .select()
          .single();

        if (inserted) {
          importedCount++;
          finalHoldings.push(inserted);
        }
      }
    }

    if (importedCount > 0 || updatedCount > 0) {
      await invalidateUserCaches(userId, ["MUTUAL_FUNDS", "PORTFOLIO", "ANALYTICS"]);
    }

    return apiSuccess(
      {
        totalParsed: parsedItems.length,
        importedCount,
        updatedCount,
        holdings: finalHoldings,
      },
      undefined,
      200,
      req
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to import statement";
    console.error("[MF Import API] Exception:", err);
    return apiError(msg, "INTERNAL_SERVER_ERROR", 500, undefined, req);
  }
}
