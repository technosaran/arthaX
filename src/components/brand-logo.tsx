"use client";

import { useMemo, useState, memo } from "react";
import { getBankLogoSources } from "@/lib/banks";

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
  slice: "sliceit.com",
  onecard: "getonecard.app",
};

export const BrandLogo = memo(({ name, symbol, className = "w-8 h-8", style }: { name?: string | null; symbol?: string | null; className?: string; style?: React.CSSProperties }) => {
  const query = (symbol || name || "").trim();

  const sources = useMemo(() => {
    if (!query) return [];
    const clean = query.toLowerCase().trim();
    const list: string[] = [];

    const firstWord = clean
      .replace(/^(dividend|salary|expense|purchase|paid to|payment to|ref):\s*/i, "")
      .replace(/\b(ltd|limited|corp|inc|co|serv|services|fund|direct|regular|plan|growth|option|mutual)\b/gi, "")
      .replace(/\([^)]*\)/g, "")
      .trim()
      .split(/\s+/)[0]
      .replace(/[^a-z0-9]/g, "");

    // 1. Try local company SVG first
    if (firstWord.length >= 2) {
      list.push(`/logos/companies/${firstWord}.svg`);
    }

    // 2. Try bank logo sources (local SVGs/PNGs + bank domains)
    const bankSources = getBankLogoSources(query);
    list.push(...bankSources);

    // 3. Check known domain mapping
    for (const [key, dom] of Object.entries(KNOWN_DOMAINS)) {
      if (clean.includes(key)) {
        list.push(`https://www.google.com/s2/favicons?domain=${dom}&sz=128`);
        list.push(`https://logo.clearbit.com/${dom}`);
        break;
      }
    }

    // 4. Try clean word domain fallback
    if (firstWord.length >= 3) {
      list.push(`https://www.google.com/s2/favicons?domain=${firstWord}.com&sz=128`);
    }

    return Array.from(new Set(list));
  }, [query]);

  const [srcIndex, setSrcIndex] = useState(0);

  const [prevQuery, setPrevQuery] = useState(query);
  if (prevQuery !== query) {
    setPrevQuery(query);
    setSrcIndex(0);
  }

  if (!sources.length || srcIndex >= sources.length) {
    const letter = (query || "B").charAt(0).toUpperCase();
    return (
      <div
        style={style}
        className={`${className} flex items-center justify-center rounded-lg bg-slate-800/80 border border-slate-700/60 text-sky-400 font-bold text-xs shrink-0 shadow-sm select-none`}
      >
        {letter}
      </div>
    );
  }

  const currentSrc = sources[srcIndex];

  return (
    <div style={style} className={`${className} flex items-center justify-center shrink-0`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={currentSrc}
        src={currentSrc}
        alt={query || "Logo"}
        className="w-full h-full object-contain filter drop-shadow-sm"
        loading="lazy"
        onError={() => setSrcIndex((prev) => prev + 1)}
      />
    </div>
  );
});
BrandLogo.displayName = "BrandLogo";
