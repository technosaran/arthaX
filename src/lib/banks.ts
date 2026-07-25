export type Bank = { name: string; domain: string };

// Bank registry mapping names to their official domains
// Used for logo resolution via multiple logo APIs
const BANKS: Bank[] = [
  // Major Public Sector Banks
  { name: "State Bank of India (SBI)",  domain: "sbi.co.in" },
  { name: "Punjab National Bank (PNB)", domain: "pnbindia.in" },
  { name: "Bank of Baroda (BOB)",       domain: "bankofbaroda.in" },
  { name: "Canara Bank",                domain: "canarabank.com" },
  { name: "Union Bank of India",        domain: "unionbankofindia.co.in" },
  { name: "Bank of India (BOI)",        domain: "bankofindia.co.in" },
  { name: "Indian Bank",                domain: "indianbank.in" },
  { name: "Central Bank of India",      domain: "centralbankofindia.co.in" },
  { name: "Indian Overseas Bank",       domain: "iob.in" },
  { name: "UCO Bank",                   domain: "ucobank.com" },
  { name: "Bank of Maharashtra",        domain: "bankofmaharashtra.in" },
  { name: "Punjab & Sind Bank",         domain: "punjabandsindbank.co.in" },

  // Major Private Sector Banks
  { name: "HDFC Bank",                  domain: "hdfcbank.com" },
  { name: "ICICI Bank",                 domain: "icicibank.com" },
  { name: "Axis Bank",                  domain: "axisbank.com" },
  { name: "Kotak Mahindra Bank",        domain: "kotak.com" },
  { name: "IndusInd Bank",              domain: "indusind.com" },
  { name: "Yes Bank",                   domain: "yesbank.in" },
  { name: "IDFC First Bank",            domain: "idfcfirstbank.com" },
  { name: "Federal Bank",               domain: "federalbank.co.in" },
  { name: "South Indian Bank",          domain: "southindianbank.com" },
  { name: "Karnataka Bank",             domain: "karnatakabank.com" },
  { name: "RBL Bank",                   domain: "rblbank.com" },
  { name: "Karur Vysya Bank",           domain: "kvb.co.in" },
  { name: "Bandhan Bank",               domain: "bandhanbank.com" },
  { name: "IDBI Bank",                  domain: "idbibank.in" },
  { name: "City Union Bank",            domain: "cityunionbank.com" },
  { name: "DCB Bank",                   domain: "dcbbank.com" },
  { name: "Tamilnad Mercantile Bank",   domain: "tmb.in" },
  { name: "J&K Bank",                   domain: "jkbank.com" },
  { name: "CSB Bank",                   domain: "csb.co.in" },
  { name: "Dhanlaxmi Bank",             domain: "dhanbank.com" },

  // International Banks (India Operations)
  { name: "HSBC India",                 domain: "hsbc.co.in" },
  { name: "Standard Chartered",         domain: "sc.com" },
  { name: "Citibank India",             domain: "citibank.co.in" },
  { name: "DBS Bank India",             domain: "dbs.com" },
  { name: "Deutsche Bank India",        domain: "db.com" },
  { name: "Barclays India",             domain: "barclays.com" },
  { name: "J.P. Morgan India",          domain: "jpmorgan.com" },

  // Small Finance & Payments Banks
  { name: "AU Small Finance Bank",      domain: "aubank.in" },
  { name: "Equitas Small Finance Bank", domain: "equitasbank.com" },
  { name: "Ujjivan Small Finance Bank", domain: "ujjivansfb.in" },
  { name: "ESAF Small Finance Bank",    domain: "esafbank.com" },
  { name: "Suryoday Small Finance Bank",domain: "suryodaybank.com" },
  { name: "Jana Small Finance Bank",    domain: "janabank.com" },
  { name: "Utkarsh Small Finance Bank", domain: "utkarshbank.in" },
  { name: "Capital Small Finance Bank", domain: "capitalbank.co.in" },
  { name: "Paytm Payments Bank",        domain: "paytm.com" },
  { name: "Airtel Payments Bank",       domain: "airtel.in" },
  { name: "Jio Payments Bank",          domain: "jio.com" },
  { name: "India Post Payments Bank",   domain: "ippbonline.com" },
  { name: "Fino Payments Bank",         domain: "finobank.com" },
  { name: "NSDL Payments Bank",         domain: "nsdlbank.com" },

  // Neo-Banks & Fintech
  { name: "Jupiter",                    domain: "jupiter.money" },
  { name: "Fi Money",                   domain: "fi.money" },
  { name: "Niyo",                       domain: "goniyo.com" },
  { name: "Slice",                      domain: "sliceit.com" },
  { name: "Uni Cards",                  domain: "uni.cards" },
  { name: "OneCard",                    domain: "getonecard.com" },
  { name: "FamPay",                     domain: "fampay.in" },
  { name: "Mobikwik",                   domain: "mobikwik.com" },
  { name: "PhonePe",                    domain: "phonepe.com" },
  { name: "Google Pay",                 domain: "pay.google.com" },
  { name: "Amazon Pay",                 domain: "amazon.in" },
  { name: "CRED",                       domain: "cred.club" },
  { name: "BharatPe",                   domain: "bharatpe.com" },
  { name: "Navi",                       domain: "navi.com" },

  // Investment Platforms
  { name: "Zerodha",                    domain: "zerodha.com" },
  { name: "Upstox",                     domain: "upstox.com" },
  { name: "Groww",                      domain: "groww.in" },
  { name: "Angel One",                  domain: "angelone.in" },
  { name: "Kuvera",                     domain: "kuvera.in" },
  { name: "Indmoney",                   domain: "indmoney.com" },
  { name: "ET Money",                   domain: "etmoney.com" },
  { name: "Smallcase",                  domain: "smallcase.com" },
  { name: "Wealthy",                    domain: "wealthy.in" },
  { name: "Paytm Money",               domain: "paytmmoney.com" },
  { name: "Coin by Zerodha",            domain: "zerodha.com" },
  
  // Custom / International / Financial Platforms
  { name: "Chase Bank",                 domain: "chase.com" },
  { name: "Bank of America",            domain: "bankofamerica.com" },
  { name: "Wells Fargo",                domain: "wellsfargo.com" },
  { name: "Capital One",                domain: "capitalone.com" },
  { name: "Morgan Stanley",             domain: "morganstanley.com" },
  { name: "Revolut",                    domain: "revolut.com" },
  { name: "Wise",                       domain: "wise.com" },
  { name: "PayPal",                     domain: "paypal.com" },
  { name: "Robinhood",                  domain: "robinhood.com" },
  { name: "Coinbase",                   domain: "coinbase.com" },
  { name: "Binance",                    domain: "binance.com" },
  { name: "SBI",                        domain: "sbi.co.in" },
  { name: "HDFC",                       domain: "hdfcbank.com" },
  { name: "ICICI",                      domain: "icicibank.com" },
];

const SHORTHAND_DOMAINS: Record<string, string> = {
  sbi: "sbi.co.in",
  hdfc: "hdfcbank.com",
  icici: "icicibank.com",
  axis: "axisbank.com",
  kotak: "kotak.com",
  pnb: "pnbindia.in",
  bob: "bankofbaroda.in",
  canara: "canarabank.com",
  union: "unionbankofindia.co.in",
  boi: "bankofindia.co.in",
  indianbank: "indianbank.in",
  idfc: "idfcfirstbank.com",
  indusind: "indusind.com",
  yes: "yesbank.in",
  federal: "federalbank.co.in",
  rbl: "rblbank.com",
  chase: "chase.com",
  bofa: "bankofamerica.com",
  wellsfargo: "wellsfargo.com",
  capitalone: "capitalone.com",
  revolut: "revolut.com",
  wise: "wise.com",
  paypal: "paypal.com",
  paytm: "paytm.com",
  phonepe: "phonepe.com",
  gpay: "pay.google.com",
  cred: "cred.club",
  zerodha: "zerodha.com",
  coin: "zerodha.com",
  "coin by zerodha": "zerodha.com",
  ippb: "ippbonline.com",
  "india post": "ippbonline.com",
  "india post payments bank": "ippbonline.com",
  groww: "groww.in",
  upstox: "upstox.com",
  angelone: "angelone.in",
  binance: "binance.com",
  coinbase: "coinbase.com",
};

import { getFastLogoCandidateUrls } from "./logo-cache";

const HD_BANK_LOGOS: Record<string, string[]> = {
  "ippbonline.com": [
    "https://upload.wikimedia.org/wikipedia/commons/e/e0/India_Post_Payments_Bank_logo.svg",
    "https://logo.clearbit.com/ippbonline.com?size=512",
  ],
  "sbi.co.in": [
    "https://upload.wikimedia.org/wikipedia/commons/c/cc/State_Bank_of_India_logo.svg",
    "https://logo.clearbit.com/sbi.co.in?size=512",
  ],
  "hdfcbank.com": [
    "https://upload.wikimedia.org/wikipedia/commons/2/28/HDFC_Bank_Logo.svg",
    "https://logo.clearbit.com/hdfcbank.com?size=512",
  ],
  "icicibank.com": [
    "https://upload.wikimedia.org/wikipedia/commons/1/12/ICICI_Bank_Logo.svg",
    "https://logo.clearbit.com/icicibank.com?size=512",
  ],
  "axisbank.com": [
    "https://upload.wikimedia.org/wikipedia/commons/1/1a/Axis_Bank_logo.svg",
    "https://logo.clearbit.com/axisbank.com?size=512",
  ],
  "kotak.com": [
    "https://upload.wikimedia.org/wikipedia/commons/6/6b/Kotak_Mahindra_Bank_logo.svg",
    "https://logo.clearbit.com/kotak.com?size=512",
  ],
  "pnbindia.in": [
    "https://upload.wikimedia.org/wikipedia/commons/4/4b/Punjab_National_Bank_Logo.svg",
    "https://logo.clearbit.com/pnbindia.in?size=512",
  ],
  "bankofbaroda.in": [
    "https://upload.wikimedia.org/wikipedia/commons/7/7b/Bank_of_Baroda_logo.svg",
    "https://logo.clearbit.com/bankofbaroda.in?size=512",
  ],
  "canarabank.com": [
    "https://upload.wikimedia.org/wikipedia/commons/2/2a/Canara_Bank_Logo.svg",
    "https://logo.clearbit.com/canarabank.com?size=512",
  ],
  "unionbankofindia.co.in": [
    "https://upload.wikimedia.org/wikipedia/commons/0/05/Union_Bank_of_India_Logo.svg",
    "https://logo.clearbit.com/unionbankofindia.co.in?size=512",
  ],
  "idfcfirstbank.com": [
    "https://upload.wikimedia.org/wikipedia/commons/2/29/IDFC_First_Bank_logo.svg",
    "https://logo.clearbit.com/idfcfirstbank.com?size=512",
  ],
  "indusind.com": [
    "https://upload.wikimedia.org/wikipedia/commons/8/82/IndusInd_Bank_logo.svg",
    "https://logo.clearbit.com/indusind.com?size=512",
  ],
  "yesbank.in": [
    "https://upload.wikimedia.org/wikipedia/commons/4/49/Yes_Bank_Logo.svg",
    "https://logo.clearbit.com/yesbank.in?size=512",
  ],
  "federalbank.co.in": [
    "https://upload.wikimedia.org/wikipedia/commons/2/27/Federal_Bank_Logo.svg",
    "https://logo.clearbit.com/federalbank.co.in?size=512",
  ],
  "paytmbank.com": [
    "https://upload.wikimedia.org/wikipedia/commons/2/24/Paytm_Logo.svg",
    "https://logo.clearbit.com/paytm.com?size=512",
  ],
  "phonepe.com": [
    "https://upload.wikimedia.org/wikipedia/commons/7/71/PhonePe_Logo.svg",
    "https://logo.clearbit.com/phonepe.com?size=512",
  ],
  "cred.club": [
    "https://upload.wikimedia.org/wikipedia/commons/8/87/CRED_logo.svg",
    "https://logo.clearbit.com/cred.club?size=512",
  ],
  "zerodha.com": [
    "https://logo.clearbit.com/zerodha.com?size=512",
    "https://cdn.brandfetch.io/zerodha.com/w/512/h/512/theme/dark/icon",
  ],
  "groww.in": [
    "https://logo.clearbit.com/groww.in?size=512",
    "https://cdn.brandfetch.io/groww.in/w/512/h/512/theme/dark/icon",
  ],
  "chase.com": [
    "https://upload.wikimedia.org/wikipedia/commons/7/7b/Chase_logo_2007.svg",
    "https://logo.clearbit.com/chase.com?size=512",
  ],
  "bankofamerica.com": [
    "https://upload.wikimedia.org/wikipedia/commons/2/20/Bank_of_America_logo.svg",
    "https://logo.clearbit.com/bankofamerica.com?size=512",
  ],
};

/**
 * Get prioritized ultra-high-resolution online logo CDN URLs for a bank domain
 */
export function getBankLogoUrls(domain: string): string[] {
  if (!domain) return [];
  const clean = domain.trim().toLowerCase();
  const list: string[] = [];
  if (HD_BANK_LOGOS[clean]) {
    list.push(...HD_BANK_LOGOS[clean]);
  }
  const defaults = getFastLogoCandidateUrls(clean);
  return Array.from(new Set([...list, ...defaults]));
}

/**
 * Get the domain registered for a bank name or account title
 */
export function getBankDomain(bankName: string): string | null {
  if (!bankName) return null;
  const raw = bankName.trim();

  // 0. Direct match if input already contains a domain (e.g. "sbi.co.in", "hdfcbank.com", "chase.com")
  const domainRegex = /\b([a-z0-9\-]+\.(?:co\.in|com|in|co|io|ai|org|net|tech|app|dev|club|money))\b/i;
  const directMatch = raw.match(domainRegex);
  if (directMatch) {
    return directMatch[1].toLowerCase();
  }

  const normalizedSearch = raw.toLowerCase();

  // 0B. Direct shorthand override
  if (SHORTHAND_DOMAINS[normalizedSearch]) {
    return SHORTHAND_DOMAINS[normalizedSearch];
  }

  // 1. Exact match
  let bank = BANKS.find((b) => b.name.toLowerCase() === normalizedSearch);
  
  // 2. Acronym match (e.g., matching "SBI" in "State Bank of India (SBI)")
  if (!bank) {
    bank = BANKS.find((b) => {
      const match = b.name.match(/\(([^)]+)\)/);
      return match && match[1].toLowerCase() === normalizedSearch;
    });
  }

  // 3. Match if the search query is contained within the bank name or vice-versa
  if (!bank) {
    bank = BANKS.find((b) => {
      const name = b.name.toLowerCase();
      return name.includes(normalizedSearch) || normalizedSearch.includes(name);
    });
  }

  // 4. Token-based word match (e.g. "My SBI Salary" -> matches "sbi" in SHORTHAND_DOMAINS or BANKS)
  if (!bank) {
    const tokens = normalizedSearch.split(/[\s\-_\/]+/);
    for (const token of tokens) {
      if (SHORTHAND_DOMAINS[token]) {
        return SHORTHAND_DOMAINS[token];
      }
      const matched = BANKS.find((b) => {
        const bName = b.name.toLowerCase();
        return bName === token || bName.split(" ")[0].toLowerCase() === token;
      });
      if (matched) return matched.domain;
    }
  }

  if (bank) return bank.domain;

  // 5. Fallback candidate (e.g. "Axis Savings" -> "axisbank.com" or "axis.com")
  const cleanWord = normalizedSearch.replace(/\b(bank|checking|savings|account|wallet|card|primary|personal|business)\b/g, "").trim().split(/\s+/)[0].replace(/[^a-z0-9]/g, "");
  if (cleanWord.length >= 3) {
    if (SHORTHAND_DOMAINS[cleanWord]) return SHORTHAND_DOMAINS[cleanWord];
    return `${cleanWord}.com`;
  }

  return null;
}

export function searchBanks(query: string): Bank[] {
  if (!query.trim()) return BANKS.slice(0, 15); // Show popular banks by default
  const q = query.toLowerCase();
  
  // Sort by priority and match quality
  return BANKS.filter((b) => {
    const name = b.name.toLowerCase();
    return name.includes(q) || q.includes(name.split(' ')[0]);
  })
  .sort((a, b) => {
    const aName = a.name.toLowerCase();
    const bName = b.name.toLowerCase();
    if (aName.startsWith(q) && !bName.startsWith(q)) return -1;
    if (!aName.startsWith(q) && bName.startsWith(q)) return 1;
    return 0;
  })
  .slice(0, 12);
}

