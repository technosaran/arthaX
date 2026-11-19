import crypto from "crypto";

export interface BinanceBalance {
  asset: string;
  free: string;
  locked: string;
}

export interface BinanceAccountResponse {
  makerCommission: number;
  takerCommission: number;
  buyerCommission: number;
  sellerCommission: number;
  canTrade: boolean;
  canWithdraw: boolean;
  canDeposit: boolean;
  accountType: string;
  balances: BinanceBalance[];
  permissions: string[];
}

export interface BinanceTicker {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  weightedAvgPrice?: string;
  prevClosePrice?: string;
  highPrice?: string;
  lowPrice?: string;
  volume?: string;
  quoteVolume?: string;
}

export interface CalculatedCryptoAsset {
  asset: string;
  name: string;
  free: number;
  locked: number;
  totalQuantity: number;
  currentPriceUsd: number;
  totalValueUsd: number;
  change24h: number;
  allocationPercent: number;
}

export interface CryptoPortfolioResult {
  assets: CalculatedCryptoAsset[];
  totalPortfolioUsd: number;
  netChange24hUsd: number;
  netChange24hPercent: number;
  assetsCount: number;
}

const STABLECOINS = new Set([
  "USDT",
  "USDC",
  "BUSD",
  "DAI",
  "FDUSD",
  "TUSD",
  "USDD",
  "USD",
]);

const COIN_NAMES: Record<string, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  SOL: "Solana",
  BNB: "BNB",
  USDT: "Tether USD",
  USDC: "USD Coin",
  XRP: "XRP",
  ADA: "Cardano",
  DOGE: "Dogecoin",
  AVAX: "Avalanche",
  LINK: "Chainlink",
  DOT: "Polkadot",
  MATIC: "Polygon",
  POL: "Polygon",
  NEAR: "NEAR Protocol",
  SUI: "Sui",
  PEPE: "Pepe",
  SHIB: "Shiba Inu",
  LTC: "Litecoin",
  TRX: "TRON",
  APT: "Aptos",
  RENDER: "Render",
  TAO: "Bittensor",
  BUSD: "Binance USD",
  DAI: "Dai",
  FDUSD: "First Digital USD",
  ATOM: "Cosmos",
  XLM: "Stellar",
  ICP: "Internet Computer",
  BCH: "Bitcoin Cash",
  UNI: "Uniswap",
  XMR: "Monero",
  ETC: "Ethereum Classic",
  FIL: "Filecoin",
  HBAR: "Hedera",
  KAS: "Kaspa",
  FET: "Artificial Superintelligence Alliance",
};

/**
 * Computes HMAC-SHA256 signature for Binance API authentication.
 */
export function generateBinanceSignature(queryString: string, apiSecret: string): string {
  return crypto
    .createHmac("sha256", apiSecret)
    .update(queryString)
    .digest("hex");
}

/**
 * Filter and format raw balances from Binance into non-zero entries.
 */
export function parseBinanceBalances(
  balances: BinanceBalance[]
): { asset: string; free: number; locked: number; total: number }[] {
  if (!Array.isArray(balances)) return [];

  const results: { asset: string; free: number; locked: number; total: number }[] = [];

  for (const b of balances) {
    const free = parseFloat(b.free) || 0;
    const locked = parseFloat(b.locked) || 0;
    const total = free + locked;

    // Filter dust and zero balances (< 0.00000001)
    if (total > 0.00000001) {
      results.push({
        asset: b.asset,
        free,
        locked,
        total,
      });
    }
  }

  return results;
}

/**
 * Resolves coin name from ticker symbol.
 */
export function getCoinName(asset: string): string {
  if (COIN_NAMES[asset]) return COIN_NAMES[asset];
  // If LD (Binance Earn locked / savings prefix, e.g. LDBTC), strip LD
  if (asset.startsWith("LD") && COIN_NAMES[asset.slice(2)]) {
    return `${COIN_NAMES[asset.slice(2)]} (Earn)`;
  }
  return asset;
}

/**
 * Calculates real-time portfolio USD valuation and 24h P&L.
 */
export function calculateCryptoValuations(
  balances: { asset: string; free: number; locked: number; total: number }[],
  tickers: Record<string, BinanceTicker>
): CryptoPortfolioResult {
  const assets: CalculatedCryptoAsset[] = [];
  let totalPortfolioUsd = 0;
  let totalYesterdayValueUsd = 0;

  for (const item of balances) {
    let cleanAsset = item.asset;
    if (cleanAsset.startsWith("LD")) {
      cleanAsset = cleanAsset.slice(2);
    }

    let priceUsd = 0;
    let change24h = 0;

    if (STABLECOINS.has(cleanAsset)) {
      priceUsd = 1.0;
      change24h = 0;
    } else {
      // 1. Direct USDT pair (e.g. BTCUSDT)
      const usdtPair = `${cleanAsset}USDT`;
      const usdcPair = `${cleanAsset}USDC`;
      const fdusdPair = `${cleanAsset}FDUSD`;

      if (tickers[usdtPair]) {
        priceUsd = parseFloat(tickers[usdtPair].lastPrice) || 0;
        change24h = parseFloat(tickers[usdtPair].priceChangePercent) || 0;
      } else if (tickers[usdcPair]) {
        priceUsd = parseFloat(tickers[usdcPair].lastPrice) || 0;
        change24h = parseFloat(tickers[usdcPair].priceChangePercent) || 0;
      } else if (tickers[fdusdPair]) {
        priceUsd = parseFloat(tickers[fdusdPair].lastPrice) || 0;
        change24h = parseFloat(tickers[fdusdPair].priceChangePercent) || 0;
      } else {
        // Fallback: check BTC cross pair (e.g. ALTBTC * BTCUSDT)
        const btcPair = `${cleanAsset}BTC`;
        const btcUsdt = tickers["BTCUSDT"];
        if (tickers[btcPair] && btcUsdt) {
          const altBtcPrice = parseFloat(tickers[btcPair].lastPrice) || 0;
          const btcPrice = parseFloat(btcUsdt.lastPrice) || 0;
          priceUsd = altBtcPrice * btcPrice;
          change24h = parseFloat(tickers[btcPair].priceChangePercent) || 0;
        }
      }
    }

    const totalValueUsd = item.total * priceUsd;
    totalPortfolioUsd += totalValueUsd;

    // Yesterday's value estimate for 24h P&L computation
    if (change24h !== 0 && 1 + change24h / 100 > 0) {
      const yesterdayPrice = priceUsd / (1 + change24h / 100);
      totalYesterdayValueUsd += item.total * yesterdayPrice;
    } else {
      totalYesterdayValueUsd += totalValueUsd;
    }

    assets.push({
      asset: item.asset,
      name: getCoinName(item.asset),
      free: item.free,
      locked: item.locked,
      totalQuantity: item.total,
      currentPriceUsd: priceUsd,
      totalValueUsd,
      change24h,
      allocationPercent: 0,
    });
  }

  // Calculate percentage allocation
  if (totalPortfolioUsd > 0) {
    for (const asset of assets) {
      asset.allocationPercent = (asset.totalValueUsd / totalPortfolioUsd) * 100;
    }
  }

  // Sort descending by total USD value
  assets.sort((a, b) => b.totalValueUsd - a.totalValueUsd);

  const netChange24hUsd = totalPortfolioUsd - totalYesterdayValueUsd;
  const netChange24hPercent =
    totalYesterdayValueUsd > 0 ? (netChange24hUsd / totalYesterdayValueUsd) * 100 : 0;

  return {
    assets,
    totalPortfolioUsd,
    netChange24hUsd,
    netChange24hPercent,
    assetsCount: assets.length,
  };
}

/**
 * Fetch Binance Spot Account Information (Balances)
 */
export async function fetchBinanceSpotAccount(
  apiKey: string,
  apiSecret: string,
  baseUrl: string = "https://api.binance.com"
): Promise<{ success: boolean; data?: BinanceAccountResponse; error?: string }> {
  try {
    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}&recvWindow=5000`;
    const signature = generateBinanceSignature(queryString, apiSecret);
    const url = `${baseUrl}/api/v3/account?${queryString}&signature=${signature}`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "X-MBX-APIKEY": apiKey,
        "User-Agent": "arthaX-Portfolio/1.0",
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      const errText = await res.text();
      let errMsg = `Binance HTTP ${res.status}`;
      try {
        const json = JSON.parse(errText);
        errMsg = json.msg || errMsg;
      } catch {
        // Fallback to text
      }
      return { success: false, error: errMsg };
    }

    const data = (await res.json()) as BinanceAccountResponse;
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to connect to Binance API",
    };
  }
}

/**
 * Fetch 24-hour ticker price change statistics for all or specified symbols.
 */
export async function fetchBinance24hrTickers(
  baseUrl: string = "https://api.binance.com"
): Promise<{ success: boolean; data?: Record<string, BinanceTicker>; error?: string }> {
  try {
    const url = `${baseUrl}/api/v3/ticker/24hr`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "arthaX-Portfolio/1.0",
      },
      next: { revalidate: 15 }, // cache for 15s to respect rate limits
    });

    if (!res.ok) {
      return { success: false, error: `Binance Ticker HTTP ${res.status}` };
    }

    const list = (await res.json()) as BinanceTicker[];
    const map: Record<string, BinanceTicker> = {};

    for (const t of list) {
      if (t.symbol) {
        map[t.symbol] = t;
      }
    }

    return { success: true, data: map };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to fetch Binance tickers",
    };
  }
}

/**
 * Fetch executed trade history for a specific symbol from Binance Spot API.
 */
export async function fetchBinanceMyTrades(
  apiKey: string,
  apiSecret: string,
  symbol: string,
  limit: number = 100,
  baseUrl: string = "https://api.binance.com"
): Promise<{ success: boolean; data?: BinanceRawTrade[]; error?: string }> {
  try {
    const timestamp = Date.now();
    const query = `symbol=${symbol}&limit=${limit}&timestamp=${timestamp}`;
    const signature = generateBinanceSignature(query, apiSecret);
    const url = `${baseUrl}/api/v3/myTrades?${query}&signature=${signature}`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "X-MBX-APIKEY": apiKey,
        "User-Agent": "arthaX-Portfolio/1.0",
      },
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      return {
        success: false,
        error: errJson?.msg || `Binance myTrades HTTP ${res.status}`,
      };
    }

    const data = (await res.json()) as BinanceRawTrade[];
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to fetch Binance trades",
    };
  }
}

// ============================================================================
// TRADE HISTORY & SELL REALIZATION ANALYTICS
// ============================================================================

export interface BinanceRawTrade {
  id: number;
  orderId: number;
  symbol: string;
  price: string;
  qty: string;
  quoteQty?: string;
  commission: string;
  commissionAsset: string;
  time: number;
  isBuyer: boolean;
  isMaker: boolean;
  isBestMatch?: boolean;
}

export interface CalculatedCryptoTrade {
  tradeId: number;
  orderId: number;
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  side: "BUY" | "SELL";
  price: number;
  qty: number;
  quoteQty: number;
  commission: number;
  commissionAsset: string;
  isBuyer: boolean;
  isMaker: boolean;
  executedAt: string;
}

export interface CryptoTradeStats {
  totalBuysUsd: number;
  totalSellsUsd: number;
  netInvestedUsd: number;
  totalFeesUsd: number;
  totalTradesCount: number;
  buyTradesCount: number;
  sellTradesCount: number;
}

export interface ExitedCryptoAsset {
  asset: string;
  symbol: string;
  totalSoldQuantity: number;
  totalRealizedUsd: number;
  averageExitPrice: number;
  lastSoldAt: string;
  sellTradesCount: number;
}

export function extractBaseAndQuote(symbol: string): { baseAsset: string; quoteAsset: string } {
  const commonQuotes = ["USDT", "USDC", "FDUSD", "BUSD", "TUSD", "BTC", "ETH", "BNB"];
  for (const q of commonQuotes) {
    if (symbol.endsWith(q) && symbol.length > q.length) {
      return {
        baseAsset: symbol.slice(0, -q.length),
        quoteAsset: q,
      };
    }
  }
  return { baseAsset: symbol, quoteAsset: "USDT" };
}

export function parseBinanceRawTrades(rawTrades: BinanceRawTrade[]): CalculatedCryptoTrade[] {
  if (!Array.isArray(rawTrades)) return [];

  return rawTrades.map((t) => {
    const { baseAsset, quoteAsset } = extractBaseAndQuote(t.symbol);
    const price = parseFloat(t.price) || 0;
    const qty = parseFloat(t.qty) || 0;
    const quoteQty = t.quoteQty ? parseFloat(t.quoteQty) || price * qty : price * qty;
    const commission = parseFloat(t.commission) || 0;

    return {
      tradeId: t.id,
      orderId: t.orderId,
      symbol: t.symbol,
      baseAsset,
      quoteAsset,
      side: t.isBuyer ? "BUY" : "SELL",
      price,
      qty,
      quoteQty,
      commission,
      commissionAsset: t.commissionAsset || "USDT",
      isBuyer: Boolean(t.isBuyer),
      isMaker: Boolean(t.isMaker),
      executedAt: new Date(t.time).toISOString(),
    };
  });
}

export function calculateTradeStats(trades: CalculatedCryptoTrade[]): CryptoTradeStats {
  let totalBuysUsd = 0;
  let totalSellsUsd = 0;
  let totalFeesUsd = 0;
  let buyTradesCount = 0;
  let sellTradesCount = 0;

  for (const t of trades) {
    if (t.side === "BUY") {
      totalBuysUsd += t.quoteQty;
      buyTradesCount++;
    } else {
      totalSellsUsd += t.quoteQty;
      sellTradesCount++;
    }
    totalFeesUsd += t.commission;
  }

  return {
    totalBuysUsd: Math.round(totalBuysUsd * 100) / 100,
    totalSellsUsd: Math.round(totalSellsUsd * 100) / 100,
    netInvestedUsd: Math.round((totalBuysUsd - totalSellsUsd) * 100) / 100,
    totalFeesUsd: Math.round(totalFeesUsd * 100) / 100,
    totalTradesCount: trades.length,
    buyTradesCount,
    sellTradesCount,
  };
}

export function getExitedAssets(
  trades: CalculatedCryptoTrade[],
  activeAssetSymbols: Set<string>
): ExitedCryptoAsset[] {
  const assetSells = new Map<string, CalculatedCryptoTrade[]>();

  for (const t of trades) {
    if (t.side === "SELL" && !activeAssetSymbols.has(t.baseAsset)) {
      const list = assetSells.get(t.baseAsset) || [];
      list.push(t);
      assetSells.set(t.baseAsset, list);
    }
  }

  const results: ExitedCryptoAsset[] = [];

  for (const [asset, sellList] of assetSells.entries()) {
    let totalQty = 0;
    let totalUsd = 0;
    let lastDate = "";

    for (const s of sellList) {
      totalQty += s.qty;
      totalUsd += s.quoteQty;
      if (!lastDate || s.executedAt > lastDate) {
        lastDate = s.executedAt;
      }
    }

    const avgPrice = totalQty > 0 ? totalUsd / totalQty : 0;

    results.push({
      asset,
      symbol: sellList[0]?.symbol || `${asset}USDT`,
      totalSoldQuantity: Math.round(totalQty * 1000000) / 1000000,
      totalRealizedUsd: Math.round(totalUsd * 100) / 100,
      averageExitPrice: Math.round(avgPrice * 100) / 100,
      lastSoldAt: lastDate,
      sellTradesCount: sellList.length,
    });
  }

  return results.sort((a, b) => b.totalRealizedUsd - a.totalRealizedUsd);
}

// ============================================================================
// MARKET DEPTH, ORDER BOOK & LIQUIDITY
// ============================================================================

export interface BinanceDepthLevel {
  price: number;
  quantity: number;
  total: number;
}

export interface BinanceDepthResponse {
  lastUpdateId: number;
  bids: [string, string][];
  asks: [string, string][];
}

export interface CalculatedMarketDepth {
  symbol: string;
  lastUpdateId: number;
  bids: BinanceDepthLevel[];
  asks: BinanceDepthLevel[];
  highestBid: number;
  lowestAsk: number;
  spread: number;
  spreadPercent: number;
  totalBidVolume: number;
  totalAskVolume: number;
  bidAskRatio: number;
}

/**
 * Fetch Order Book Level 2 Depth from Binance.
 */
export async function fetchBinanceDepth(
  symbol: string = "BTCUSDT",
  limit: number = 20,
  baseUrl: string = "https://api.binance.com"
): Promise<{ success: boolean; data?: CalculatedMarketDepth; error?: string }> {
  try {
    const url = `${baseUrl}/api/v3/depth?symbol=${symbol.toUpperCase()}&limit=${limit}`;
    const res = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": "arthaX-Portfolio/1.0" },
      signal: AbortSignal.timeout(4000),
      next: { revalidate: 3 },
    });

    if (!res.ok) {
      return { success: false, error: `Binance Depth HTTP ${res.status}` };
    }

    const raw = (await res.json()) as BinanceDepthResponse;
    const calculated = parseMarketDepth(symbol, raw);
    return { success: true, data: calculated };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to fetch Binance depth",
    };
  }
}

export function parseMarketDepth(symbol: string, raw: BinanceDepthResponse): CalculatedMarketDepth {
  let totalBidVolume = 0;
  const bids: BinanceDepthLevel[] = (raw.bids || []).map(([p, q]) => {
    const price = parseFloat(p) || 0;
    const quantity = parseFloat(q) || 0;
    totalBidVolume += quantity;
    return { price, quantity, total: totalBidVolume };
  });

  let totalAskVolume = 0;
  const asks: BinanceDepthLevel[] = (raw.asks || []).map(([p, q]) => {
    const price = parseFloat(p) || 0;
    const quantity = parseFloat(q) || 0;
    totalAskVolume += quantity;
    return { price, quantity, total: totalAskVolume };
  });

  const highestBid = bids[0]?.price || 0;
  const lowestAsk = asks[0]?.price || 0;
  const spread = lowestAsk > 0 && highestBid > 0 ? lowestAsk - highestBid : 0;
  const spreadPercent = lowestAsk > 0 ? (spread / lowestAsk) * 100 : 0;
  const totalVolume = totalBidVolume + totalAskVolume;
  const bidAskRatio = totalVolume > 0 ? (totalBidVolume / totalVolume) * 100 : 50;

  return {
    symbol,
    lastUpdateId: raw.lastUpdateId || Date.now(),
    bids,
    asks,
    highestBid,
    lowestAsk,
    spread: Math.round(spread * 10000) / 10000,
    spreadPercent: Math.round(spreadPercent * 1000) / 1000,
    totalBidVolume: Math.round(totalBidVolume * 1000) / 1000,
    totalAskVolume: Math.round(totalAskVolume * 1000) / 1000,
    bidAskRatio: Math.round(bidAskRatio * 10) / 10,
  };
}

// ============================================================================
// KLINES / CANDLESTICKS & OHLCV TECHNICAL DATA
// ============================================================================

export interface BinanceKline {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
  quoteVolume: number;
  tradesCount: number;
  takerBuyBaseVolume?: number;
  takerBuyQuoteVolume?: number;
}

/**
 * Fetch Kline / Candlestick bars for a symbol and interval.
 * Intervals: 1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 8h, 12h, 1d, 3d, 1w, 1M
 */
export async function fetchBinanceKlines(
  symbol: string = "BTCUSDT",
  interval: string = "1h",
  limit: number = 40,
  baseUrl: string = "https://api.binance.com"
): Promise<{ success: boolean; data?: BinanceKline[]; error?: string }> {
  try {
    const url = `${baseUrl}/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=${limit}`;
    const res = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": "arthaX-Portfolio/1.0" },
      signal: AbortSignal.timeout(4000),
      next: { revalidate: 15 },
    });

    if (!res.ok) {
      return { success: false, error: `Binance Klines HTTP ${res.status}` };
    }

    const rawList = (await res.json()) as (string | number)[][];
    const klines: BinanceKline[] = rawList.map((item) => ({
      openTime: Number(item[0]),
      open: parseFloat(String(item[1])) || 0,
      high: parseFloat(String(item[2])) || 0,
      low: parseFloat(String(item[3])) || 0,
      close: parseFloat(String(item[4])) || 0,
      volume: parseFloat(String(item[5])) || 0,
      closeTime: Number(item[6]),
      quoteVolume: parseFloat(String(item[7])) || 0,
      tradesCount: Number(item[8]) || 0,
      takerBuyBaseVolume: parseFloat(String(item[9])) || 0,
      takerBuyQuoteVolume: parseFloat(String(item[10])) || 0,
    }));

    return { success: true, data: klines };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to fetch Binance klines",
    };
  }
}

// ============================================================================
// RECENT PUBLIC MARKET TRADES (LIVE TAPE)
// ============================================================================

export interface BinancePublicTrade {
  id: number;
  price: number;
  qty: number;
  quoteQty: number;
  time: number;
  isBuyerMaker: boolean; // true = sell side taker; false = buy side taker
}

/**
 * Fetch recent public market trades for a symbol.
 */
export async function fetchBinanceRecentTrades(
  symbol: string = "BTCUSDT",
  limit: number = 30,
  baseUrl: string = "https://api.binance.com"
): Promise<{ success: boolean; data?: BinancePublicTrade[]; error?: string }> {
  try {
    const url = `${baseUrl}/api/v3/trades?symbol=${symbol.toUpperCase()}&limit=${limit}`;
    const res = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": "arthaX-Portfolio/1.0" },
      signal: AbortSignal.timeout(4000),
      next: { revalidate: 3 },
    });

    if (!res.ok) {
      return { success: false, error: `Binance Trades HTTP ${res.status}` };
    }

    interface RawTrade {
      id: number;
      price: string;
      qty: string;
      quoteQty: string;
      time: number;
      isBuyerMaker: boolean;
    }

    const rawList = (await res.json()) as RawTrade[];
    const parsed: BinancePublicTrade[] = rawList.map((t) => ({
      id: t.id,
      price: parseFloat(t.price) || 0,
      qty: parseFloat(t.qty) || 0,
      quoteQty: parseFloat(t.quoteQty) || 0,
      time: t.time,
      isBuyerMaker: Boolean(t.isBuyerMaker),
    }));

    return { success: true, data: parsed };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to fetch Binance public trades",
    };
  }
}

// ============================================================================
// BOOK TICKER & 5-MIN ROLLING AVERAGE PRICE
// ============================================================================

export interface BinanceBookTicker {
  symbol: string;
  bidPrice: number;
  bidQty: number;
  askPrice: number;
  askQty: number;
  spread: number;
  spreadPercent: number;
}

export interface BinanceAvgPrice {
  mins: number;
  price: number;
  closeTime?: number;
}

export async function fetchBinanceBookTicker(
  symbol?: string,
  baseUrl: string = "https://api.binance.com"
): Promise<{ success: boolean; data?: BinanceBookTicker; error?: string }> {
  try {
    const url = `${baseUrl}/api/v3/ticker/bookTicker${symbol ? `?symbol=${symbol.toUpperCase()}` : ""}`;
    const res = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": "arthaX-Portfolio/1.0" },
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) {
      return { success: false, error: `Binance BookTicker HTTP ${res.status}` };
    }

    interface RawBook {
      symbol: string;
      bidPrice: string;
      bidQty: string;
      askPrice: string;
      askQty: string;
    }

    const raw = (await res.json()) as RawBook;
    const bidPrice = parseFloat(raw.bidPrice) || 0;
    const bidQty = parseFloat(raw.bidQty) || 0;
    const askPrice = parseFloat(raw.askPrice) || 0;
    const askQty = parseFloat(raw.askQty) || 0;
    const spread = askPrice > 0 && bidPrice > 0 ? askPrice - bidPrice : 0;
    const spreadPercent = askPrice > 0 ? (spread / askPrice) * 100 : 0;

    return {
      success: true,
      data: {
        symbol: raw.symbol,
        bidPrice,
        bidQty,
        askPrice,
        askQty,
        spread: Math.round(spread * 10000) / 10000,
        spreadPercent: Math.round(spreadPercent * 1000) / 1000,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to fetch book ticker",
    };
  }
}

export async function fetchBinanceAvgPrice(
  symbol: string = "BTCUSDT",
  baseUrl: string = "https://api.binance.com"
): Promise<{ success: boolean; data?: BinanceAvgPrice; error?: string }> {
  try {
    const url = `${baseUrl}/api/v3/avgPrice?symbol=${symbol.toUpperCase()}`;
    const res = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": "arthaX-Portfolio/1.0" },
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) {
      return { success: false, error: `Binance AvgPrice HTTP ${res.status}` };
    }

    interface RawAvg {
      mins: number;
      price: string;
      closeTime?: number;
    }

    const raw = (await res.json()) as RawAvg;
    return {
      success: true,
      data: {
        mins: raw.mins || 5,
        price: parseFloat(raw.price) || 0,
        closeTime: raw.closeTime,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to fetch avg price",
    };
  }
}

// ============================================================================
// SYSTEM STATUS & EXCHANGE INFO
// ============================================================================

export interface BinanceSystemStatus {
  status: 0 | 1; // 0: Normal, 1: System Maintenance
  msg: string;
}

export interface BinanceServerTime {
  serverTime: number;
  localTime: number;
  clockDriftMs: number;
}

export interface BinanceSymbolFilter {
  filterType: string;
  minPrice?: string;
  maxPrice?: string;
  tickSize?: string;
  minQty?: string;
  maxQty?: string;
  stepSize?: string;
  minNotional?: string;
}

export interface BinanceSymbolInfo {
  symbol: string;
  status: string;
  baseAsset: string;
  quoteAsset: string;
  filters: BinanceSymbolFilter[];
  permissions: string[];
}

export async function fetchBinanceSystemStatus(
  baseUrl: string = "https://api.binance.com"
): Promise<{ success: boolean; data?: BinanceSystemStatus; error?: string }> {
  try {
    const url = `${baseUrl}/sapi/v1/system/status`;
    const res = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": "arthaX-Portfolio/1.0" },
      signal: AbortSignal.timeout(3000),
    });

    if (!res.ok) {
      return { success: true, data: { status: 0, msg: "normal" } };
    }

    const data = (await res.json()) as BinanceSystemStatus;
    return { success: true, data };
  } catch {
    return { success: true, data: { status: 0, msg: "normal" } };
  }
}

export async function fetchBinanceTime(
  baseUrl: string = "https://api.binance.com"
): Promise<{ success: boolean; data?: BinanceServerTime; error?: string }> {
  try {
    const localBefore = Date.now();
    const url = `${baseUrl}/api/v3/time`;
    const res = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": "arthaX-Portfolio/1.0" },
      signal: AbortSignal.timeout(3000),
    });

    const localAfter = Date.now();
    const localMid = Math.round((localBefore + localAfter) / 2);

    if (!res.ok) {
      return {
        success: true,
        data: {
          serverTime: localMid,
          localTime: localMid,
          clockDriftMs: 0,
        },
      };
    }

    const json = (await res.json()) as { serverTime: number };
    const clockDriftMs = json.serverTime - localMid;

    return {
      success: true,
      data: {
        serverTime: json.serverTime,
        localTime: localMid,
        clockDriftMs,
      },
    };
  } catch {
    const now = Date.now();
    return {
      success: true,
      data: {
        serverTime: now,
        localTime: now,
        clockDriftMs: 0,
      },
    };
  }
}

// ============================================================================
// INSTANT CRYPTO SWAP / CONVERTER ESTIMATOR
// ============================================================================

export interface SwapQuoteResult {
  fromAsset: string;
  toAsset: string;
  fromAmount: number;
  toAmount: number;
  executionPrice: number;
  invertedPrice: number;
  estimatedFeeUsd: number;
  route: string;
}

export function calculateCryptoSwap(
  fromAsset: string,
  toAsset: string,
  amount: number,
  tickers: Record<string, BinanceTicker>
): SwapQuoteResult {
  if (amount <= 0 || fromAsset === toAsset) {
    return {
      fromAsset,
      toAsset,
      fromAmount: amount,
      toAmount: amount,
      executionPrice: 1,
      invertedPrice: 1,
      estimatedFeeUsd: 0,
      route: "DIRECT",
    };
  }

  const getPriceInUsd = (coin: string): number => {
    if (STABLECOINS.has(coin)) return 1.0;
    const usdtPair = `${coin}USDT`;
    if (tickers[usdtPair]) return parseFloat(tickers[usdtPair].lastPrice) || 0;
    const usdcPair = `${coin}USDC`;
    if (tickers[usdcPair]) return parseFloat(tickers[usdcPair].lastPrice) || 0;
    return 0;
  };

  const fromUsd = getPriceInUsd(fromAsset);
  const toUsd = getPriceInUsd(toAsset);

  if (fromUsd <= 0 || toUsd <= 0) {
    return {
      fromAsset,
      toAsset,
      fromAmount: amount,
      toAmount: 0,
      executionPrice: 0,
      invertedPrice: 0,
      estimatedFeeUsd: 0,
      route: "UNAVAILABLE",
    };
  }

  const totalUsd = amount * fromUsd;
  const rawToAmount = totalUsd / toUsd;
  // Apply standard Binance spot fee: 0.10%
  const feePercent = 0.001;
  const estimatedFeeUsd = totalUsd * feePercent;
  const toAmount = rawToAmount * (1 - feePercent);
  const executionPrice = fromUsd / toUsd;
  const invertedPrice = executionPrice > 0 ? 1 / executionPrice : 0;

  return {
    fromAsset,
    toAsset,
    fromAmount: amount,
    toAmount: Math.round(toAmount * 1000000) / 1000000,
    executionPrice: Math.round(executionPrice * 1000000) / 1000000,
    invertedPrice: Math.round(invertedPrice * 1000000) / 1000000,
    estimatedFeeUsd: Math.round(estimatedFeeUsd * 100) / 100,
    route: `${fromAsset} → USDT → ${toAsset}`,
  };
}

// ============================================================================
// DEMO DATA GENERATORS FOR RICH ZERO-CREDENTIAL SHOWCASE
// ============================================================================

export function getDemoMarketTickers(): Record<string, BinanceTicker> {
  return {
    BTCUSDT: {
      symbol: "BTCUSDT",
      lastPrice: "96420.50",
      priceChangePercent: "4.82",
      highPrice: "97850.00",
      lowPrice: "91900.00",
      volume: "38920.45",
      quoteVolume: "3752600000.00",
      weightedAvgPrice: "95800.20",
      prevClosePrice: "91985.00",
    },
    ETHUSDT: {
      symbol: "ETHUSDT",
      lastPrice: "3480.25",
      priceChangePercent: "3.45",
      highPrice: "3550.00",
      lowPrice: "3360.10",
      volume: "245890.12",
      quoteVolume: "855700000.00",
      weightedAvgPrice: "3450.10",
      prevClosePrice: "3364.20",
    },
    SOLUSDT: {
      symbol: "SOLUSDT",
      lastPrice: "214.80",
      priceChangePercent: "7.92",
      highPrice: "219.50",
      lowPrice: "198.20",
      volume: "4820190.00",
      quoteVolume: "1035000000.00",
      weightedAvgPrice: "208.50",
      prevClosePrice: "199.03",
    },
    BNBUSDT: {
      symbol: "BNBUSDT",
      lastPrice: "652.40",
      priceChangePercent: "2.18",
      highPrice: "660.00",
      lowPrice: "638.50",
      volume: "612450.00",
      quoteVolume: "399560000.00",
      weightedAvgPrice: "648.20",
      prevClosePrice: "638.48",
    },
    XRPUSDT: {
      symbol: "XRPUSDT",
      lastPrice: "1.4820",
      priceChangePercent: "12.45",
      highPrice: "1.5400",
      lowPrice: "1.3100",
      volume: "892004500.00",
      quoteVolume: "1280000000.00",
      weightedAvgPrice: "1.4250",
      prevClosePrice: "1.3179",
    },
    DOGEUSDT: {
      symbol: "DOGEUSDT",
      lastPrice: "0.3845",
      priceChangePercent: "-1.85",
      highPrice: "0.4050",
      lowPrice: "0.3720",
      volume: "1420500900.00",
      quoteVolume: "546000000.00",
      weightedAvgPrice: "0.3890",
      prevClosePrice: "0.3917",
    },
    AVAXUSDT: {
      symbol: "AVAXUSDT",
      lastPrice: "36.85",
      priceChangePercent: "5.12",
      highPrice: "37.90",
      lowPrice: "34.80",
      volume: "3540200.00",
      quoteVolume: "130450000.00",
      weightedAvgPrice: "36.20",
      prevClosePrice: "35.05",
    },
    SUIUSDT: {
      symbol: "SUIUSDT",
      lastPrice: "3.42",
      priceChangePercent: "9.60",
      highPrice: "3.55",
      lowPrice: "3.10",
      volume: "89450200.00",
      quoteVolume: "305900000.00",
      weightedAvgPrice: "3.31",
      prevClosePrice: "3.12",
    },
    LINKUSDT: {
      symbol: "LINKUSDT",
      lastPrice: "16.80",
      priceChangePercent: "4.15",
      highPrice: "17.20",
      lowPrice: "16.10",
      volume: "5890200.00",
      quoteVolume: "98950000.00",
      weightedAvgPrice: "16.55",
      prevClosePrice: "16.13",
    },
    PEPEUSDT: {
      symbol: "PEPEUSDT",
      lastPrice: "0.0000214",
      priceChangePercent: "-3.60",
      highPrice: "0.0000230",
      lowPrice: "0.0000205",
      volume: "21500000000000.00",
      quoteVolume: "460000000.00",
      weightedAvgPrice: "0.0000218",
      prevClosePrice: "0.0000222",
    },
    NEARUSDT: {
      symbol: "NEARUSDT",
      lastPrice: "6.85",
      priceChangePercent: "6.20",
      highPrice: "7.10",
      lowPrice: "6.40",
      volume: "18900400.00",
      quoteVolume: "129460000.00",
      weightedAvgPrice: "6.72",
      prevClosePrice: "6.45",
    },
    ADAUSDT: {
      symbol: "ADAUSDT",
      lastPrice: "0.8420",
      priceChangePercent: "3.80",
      highPrice: "0.8750",
      lowPrice: "0.8050",
      volume: "285900400.00",
      quoteVolume: "240720000.00",
      weightedAvgPrice: "0.8350",
      prevClosePrice: "0.8112",
    },
  };
}

export function getDemoDepth(symbol: string = "BTCUSDT", currentPrice: number = 96420.5): CalculatedMarketDepth {
  const bids: BinanceDepthLevel[] = [];
  const asks: BinanceDepthLevel[] = [];
  let bidAccum = 0;
  let askAccum = 0;

  for (let i = 1; i <= 15; i++) {
    const bidPrice = Math.round((currentPrice * (1 - i * 0.0006)) * 100) / 100;
    const bidQty = Math.round((0.2 + Math.sin(i * 1.5) * 0.1 + i * 0.08) * 1000) / 1000;
    bidAccum += bidQty;
    bids.push({ price: bidPrice, quantity: bidQty, total: Math.round(bidAccum * 1000) / 1000 });

    const askPrice = Math.round((currentPrice * (1 + i * 0.0006)) * 100) / 100;
    const askQty = Math.round((0.18 + Math.cos(i * 1.4) * 0.09 + i * 0.075) * 1000) / 1000;
    askAccum += askQty;
    asks.push({ price: askPrice, quantity: askQty, total: Math.round(askAccum * 1000) / 1000 });
  }

  const highestBid = bids[0]?.price || currentPrice - 5;
  const lowestAsk = asks[0]?.price || currentPrice + 5;
  const spread = lowestAsk - highestBid;
  const spreadPercent = (spread / lowestAsk) * 100;

  return {
    symbol,
    lastUpdateId: Date.now(),
    bids,
    asks,
    highestBid,
    lowestAsk,
    spread: Math.round(spread * 100) / 100,
    spreadPercent: Math.round(spreadPercent * 1000) / 1000,
    totalBidVolume: Math.round(bidAccum * 1000) / 1000,
    totalAskVolume: Math.round(askAccum * 1000) / 1000,
    bidAskRatio: Math.round((bidAccum / (bidAccum + askAccum)) * 1000) / 10,
  };
}

export function getDemoKlines(symbol: string = "BTCUSDT", interval: string = "1h", limit: number = 36): BinanceKline[] {
  const klines: BinanceKline[] = [];
  const basePrice = symbol.includes("ETH")
    ? 3480
    : symbol.includes("SOL")
    ? 214
    : symbol.includes("BNB")
    ? 652
    : symbol.includes("XRP")
    ? 1.48
    : 96420;

  const now = Date.now();
  const stepMs = interval === "15m" ? 15 * 60 * 1000 : interval === "4h" ? 4 * 3600 * 1000 : interval === "1d" ? 24 * 3600 * 1000 : 3600 * 1000;

  let current = basePrice * 0.94;

  for (let i = limit; i >= 0; i--) {
    const openTime = now - i * stepMs;
    const drift = (Math.sin(i * 0.4) * 0.012 + (Math.random() - 0.45) * 0.015) * current;
    const open = Math.round(current * 100) / 100;
    const close = Math.round((current + drift) * 100) / 100;
    const high = Math.round((Math.max(open, close) + Math.abs(drift) * (0.4 + Math.random() * 0.6)) * 100) / 100;
    const low = Math.round((Math.min(open, close) - Math.abs(drift) * (0.4 + Math.random() * 0.6)) * 100) / 100;
    const volume = Math.round((120 + Math.random() * 250) * 100) / 100;

    klines.push({
      openTime,
      open,
      high,
      low,
      close,
      volume,
      closeTime: openTime + stepMs - 1,
      quoteVolume: Math.round(volume * close),
      tradesCount: Math.round(1800 + Math.random() * 2400),
      takerBuyBaseVolume: Math.round(volume * 0.54 * 100) / 100,
      takerBuyQuoteVolume: Math.round(volume * close * 0.54),
    });

    current = close;
  }

  return klines;
}

export function getDemoRecentTrades(symbol: string = "BTCUSDT", currentPrice: number = 96420): BinancePublicTrade[] {
  const trades: BinancePublicTrade[] = [];
  const now = Date.now();

  for (let i = 0; i < 25; i++) {
    const isBuyerMaker = i % 2 === 0;
    const delta = (Math.random() - 0.48) * 8;
    const price = Math.round((currentPrice + delta) * 100) / 100;
    const qty = Math.round((0.02 + Math.random() * 0.85) * 10000) / 10000;
    trades.push({
      id: 59000000 + i,
      price,
      qty,
      quoteQty: Math.round(price * qty * 100) / 100,
      time: now - i * 1800 - Math.floor(Math.random() * 800),
      isBuyerMaker,
    });
  }

  return trades;
}

export function getDemoSpotAccount(): BinanceAccountResponse {
  return {
    makerCommission: 10, // 0.10%
    takerCommission: 10, // 0.10%
    buyerCommission: 0,
    sellerCommission: 0,
    canTrade: true,
    canWithdraw: true,
    canDeposit: true,
    accountType: "SPOT",
    balances: [
      { asset: "BTC", free: "0.42850000", locked: "0.00000000" },
      { asset: "ETH", free: "4.85000000", locked: "0.00000000" },
      { asset: "SOL", free: "42.50000000", locked: "0.00000000" },
      { asset: "BNB", free: "12.00000000", locked: "0.00000000" },
      { asset: "SUI", free: "1500.00000000", locked: "0.00000000" },
      { asset: "USDT", free: "12840.50000000", locked: "500.00000000" },
      { asset: "USDC", free: "4500.00000000", locked: "0.00000000" },
    ],
    permissions: ["SPOT", "LEVERAGED", "TRD_GRP_002"],
  };
}

export function getDemoTradeHistory(): CalculatedCryptoTrade[] {
  return [
    {
      tradeId: 98101,
      orderId: 441001,
      symbol: "BTCUSDT",
      baseAsset: "BTC",
      quoteAsset: "USDT",
      side: "BUY",
      price: 64200.0,
      qty: 0.25,
      quoteQty: 16050.0,
      commission: 16.05,
      commissionAsset: "USDT",
      isBuyer: true,
      isMaker: false,
      executedAt: new Date(Date.now() - 38 * 24 * 3600 * 1000).toISOString(),
    },
    {
      tradeId: 98102,
      orderId: 441002,
      symbol: "SOLUSDT",
      baseAsset: "SOL",
      quoteAsset: "USDT",
      side: "BUY",
      price: 135.5,
      qty: 35.0,
      quoteQty: 4742.5,
      commission: 4.74,
      commissionAsset: "USDT",
      isBuyer: true,
      isMaker: false,
      executedAt: new Date(Date.now() - 25 * 24 * 3600 * 1000).toISOString(),
    },
    {
      tradeId: 98103,
      orderId: 441003,
      symbol: "ETHUSDT",
      baseAsset: "ETH",
      quoteAsset: "USDT",
      side: "BUY",
      price: 2850.0,
      qty: 3.0,
      quoteQty: 8550.0,
      commission: 8.55,
      commissionAsset: "USDT",
      isBuyer: true,
      isMaker: true,
      executedAt: new Date(Date.now() - 19 * 24 * 3600 * 1000).toISOString(),
    },
    {
      tradeId: 98104,
      orderId: 441004,
      symbol: "AVAXUSDT",
      baseAsset: "AVAX",
      quoteAsset: "USDT",
      side: "BUY",
      price: 28.0,
      qty: 150.0,
      quoteQty: 4200.0,
      commission: 4.2,
      commissionAsset: "USDT",
      isBuyer: true,
      isMaker: false,
      executedAt: new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString(),
    },
    {
      tradeId: 98105,
      orderId: 441005,
      symbol: "AVAXUSDT",
      baseAsset: "AVAX",
      quoteAsset: "USDT",
      side: "SELL",
      price: 36.5,
      qty: 150.0,
      quoteQty: 5475.0,
      commission: 5.48,
      commissionAsset: "USDT",
      isBuyer: false,
      isMaker: true,
      executedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    },
  ];
}
