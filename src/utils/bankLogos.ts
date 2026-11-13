/**
 * Ultra High-Resolution Bank Logo Resolver & URL Builder
 * Supports Vector SVG (Unavatar) + High-Definition Retina PNG (Logo.dev)
 */

const COMMON_BANKS: Record<string, string> = {
  // Indian Public & Private Banks
  hdfc: "hdfcbank.com",
  sbi: "sbi.co.in",
  "state bank of india": "sbi.co.in",
  "state bank": "sbi.co.in",
  icici: "icicibank.com",
  axis: "axisbank.com",
  kotak: "kotak.com",
  "kotak mahindra": "kotak.com",
  "bank of baroda": "bankofbaroda.in",
  bob: "bankofbaroda.in",
  "punjab national bank": "pnbindia.in",
  "punjab national": "pnbindia.in",
  pnb: "pnbindia.in",
  canara: "canarabank.com",
  "canara bank": "canarabank.com",
  "union bank of india": "unionbankofindia.co.in",
  "union bank": "unionbankofindia.co.in",
  union: "unionbankofindia.co.in",
  "bank of india": "bankofindia.co.in",
  boi: "bankofindia.co.in",
  "indian bank": "indianbank.in",
  "central bank of india": "centralbankofindia.co.in",
  "central bank": "centralbankofindia.co.in",
  idbi: "idbibank.in",
  "idbi bank": "idbibank.in",
  indusind: "indusind.com",
  "indusind bank": "indusind.com",
  "yes bank": "yesbank.in",
  yes: "yesbank.in",
  "idfc first": "idfcfirstbank.com",
  "idfc first bank": "idfcfirstbank.com",
  idfc: "idfcfirstbank.com",
  "federal bank": "federalbank.co.in",
  federal: "federalbank.co.in",
  "rbl bank": "rblbank.com",
  rbl: "rblbank.com",
  "bandhan bank": "bandhanbank.com",
  bandhan: "bandhanbank.com",
  "au small finance bank": "aubank.in",
  "au bank": "aubank.in",
  aubank: "aubank.in",
  "standard chartered": "sc.com",
  stanchart: "sc.com",
  dbs: "dbs.com",
  "dbs bank": "dbs.com",
  // Indian Fintech, Neobanks & Brokerages
  zerodha: "zerodha.com",
  kite: "zerodha.com",
  groww: "groww.in",
  paytm: "paytm.com",
  "paytm payments bank": "paytm.com",
  cred: "cred.club",
  jupiter: "jupiter.money",
  "jupiter money": "jupiter.money",
  "fi money": "fi.money",
  fi: "fi.money",
  upstox: "upstox.com",
  "angel one": "angelone.in",
  angelone: "angelone.in",
  "angel broking": "angelone.in",
  dhan: "dhan.co",
  kuvera: "kuvera.in",
  navi: "navi.com",
  // Global Banks & Payment Processors
  chase: "chase.com",
  jpmorgan: "chase.com",
  "jp morgan": "chase.com",
  citi: "citi.com",
  citibank: "citi.com",
  hsbc: "hsbc.com",
  barclays: "barclays.com",
  "wells fargo": "wellsfargo.com",
  wells: "wellsfargo.com",
  "bank of america": "bankofamerica.com",
  bofa: "bankofamerica.com",
  revolut: "revolut.com",
  monzo: "monzo.com",
  stripe: "stripe.com",
  paypal: "paypal.com",
  "american express": "americanexpress.com",
  amex: "americanexpress.com",
  "capital one": "capitalone.com",
  capitalone: "capitalone.com",
  schwab: "schwab.com",
  "charles schwab": "schwab.com",
  fidelity: "fidelity.com",
  vanguard: "vanguard.com",
  wise: "wise.com",
  transferwise: "wise.com",
  apple: "apple.com",
  "cash app": "cash.app",
  robinhood: "robinhood.com",
  coinbase: "coinbase.com",
};

// Sort entries by key length descending so longer matching phrases take precedence
const SORTED_BANKS = Object.entries(COMMON_BANKS).sort(
  (a, b) => b[0].length - a[0].length
);

export function getBankDomain(inputName: string): string | null {
  if (!inputName || !inputName.trim()) return null;
  const clean = inputName.trim().toLowerCase();

  // Exclude physical cash or generic terms
  if (clean.includes("cash") || clean === "vault") return null;
  const genericTerms = ["bank", "account", "card", "savings", "current", "checking", "deposit", "holding"];
  if (genericTerms.includes(clean)) return null;

  // If input is already a domain (e.g., hdfcbank.com)
  if (clean.includes(".") && !clean.includes(" ")) {
    return clean.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  }

  // Look for match in known bank dictionary (longest match first)
  for (const [key, domain] of SORTED_BANKS) {
    if (key.length <= 3) {
      // For short acronyms (bob, boi, pnb, sbi, rbl), require word boundaries
      const regex = new RegExp(`(^|\\s|[^a-z0-9])${key}($|\\s|[^a-z0-9])`, "i");
      if (clean === key || regex.test(clean)) {
        return domain;
      }
    } else {
      if (clean.includes(key)) {
        return domain;
      }
    }
  }

  // Fallback: guess domain based on name if length is reasonable
  const stripped = clean.replace(/[^a-z0-9]/g, "");
  if (stripped.length >= 3 && !genericTerms.includes(stripped)) {
    return `${stripped}.com`;
  }

  return null;
}

/**
 * Tier 1: Vector SVG Provider (Infinite resolution, razor-sharp on all screens)
 */
export function getVectorLogoUrl(domain: string): string {
  return `https://unavatar.io/${encodeURIComponent(domain)}?fallback=false`;
}

/**
 * Tier 2: High-Definition Retina Lossless PNG (Logo.dev 600x600 px)
 */
export function getLogosDevUrl(domain: string, size?: number): string {
  const token =
    process.env.NEXT_PUBLIC_LOGOS_DEV_API_KEY ||
    "pk_bIuq9jRhRO-QRCdxlZWt4Q";
  const params = new URLSearchParams();
  if (token) params.set("token", token);
  // High-density scaling: minimum 300px with retina=true produces 600x600 px high-res PNG
  const reqSize = size ? Math.max(size * 3, 200) : 300;
  params.set("size", String(reqSize));
  params.set("format", "png");
  params.set("retina", "true");
  const query = params.toString() ? `?${params.toString()}` : "";
  return `https://img.logo.dev/${encodeURIComponent(domain)}${query}`;
}

/**
 * Tier 3 Fallback: Google Favicon Service
 */
export function getGoogleFaviconUrl(domain: string, size: number = 128): string {
  return `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${encodeURIComponent(domain)}&size=${size}`;
}
