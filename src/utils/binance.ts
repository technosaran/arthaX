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

function extractBaseAndQuote(symbol: string): { baseAsset: string; quoteAsset: string } {
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
// EMPTY FALLBACK GENERATORS (NO FAKE / MOCK DATA)
// ============================================================================

export function getDemoMarketTickers(): Record<string, BinanceTicker> {
  return {};
}

export function getDemoDepth(symbol: string = "BTCUSDT", currentPrice: number = 0): CalculatedMarketDepth {
  return {
    symbol,
    lastUpdateId: Date.now(),
    bids: [],
    asks: [],
    highestBid: currentPrice,
    lowestAsk: currentPrice,
    spread: 0,
    spreadPercent: 0,
    totalBidVolume: 0,
    totalAskVolume: 0,
    bidAskRatio: 0,
  };
}

export function getDemoKlines(_symbol: string = "BTCUSDT", _interval: string = "1h", _limit: number = 36): BinanceKline[] {
  return [];
}

export function getDemoRecentTrades(_symbol: string = "BTCUSDT", _currentPrice: number = 0): BinancePublicTrade[] {
  return [];
}

export function getDemoSpotAccount(): BinanceAccountResponse {
  return {
    makerCommission: 0,
    takerCommission: 0,
    buyerCommission: 0,
    sellerCommission: 0,
    canTrade: true,
    canWithdraw: true,
    canDeposit: true,
    accountType: "SPOT",
    balances: [],
    permissions: ["SPOT"],
  };
}
