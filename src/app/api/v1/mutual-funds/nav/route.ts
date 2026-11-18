import { NextRequest, NextResponse } from "next/server";
import { redis, isRedisConfigured } from "@/utils/redis";
import { extractRequestId } from "@/utils/apiResponse";
import { inferCategoryAndAsset, inferFundHouse } from "../search/route";

export interface MutualFundNavQuote {
  schemeCode: string;
  schemeName: string;
  fundHouse: string;
  category: string;
  assetClass: "Equity" | "Debt" | "Hybrid" | "Commodity" | "Other";
  currentNav: number;
  previousNav: number;
  change: number;
  changePercent: number;
  navDate: string;
  lastUpdated: string;
  isin?: string | null;
}

// In-memory cache (TTL: 1 hour since AMFI NAVs update once daily in the evening)
const memoryCache = new Map<string, { data: MutualFundNavQuote; expiry: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function fetchSchemeNav(schemeCode: string): Promise<MutualFundNavQuote | null> {
  const cleanCode = schemeCode.trim();
  if (!cleanCode || !/^\d+$/.test(cleanCode)) return null;

  // 1. Check in-memory cache
  const cached = memoryCache.get(cleanCode);
  if (cached && cached.expiry > Date.now()) {
    return cached.data;
  }

  // 2. Check Redis cache if configured
  if (isRedisConfigured && redis) {
    try {
      const redisKey = `arthax:mf_nav:${cleanCode}`;
      const redisData = await redis.get<MutualFundNavQuote>(redisKey);
      if (redisData && typeof redisData === "object" && redisData.currentNav) {
        memoryCache.set(cleanCode, { data: redisData, expiry: Date.now() + CACHE_TTL_MS });
        return redisData;
      }
    } catch (e) {
      console.warn("[MF NAV] Redis read warning:", e);
    }
  }

  // 3. Fetch from MFAPI
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  try {
    const res = await fetch(`https://api.mfapi.in/mf/${cleanCode}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`[MF NAV] Provider returned HTTP ${res.status} for scheme ${cleanCode}`);
      return null;
    }

    const json = await res.json();
    const meta = json?.meta;
    const dataList = json?.data;

    if (!dataList || !Array.isArray(dataList) || dataList.length === 0) {
      console.warn(`[MF NAV] No NAV records found for scheme ${cleanCode}`);
      return null;
    }

    const latest = dataList[0];
    const prev = dataList[1] || latest;

    const currentNav = parseFloat(latest.nav) || 0;
    const previousNav = parseFloat(prev.nav) || currentNav;

    const change = +(currentNav - previousNav).toFixed(4);
    const changePercent = previousNav > 0 ? +(((currentNav - previousNav) / previousNav) * 100).toFixed(2) : 0;

    const schemeName = meta?.scheme_name || `Scheme ${cleanCode}`;
    const { category, assetClass } = inferCategoryAndAsset(schemeName, meta?.scheme_category);
    const fundHouse = meta?.fund_house || inferFundHouse(schemeName);

    const quote: MutualFundNavQuote = {
      schemeCode: cleanCode,
      schemeName,
      fundHouse,
      category,
      assetClass,
      currentNav,
      previousNav,
      change,
      changePercent,
      navDate: latest.date || new Date().toISOString().split("T")[0],
      lastUpdated: new Date().toISOString(),
      isin: meta?.isin_growth || null,
    };

    // Store in memory
    memoryCache.set(cleanCode, { data: quote, expiry: Date.now() + CACHE_TTL_MS });

    // Store in Redis (1 hour TTL)
    if (isRedisConfigured && redis) {
      redis.set(`arthax:mf_nav:${cleanCode}`, quote, { ex: 3600 }).catch(() => {});
    }

    return quote;
  } catch (err) {
    clearTimeout(timeout);
    console.error(`[MF NAV] Failed to fetch NAV for ${cleanCode}:`, err);
    return null;
  }
}

export async function GET(req: NextRequest) {
  const requestId = extractRequestId(req);
  const { searchParams } = new URL(req.url);

  const code = searchParams.get("code")?.trim();
  const codesParam = searchParams.get("codes")?.trim();

  // Single scheme quote
  if (code) {
    const quote = await fetchSchemeNav(code);
    if (!quote) {
      return NextResponse.json(
        { success: false, error: `Scheme NAV unavailable for code: ${code}`, requestId },
        { status: 404, headers: { "X-Request-Id": requestId } }
      );
    }
    return NextResponse.json(
      { success: true, quote },
      {
        headers: {
          "X-Request-Id": requestId,
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      }
    );
  }

  // Batch scheme quotes
  if (codesParam) {
    const codes = codesParam
      .split(",")
      .map((c) => c.trim())
      .filter((c) => /^\d+$/.test(c))
      .slice(0, 30); // Max 30 funds per batch

    const results = await Promise.all(codes.map((c) => fetchSchemeNav(c)));
    const quotes: Record<string, MutualFundNavQuote> = {};

    results.forEach((q) => {
      if (q) {
        quotes[q.schemeCode] = q;
      }
    });

    return NextResponse.json(
      { success: true, quotes },
      {
        headers: {
          "X-Request-Id": requestId,
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      }
    );
  }

  return NextResponse.json(
    { success: false, error: "Please provide ?code=... or ?codes=...", requestId },
    { status: 400, headers: { "X-Request-Id": requestId } }
  );
}
