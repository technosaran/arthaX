import { NextRequest, NextResponse } from "next/server";
import { extractRequestId } from "@/utils/apiResponse";

// Standard normal cumulative distribution function
function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.sqrt(2.0);

  const t = 1.0 / (1.0 + p * absX);
  const erf =
    1.0 -
    ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

  return 0.5 * (1.0 + sign * erf);
}

// Standard normal probability density function
function normalPDF(x: number): number {
  return (1.0 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x);
}

export interface OptionGreeks {
  delta: number;
  gamma: number;
  theta: number; // daily ₹ decay
  vega: number; // ₹ change per 1% IV
}

export interface OptionStrikeData {
  strike: number;
  isAtm: boolean;
  calls: {
    ltp: number;
    change: number;
    changePercent: number;
    oi: number; // in contracts / lakhs
    oiChange: number;
    volume: number;
    iv: number;
    greeks: OptionGreeks;
  };
  puts: {
    ltp: number;
    change: number;
    changePercent: number;
    oi: number;
    oiChange: number;
    volume: number;
    iv: number;
    greeks: OptionGreeks;
  };
}

export interface OptionChainResponse {
  symbol: string;
  underlyingPrice: number;
  previousClose: number;
  change: number;
  changePercent: number;
  lotSize: number;
  step: number;
  atmStrike: number;
  expiry: string;
  availableExpiries: string[];
  totalCallOi: number;
  totalPutOi: number;
  pcr: number; // Put-Call Ratio
  maxPain: number;
  atmStraddlePremium: number;
  impliedMovePercent: number;
  strikes: OptionStrikeData[];
  lastUpdated: string;
}

// Index specifications
interface IndexConfig {
  name: string;
  yahooTicker: string;
  defaultSpot: number;
  step: number;
  lotSize: number;
}

const INDEX_CONFIGS: Record<string, IndexConfig> = {
  NIFTY: {
    name: "NIFTY 50",
    yahooTicker: "^NSEI",
    defaultSpot: 24200,
    step: 50,
    lotSize: 25,
  },
  BANKNIFTY: {
    name: "NIFTY BANK",
    yahooTicker: "^NSEBANK",
    defaultSpot: 51800,
    step: 100,
    lotSize: 15,
  },
  FINNIFTY: {
    name: "NIFTY FINANCIAL SERVICES",
    yahooTicker: "NIFTY_FIN_SERVICE.NS",
    defaultSpot: 23600,
    step: 50,
    lotSize: 25,
  },
  SENSEX: {
    name: "BSE SENSEX",
    yahooTicker: "^BSESN",
    defaultSpot: 79500,
    step: 100,
    lotSize: 10,
  },
  RELIANCE: {
    name: "Reliance Industries",
    yahooTicker: "RELIANCE.NS",
    defaultSpot: 1280,
    step: 10,
    lotSize: 250,
  },
  HDFCBANK: {
    name: "HDFC Bank",
    yahooTicker: "HDFCBANK.NS",
    defaultSpot: 1750,
    step: 10,
    lotSize: 550,
  },
  INFY: {
    name: "Infosys Ltd",
    yahooTicker: "INFY.NS",
    defaultSpot: 1840,
    step: 10,
    lotSize: 400,
  },
  TCS: {
    name: "Tata Consultancy Services",
    yahooTicker: "TCS.NS",
    defaultSpot: 4150,
    step: 20,
    lotSize: 175,
  },
};

// Calculate Black-Scholes prices and Greeks
function calculateBS(
  spot: number,
  strike: number,
  timeToExpiryYears: number,
  volatility: number,
  rate = 0.065 // RBI repo rate ~6.5%
) {
  const T = Math.max(0.001, timeToExpiryYears);
  const sigma = Math.max(0.01, volatility);
  const sqrtT = Math.sqrt(T);

  const d1 = (Math.log(spot / strike) + (rate + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;

  const Nd1 = normalCDF(d1);
  const Nd2 = normalCDF(d2);
  const N_minus_d1 = normalCDF(-d1);
  const N_minus_d2 = normalCDF(-d2);
  const pdfD1 = normalPDF(d1);

  // Prices
  const callPrice = Math.max(0.05, spot * Nd1 - strike * Math.exp(-rate * T) * Nd2);
  const putPrice = Math.max(0.05, strike * Math.exp(-rate * T) * N_minus_d2 - spot * N_minus_d1);

  // Greeks
  const gamma = +(pdfD1 / (spot * sigma * sqrtT)).toFixed(5);
  const vega = +(spot * sqrtT * pdfD1 * 0.01).toFixed(2);

  const callDelta = +Nd1.toFixed(3);
  const putDelta = +(Nd1 - 1.0).toFixed(3);

  // Theta per day (annualized / 365)
  const thetaPart1 = -(spot * pdfD1 * sigma) / (2 * sqrtT);
  const callThetaAnnual = thetaPart1 - rate * strike * Math.exp(-rate * T) * Nd2;
  const putThetaAnnual = thetaPart1 + rate * strike * Math.exp(-rate * T) * N_minus_d2;

  const callTheta = +(callThetaAnnual / 365).toFixed(2);
  const putTheta = +(putThetaAnnual / 365).toFixed(2);

  return {
    callPrice: +callPrice.toFixed(2),
    putPrice: +putPrice.toFixed(2),
    callGreeks: { delta: callDelta, gamma, theta: callTheta, vega },
    putGreeks: { delta: putDelta, gamma, theta: putTheta, vega },
  };
}

// Generate the next 4 weekly Thursday expiries (standard for Indian index options)
function getUpcomingExpiries(): string[] {
  const expiries: string[] = [];
  const now = new Date();

  // Find next Thursday (day 4)
  const current = new Date(now);
  let daysUntilThursday = (4 - current.getDay() + 7) % 7;
  if (daysUntilThursday === 0 && current.getHours() >= 15 && current.getMinutes() >= 30) {
    daysUntilThursday = 7;
  }
  current.setDate(current.getDate() + daysUntilThursday);

  for (let i = 0; i < 4; i++) {
    const d = new Date(current);
    d.setDate(current.getDate() + i * 7);
    expiries.push(d.toISOString().slice(0, 10));
  }

  return expiries;
}

// Fetch live spot index price from provider
async function fetchSpotPrice(config: IndexConfig): Promise<{ spot: number; prevClose: number }> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      config.yahooTicker
    )}?interval=1d&range=1d`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const json = await res.json();
      const meta = json?.chart?.result?.[0]?.meta;
      if (meta && typeof meta.regularMarketPrice === "number") {
        const spot = meta.regularMarketPrice;
        const prevClose = meta.chartPreviousClose || meta.previousClose || spot;
        return { spot: +spot.toFixed(2), prevClose: +prevClose.toFixed(2) };
      }
    }
  } catch {
    // Fallback if timeout or network blocked
  }

  return {
    spot: config.defaultSpot,
    prevClose: +(config.defaultSpot * 0.996).toFixed(2),
  };
}

export async function GET(req: NextRequest) {
  const requestId = extractRequestId(req);
  const { searchParams } = new URL(req.url);

  const symbol = (searchParams.get("symbol") || "NIFTY").toUpperCase();
  const config = INDEX_CONFIGS[symbol] || INDEX_CONFIGS.NIFTY;

  const availableExpiries = getUpcomingExpiries();
  const requestedExpiry = searchParams.get("expiry") || availableExpiries[0];
  const expiryDate = new Date(requestedExpiry);

  // Time to expiry in years
  const today = new Date();
  const diffMs = Math.max(86400000 * 0.5, expiryDate.getTime() - today.getTime());
  const dteDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const timeToExpiryYears = Math.max(0.002, dteDays / 365);

  // Fetch live or fallback spot price
  const { spot, prevClose } = await fetchSpotPrice(config);
  const change = +(spot - prevClose).toFixed(2);
  const changePercent = prevClose > 0 ? +((change / prevClose) * 100).toFixed(2) : 0;

  // Round spot to nearest strike step to determine ATM
  const atmStrike = Math.round(spot / config.step) * config.step;

  // Generate 21 strikes (10 OTM calls, ATM, 10 OTM puts)
  const strikeRange = 10;
  const strikes: OptionStrikeData[] = [];

  let totalCallOi = 0;
  let totalPutOi = 0;

  for (let i = -strikeRange; i <= strikeRange; i++) {
    const strike = atmStrike + i * config.step;
    const isAtm = strike === atmStrike;

    // Volatility smile: IV increases for deep OTM puts (skew) and deep OTM calls
    const moneyness = Math.log(strike / spot);
    const baseIv = 0.135; // 13.5% base
    const skew = moneyness < 0 ? 0.35 * Math.abs(moneyness) : 0.2 * moneyness;
    const iv = Math.min(0.4, Math.max(0.1, +(baseIv + skew).toFixed(4)));

    // Black Scholes valuation
    const bs = calculateBS(spot, strike, timeToExpiryYears, iv);

    // Realistic Open Interest model: peak OI around round strikes and ATM
    const distanceFromAtm = Math.abs(strike - atmStrike) / config.step;
    const roundNumberBonus = strike % 500 === 0 ? 2.5 : strike % 100 === 0 ? 1.5 : 1.0;

    // Call OI tends to be heavier above ATM (resistance), Put OI heavier below ATM (support)
    const callOiWeight = (strike >= atmStrike ? 1.4 : 0.8) * Math.exp(-0.15 * distanceFromAtm);
    const putOiWeight = (strike <= atmStrike ? 1.5 : 0.7) * Math.exp(-0.15 * distanceFromAtm);

    const callOi = Math.round(15000 * callOiWeight * roundNumberBonus * (config.lotSize / 25));
    const putOi = Math.round(16200 * putOiWeight * roundNumberBonus * (config.lotSize / 25));

    const callOiChg = Math.round((Math.sin(strike + 1) * 0.3 + 0.1) * callOi * 0.15);
    const putOiChg = Math.round((Math.cos(strike + 2) * 0.3 + 0.15) * putOi * 0.15);

    const callVol = Math.round(callOi * 0.85);
    const putVol = Math.round(putOi * 0.88);

    totalCallOi += callOi;
    totalPutOi += putOi;

    strikes.push({
      strike,
      isAtm,
      calls: {
        ltp: bs.callPrice,
        change: +(bs.callGreeks.delta * change).toFixed(2),
        changePercent: +(bs.callPrice > 0 ? (bs.callGreeks.delta * change) / bs.callPrice * 100 : 0).toFixed(1),
        oi: callOi,
        oiChange: callOiChg,
        volume: callVol,
        iv: +(iv * 100).toFixed(1),
        greeks: bs.callGreeks,
      },
      puts: {
        ltp: bs.putPrice,
        change: +(bs.putGreeks.delta * change).toFixed(2),
        changePercent: +(bs.putPrice > 0 ? (bs.putGreeks.delta * change) / bs.putPrice * 100 : 0).toFixed(1),
        oi: putOi,
        oiChange: putOiChg,
        volume: putVol,
        iv: +(iv * 100).toFixed(1),
        greeks: bs.putGreeks,
      },
    });
  }

  // Put-Call Ratio
  const pcr = totalCallOi > 0 ? +(totalPutOi / totalCallOi).toFixed(2) : 1.0;

  // Max Pain calculation: Find strike that causes minimal option buyer payout
  let minPainValue = Infinity;
  let maxPainStrike = atmStrike;

  for (const s of strikes) {
    let currentPain = 0;
    for (const other of strikes) {
      if (s.strike > other.strike) {
        currentPain += (s.strike - other.strike) * other.calls.oi;
      } else if (s.strike < other.strike) {
        currentPain += (other.strike - s.strike) * other.puts.oi;
      }
    }
    if (currentPain < minPainValue) {
      minPainValue = currentPain;
      maxPainStrike = s.strike;
    }
  }

  // ATM Straddle premium & implied move
  const atmRow = strikes.find((s) => s.isAtm) || strikes[Math.floor(strikes.length / 2)];
  const atmStraddlePremium = +(atmRow.calls.ltp + atmRow.puts.ltp).toFixed(2);
  const impliedMovePercent = spot > 0 ? +((atmStraddlePremium / spot) * 100).toFixed(2) : 0;

  const responsePayload: OptionChainResponse = {
    symbol,
    underlyingPrice: spot,
    previousClose: prevClose,
    change,
    changePercent,
    lotSize: config.lotSize,
    step: config.step,
    atmStrike,
    expiry: requestedExpiry,
    availableExpiries,
    totalCallOi,
    totalPutOi,
    pcr,
    maxPain: maxPainStrike,
    atmStraddlePremium,
    impliedMovePercent,
    strikes,
    lastUpdated: new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }),
  };

  return NextResponse.json(responsePayload, {
    headers: {
      "X-Request-Id": requestId,
      "Cache-Control": "public, max-age=5, stale-while-revalidate=15",
    },
  });
}
