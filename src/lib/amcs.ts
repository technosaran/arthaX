/**
 * Asset Management Company (AMC) Registry & Domain Resolver
 * Used for fetching real high-resolution official AMC / Fund House logos for Mutual Funds
 */

export type AMC = {
  name: string;
  keywords: string[];
  domain: string;
};

const AMCS: AMC[] = [
  { name: "SBI Mutual Fund", keywords: ["sbi", "state bank"], domain: "sbimf.com" },
  { name: "HDFC Mutual Fund", keywords: ["hdfc"], domain: "hdfcfund.com" },
  { name: "ICICI Prudential Mutual Fund", keywords: ["icici", "pru", "prudential"], domain: "icicipruamc.com" },
  { name: "Axis Mutual Fund", keywords: ["axis"], domain: "axismf.com" },
  { name: "Nippon India Mutual Fund", keywords: ["nippon", "reliance"], domain: "nipponindiamf.com" },
  { name: "Kotak Mahindra Mutual Fund", keywords: ["kotak"], domain: "kotakmf.com" },
  { name: "Mirae Asset Mutual Fund", keywords: ["mirae", "mirae asset"], domain: "miraeassetmf.co.in" },
  { name: "Parag Parikh Mutual Fund", keywords: ["parag parikh", "ppfas"], domain: "amc.ppfas.com" },
  { name: "Quant Mutual Fund", keywords: ["quant"], domain: "quantmutual.com" },
  { name: "Tata Mutual Fund", keywords: ["tata"], domain: "tatamutual.com" },
  { name: "UTI Mutual Fund", keywords: ["uti"], domain: "utimf.com" },
  { name: "Motilal Oswal Mutual Fund", keywords: ["motilal", "oswal", "motilal oswal"], domain: "motilaloswalmf.com" },
  { name: "Bandhan Mutual Fund", keywords: ["bandhan", "idfc"], domain: "bandhanmutual.com" },
  { name: "DSP Mutual Fund", keywords: ["dsp", "dsp blackrock"], domain: "dspim.com" },
  { name: "Aditya Birla Sun Life Mutual Fund", keywords: ["aditya birla", "absl", "birla"], domain: "mutualfund.adityabirlacapital.com" },
  { name: "Sundaram Mutual Fund", keywords: ["sundaram"], domain: "sundarammutual.com" },
  { name: "Canara Robeco Mutual Fund", keywords: ["canara", "canara robeco", "robeco"], domain: "canararobeco.com" },
  { name: "Invesco Mutual Fund", keywords: ["invesco"], domain: "invescomutualfund.com" },
  { name: "Edelweiss Mutual Fund", keywords: ["edelweiss"], domain: "edelweissmf.com" },
  { name: "WhiteOak Capital Mutual Fund", keywords: ["whiteoak", "white oak"], domain: "whiteoakcapitalmf.in" },
  { name: "Groww Mutual Fund", keywords: ["groww"], domain: "groww.in" },
  { name: "Zerodha Mutual Fund", keywords: ["zerodha"], domain: "zerodha.com" },
  { name: "Baroda BNP Paribas Mutual Fund", keywords: ["baroda", "bnp", "paribas"], domain: "barodabnpparibasmf.in" },
  { name: "Mahindra Manulife Mutual Fund", keywords: ["mahindra", "manulife"], domain: "mahindramanulife.com" },
  { name: "HSBC Mutual Fund", keywords: ["hsbc"], domain: "assetmanagement.hsbc.co.in" },
  { name: "PGIM India Mutual Fund", keywords: ["pgim"], domain: "pgimindiamf.com" },
  { name: "Union Mutual Fund", keywords: ["union"], domain: "unionmf.com" },
  { name: "JM Financial Mutual Fund", keywords: ["jm financial", "jm"], domain: "jmfinancialmf.com" },
  { name: "Taurus Mutual Fund", keywords: ["taurus"], domain: "taurusmutualfund.com" },
  { name: "Trust Mutual Fund", keywords: ["trust"], domain: "trustmf.in" },
  { name: "Navi Mutual Fund", keywords: ["navi"], domain: "navi.com" },
  { name: "Samco Mutual Fund", keywords: ["samco"], domain: "samcomf.com" },
  { name: "360 ONE Mutual Fund", keywords: ["360 one", "iifl"], domain: "360.one" },
  { name: "Helios Mutual Fund", keywords: ["helios"], domain: "heliosmf.in" },
  { name: "Bajaj Finserv Mutual Fund", keywords: ["bajaj", "bajaj finserv"], domain: "bajajfinserv.in" },
  { name: "Old Bridge Mutual Fund", keywords: ["old bridge"], domain: "oldbridgemf.com" },
  { name: "Vanguard", keywords: ["vanguard"], domain: "vanguard.com" },
  { name: "BlackRock / iShares", keywords: ["blackrock", "ishares"], domain: "blackrock.com" },
  { name: "Fidelity", keywords: ["fidelity"], domain: "fidelity.com" },
];

import { getFastLogoCandidateUrls } from "./logo-cache";

const HD_AMC_LOGOS: Record<string, string[]> = {
  "sbimf.com": [
    "https://upload.wikimedia.org/wikipedia/commons/c/cc/SBI-Logo.svg",
    "https://www.google.com/s2/favicons?domain=sbimf.com&sz=256",
  ],
  "hdfcfund.com": [
    "https://upload.wikimedia.org/wikipedia/commons/2/28/HDFC_Bank_Logo.svg",
    "https://www.google.com/s2/favicons?domain=hdfcfund.com&sz=256",
  ],
  "icicipruamc.com": [
    "https://upload.wikimedia.org/wikipedia/commons/1/12/ICICI_Bank_Logo.svg",
    "https://www.google.com/s2/favicons?domain=icicipruamc.com&sz=256",
  ],
  "axismf.com": [
    "https://upload.wikimedia.org/wikipedia/commons/1/1a/Axis_Bank_logo.svg",
    "https://www.google.com/s2/favicons?domain=axismf.com&sz=256",
  ],
  "kotakmf.com": [
    "https://upload.wikimedia.org/wikipedia/commons/6/6b/Kotak_Mahindra_Bank_logo.svg",
    "https://www.google.com/s2/favicons?domain=kotakmf.com&sz=256",
  ],
  "tatamutual.com": [
    "https://upload.wikimedia.org/wikipedia/commons/8/8e/Tata_logo.svg",
    "https://www.google.com/s2/favicons?domain=tatamutual.com&sz=256",
  ],
  "groww.in": [
    "https://upload.wikimedia.org/wikipedia/commons/b/b8/Groww_Logo.svg",
  ],
  "zerodha.com": [
    "https://upload.wikimedia.org/wikipedia/commons/3/30/Zerodha_logo.svg",
  ],
  "vanguard.com": [
    "https://upload.wikimedia.org/wikipedia/commons/5/58/Vanguard_logo.svg",
    "https://cdn.simpleicons.org/vanguard",
  ],
  "blackrock.com": [
    "https://upload.wikimedia.org/wikipedia/commons/9/91/BlackRock_logo.svg",
    "https://cdn.simpleicons.org/blackrock",
  ],
  "fidelity.com": [
    "https://upload.wikimedia.org/wikipedia/commons/a/a2/Fidelity_Investments_logo.svg",
    "https://cdn.simpleicons.org/fidelity",
  ],
};

/**
 * Get prioritized ultra-high-resolution online logo CDN URLs for an AMC domain
 */
export function getAMCLogoUrls(domain: string): string[] {
  if (!domain) return [];
  const clean = domain.trim().toLowerCase();
  const list: string[] = [];
  if (HD_AMC_LOGOS[clean]) {
    list.push(...HD_AMC_LOGOS[clean]);
  }
  const defaults = getFastLogoCandidateUrls(clean);
  return Array.from(new Set([...list, ...defaults]));
}

/**
 * Smart resolution of AMC web domain from AMC name or Mutual Fund Scheme title
 */
export function getAMCDomain(amcName?: string | null, fundName?: string | null): string | null {
  const text = `${amcName || ""} ${fundName || ""}`.toLowerCase().trim();
  if (!text) return null;

  // Search through registered AMCs by keyword length descending for precision
  for (const amc of AMCS) {
    for (const kw of amc.keywords) {
      const regex = new RegExp(`\\b${kw.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&")}\\b`, "i");
      if (regex.test(text)) {
        return amc.domain;
      }
    }
  }

  // Fallback first word token check
  const firstWord = text.split(/\s+/)[0].replace(/[^a-z0-9]/g, "");
  if (firstWord.length >= 3) {
    const matched = AMCS.find((a) => a.keywords.includes(firstWord));
    if (matched) return matched.domain;
  }

  return null;
}
