import { NextRequest, NextResponse } from "next/server";
import { redis, isRedisConfigured } from "@/utils/redis";
import { extractRequestId } from "@/utils/apiResponse";

export interface StockQuote {
  symbol: string;
  exchange: "NSE" | "BSE";
  companyName: string;
  currentPrice: number;
  previousClose: number;
  change: number;
  changePercent: number;
  dayHigh?: number;
  dayLow?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  volume?: number;
  currency: "INR";
  lastUpdated: string;
  isStale?: boolean;
}

export interface IndianMarketStatus {
  isOpen: boolean;
  phase: "LIVE" | "PRE_MARKET" | "POST_MARKET" | "CLOSED_WEEKEND" | "CLOSED";
  message: string;
  istTime: string;
}

// In-memory fallback cache when Redis is not reachable (TTL: 60s)
const memoryCache = new Map<string, { data: StockQuote; expiry: number }>();

function getIndianMarketStatus(): IndianMarketStatus {
  // Current time converted to IST (UTC + 5:30)
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const istOffset = 5.5 * 3600000;
  const istDate = new Date(utc + istOffset);

  const dayOfWeek = istDate.getDay(); // 0 = Sun, 6 = Sat
  const hours = istDate.getHours();
  const minutes = istDate.getMinutes();
  const timeInMinutes = hours * 60 + minutes;

  const istTimeString = istDate.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  // Saturday (6) or Sunday (0)
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return {
      isOpen: false,
      phase: "CLOSED_WEEKEND",
      message: "Market Closed (Weekend). Opens Monday 9:15 AM IST.",
      istTime: istTimeString,
    };
  }

  // Monday - Friday market hours
  // 9:00 AM = 540 min, 9:15 AM = 555 min, 3:30 PM = 930 min, 4:00 PM = 960 min
  if (timeInMinutes >= 540 && timeInMinutes < 555) {
    return {
      isOpen: false,
      phase: "PRE_MARKET",
      message: "Pre-Market Session (9:00 AM - 9:15 AM IST).",
      istTime: istTimeString,
    };
  } else if (timeInMinutes >= 555 && timeInMinutes <= 930) {
    return {
      isOpen: true,
      phase: "LIVE",
      message: "Market Open (Live trading 9:15 AM - 3:30 PM IST).",
      istTime: istTimeString,
    };
  } else if (timeInMinutes > 930 && timeInMinutes <= 960) {
    return {
      isOpen: false,
      phase: "POST_MARKET",
      message: "Post-Market Closing Session (3:30 PM - 4:00 PM IST).",
      istTime: istTimeString,
    };
  } else {
    return {
      isOpen: false,
      phase: "CLOSED",
      message: "Market Closed. Next session at 9:15 AM IST.",
      istTime: istTimeString,
    };
  }
}

export async function fetchStockQuote(
  symbol: string,
  exchange: "NSE" | "BSE" = "NSE"
): Promise<StockQuote | null> {
  const cleanSymbol = symbol.trim().toUpperCase().replace(/\.(NS|BO)$/, "");
  const suffix = exchange === "BSE" ? ".BO" : ".NS";
  const ticker = `${cleanSymbol}${suffix}`;

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    ticker
  )}?interval=1d&range=1d`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`[Stock Quote] Provider responded with HTTP ${res.status} for ${ticker}`);
      return null;
    }

    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;

    if (!meta || typeof meta.regularMarketPrice !== "number") {
      console.warn(`[Stock Quote] No price metadata found for ${ticker}`);
      return null;
    }

    const price = meta.regularMarketPrice;
    const prevClose =
      typeof meta.chartPreviousClose === "number"
        ? meta.chartPreviousClose
        : typeof meta.previousClose === "number"
        ? meta.previousClose
        : price;

    const change = +(price - prevClose).toFixed(2);
    const changePercent = prevClose !== 0 ? +(((price - prevClose) / prevClose) * 100).toFixed(2) : 0;

    return {
      symbol: cleanSymbol,
      exchange,
      companyName: meta.shortName || meta.longName || cleanSymbol,
      currentPrice: price,
      previousClose: prevClose,
      change,
      changePercent,
      dayHigh: meta.regularMarketDayHigh || price,
      dayLow: meta.regularMarketDayLow || price,
      fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh || price,
      fiftyTwoWeekLow: meta.fiftyTwoWeekLow || price,
      volume: meta.regularMarketVolume,
      currency: "INR",
      lastUpdated: new Date().toISOString(),
    };
  } catch (err) {
    clearTimeout(timeout);
    console.warn(`[Stock Quote] Error fetching quote for ${ticker}:`, err);
    return null;
  }
}

export async function GET(req: NextRequest) {
  const requestId = extractRequestId(req);
  const { searchParams } = new URL(req.url);
  const symbolsParam = searchParams.get("symbols") || "";
  const forceRefresh = searchParams.get("refresh") === "true";

  if (!symbolsParam.trim()) {
    return NextResponse.json(
      {
        success: true,
        quotes: {},
        marketStatus: getIndianMarketStatus(),
        message: "No symbols specified. Use ?symbols=RELIANCE:NSE,TCS:NSE",
      },
      { headers: { "X-Request-Id": requestId } }
    );
  }

  // Parse symbols e.g. "RELIANCE:NSE,TCS:NSE,INFY:BSE" or simple "RELIANCE,TCS" (capped to 50 symbols max)
  const rawPairs = symbolsParam.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 50);
  const parsedItems: { symbol: string; exchange: "NSE" | "BSE"; key: string }[] = [];

  for (const item of rawPairs) {
    const [sym, ex] = item.split(":");
    const cleanSym = sym.trim().toUpperCase().replace(/\.(NS|BO)$/, "");
    const exchange: "NSE" | "BSE" = ex && ex.trim().toUpperCase() === "BSE" ? "BSE" : "NSE";
    parsedItems.push({
      symbol: cleanSym,
      exchange,
      key: `${cleanSym}:${exchange}`,
    });
  }

  const quotesMap: Record<string, StockQuote> = {};
  const symbolsToFetch: { symbol: string; exchange: "NSE" | "BSE"; key: string }[] = [];
  const now = Date.now();

  // Check cache for each requested symbol
  for (const item of parsedItems) {
    const cacheKey = `arthax:stock_quote:${item.key}`;

    if (!forceRefresh) {
      // 1. Check memory cache first (fastest, 0ms)
      const memCached = memoryCache.get(cacheKey);
      if (memCached && memCached.expiry > now) {
        quotesMap[item.key] = memCached.data;
        continue;
      }

      // 2. Check Redis cache if configured
      if (isRedisConfigured && redis) {
        try {
          const redisCached = await redis.get<StockQuote>(cacheKey);
          if (redisCached) {
            quotesMap[item.key] = redisCached;
            // Update memory cache
            memoryCache.set(cacheKey, { data: redisCached, expiry: now + 60000 });
            continue;
          }
        } catch {
          // Graceful fallback on Redis timeout/error
        }
      }
    }

    symbolsToFetch.push(item);
  }

  // Fetch uncached symbols in parallel
  if (symbolsToFetch.length > 0) {
    const fetchPromises = symbolsToFetch.map(async (item) => {
      const quote = await fetchStockQuote(item.symbol, item.exchange);
      if (quote) {
        quotesMap[item.key] = quote;

        const cacheKey = `arthax:stock_quote:${item.key}`;
        // Store in memory cache with 60s TTL
        memoryCache.set(cacheKey, { data: quote, expiry: Date.now() + 60000 });

        // Store in Redis with 60s TTL
        if (isRedisConfigured && redis) {
          redis.set(cacheKey, quote, { ex: 60 }).catch(() => {});
        }
      } else {
        // Fallback placeholder if quote could not be fetched
        quotesMap[item.key] = {
          symbol: item.symbol,
          exchange: item.exchange,
          companyName: item.symbol,
          currentPrice: 0,
          previousClose: 0,
          change: 0,
          changePercent: 0,
          currency: "INR",
          lastUpdated: new Date().toISOString(),
          isStale: true,
        };
      }
    });

    await Promise.all(fetchPromises);
  }

  const marketStatus = getIndianMarketStatus();

  return NextResponse.json(
    {
      success: true,
      quotes: quotesMap,
      marketStatus,
      cachedCount: parsedItems.length - symbolsToFetch.length,
      fetchedCount: symbolsToFetch.length,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=15, s-maxage=30",
        "X-Request-Id": requestId,
      },
    }
  );
}
