"use client";

import { useMemo, useState, memo } from "react";
import { getBankLogoSources } from "@/lib/banks";

const DIRECT_MERCHANT_LOGOS: Record<string, string[]> = {
  amazon: [
    "https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg",
    "https://logo.clearbit.com/amazon.com",
    "https://www.google.com/s2/favicons?domain=amazon.com&sz=128",
  ],
  kfc: [
    "https://upload.wikimedia.org/wikipedia/commons/b/bf/KFC_logo.svg",
    "https://logo.clearbit.com/kfc.com",
    "https://www.google.com/s2/favicons?domain=kfc.com&sz=128",
  ],
  otto: [
    "https://upload.wikimedia.org/wikipedia/commons/f/fe/Otto-group-logo.svg",
    "https://logo.clearbit.com/otto.de",
    "https://www.google.com/s2/favicons?domain=otto.de&sz=128",
  ],
  raymond: [
    "https://logo.clearbit.com/raymond.in",
    "https://www.google.com/s2/favicons?domain=raymond.in&sz=128",
  ],
  swiggy: [
    "https://upload.wikimedia.org/wikipedia/commons/1/13/Swiggy_logo.svg",
    "https://logo.clearbit.com/swiggy.in",
  ],
  zomato: [
    "https://upload.wikimedia.org/wikipedia/commons/7/75/Zomato_logo.png",
    "https://logo.clearbit.com/zomato.com",
  ],
  flipkart: [
    "https://upload.wikimedia.org/wikipedia/commons/7/7a/Flipkart_logo.svg",
    "https://logo.clearbit.com/flipkart.com",
  ],
  myntra: [
    "https://logo.clearbit.com/myntra.com",
  ],
  uber: [
    "https://upload.wikimedia.org/wikipedia/commons/c/cc/Uber_logo_2018.svg",
    "https://logo.clearbit.com/uber.com",
  ],
  spotify: [
    "https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg",
    "https://logo.clearbit.com/spotify.com",
  ],
  netflix: [
    "https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_N_logo.svg",
    "https://logo.clearbit.com/netflix.com",
  ],
  google: [
    "https://upload.wikimedia.org/wikipedia/commons/2/2f/Google_2015_logo.svg",
    "https://logo.clearbit.com/google.com",
  ],
  apple: [
    "https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg",
    "https://logo.clearbit.com/apple.com",
  ],
  samsung: [
    "https://upload.wikimedia.org/wikipedia/commons/2/24/Samsung_Logo.svg",
    "https://logo.clearbit.com/samsung.com",
  ],
};

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

  const logoUrl = useMemo(() => {
    if (!cleanQuery) return null;
    const clean = cleanQuery.toLowerCase().trim();

    const firstWord = clean
      .replace(/^(dividend|salary|expense|purchase|paid to|payment to|ref):\s*/i, "")
      .replace(/\b(ltd|limited|corp|inc|co|serv|services|fund|direct|regular|plan|growth|option|mutual)\b/gi, "")
      .replace(/\([^)]*\)/g, "")
      .trim()
      .split(/\s+/)[0]
      .replace(/[^a-z0-9]/g, "");

    // 1. Direct merchant logo
    if (DIRECT_MERCHANT_LOGOS[firstWord]) {
      return DIRECT_MERCHANT_LOGOS[firstWord][0];
    }

    // 2. Known domain mapping -> Clearbit Logo API
    for (const [key, dom] of Object.entries(KNOWN_DOMAINS)) {
      if (clean.includes(key)) {
        return `https://logo.clearbit.com/${dom}`;
      }
    }

    // 3. Bank logo -> Clearbit Logo API or Wikimedia
    const bankSources = getBankLogoSources(cleanQuery);
    if (bankSources.length > 0) {
      return bankSources[0];
    }

    // 4. Domain fallback for clean merchant words -> Clearbit Logo API
    if (firstWord.length >= 3 && !GENERIC_NON_MERCHANT_WORDS.has(firstWord)) {
      return `https://logo.clearbit.com/${firstWord}.com`;
    }

    return null;
  }, [cleanQuery]);

  const [hasError, setHasError] = useState(false);

  const [prevQuery, setPrevQuery] = useState(cleanQuery);
  if (prevQuery !== cleanQuery) {
    setPrevQuery(cleanQuery);
    setHasError(false);
  }

  if (!logoUrl || hasError) {
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
        key={logoUrl}
        src={logoUrl}
        alt={cleanQuery || "Logo"}
        className="w-full h-full object-contain"
        loading="lazy"
        onError={() => setHasError(true)}
      />
    </div>
  );
});
BrandLogo.displayName = "BrandLogo";

