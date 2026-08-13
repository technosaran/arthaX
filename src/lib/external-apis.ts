/**
 * Centralized External API Registry & Resilient Fetch Client
 * Configures all third-party market data APIs (AMFI, Yahoo Finance, Groww, Tickertape)
 * with timeout policies, user-agent headers, and unified error handling.
 */

export interface ExternalApiConfig {
  id: string;
  name: string;
  url: string;
  description: string;
  defaultTimeoutMs?: number;
}

export const EXTERNAL_APIS: Record<string, ExternalApiConfig> = {
  AMFI_MUTUAL_FUNDS: {
    id: "amfi-mf",
    name: "AMFI Mutual Funds API (mfapi.in)",
    url: "https://api.mfapi.in/mf/122639",
    description: "Daily mutual fund NAV prices for Indian AMC schemes",
    defaultTimeoutMs: 8000,
  },
  AMFI_OFFICIAL: {
    id: "amfi-official",
    name: "AMFI India Official NAV (amfiindia.com)",
    url: "https://www.amfiindia.com/spages/NAVAll.txt",
    description: "Official text publication of all Indian AMC daily NAVs",
    defaultTimeoutMs: 10000,
  },
  GROWW_MUTUAL_FUNDS: {
    id: "groww-mf",
    name: "Groww Mutual Funds API",
    url: "https://groww.in/v1/api/search/v1/derived/scheme?availableForInvestment=true&docType=scheme&plan_type=Direct&q=HDFC",
    description: "Direct scheme metadata search & investment details",
    defaultTimeoutMs: 8000,
  },
  YAHOO_FINANCE_CHART: {
    id: "yahoo-chart",
    name: "Yahoo Finance Chart API (v8)",
    url: "https://query1.finance.yahoo.com/v8/finance/chart/RELIANCE.NS",
    description: "Stock price history, historical candles & market metadata",
    defaultTimeoutMs: 8000,
  },
  YAHOO_FINANCE_SEARCH: {
    id: "yahoo-search",
    name: "Yahoo Finance Search API",
    url: "https://query2.finance.yahoo.com/v1/finance/search?q=RELIANCE",
    description: "Global stock symbol search & ticker lookup",
    defaultTimeoutMs: 8000,
  },
  TICKERTAPE_STOCKS: {
    id: "tickertape-search",
    name: "Tickertape Stocks API",
    url: "https://api.tickertape.in/search?text=RELIANCE",
    description: "Indian stock market analytics, financial ratios & news",
    defaultTimeoutMs: 8000,
  },
};

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export interface ApiHealthResult {
  name: string;
  status: "Healthy" | "Degraded" | "Rate Limited" | "Offline";
  latency: string;
  code: number;
  error?: string;
}

/**
 * Resilient fetch client for external market data endpoints
 */
export async function fetchExternalApi(
  url: string,
  options?: RequestInit & { timeoutMs?: number }
): Promise<Response> {
  const timeoutMs = options?.timeoutMs || 8000;
  const headers = new Headers(options?.headers);

  if (!headers.has("User-Agent")) {
    headers.set("User-Agent", DEFAULT_USER_AGENT);
  }
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json, text/plain, */*");
  }

  return fetch(url, {
    ...options,
    headers,
    cache: options?.cache || "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
}

/**
 * Health check probe for a single external API endpoint
 */
export async function probeExternalApi(api: ExternalApiConfig): Promise<ApiHealthResult> {
  const start = Date.now();
  try {
    const res = await fetchExternalApi(api.url, { timeoutMs: api.defaultTimeoutMs });
    const latency = `${Date.now() - start}ms`;

    if (res.status === 200) {
      return { name: api.name, status: "Healthy", latency, code: 200 };
    } else if (res.status === 429) {
      return { name: api.name, status: "Rate Limited", latency, code: 429 };
    } else {
      return { name: api.name, status: "Degraded", latency, code: res.status };
    }
  } catch (err) {
    return {
      name: api.name,
      status: "Offline",
      latency: "—",
      code: 504,
      error: err instanceof Error ? err.message : "Timeout / Connection Failed",
    };
  }
}
