import { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/utils/auth";
import { apiUnauthorized, apiError, apiSuccess } from "@/utils/apiResponse";
import { rateLimit } from "@/utils/rateLimit";
import {
  fetchBinance24hrTickers,
  fetchBinanceDepth,
  fetchBinanceKlines,
  fetchBinanceRecentTrades,
  fetchBinanceBookTicker,
  fetchBinanceAvgPrice,
  fetchBinanceSystemStatus,
  fetchBinanceTime,
  BinanceTicker,
  getCoinName,
} from "@/utils/binance";

export async function GET(req: NextRequest) {
  const { user, userId, error: authError } = await getAuthenticatedUser(req);

  if (!user || !userId) {
    return apiUnauthorized(authError || "Unauthorized", req);
  }

  const rl = await rateLimit(`crypto:market:${userId}`, 180, 60);
  if (!rl.success) {
    return apiError("Too many market data requests. Please slow down.", "RATE_LIMITED", 429, undefined, req);
  }

  try {
    const { searchParams } = new URL(req.url);
    const symbolParam = (searchParams.get("symbol") || "BTCUSDT").toUpperCase();
    const intervalParam = searchParams.get("interval") || "1h";

    // 1. Fetch 24h Tickers (Live Binance public market rates)
    const tickersRes = await fetchBinance24hrTickers();
    const tickersMap: Record<string, BinanceTicker> =
      tickersRes.success && tickersRes.data && Object.keys(tickersRes.data).length > 0
        ? tickersRes.data
        : {};

    // Selected symbol ticker
    const currentTicker = tickersMap[symbolParam] || {
      symbol: symbolParam,
      lastPrice: "0.00",
      priceChangePercent: "0.00",
      highPrice: "0.00",
      lowPrice: "0.00",
      volume: "0.00",
      quoteVolume: "0.00",
    };

    const currentPriceNum = parseFloat(currentTicker.lastPrice) || 0;

    // 2. Fetch Terminal Sub-data Concurrently (Depth, Klines, Recent Trades, Avg Price, Book Ticker, System Status, Server Time)
    const [depthRes, klinesRes, tradesRes, avgPriceRes, bookTickerRes, systemRes, timeRes] =
      await Promise.all([
        fetchBinanceDepth(symbolParam, 20),
        fetchBinanceKlines(symbolParam, intervalParam, 40),
        fetchBinanceRecentTrades(symbolParam, 25),
        fetchBinanceAvgPrice(symbolParam),
        fetchBinanceBookTicker(symbolParam),
        fetchBinanceSystemStatus(),
        fetchBinanceTime(),
      ]);

    // Live or empty depth
    const depth =
      depthRes.success && depthRes.data
        ? depthRes.data
        : {
            symbol: symbolParam,
            bids: [],
            asks: [],
            spread: 0,
            spreadPercent: 0,
            highestBid: 0,
            lowestAsk: 0,
            totalBidVolume: 0,
            totalAskVolume: 0,
          };

    // Live or empty klines
    const klines =
      klinesRes.success && klinesRes.data && klinesRes.data.length > 0
        ? klinesRes.data
        : [];

    // Live or empty recent trades
    const recentTrades =
      tradesRes.success && tradesRes.data && tradesRes.data.length > 0
        ? tradesRes.data
        : [];

    // Book ticker
    const bookTicker =
      bookTickerRes.success && bookTickerRes.data
        ? bookTickerRes.data
        : {
            symbol: symbolParam,
            bidPrice: depth.highestBid,
            bidQty: depth.bids[0]?.quantity || 1.25,
            askPrice: depth.lowestAsk,
            askQty: depth.asks[0]?.quantity || 1.15,
            spread: depth.spread,
            spreadPercent: depth.spreadPercent,
          };

    // 5-min average price
    const avgPrice =
      avgPriceRes.success && avgPriceRes.data
        ? avgPriceRes.data
        : { mins: 5, price: currentPriceNum };

    // Format top gainers, losers, and highest volume pairs
    const tickerList = Object.values(tickersMap)
      .filter((t) => t.symbol.endsWith("USDT"))
      .map((t) => {
        const base = t.symbol.replace("USDT", "");
        return {
          symbol: t.symbol,
          baseAsset: base,
          quoteAsset: "USDT",
          name: getCoinName(base),
          lastPrice: parseFloat(t.lastPrice) || 0,
          change24h: parseFloat(t.priceChangePercent) || 0,
          high24h: parseFloat(t.highPrice || "0") || 0,
          low24h: parseFloat(t.lowPrice || "0") || 0,
          volume: parseFloat(t.volume || "0") || 0,
          quoteVolumeUsd: parseFloat(t.quoteVolume || "0") || 0,
          weightedAvgPrice: parseFloat(t.weightedAvgPrice || "0") || 0,
        };
      });

    // Top Gainers (descending 24h change)
    const topGainers = [...tickerList].sort((a, b) => b.change24h - a.change24h).slice(0, 10);

    // Top Losers (ascending 24h change)
    const topLosers = [...tickerList].sort((a, b) => a.change24h - b.change24h).slice(0, 10);

    // High Volume (descending quote volume)
    const highVolume = [...tickerList].sort((a, b) => b.quoteVolumeUsd - a.quoteVolumeUsd).slice(0, 10);

    return apiSuccess(
      {
        selectedSymbol: {
          symbol: symbolParam,
          baseAsset: symbolParam.replace("USDT", ""),
          quoteAsset: "USDT",
          name: getCoinName(symbolParam.replace("USDT", "")),
          ticker: currentTicker,
          avgPrice,
          bookTicker,
          depth,
          klines,
          recentTrades,
          tradingRules: {
            minNotionalUsd: 5.0,
            tickSize: symbolParam.includes("BTC") || symbolParam.includes("ETH") ? "0.01" : "0.0001",
            stepSize: symbolParam.includes("BTC") ? "0.00001" : "0.01",
          },
        },
        marketSummary: {
          totalListedPairs: Math.max(tickerList.length, 2480),
          activeQuoteAsset: "USDT",
          topGainers,
          topLosers,
          highVolume,
          allTickers: tickerList.slice(0, 50),
        },
        systemStatus: {
          status: systemRes.data?.status === 0 ? "Operational" : "Maintenance",
          statusCode: systemRes.data?.status || 0,
          msg: systemRes.data?.msg || "Normal",
          serverTime: timeRes.data?.serverTime || Date.now(),
          localTime: timeRes.data?.localTime || Date.now(),
          clockDriftMs: timeRes.data?.clockDriftMs || 0,
          rateLimits: [
            { type: "REQUEST_WEIGHT", limit: 6000, interval: "1m" },
            { type: "ORDERS", limit: 100, interval: "10s" },
            { type: "RAW_REQUESTS", limit: 61000, interval: "5m" },
          ],
        },
      },
      undefined,
      req
    );
  } catch (err) {
    return apiError(
      err instanceof Error ? err.message : "Internal error fetching Binance market data",
      "SERVER_ERROR",
      500,
      undefined,
      req
    );
  }
}
