/**
 * arthaX Merchant Normalization Engine
 * Normalizes raw transaction descriptions, merchant names, bank strings, and payment handles to canonical domains.
 */

import { EntityCategory, NormalizationResult } from "./types";

// Known Exact Entity & Domain Map (Indian & Global Finance, E-commerce, Services)
const EXACT_ALIAS_MAP: Record<string, { domain: string; category: EntityCategory }> = {
  // Banks & Financial Institutions
  "sbi": { domain: "sbi.co.in", category: "bank" },
  "sbi upi": { domain: "onlinesbi.sbi", category: "upi" },
  "state bank of india": { domain: "sbi.co.in", category: "bank" },
  "icici": { domain: "icicibank.com", category: "bank" },
  "icici bank": { domain: "icicibank.com", category: "bank" },
  "icici bank ltd": { domain: "icicibank.com", category: "bank" },
  "hdfc": { domain: "hdfcbank.com", category: "bank" },
  "hdfc bank": { domain: "hdfcbank.com", category: "bank" },
  "axis": { domain: "axisbank.com", category: "bank" },
  "axis bank": { domain: "axisbank.com", category: "bank" },
  "kotak": { domain: "kotak.com", category: "bank" },
  "kotak mahindra": { domain: "kotak.com", category: "bank" },
  "pnb": { domain: "pnbindia.in", category: "bank" },
  "punjab national bank": { domain: "pnbindia.in", category: "bank" },
  "bob": { domain: "bankofbaroda.in", category: "bank" },
  "bank of baroda": { domain: "bankofbaroda.in", category: "bank" },
  "canara": { domain: "canarabank.com", category: "bank" },
  "canara bank": { domain: "canarabank.com", category: "bank" },
  "union bank": { domain: "unionbankofindia.co.in", category: "bank" },
  "idfc": { domain: "idfcfirstbank.com", category: "bank" },
  "idfc first": { domain: "idfcfirstbank.com", category: "bank" },
  "idfc first bank": { domain: "idfcfirstbank.com", category: "bank" },
  "yes bank": { domain: "yesbank.in", category: "bank" },
  "indusind": { domain: "indusind.com", category: "bank" },
  "au bank": { domain: "aubank.in", category: "bank" },

  // E-commerce & Merchants
  "amazon": { domain: "amazon.in", category: "merchant" },
  "amazon pay": { domain: "amazon.in", category: "payment_app" },
  "amazon pay india": { domain: "amazon.in", category: "payment_app" },
  "flipkart": { domain: "flipkart.com", category: "merchant" },
  "swiggy": { domain: "swiggy.in", category: "merchant" },
  "zomato": { domain: "zomato.com", category: "merchant" },
  "blinkit": { domain: "blinkit.com", category: "merchant" },
  "zepto": { domain: "zepto.co.in", category: "merchant" },
  "myntra": { domain: "myntra.com", category: "merchant" },
  "ajio": { domain: "ajio.com", category: "merchant" },
  "nykaa": { domain: "nykaa.com", category: "merchant" },
  "kfc": { domain: "online.kfc.co.in", category: "merchant" },
  "kfc india": { domain: "online.kfc.co.in", category: "merchant" },
  "mcdonalds": { domain: "mcdonaldsindia.com", category: "merchant" },
  "starbucks": { domain: "starbucks.in", category: "merchant" },
  "uber": { domain: "uber.com", category: "merchant" },
  "ola": { domain: "olacabs.com", category: "merchant" },
  "rapido": { domain: "rapido.bike", category: "merchant" },
  "bookmyshow": { domain: "bookmyshow.com", category: "merchant" },
  "make my trip": { domain: "makemytrip.com", category: "merchant" },
  "makemytrip": { domain: "makemytrip.com", category: "merchant" },

  // Payment Apps & UPI
  "phonepe": { domain: "phonepe.com", category: "payment_app" },
  "gpay": { domain: "pay.google.com", category: "payment_app" },
  "google pay": { domain: "pay.google.com", category: "payment_app" },
  "paytm": { domain: "paytm.com", category: "payment_app" },
  "cred": { domain: "cred.club", category: "payment_app" },
  "razorpay": { domain: "razorpay.com", category: "payment_app" },
  "jupiter": { domain: "jupiter.money", category: "bank" },
  "fi": { domain: "fi.money", category: "bank" },

  // Investment Platforms & Mutual Funds & Crypto
  "groww": { domain: "groww.in", category: "investment" },
  "zerodha": { domain: "zerodha.com", category: "brokerage" },
  "upstox": { domain: "upstox.com", category: "brokerage" },
  "angel one": { domain: "angelone.in", category: "brokerage" },
  "angelone": { domain: "angelone.in", category: "brokerage" },
  "paytm money": { domain: "paytmmoney.com", category: "investment" },
  "binance": { domain: "binance.com", category: "crypto" },
  "coindcx": { domain: "coindcx.com", category: "crypto" },
  "coinswitch": { domain: "coinswitch.co", category: "crypto" },
  "wazirx": { domain: "wazirx.com", category: "crypto" },

  // Tech & Global Brands
  "google": { domain: "google.com", category: "company" },
  "google *youtube": { domain: "youtube.com", category: "company" },
  "youtube": { domain: "youtube.com", category: "company" },
  "microsoft": { domain: "microsoft.com", category: "company" },
  "apple": { domain: "apple.com", category: "company" },
  "netflix": { domain: "netflix.com", category: "company" },
  "spotify": { domain: "spotify.com", category: "company" },
  "meta": { domain: "meta.com", category: "company" },
  "tcs": { domain: "tcs.com", category: "company" },
  "tata": { domain: "tata.com", category: "company" },
  "infosys": { domain: "infosys.com", category: "company" },
  "wipro": { domain: "wipro.com", category: "company" },

  // Government & Services
  "lic": { domain: "licindia.in", category: "insurance" },
  "irctc": { domain: "irctc.co.in", category: "government" },
};

// Patterns for transaction string cleaning
const NOISE_PREFIXES = [
  /^(upi|pos|ach|neft|rtgs|imps|atm|ecomm|sal|salary|dividend|ref|trf|paid to|payment to|transfer to)\s*[:/-]?\s*/i,
  /^(inb|mb|wib|billdesk|ccav|payu)\s*[:/-]?\s*/i,
];

const NOISE_SUFFIXES = [
  /\b(ltd|limited|pvt|private|inc|corp|corporation|llc|co|india|services|solutions)\b/gi,
  /\b(bank|bk|branch)\b/gi,
];

/**
 * Normalizes raw merchant or entity query into canonical name and domain.
 */
export function normalizeMerchant(rawQuery: string): NormalizationResult {
  if (!rawQuery) {
    return {
      rawQuery: "",
      normalizedName: "Unknown Merchant",
      domain: "",
      category: "general",
      aliasMatched: false,
    };
  }

  const cleanInput = rawQuery.trim().toLowerCase();

  // 1. Direct Alias Check
  if (EXACT_ALIAS_MAP[cleanInput]) {
    const match = EXACT_ALIAS_MAP[cleanInput];
    return {
      rawQuery,
      normalizedName: cleanInput,
      domain: match.domain,
      category: match.category,
      aliasMatched: true,
    };
  }

  // 2. Strip Noise Prefixes (e.g. "UPI/AMAZON PAY INDIA/REF123" -> "amazon pay india")
  let stripped = cleanInput;
  for (const prefix of NOISE_PREFIXES) {
    stripped = stripped.replace(prefix, "");
  }

  // Strip transaction reference codes like "/123456/okicici" or "*YOUTUBE"
  stripped = stripped.replace(/[\/\*]\s*[a-z0-9_-]+/gi, " ").trim();

  // Check alias again after prefix/code stripping
  if (EXACT_ALIAS_MAP[stripped]) {
    const match = EXACT_ALIAS_MAP[stripped];
    return {
      rawQuery,
      normalizedName: stripped,
      domain: match.domain,
      category: match.category,
      aliasMatched: true,
    };
  }

  // 3. Direct Domain Check (e.g., "youtube.com" or "online.kfc.co.in")
  const domainRegex = /\b([a-z0-9\-]+\.(?:com|in|co\.in|sbi|net|org|io|club|money|bike|app|tech|dev))\b/i;
  const domainMatch = stripped.match(domainRegex);
  if (domainMatch) {
    const domain = domainMatch[1].toLowerCase();
    return {
      rawQuery,
      normalizedName: domain.split(".")[0],
      domain,
      category: "company",
      aliasMatched: false,
    };
  }

  // 4. Substring Match against Alias Database
  for (const [alias, data] of Object.entries(EXACT_ALIAS_MAP)) {
    if (stripped.includes(alias)) {
      return {
        rawQuery,
        normalizedName: alias,
        domain: data.domain,
        category: data.category,
        aliasMatched: true,
      };
    }
  }

  // 5. Fallback Extraction (e.g., "KFC INDIA" -> "kfc.com")
  let coreName = stripped;
  for (const suffix of NOISE_SUFFIXES) {
    coreName = coreName.replace(suffix, "");
  }
  coreName = coreName.replace(/[^a-z0-9]/g, "").trim();

  const domain = coreName.length >= 3 ? `${coreName}.com` : "";

  return {
    rawQuery,
    normalizedName: coreName || cleanInput,
    domain,
    category: "general",
    aliasMatched: false,
  };
}
