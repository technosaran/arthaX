import { NextRequest, NextResponse } from "next/server";
import { extractRequestId } from "@/utils/apiResponse";

export interface IndianStockSymbol {
  symbol: string;
  name: string;
  exchange: "NSE" | "BSE";
  sector: string;
  isPopular?: boolean;
}

// Curated list of top traded Indian stocks (Nifty 50, Next 50 & Retail Favorites)
const POPULAR_INDIAN_STOCKS: IndianStockSymbol[] = [
  { symbol: "RELIANCE", name: "Reliance Industries Ltd", exchange: "NSE", sector: "Energy & Conglomerate", isPopular: true },
  { symbol: "TCS", name: "Tata Consultancy Services Ltd", exchange: "NSE", sector: "IT Services", isPopular: true },
  { symbol: "HDFCBANK", name: "HDFC Bank Ltd", exchange: "NSE", sector: "Banking", isPopular: true },
  { symbol: "INFY", name: "Infosys Ltd", exchange: "NSE", sector: "IT Services", isPopular: true },
  { symbol: "ICICIBANK", name: "ICICI Bank Ltd", exchange: "NSE", sector: "Banking", isPopular: true },
  { symbol: "SBIN", name: "State Bank of India", exchange: "NSE", sector: "Banking", isPopular: true },
  { symbol: "BHARTIARTL", name: "Bharti Airtel Ltd", exchange: "NSE", sector: "Telecommunications", isPopular: true },
  { symbol: "ITC", name: "ITC Ltd", exchange: "NSE", sector: "FMCG", isPopular: true },
  { symbol: "KOTAKBANK", name: "Kotak Mahindra Bank Ltd", exchange: "NSE", sector: "Banking", isPopular: true },
  { symbol: "LT", name: "Larsen & Toubro Ltd", exchange: "NSE", sector: "Infrastructure", isPopular: true },
  { symbol: "HINDUNILVR", name: "Hindustan Unilever Ltd", exchange: "NSE", sector: "FMCG", isPopular: true },
  { symbol: "TATAMOTORS", name: "Tata Motors Ltd", exchange: "NSE", sector: "Automobile", isPopular: true },
  { symbol: "TATASTEEL", name: "Tata Steel Ltd", exchange: "NSE", sector: "Metals & Mining", isPopular: true },
  { symbol: "TATAPOWER", name: "Tata Power Co Ltd", exchange: "NSE", sector: "Power & Utilities", isPopular: true },
  { symbol: "TATAELXSI", name: "Tata Elxsi Ltd", exchange: "NSE", sector: "IT & Design", isPopular: true },
  { symbol: "BAJFINANCE", name: "Bajaj Finance Ltd", exchange: "NSE", sector: "NBFC / Financials", isPopular: true },
  { symbol: "BAJAJFINSV", name: "Bajaj Finserv Ltd", exchange: "NSE", sector: "Financial Services", isPopular: true },
  { symbol: "MARUTI", name: "Maruti Suzuki India Ltd", exchange: "NSE", sector: "Automobile", isPopular: true },
  { symbol: "AXISBANK", name: "Axis Bank Ltd", exchange: "NSE", sector: "Banking", isPopular: true },
  { symbol: "ASIANPAINT", name: "Asian Paints Ltd", exchange: "NSE", sector: "Consumer Durables", isPopular: true },
  { symbol: "WIPRO", name: "Wipro Ltd", exchange: "NSE", sector: "IT Services", isPopular: true },
  { symbol: "HCLTECH", name: "HCL Technologies Ltd", exchange: "NSE", sector: "IT Services", isPopular: true },
  { symbol: "TITAN", name: "Titan Company Ltd", exchange: "NSE", sector: "Gems & Jewellery", isPopular: true },
  { symbol: "SUNPHARMA", name: "Sun Pharmaceutical Industries", exchange: "NSE", sector: "Pharma", isPopular: true },
  { symbol: "ULTRACEMCO", name: "UltraTech Cement Ltd", exchange: "NSE", sector: "Cement", isPopular: true },
  { symbol: "NTPC", name: "NTPC Ltd", exchange: "NSE", sector: "Power", isPopular: true },
  { symbol: "POWERGRID", name: "Power Grid Corp of India", exchange: "NSE", sector: "Power Transmission", isPopular: true },
  { symbol: "ONGC", name: "Oil & Natural Gas Corp", exchange: "NSE", sector: "Oil & Gas", isPopular: true },
  { symbol: "COALINDIA", name: "Coal India Ltd", exchange: "NSE", sector: "Mining", isPopular: true },
  { symbol: "ADANIENT", name: "Adani Enterprises Ltd", exchange: "NSE", sector: "Conglomerate", isPopular: true },
  { symbol: "ADANIPORTS", name: "Adani Ports & SEZ Ltd", exchange: "NSE", sector: "Ports & Logistics", isPopular: true },
  { symbol: "ADANIPOWER", name: "Adani Power Ltd", exchange: "NSE", sector: "Power", isPopular: true },
  { symbol: "ADANIGREEN", name: "Adani Green Energy Ltd", exchange: "NSE", sector: "Renewable Energy", isPopular: true },
  { symbol: "ETERNAL", name: "Eternal Ltd (formerly Zomato)", exchange: "NSE", sector: "Tech & Delivery", isPopular: true },
  { symbol: "JIOFIN", name: "Jio Financial Services Ltd", exchange: "NSE", sector: "Financial Services", isPopular: true },
  { symbol: "HAL", name: "Hindustan Aeronautics Ltd", exchange: "NSE", sector: "Defense & Aerospace", isPopular: true },
  { symbol: "BEL", name: "Bharat Electronics Ltd", exchange: "NSE", sector: "Defense Electronics", isPopular: true },
  { symbol: "IRFC", name: "Indian Railway Finance Corp", exchange: "NSE", sector: "Railways & Finance", isPopular: true },
  { symbol: "RVNL", name: "Rail Vikas Nigam Ltd", exchange: "NSE", sector: "Railways Infrastructure", isPopular: true },
  { symbol: "IRCTC", name: "IRCTC Ltd", exchange: "NSE", sector: "Railways / Tourism", isPopular: true },
  { symbol: "SUZLON", name: "Suzlon Energy Ltd", exchange: "NSE", sector: "Clean Energy", isPopular: true },
  { symbol: "CDSL", name: "Central Depository Services Ltd", exchange: "NSE", sector: "Capital Markets", isPopular: true },
  { symbol: "BSE", name: "BSE Ltd", exchange: "NSE", sector: "Capital Markets", isPopular: true },
  { symbol: "ANGELONE", name: "Angel One Ltd", exchange: "NSE", sector: "Brokerage", isPopular: true },
  { symbol: "PAYTM", name: "One97 Communications (Paytm)", exchange: "NSE", sector: "Fintech", isPopular: true },
  { symbol: "POLICYBZR", name: "PB Fintech Ltd (Policybazaar)", exchange: "NSE", sector: "Fintech", isPopular: true },
  { symbol: "NYKAA", name: "FSN E-Commerce (Nykaa)", exchange: "NSE", sector: "E-Commerce", isPopular: true },
  { symbol: "ZOMATO", name: "Eternal Ltd (Zomato)", exchange: "NSE", sector: "Tech & Delivery", isPopular: true },
  { symbol: "NESTLEIND", name: "Nestle India Ltd", exchange: "NSE", sector: "FMCG", isPopular: true },
  { symbol: "BRITANNIA", name: "Britannia Industries Ltd", exchange: "NSE", sector: "FMCG", isPopular: true },
  { symbol: "CIPLA", name: "Cipla Ltd", exchange: "NSE", sector: "Pharma", isPopular: true },
  { symbol: "DRREDDY", name: "Dr. Reddy's Laboratories", exchange: "NSE", sector: "Pharma", isPopular: true },
  { symbol: "DIVISLAB", name: "Divi's Laboratories Ltd", exchange: "NSE", sector: "Pharma", isPopular: true },
  { symbol: "APOLLOHOSP", name: "Apollo Hospitals Enterprise", exchange: "NSE", sector: "Healthcare", isPopular: true },
  { symbol: "HEROMOTOCO", name: "Hero MotoCorp Ltd", exchange: "NSE", sector: "Automobile", isPopular: true },
  { symbol: "EICHERMOT", name: "Eicher Motors Ltd", exchange: "NSE", sector: "Automobile", isPopular: true },
  { symbol: "BAJAJ-AUTO", name: "Bajaj Auto Ltd", exchange: "NSE", sector: "Automobile", isPopular: true },
  { symbol: "M&M", name: "Mahindra & Mahindra Ltd", exchange: "NSE", sector: "Automobile", isPopular: true },
  { symbol: "VEDL", name: "Vedanta Ltd", exchange: "NSE", sector: "Metals & Mining", isPopular: true },
  { symbol: "HINDALCO", name: "Hindalco Industries Ltd", exchange: "NSE", sector: "Metals", isPopular: true },
  { symbol: "JSWSTEEL", name: "JSW Steel Ltd", exchange: "NSE", sector: "Metals & Steel", isPopular: true },
  { symbol: "PIDILITIND", name: "Pidilite Industries Ltd", exchange: "NSE", sector: "Specialty Chemicals", isPopular: true },
  { symbol: "HDFCLIFE", name: "HDFC Life Insurance Co", exchange: "NSE", sector: "Insurance", isPopular: true },
  { symbol: "SBILIFE", name: "SBI Life Insurance Co", exchange: "NSE", sector: "Insurance", isPopular: true },
];

export async function GET(req: NextRequest) {
  const requestId = extractRequestId(req);
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() || "";

  // If query is empty, return top popular Indian stocks
  if (!q) {
    return NextResponse.json(
      {
        success: true,
        results: POPULAR_INDIAN_STOCKS.slice(0, 15),
      },
      { headers: { "X-Request-Id": requestId } }
    );
  }

  const queryLower = q.toLowerCase();

  // 1. First search in local curated index (exact matches, prefix matches)
  const localMatches = POPULAR_INDIAN_STOCKS.filter(
    (stock) =>
      stock.symbol.toLowerCase().includes(queryLower) ||
      stock.name.toLowerCase().includes(queryLower) ||
      stock.sector.toLowerCase().includes(queryLower)
  );

  // If we already have strong local matches, return them immediately
  const externalMatches: IndianStockSymbol[] = [];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);

    const searchUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
      q
    )}&quotesCount=12&newsCount=0`;

    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      const quotes = data.quotes || [];

      for (const item of quotes) {
        if (!item.symbol) continue;
        const isNSE = item.symbol.endsWith(".NS");
        const isBSE = item.symbol.endsWith(".BO");

        if (isNSE || isBSE) {
          const rawSymbol = item.symbol.replace(/\.(NS|BO)$/, "");
          const exchange: "NSE" | "BSE" = isNSE ? "NSE" : "BSE";

          // Don't add duplicate if already in localMatches
          const alreadyMatched = localMatches.some(
            (m) => m.symbol.toUpperCase() === rawSymbol.toUpperCase() && m.exchange === exchange
          );

          if (!alreadyMatched) {
            externalMatches.push({
              symbol: rawSymbol,
              name: item.shortname || item.longname || rawSymbol,
              exchange,
              sector: item.sector || "Equities",
              isPopular: false,
            });
          }
        }
      }
    }
  } catch (err) {
    // Graceful fallback to local matches on timeout or external API errors
    console.warn("[Stocks Search] External search error or timeout:", err);
  }

  const combined = [...localMatches, ...externalMatches].slice(0, 20);

  return NextResponse.json(
    {
      success: true,
      query: q,
      results: combined,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=30, s-maxage=60",
        "X-Request-Id": requestId,
      },
    }
  );
}
