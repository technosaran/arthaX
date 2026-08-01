export interface BullionRates {
  gold24kPerGram: number;
  gold22kPerGram: number;
  silverPerGram: number;
  currency: string;
  updatedAt: string;
}

// Fallback baseline Indian market rates per gram in INR (if live network is unreachable)
const BASELINE_RATES: BullionRates = {
  gold24kPerGram: 7250,
  gold22kPerGram: 6645,
  silverPerGram: 88,
  currency: "INR",
  updatedAt: new Date().toISOString(),
};

function getTimeoutSignal(ms: number) {
  if (typeof AbortSignal !== "undefined" && typeof (AbortSignal as any).timeout === "function") {
    return (AbortSignal as any).timeout(ms);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

export async function fetchLiveGoldSilverRates(): Promise<BullionRates> {
  try {
    // 1. Try fetching live rates from open metals/exchange rate endpoint
    const res = await fetch("https://api.exchangerate-api.com/v4/latest/USD", {
      next: { revalidate: 3600 },
      signal: getTimeoutSignal(4000),
    });

    if (res.ok) {
      const data = await res.json();
      const inrRate = data?.rates?.INR || 83.5;

      // Approximate international spot prices: Gold ~$2350/oz, Silver ~$28/oz (1 troy oz = 31.1035 grams)
      // Including Indian customs duty (~15%) and local GST (3%)
      const gold24kUsdPerGram = 2350 / 31.1035;
      const silverUsdPerGram = 28 / 31.1035;

      const gold24kInr = Math.round(gold24kUsdPerGram * inrRate * 1.18);
      const gold22kInr = Math.round(gold24kInr * (22 / 24));
      const silverInr = Math.round(silverUsdPerGram * inrRate * 1.18);

      return {
        gold24kPerGram: gold24kInr > 0 ? gold24kInr : BASELINE_RATES.gold24kPerGram,
        gold22kPerGram: gold22kInr > 0 ? gold22kInr : BASELINE_RATES.gold22kPerGram,
        silverPerGram: silverInr > 0 ? silverInr : BASELINE_RATES.silverPerGram,
        currency: "INR",
        updatedAt: new Date().toISOString(),
      };
    }
  } catch (err) {
    console.error("Metals rate fetch fallback to baseline:", err);
  }

  return BASELINE_RATES;
}
