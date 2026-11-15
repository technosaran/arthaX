import { NextRequest, NextResponse } from "next/server";
import { extractRequestId } from "@/utils/apiResponse";

export interface MutualFundSearchResult {
  schemeCode: string;
  schemeName: string;
  fundHouse: string;
  category: string;
  assetClass: "Equity" | "Debt" | "Hybrid" | "Commodity" | "Other";
  planType: "Direct" | "Regular";
  isDirectCoin: boolean;
  isPopular?: boolean;
}

export function inferCategoryAndAsset(name: string, rawCategory?: string): {
  category: string;
  assetClass: "Equity" | "Debt" | "Hybrid" | "Commodity" | "Other";
} {
  const text = `${name} ${rawCategory || ""}`.toLowerCase();

  if (text.includes("elss") || text.includes("tax saver")) {
    return { category: "ELSS (Tax Saver)", assetClass: "Equity" };
  }
  if (text.includes("flexi cap") || text.includes("flexicap")) {
    return { category: "Flexi Cap", assetClass: "Equity" };
  }
  if (text.includes("small cap") || text.includes("smallcap")) {
    return { category: "Small Cap", assetClass: "Equity" };
  }
  if (text.includes("mid cap") || text.includes("midcap")) {
    return { category: "Mid Cap", assetClass: "Equity" };
  }
  if (text.includes("large & mid") || text.includes("large and mid")) {
    return { category: "Large & Mid Cap", assetClass: "Equity" };
  }
  if (text.includes("large cap") || text.includes("bluechip") || text.includes("top 100") || text.includes("frontline")) {
    return { category: "Large Cap", assetClass: "Equity" };
  }
  if (text.includes("nifty") || text.includes("sensex") || text.includes("index")) {
    return { category: "Index Fund", assetClass: "Equity" };
  }
  if (text.includes("contra") || text.includes("value fund")) {
    return { category: "Value & Contra", assetClass: "Equity" };
  }
  if (text.includes("balanced advantage") || text.includes("dynamic asset") || text.includes("hybrid") || text.includes("multi asset") || text.includes("arbitrage")) {
    return { category: "Hybrid / Balanced", assetClass: "Hybrid" };
  }
  if (text.includes("gold") || text.includes("silver") || text.includes("commodity")) {
    return { category: "Commodities", assetClass: "Commodity" };
  }
  if (text.includes("liquid") || text.includes("overnight") || text.includes("money market") || text.includes("ultra short") || text.includes("corporate bond") || text.includes("gilt") || text.includes("debt")) {
    return { category: "Debt & Liquid", assetClass: "Debt" };
  }
  if (text.includes("nasdaq") || text.includes("us equity") || text.includes("international") || text.includes("global")) {
    return { category: "International FoF", assetClass: "Equity" };
  }

  return { category: "Equity (Other)", assetClass: "Equity" };
}

export function inferFundHouse(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("parag parikh") || lower.includes("ppfas")) return "PPFAS Mutual Fund";
  if (lower.includes("quant")) return "Quant Mutual Fund";
  if (lower.includes("nippon")) return "Nippon India Mutual Fund";
  if (lower.includes("hdfc")) return "HDFC Mutual Fund";
  if (lower.includes("sbi")) return "SBI Mutual Fund";
  if (lower.includes("icici")) return "ICICI Prudential Mutual Fund";
  if (lower.includes("mirae")) return "Mirae Asset Mutual Fund";
  if (lower.includes("motilal")) return "Motilal Oswal Mutual Fund";
  if (lower.includes("kotak")) return "Kotak Mahindra Mutual Fund";
  if (lower.includes("axis")) return "Axis Mutual Fund";
  if (lower.includes("tata")) return "Tata Mutual Fund";
  if (lower.includes("uti")) return "UTI Mutual Fund";
  if (lower.includes("bandhan") || lower.includes("idfc")) return "Bandhan Mutual Fund";
  if (lower.includes("dsp")) return "DSP Mutual Fund";
  if (lower.includes("edelweiss")) return "Edelweiss Mutual Fund";
  if (lower.includes("invesco")) return "Invesco Mutual Fund";
  if (lower.includes("canara robeco")) return "Canara Robeco Mutual Fund";
  if (lower.includes("franklin")) return "Franklin Templeton Mutual Fund";
  if (lower.includes("pgim")) return "PGIM India Mutual Fund";
  if (lower.includes("sundaram")) return "Sundaram Mutual Fund";
  if (lower.includes("groww") || lower.includes("indiabulls")) return "Groww Mutual Fund";
  if (lower.includes("zerodha")) return "Zerodha Fund House";

  // Fallback to first 2 words before "Mutual Fund" or first 3 words
  const parts = name.split(" - ")[0].split(" ");
  return parts.slice(0, 2).join(" ") + " MF";
}

// Curated list of Zerodha Coin favorites (Direct Growth schemes)
const POPULAR_COIN_FUNDS: MutualFundSearchResult[] = [
  {
    schemeCode: "122639",
    schemeName: "Parag Parikh Flexi Cap Fund - Direct Plan - Growth",
    fundHouse: "PPFAS Mutual Fund",
    category: "Flexi Cap",
    assetClass: "Equity",
    planType: "Direct",
    isDirectCoin: true,
    isPopular: true,
  },
  {
    schemeCode: "120828",
    schemeName: "Quant Small Cap Fund - Direct Plan - Growth",
    fundHouse: "Quant Mutual Fund",
    category: "Small Cap",
    assetClass: "Equity",
    planType: "Direct",
    isDirectCoin: true,
    isPopular: true,
  },
  {
    schemeCode: "118778",
    schemeName: "Nippon India Small Cap Fund - Direct Plan - Growth Option",
    fundHouse: "Nippon India Mutual Fund",
    category: "Small Cap",
    assetClass: "Equity",
    planType: "Direct",
    isDirectCoin: true,
    isPopular: true,
  },
  {
    schemeCode: "118989",
    schemeName: "HDFC Mid-Cap Opportunities Fund - Direct Plan - Growth",
    fundHouse: "HDFC Mutual Fund",
    category: "Mid Cap",
    assetClass: "Equity",
    planType: "Direct",
    isDirectCoin: true,
    isPopular: true,
  },
  {
    schemeCode: "120847",
    schemeName: "Quant Flexi Cap Fund - Direct Plan - Growth",
    fundHouse: "Quant Mutual Fund",
    category: "Flexi Cap",
    assetClass: "Equity",
    planType: "Direct",
    isDirectCoin: true,
    isPopular: true,
  },
  {
    schemeCode: "118834",
    schemeName: "Mirae Asset Large & Midcap Fund - Direct Plan - Growth",
    fundHouse: "Mirae Asset Mutual Fund",
    category: "Large & Mid Cap",
    assetClass: "Equity",
    planType: "Direct",
    isDirectCoin: true,
    isPopular: true,
  },
  {
    schemeCode: "120716",
    schemeName: "UTI Nifty 50 Index Fund - Direct Plan - Growth",
    fundHouse: "UTI Mutual Fund",
    category: "Index Fund",
    assetClass: "Equity",
    planType: "Direct",
    isDirectCoin: true,
    isPopular: true,
  },
  {
    schemeCode: "120586",
    schemeName: "ICICI Prudential Bluechip Fund - Direct Plan - Growth",
    fundHouse: "ICICI Prudential Mutual Fund",
    category: "Large Cap",
    assetClass: "Equity",
    planType: "Direct",
    isDirectCoin: true,
    isPopular: true,
  },
  {
    schemeCode: "119598",
    schemeName: "SBI Contra Fund - Direct Plan - Growth",
    fundHouse: "SBI Mutual Fund",
    category: "Value & Contra",
    assetClass: "Equity",
    planType: "Direct",
    isDirectCoin: true,
    isPopular: true,
  },
  {
    schemeCode: "127042",
    schemeName: "Motilal Oswal Midcap Fund - Direct Plan - Growth",
    fundHouse: "Motilal Oswal Mutual Fund",
    category: "Mid Cap",
    assetClass: "Equity",
    planType: "Direct",
    isDirectCoin: true,
    isPopular: true,
  },
  {
    schemeCode: "147493",
    schemeName: "Parag Parikh ELSS Tax Saver Fund - Direct Plan - Growth",
    fundHouse: "PPFAS Mutual Fund",
    category: "ELSS (Tax Saver)",
    assetClass: "Equity",
    planType: "Direct",
    isDirectCoin: true,
    isPopular: true,
  },
  {
    schemeCode: "135766",
    schemeName: "Mirae Asset ELSS Tax Saver Fund - Direct Plan - Growth",
    fundHouse: "Mirae Asset Mutual Fund",
    category: "ELSS (Tax Saver)",
    assetClass: "Equity",
    planType: "Direct",
    isDirectCoin: true,
    isPopular: true,
  },
  {
    schemeCode: "120594",
    schemeName: "ICICI Prudential Balanced Advantage Fund - Direct Plan - Growth",
    fundHouse: "ICICI Prudential Mutual Fund",
    category: "Hybrid / Balanced",
    assetClass: "Hybrid",
    planType: "Direct",
    isDirectCoin: true,
    isPopular: true,
  },
  {
    schemeCode: "120536",
    schemeName: "ICICI Prudential Liquid Fund - Direct Plan - Growth",
    fundHouse: "ICICI Prudential Mutual Fund",
    category: "Debt & Liquid",
    assetClass: "Debt",
    planType: "Direct",
    isDirectCoin: true,
    isPopular: true,
  },
  {
    schemeCode: "149539",
    schemeName: "Nippon India Silver ETF Fund of Fund - Direct Plan - Growth",
    fundHouse: "Nippon India Mutual Fund",
    category: "Commodities",
    assetClass: "Commodity",
    planType: "Direct",
    isDirectCoin: true,
    isPopular: true,
  },
];

export async function GET(req: NextRequest) {
  const requestId = extractRequestId(req);
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() || "";

  // Return popular Zerodha Coin funds when query is empty
  if (!q) {
    return NextResponse.json(
      {
        success: true,
        results: POPULAR_COIN_FUNDS,
      },
      { headers: { "X-Request-Id": requestId } }
    );
  }

  const queryLower = q.toLowerCase();

  // 1. Check local popular list
  const localMatches = POPULAR_COIN_FUNDS.filter(
    (fund) =>
      fund.schemeName.toLowerCase().includes(queryLower) ||
      fund.fundHouse.toLowerCase().includes(queryLower) ||
      fund.category.toLowerCase().includes(queryLower) ||
      fund.schemeCode.includes(queryLower)
  );

  try {
    // 2. Fetch live schemes from MFAPI
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(q)}`, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    clearTimeout(timeout);

    let remoteResults: MutualFundSearchResult[] = [];

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        remoteResults = data.map((item: { schemeCode: number | string; schemeName: string }) => {
          const sName = String(item.schemeName);
          const isDirect = /direct/i.test(sName);
          const { category, assetClass } = inferCategoryAndAsset(sName);
          const fundHouse = inferFundHouse(sName);

          return {
            schemeCode: String(item.schemeCode),
            schemeName: sName,
            fundHouse,
            category,
            assetClass,
            planType: isDirect ? "Direct" : "Regular",
            isDirectCoin: isDirect,
          };
        });
      }
    }

    // Merge: Deduplicate by schemeCode, prioritize Direct plans (Coin platform standard), then Growth
    const seen = new Set<string>();
    const combined: MutualFundSearchResult[] = [];

    for (const fund of [...localMatches, ...remoteResults]) {
      if (!seen.has(fund.schemeCode)) {
        seen.add(fund.schemeCode);
        combined.push(fund);
      }
    }

    // Sort: Direct plans first, then Growth, then closest match
    combined.sort((a, b) => {
      // 1. Direct plans rank higher for Zerodha Coin users
      if (a.isDirectCoin && !b.isDirectCoin) return -1;
      if (!a.isDirectCoin && b.isDirectCoin) return 1;

      // 2. Growth options rank higher than IDCW/Dividend
      const aGrowth = /growth/i.test(a.schemeName);
      const bGrowth = /growth/i.test(b.schemeName);
      if (aGrowth && !bGrowth) return -1;
      if (!aGrowth && bGrowth) return 1;

      return 0;
    });

    return NextResponse.json(
      {
        success: true,
        results: combined.slice(0, 20),
      },
      { headers: { "X-Request-Id": requestId } }
    );
  } catch (err) {
    console.warn("[Mutual Funds Search] Live search failed, using local match:", err);
    return NextResponse.json(
      {
        success: true,
        results: localMatches,
      },
      { headers: { "X-Request-Id": requestId } }
    );
  }
}
