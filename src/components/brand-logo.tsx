"use client";

import { useMemo, useState, memo } from "react";
import { getBankLogoSources } from "@/lib/banks";

const GENERIC_NON_MERCHANT_WORDS = new Set([
  "home", "rent", "dress", "clothes", "clothing", "food", "dinner", "lunch", "breakfast",
  "tea", "coffee", "milk", "groceries", "grocery", "vegetables", "fruits",
  "cabs", "cab", "auto", "taxi", "fuel", "petrol", "diesel", "bills", "recharge",
  "wifi", "broadband", "electricity", "water", "gas", "doctor", "medical",
  "medicine", "hospital", "clinic", "fees", "school", "college", "tuition",
  "cash", "transfer", "interest", "dividend", "salary", "bonus", "freelance",
  "payout", "credit", "debit", "refund", "purchase", "shopping", "maintenance",
  "repair", "service", "gym", "fitness", "movie", "cinema", "entertainment",
  "travel", "flight", "hotel", "bus", "train", "ticket", "party", "gift",
  "personal", "miscellaneous", "others", "other", "outflow", "inflow", "cash reserve"
]);

const GENERIC_CATEGORY_ICONS: Record<string, string> = {
  home: "🏠",
  rent: "🏠",
  food: "🍔",
  dinner: "🍔",
  lunch: "🍔",
  dress: "👔",
  clothes: "👔",
  clothing: "👔",
  fuel: "⛽",
  petrol: "⛽",
  bills: "⚡",
  recharge: "📱",
  wifi: "📶",
  cash: "💵",
  medical: "🏥",
  doctor: "🏥",
  travel: "✈️",
  movie: "🎬",
  shopping: "🛍️",
};

const KNOWN_DOMAINS: Record<string, string> = {
  // AMC & Mutual Funds
  "parag parikh": "amc.ppfas.com",
  ppfas: "amc.ppfas.com",
  nippon: "nipponindiamf.com",
  sbi: "sbimf.com",
  hdfc: "hdfcfund.com",
  icici: "icicipruamc.com",
  quant: "quantmutual.com",
  mirae: "miraeassetmf.co.in",
  kotak: "kotakmf.com",
  axis: "axismf.com",
  "motilal oswal": "motilaloswalmf.com",
  uti: "utimf.com",
  dsp: "dspim.com",
  tata: "tatamutual.com",
  canara: "canararobeco.com",
  sundaram: "sundarammutual.com",
  edelweiss: "edelweissmf.com",
  invesco: "invescomutualfund.com",
  navi: "navi.com",
  bandhan: "bandhanmutual.com",
  mahindra: "mahindramutualfund.com",
  union: "unionmf.com",
  lic: "licmf.com",
  
  // Stocks & Major Companies
  reliance: "ril.com",
  tcs: "tcs.com",
  infosys: "infosys.com",
  wipro: "wipro.com",
  hcltech: "hcltech.com",
  airtel: "airtel.in",
  itc: "itcportal.com",
  larsen: "larsentoubro.com",
  tatamotors: "tatamotors.com",
  maruti: "marutisuzuki.com",
  sunpharma: "sunpharma.com",
  ultratech: "ultratechcement.com",
  titan: "titancompany.in",
  asianpaints: "asianpaints.com",
  nestle: "nestle.in",
  bajaj: "bajajfinserv.in",
  jio: "jio.com",
  adani: "adanienterprises.com",
  coalindia: "coalindia.in",
  ntpc: "ntpc.co.in",
  ongc: "ongcindia.com",
  powergrid: "powergrid.in",
  hindalco: "hindalco.com",
  "tata-steel": "tatasteel.com",
  tatasteel: "tatasteel.com",
  vedanta: "vedantalimited.com",
  divislab: "divislabs.com",
  cipla: "cipla.com",
  drreddy: "drreddys.com",
  ebix: "ebix.com",
  irctc: "irctc.co.in",
  hal: "hal-india.co.in",
  bel: "bel-india.in",
  zomato: "zomato.com",
  paytm: "paytm.com",
  pbtech: "policybazaar.com",
  policybazaar: "policybazaar.com",
  nykaa: "nykaa.com",
  delhivery: "delhivery.com",
  google: "google.com",
  apple: "apple.com",
  microsoft: "microsoft.com",
  amazon: "amazon.com",
  meta: "meta.com",
  tesla: "tesla.com",
  nvidia: "nvidia.com",
  netflix: "netflix.com",
  amd: "amd.com",
  intel: "intel.com",
  qualcomm: "qualcomm.com",
  broadcom: "broadcom.com",

  // Merchants & Services
  kfc: "kfc.com",
  raymond: "raymond.in",
  otto: "otto.de",
  uber: "uber.com",
  ola: "olacabs.com",
  rapido: "rapido.bike",
  swiggy: "swiggy.in",
  zepto: "zepto.co.in",
  blinkit: "blinkit.com",
  bigbasket: "bigbasket.com",
  flipkart: "flipkart.com",
  myntra: "myntra.com",
  ajio: "ajio.com",
  meesho: "meesho.com",
  croma: "croma.com",
  pvr: "pvrcinemas.com",
  inox: "inoxmovies.com",
  bookmyshow: "bookmyshow.com",
  spotify: "spotify.com",
  apollo: "apollopharmacy.in",
  pharmeasy: "pharmeasy.in",
  "1mg": "1mg.com",
  urbancompany: "urbancompany.com",
  cult: "cult.fit",
  curefit: "cult.fit",
  cred: "cred.club",
  samsung: "samsung.com",
  tvs: "tvsmotor.com",
  tvsmotor: "tvsmotor.com",
  slice: "sliceit.com",
  onecard: "getonecard.app",
};

export const BrandLogo = memo(({ name, symbol, className = "w-8 h-8", style }: { name?: string | null; symbol?: string | null; className?: string; style?: React.CSSProperties }) => {
  const query = (symbol || name || "").trim();

  const cleanQuery = useMemo(() => {
    if (!query) return "";
    return query.replace(/^\[(gemini ai|telegram|ai|bot)\]\s*/i, "").trim();
  }, [query]);

  const sources = useMemo(() => {
    if (!cleanQuery) return [];
    const clean = cleanQuery.toLowerCase().trim();

    // 1. Check if query is a bank -> use separate bank API chain
    const bankSources = getBankLogoSources(cleanQuery);
    if (bankSources.length > 0) {
      return bankSources;
    }

    // 2. Resolve domain for general brand
    let domain: string | null = null;
    for (const [key, dom] of Object.entries(KNOWN_DOMAINS)) {
      if (clean.includes(key)) {
        domain = dom;
        break;
      }
    }

    if (!domain) {
      const domainMatch = clean.match(/\b([a-z0-9\-]+\.(?:com|in|co|org|io|dev|ai|app|net|tech|money|club|de))\b/i);
      if (domainMatch) {
        domain = domainMatch[1].toLowerCase();
      }
    }

    if (!domain) {
      const firstWord = clean
        .replace(/^(dividend|salary|expense|purchase|paid to|payment to|ref):\s*/i, "")
        .replace(/\b(ltd|limited|corp|inc|co|serv|services|fund|direct|regular|plan|growth|option|mutual)\b/gi, "")
        .replace(/\([^)]*\)/g, "")
        .trim()
        .split(/\s+/)[0]
        .replace(/[^a-z0-9]/g, "");

      if (firstWord.length >= 3 && !GENERIC_NON_MERCHANT_WORDS.has(firstWord)) {
        domain = `${firstWord}.com`;
      }
    }

    if (!domain) return [];

    // General Brand Logo API sequence (separate from Bank logo APIs)
    return [
      `https://logo.clearbit.com/${domain}`,
      `https://unavatar.io/${domain}`,
      `https://api.faviconkit.com/${domain}/128`,
      `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
      `https://icons.duckduckgo.com/ip3/${domain}.ico`,
    ];
  }, [cleanQuery]);

  const [srcIndex, setSrcIndex] = useState(0);

  const [prevQuery, setPrevQuery] = useState(cleanQuery);
  if (prevQuery !== cleanQuery) {
    setPrevQuery(cleanQuery);
    setSrcIndex(0);
  }

  const currentSrc = sources[srcIndex];

  if (!currentSrc || srcIndex >= sources.length) {
    const cleanLower = (cleanQuery || "").toLowerCase();
    let categoryIcon: string | null = null;
    for (const [key, icon] of Object.entries(GENERIC_CATEGORY_ICONS)) {
      if (cleanLower.includes(key)) {
        categoryIcon = icon;
        break;
      }
    }

    if (categoryIcon) {
      return (
        <div
          style={style}
          className={`${className} flex items-center justify-center rounded-xl bg-white/10 border border-white/10 text-lg shrink-0 shadow-sm select-none`}
        >
          {categoryIcon}
        </div>
      );
    }

    const letter = (cleanQuery || "B").charAt(0).toUpperCase();
    return (
      <div
        style={style}
        className={`${className} flex items-center justify-center rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 border border-slate-700/60 text-sky-400 font-bold text-xs shrink-0 shadow-sm select-none`}
      >
        {letter}
      </div>
    );
  }

  return (
    <div style={style} className={`${className} flex items-center justify-center shrink-0 rounded-xl bg-white/90 p-1 shadow-sm border border-white/20 overflow-hidden`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={currentSrc}
        src={currentSrc}
        alt={cleanQuery || "Logo"}
        className="w-full h-full object-contain"
        loading="lazy"
        onError={() => setSrcIndex((prev) => prev + 1)}
      />
    </div>
  );
});
BrandLogo.displayName = "BrandLogo";


