export interface CryptoPriceResult {
  symbol: string;
  priceInr: number;
  priceUsd: number;
  dayChangePercent?: number;
}

const COINGECKO_ID_MAP: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  BNB: "binancecoin",
  XRP: "ripple",
  DOGE: "dogecoin",
  ADA: "cardano",
  AVAX: "avalanche-2",
  SUI: "sui",
  PEPE: "pepe",
  DOT: "polkadot",
  MATIC: "matic-network",
  LINK: "chainlink",
  UNI: "uniswap",
  ATOM: "cosmos",
};

export async function fetchBatchCryptoPrices(symbols: string[]): Promise<Record<string, CryptoPriceResult>> {
  const result: Record<string, CryptoPriceResult> = {};
  if (!symbols || symbols.length === 0) return result;

  const uniqueSymbols = Array.from(new Set(symbols.map((s) => s.toUpperCase().trim())));
  const cgIds = uniqueSymbols
    .map((s) => COINGECKO_ID_MAP[s])
    .filter(Boolean);

function getTimeoutSignal(ms: number) {
  if (typeof AbortSignal !== "undefined" && typeof (AbortSignal as any).timeout === "function") {
    return (AbortSignal as any).timeout(ms);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

  // 1. Try CoinGecko free simple price API
  if (cgIds.length > 0) {
    try {
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${cgIds.join(",")}&vs_currencies=inr,usd&include_24hr_change=true`;
      const res = await fetch(url, {
        next: { revalidate: 60 },
        signal: getTimeoutSignal(5000),
      });

      if (res.ok) {
        const data = await res.json();
        for (const sym of uniqueSymbols) {
          const cgId = COINGECKO_ID_MAP[sym];
          if (cgId && data[cgId]) {
            const item = data[cgId];
            result[sym] = {
              symbol: sym,
              priceInr: item.inr || 0,
              priceUsd: item.usd || 0,
              dayChangePercent: item.usd_24h_change || 0,
            };
          }
        }
      }
    } catch (err) {
      console.error("CoinGecko batch fetch failed, trying Binance ticker fallback:", err);
    }
  }

  // 2. Binance fallback for missing symbols
  for (const sym of uniqueSymbols) {
    if (!result[sym]) {
      try {
        const symbolUsdt = `${sym}USDT`;
        const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbolUsdt}`, {
          next: { revalidate: 60 },
          signal: getTimeoutSignal(3000),
        });

        if (res.ok) {
          const data = await res.json();
          const priceUsd = parseFloat(data.lastPrice || "0");
          const changePct = parseFloat(data.priceChangePercent || "0");
          const priceInr = Math.round(priceUsd * 83.5); // Approx INR conversion

          result[sym] = {
            symbol: sym,
            priceInr,
            priceUsd,
            dayChangePercent: changePct,
          };
        }
      } catch (binanceErr) {
        console.error(`Failed Binance price fetch for ${sym}:`, binanceErr);
      }
    }
  }

  return result;
}
