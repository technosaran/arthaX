/**
 * Zerodha Kite standard brokerage and statutory charges calculations for F&O derivatives.
 * Applicable to NSE / BSE Futures and Options.
 */

export interface ZerodhaChargesBreakdown {
  brokerage: number;
  stt: number;
  exchangeCharges: number;
  sebiCharges: number;
  stampDuty: number;
  gst: number;
  totalCharges: number;
  turnover: number;
}

export function calculateZerodhaCharges(
  instrumentType: "CE" | "PE" | "FUT",
  side: "BUY" | "SELL",
  quantity: number,
  price: number
): ZerodhaChargesBreakdown {
  const turnover = quantity * price;

  // Zerodha Flat Brokerage: ₹20 per executed order or 0.03% (whichever is lower)
  const brokerage = Math.min(20, +(turnover * 0.0003).toFixed(2));

  // STT / CTT (Securities Transaction Tax)
  let stt = 0;
  if (instrumentType === "FUT") {
    // Futures: 0.02% on sell side turnover
    if (side === "SELL") stt = +(turnover * 0.0002).toFixed(2);
  } else {
    // Options: 0.125% of premium on sell side turnover
    if (side === "SELL") stt = +(turnover * 0.00125).toFixed(2);
  }

  // Exchange transaction charges (NSE)
  // Options: 0.0495% of premium
  // Futures: 0.0019% of turnover
  const exchangeCharges =
    instrumentType === "FUT"
      ? +(turnover * 0.000019).toFixed(2)
      : +(turnover * 0.000495).toFixed(2);

  // SEBI turnover charges: ₹10 / crore (0.000001)
  const sebiCharges = +(turnover * 0.000001).toFixed(2);

  // Stamp Duty (on BUY side only): 0.002% for futures, 0.003% for options
  let stampDuty = 0;
  if (side === "BUY") {
    stampDuty = +(turnover * (instrumentType === "FUT" ? 0.00002 : 0.00003)).toFixed(2);
  }

  // GST: 18% on (Brokerage + Exchange Charges + SEBI Charges)
  const gst = +((brokerage + exchangeCharges + sebiCharges) * 0.18).toFixed(2);

  const totalCharges = +(brokerage + stt + exchangeCharges + sebiCharges + stampDuty + gst).toFixed(2);

  return {
    brokerage,
    stt,
    exchangeCharges,
    sebiCharges,
    stampDuty,
    gst,
    totalCharges,
    turnover,
  };
}

/**
 * Normal cumulative distribution function for Option Greeks.
 */
export function normalCDF(x: number): number {
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

/**
 * Computes Put-Call Ratio (PCR).
 */
export function calculatePCR(totalCallOi: number, totalPutOi: number): number {
  if (totalCallOi <= 0) return 1.0;
  return +(totalPutOi / totalCallOi).toFixed(2);
}

/**
 * Interprets PCR market sentiment.
 */
export function interpretPCR(pcr: number): "Bullish" | "Neutral" | "Bearish" {
  if (pcr >= 1.2) return "Bullish";
  if (pcr <= 0.8) return "Bearish";
  return "Neutral";
}
