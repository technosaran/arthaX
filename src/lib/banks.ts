export type Bank = { name: string; domain: string; isBank?: boolean };

// Bank registry mapping names to their official domains
const BANKS: Bank[] = [
  // Major Public Sector Banks
  { name: "State Bank of India (SBI)",  domain: "sbi.co.in", isBank: true },
  { name: "Punjab National Bank (PNB)", domain: "pnbindia.in", isBank: true },
  { name: "Bank of Baroda (BOB)",       domain: "bankofbaroda.in", isBank: true },
  { name: "Canara Bank",                domain: "canarabank.com", isBank: true },
  { name: "Union Bank of India",        domain: "unionbankofindia.co.in", isBank: true },
  { name: "Bank of India (BOI)",        domain: "bankofindia.co.in", isBank: true },
  { name: "Indian Bank",                domain: "indianbank.in", isBank: true },
  { name: "Central Bank of India",      domain: "centralbankofindia.co.in", isBank: true },
  { name: "Indian Overseas Bank",       domain: "iob.in", isBank: true },
  { name: "UCO Bank",                   domain: "ucobank.com", isBank: true },
  { name: "Bank of Maharashtra",        domain: "bankofmaharashtra.in", isBank: true },
  { name: "Punjab & Sind Bank",         domain: "punjabandsindbank.co.in", isBank: true },

  // Major Private Sector Banks
  { name: "HDFC Bank",                  domain: "hdfcbank.com", isBank: true },
  { name: "ICICI Bank",                 domain: "icicibank.com", isBank: true },
  { name: "Axis Bank",                  domain: "axisbank.com", isBank: true },
  { name: "Kotak Mahindra Bank",        domain: "kotak.com", isBank: true },
  { name: "IndusInd Bank",              domain: "indusind.com", isBank: true },
  { name: "Yes Bank",                   domain: "yesbank.in", isBank: true },
  { name: "IDFC First Bank",            domain: "idfcfirstbank.com", isBank: true },
  { name: "Federal Bank",               domain: "federalbank.co.in", isBank: true },
  { name: "South Indian Bank",          domain: "southindianbank.com", isBank: true },
  { name: "Karnataka Bank",             domain: "karnatakabank.com", isBank: true },
  { name: "RBL Bank",                   domain: "rblbank.com", isBank: true },
  { name: "Karur Vysya Bank",           domain: "kvb.co.in", isBank: true },
  { name: "Bandhan Bank",               domain: "bandhanbank.com", isBank: true },
  { name: "IDBI Bank",                  domain: "idbibank.in", isBank: true },
  { name: "City Union Bank",            domain: "cityunionbank.com", isBank: true },
  { name: "DCB Bank",                   domain: "dcbbank.com", isBank: true },
  { name: "Tamilnad Mercantile Bank",   domain: "tmb.in", isBank: true },
  { name: "J&K Bank",                   domain: "jkbank.com", isBank: true },
  { name: "CSB Bank",                   domain: "csb.co.in", isBank: true },
  { name: "Dhanlaxmi Bank",             domain: "dhanbank.com", isBank: true },

  // International Banks (India Operations)
  { name: "HSBC India",                 domain: "hsbc.co.in", isBank: true },
  { name: "Standard Chartered",         domain: "sc.com", isBank: true },
  { name: "Citibank India",             domain: "citibank.co.in", isBank: true },
  { name: "DBS Bank India",             domain: "dbs.com", isBank: true },
  { name: "Deutsche Bank India",        domain: "db.com", isBank: true },
  { name: "Barclays India",             domain: "barclays.com", isBank: true },
  { name: "J.P. Morgan India",          domain: "jpmorgan.com", isBank: true },

  // Small Finance & Payments Banks
  { name: "AU Small Finance Bank",      domain: "aubank.in", isBank: true },
  { name: "Equitas Small Finance Bank", domain: "equitasbank.com", isBank: true },
  { name: "Ujjivan Small Finance Bank", domain: "ujjivansfb.in", isBank: true },
  { name: "ESAF Small Finance Bank",    domain: "esafbank.com", isBank: true },
  { name: "Suryoday Small Finance Bank",domain: "suryodaybank.com", isBank: true },
  { name: "Jana Small Finance Bank",    domain: "janabank.com", isBank: true },
  { name: "Utkarsh Small Finance Bank", domain: "utkarshbank.in", isBank: true },
  { name: "Capital Small Finance Bank", domain: "capitalbank.co.in", isBank: true },
  { name: "Paytm Payments Bank",        domain: "paytm.com", isBank: true },
  { name: "Airtel Payments Bank",       domain: "airtel.in", isBank: true },
  { name: "Jio Payments Bank",          domain: "jio.com", isBank: true },
  { name: "India Post Payments Bank",   domain: "ippbonline.com", isBank: true },
  { name: "Fino Payments Bank",         domain: "finobank.com", isBank: true },
  { name: "NSDL Payments Bank",         domain: "nsdlbank.com", isBank: true },

  // Neo-Banks & Fintech (Banking Services)
  { name: "Jupiter",                    domain: "jupiter.money", isBank: true },
  { name: "Fi Money",                   domain: "fi.money", isBank: true },
  { name: "Niyo",                       domain: "goniyo.com", isBank: true },
  { name: "Slice",                      domain: "sliceit.com", isBank: true },
  { name: "Uni Cards",                  domain: "uni.cards", isBank: false },
  { name: "OneCard",                    domain: "getonecard.com", isBank: false },
  { name: "FamPay",                     domain: "fampay.in", isBank: false },
  { name: "Mobikwik",                   domain: "mobikwik.com", isBank: false },
  { name: "PhonePe",                    domain: "phonepe.com", isBank: false },
  { name: "Google Pay",                 domain: "pay.google.com", isBank: false },
  { name: "Amazon Pay",                 domain: "amazon.in", isBank: false },
  { name: "CRED",                       domain: "cred.club", isBank: false },
  { name: "BharatPe",                   domain: "bharatpe.com", isBank: false },
  { name: "Navi",                       domain: "navi.com", isBank: false },

  // Investment Platforms (Non-Bank Brokers)
  { name: "Zerodha",                    domain: "zerodha.com", isBank: false },
  { name: "Upstox",                     domain: "upstox.com", isBank: false },
  { name: "Groww",                      domain: "groww.in", isBank: false },
  { name: "Angel One",                  domain: "angelone.in", isBank: false },
  { name: "Kuvera",                     domain: "kuvera.in", isBank: false },
  { name: "Indmoney",                   domain: "indmoney.com", isBank: false },
  { name: "ET Money",                   domain: "etmoney.com", isBank: false },
  { name: "Smallcase",                  domain: "smallcase.com", isBank: false },
  { name: "Wealthy",                    domain: "wealthy.in", isBank: false },
  { name: "Paytm Money",               domain: "paytmmoney.com", isBank: false },
  { name: "Coin by Zerodha",            domain: "zerodha.com", isBank: false },
  
  // Cooperative & Regional Urban Banks
  { name: "Saraswat Bank",              domain: "saraswatbank.com", isBank: true },
  { name: "Cosmos Bank",                domain: "cosmosbank.com", isBank: true },
  { name: "TJSB Sahakari Bank",         domain: "tjsb.co.in", isBank: true },
  { name: "SVC Cooperative Bank",       domain: "svcbank.com", isBank: true },
  { name: "Abhyudaya Bank",             domain: "abhyudayabank.co.in", isBank: true },
  { name: "NKGSB Bank",                 domain: "nkgsb.co.in", isBank: true },
  { name: "Kalupur Bank",               domain: "kalupurbank.com", isBank: true },
  { name: "Shamrao Vithal Bank",        domain: "svcbank.com", isBank: true },

  // Credit Cards & BNPL (Non-Bank)
  { name: "LazyPay",                    domain: "lazypay.in", isBank: false },
  { name: "Simpl",                      domain: "getsimpl.com", isBank: false },
  { name: "Cashfree Payments",          domain: "cashfree.com", isBank: false },
  { name: "Instamojo",                  domain: "instamojo.com", isBank: false },
  { name: "Pine Labs",                  domain: "pinelabs.com", isBank: false },
  { name: "PayU India",                 domain: "payu.in", isBank: false },

  // Additional Investment & Trading Platforms (Non-Bank)
  { name: "Dhan",                       domain: "dhan.co", isBank: false },
  { name: "5Paisa",                     domain: "5paisa.com", isBank: false },
  { name: "Motilal Oswal",              domain: "motilaloswal.com", isBank: false },
  { name: "Sharekhan",                  domain: "sharekhan.com", isBank: false },
  { name: "ICICI Direct",               domain: "icicidirect.com", isBank: false },
  { name: "HDFC Securities",            domain: "hdfcsec.com", isBank: false },
  { name: "Kotak Securities",           domain: "kotaksecurities.com", isBank: false },
  { name: "SBI Securities",             domain: "sbisecurities.in", isBank: false },
  { name: "Axis Direct",                domain: "axisdirect.in", isBank: false },
  { name: "IIFL Securities",            domain: "iifl.com", isBank: false },
  { name: "Geojit Financial Services",  domain: "geojit.com", isBank: false },
  { name: "Edelweiss Wealth",           domain: "edelweiss.in", isBank: false },
  { name: "Scripbox",                   domain: "scripbox.com", isBank: false },
  { name: "Vested Finance",             domain: "vestedfinance.com", isBank: false },

  // Global Financial Institutions & Neo-Banks
  { name: "Barclays",                   domain: "barclays.com", isBank: true },
  { name: "UBS",                        domain: "ubs.com", isBank: true },
  { name: "Credit Suisse",              domain: "credit-suisse.com", isBank: true },
  { name: "BNP Paribas",                domain: "bnpparibas.com", isBank: true },
  { name: "Societe Generale",           domain: "societegenerale.com", isBank: true },
  { name: "Fidelity Investments",       domain: "fidelity.com", isBank: false },
  { name: "Vanguard",                   domain: "vanguard.com", isBank: false },
  { name: "Charles Schwab",             domain: "schwab.com", isBank: true },
  { name: "E*TRADE",                    domain: "etrade.com", isBank: false },
  { name: "Webull",                     domain: "webull.com", isBank: false },
  { name: "Interactive Brokers",        domain: "interactivebrokers.com", isBank: false },
  { name: "N26",                        domain: "n26.com", isBank: true },
  { name: "Monzo",                      domain: "monzo.com", isBank: true },
  { name: "Starling Bank",              domain: "starlingbank.com", isBank: true },
  { name: "Remitly",                    domain: "remitly.com", isBank: false },

  { name: "Chase Bank",                 domain: "chase.com", isBank: true },
  { name: "Bank of America",            domain: "bankofamerica.com", isBank: true },
  { name: "Wells Fargo",                domain: "wellsfargo.com", isBank: true },
  { name: "Capital One",                domain: "capitalone.com", isBank: true },
  { name: "Morgan Stanley",             domain: "morganstanley.com", isBank: true },
  { name: "Revolut",                    domain: "revolut.com", isBank: true },
  { name: "Wise",                       domain: "wise.com", isBank: true },
  { name: "PayPal",                     domain: "paypal.com", isBank: false },
  { name: "Robinhood",                  domain: "robinhood.com", isBank: false },
  { name: "Coinbase",                   domain: "coinbase.com", isBank: false },
  { name: "Binance",                    domain: "binance.com", isBank: false },
];

const SHORTHAND_DOMAINS: Record<string, string> = {
  sbi: "sbi.co.in",
  "state bank": "sbi.co.in",
  "state bank of india": "sbi.co.in",
  hdfc: "hdfcbank.com",
  "hdfc bank": "hdfcbank.com",
  icici: "icicibank.com",
  "icici bank": "icicibank.com",
  axis: "axisbank.com",
  "axis bank": "axisbank.com",
  kotak: "kotak.com",
  "kotak bank": "kotak.com",
  "kotak mahindra": "kotak.com",
  "kotak mahindra bank": "kotak.com",
  pnb: "pnbindia.in",
  "punjab national bank": "pnbindia.in",
  bob: "bankofbaroda.in",
  baroda: "bankofbaroda.in",
  "bank of baroda": "bankofbaroda.in",
  canara: "canarabank.com",
  "canara bank": "canarabank.com",
  union: "unionbankofindia.co.in",
  "union bank": "unionbankofindia.co.in",
  "union bank of india": "unionbankofindia.co.in",
  boi: "bankofindia.co.in",
  "bank of india": "bankofindia.co.in",
  indianbank: "indianbank.in",
  "indian bank": "indianbank.in",
  cbi: "centralbankofindia.co.in",
  "central bank": "centralbankofindia.co.in",
  "central bank of india": "centralbankofindia.co.in",
  iob: "iob.in",
  "indian overseas bank": "iob.in",
  uco: "ucobank.com",
  "uco bank": "ucobank.com",
  bom: "bankofmaharashtra.in",
  "bank of maharashtra": "bankofmaharashtra.in",
  psb: "punjabandsindbank.co.in",
  "punjab & sind bank": "punjabandsindbank.co.in",
  idfc: "idfcfirstbank.com",
  "idfc first": "idfcfirstbank.com",
  "idfc bank": "idfcfirstbank.com",
  "idfc first bank": "idfcfirstbank.com",
  indusind: "indusind.com",
  "indusind bank": "indusind.com",
  yes: "yesbank.in",
  "yes bank": "yesbank.in",
  federal: "federalbank.co.in",
  "federal bank": "federalbank.co.in",
  rbl: "rblbank.com",
  "rbl bank": "rblbank.com",
  sib: "southindianbank.com",
  "south indian bank": "southindianbank.com",
  karnataka: "karnatakabank.com",
  "karnataka bank": "karnatakabank.com",
  kvb: "kvb.co.in",
  "karur vysya bank": "kvb.co.in",
  bandhan: "bandhanbank.com",
  "bandhan bank": "bandhanbank.com",
  idbi: "idbibank.in",
  "idbi bank": "idbibank.in",
  cub: "cityunionbank.com",
  "city union bank": "cityunionbank.com",
  dcb: "dcbbank.com",
  "dcb bank": "dcbbank.com",
  tmb: "tmb.in",
  "tamilnad mercantile bank": "tmb.in",
  au: "aubank.in",
  "au bank": "aubank.in",
  "au small finance bank": "aubank.in",
  equitas: "equitasbank.com",
  "equitas small finance bank": "equitasbank.com",
  ujjivan: "ujjivansfb.in",
  "ujjivan small finance bank": "ujjivansfb.in",
  hsbc: "hsbc.co.in",
  "hsbc bank": "hsbc.co.in",
  "hsbc india": "hsbc.co.in",
  "standard chartered": "sc.com",
  citi: "citibank.co.in",
  citibank: "citibank.co.in",
  "citibank india": "citibank.co.in",
  dbs: "dbs.com",
  "dbs bank": "dbs.com",
  chase: "chase.com",
  bofa: "bankofamerica.com",
  "bank of america": "bankofamerica.com",
  wellsfargo: "wellsfargo.com",
  "wells fargo": "wellsfargo.com",
  capitalone: "capitalone.com",
  "capital one": "capitalone.com",
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

  const normalizedSearch = raw.toLowerCase().trim();

  // 0B. Direct shorthand override
  if (SHORTHAND_DOMAINS[normalizedSearch]) {
    return SHORTHAND_DOMAINS[normalizedSearch];
  }

  // Helper to get clean bank name without parenthetical acronyms (e.g. "State Bank of India (SBI)" -> "state bank of india")
  const cleanBankName = (bName: string) => bName.replace(/\s*\([^)]*\)/g, "").toLowerCase().trim();

  // 1. Exact match against full name or clean name without parentheticals
  let bank = BANKS.find((b) => b.name.toLowerCase() === normalizedSearch || cleanBankName(b.name) === normalizedSearch);
  
  // 2. Acronym match (e.g., matching "SBI" in "State Bank of India (SBI)")
  if (!bank) {
    bank = BANKS.find((b) => {
      const match = b.name.match(/\(([^)]+)\)/);
      return match && match[1].toLowerCase() === normalizedSearch;
    });
  }

  // 3. Exact clean name match
  if (!bank) {
    bank = BANKS.find((b) => cleanBankName(b.name) === normalizedSearch);
  }

  // 4. Token-based word match (e.g. "My SBI Salary" -> matches "sbi" in SHORTHAND_DOMAINS or BANKS)
  if (!bank) {
    const tokens = normalizedSearch.split(/[\s\-_\/]+/);
    for (const token of tokens) {
      if (token.length >= 2 && SHORTHAND_DOMAINS[token]) {
        return SHORTHAND_DOMAINS[token];
      }
      const matched = BANKS.find((b) => {
        const clean = cleanBankName(b.name);
        return clean === token || clean.split(" ")[0] === token;
      });
      if (matched) return matched.domain;
    }
  }

  // 5. Substring match with length closeness sorting to prevent matching "State Bank of India" when query is "Bank of India"
  if (!bank) {
    const candidates = BANKS.filter((b) => {
      const clean = cleanBankName(b.name);
      return clean.includes(normalizedSearch) || normalizedSearch.includes(clean);
    });

    if (candidates.length > 0) {
      candidates.sort((a, b) => {
        const cleanA = cleanBankName(a.name);
        const cleanB = cleanBankName(b.name);
        const diffA = Math.abs(cleanA.length - normalizedSearch.length);
        const diffB = Math.abs(cleanB.length - normalizedSearch.length);
        return diffA - diffB;
      });
      bank = candidates[0];
    }
  }

  if (bank) return bank.domain;

  // 6. Fallback candidate (e.g. "Axis Savings" -> "axisbank.com" or "axis.com")
  const cleanWord = normalizedSearch
    .replace(/\b(bank|checking|savings|account|wallet|card|primary|personal|business)\b/g, "")
    .trim()
    .split(/\s+/)[0]
    .replace(/[^a-z0-9]/g, "");

  if (cleanWord.length >= 3) {
    if (SHORTHAND_DOMAINS[cleanWord]) return SHORTHAND_DOMAINS[cleanWord];
    return `${cleanWord}.com`;
  }

  return null;
}

/**
 * Get ordered fallback logo URLs for a bank.
 * Strategy: IconHorse → Unavatar → Google Favicon 128px
 */
export function getBankLogoSources(bankNameOrDomain: string): string[] {
  if (!bankNameOrDomain) return [];
  const raw = bankNameOrDomain.trim();
  const domainRegex = /^[a-z0-9\-]+\.(?:co\.in|com|in|co|io|ai|org|net|tech|app|dev|club|money)$/i;
  let domain: string | null = null;

  if (domainRegex.test(raw)) {
    domain = raw.toLowerCase();
  } else {
    domain = getBankDomain(raw);
  }

  if (!domain) return [];

  return [
    `https://icon.horse/icon/${domain}`,
    `https://unavatar.io/${domain}`,
    `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
  ];
}

/**
 * Get a high-quality logo URL for a bank.
 */
export function getBankLogoUrl(bankNameOrDomain: string, size: number = 128): string | null {
  const sources = getBankLogoSources(bankNameOrDomain);
  return sources.length > 0 ? sources[0] : null;
}

export function searchBanks(query: string, includeNonBanks: boolean = false): Bank[] {
  const bankPool = includeNonBanks ? BANKS : BANKS.filter((b) => b.isBank !== false);
  if (!query.trim()) return bankPool.slice(0, 15); // Show popular banks by default
  const q = query.toLowerCase().trim();
  const cleanBankName = (name: string) => name.replace(/\s*\([^)]*\)/g, "").toLowerCase().trim();
  const acronymFor = (name: string) => name.match(/\(([^)]+)\)/)?.[1]?.toLowerCase() || "";
  const scoreBank = (bank: Bank) => {
    const name = bank.name.toLowerCase();
    const clean = cleanBankName(bank.name);
    const acronym = acronymFor(bank.name);

    if (name === q || clean === q || acronym === q) return 0;
    if (SHORTHAND_DOMAINS[q] === bank.domain) return 1;
    if (name.startsWith(q) || clean.startsWith(q)) return 2;
    if (acronym.startsWith(q)) return 3;
    if (name.includes(q) || clean.includes(q)) return 4;
    return 5;
  };
  
  // Sort by priority and match quality
  return bankPool.filter((b) => {
    const name = b.name.toLowerCase();
    const clean = cleanBankName(b.name);
    const acronym = acronymFor(b.name);
    return (
      name.includes(q) ||
      clean.includes(q) ||
      acronym.includes(q) ||
      SHORTHAND_DOMAINS[q] === b.domain ||
      q.includes(clean.split(" ")[0])
    );
  })
  .sort((a, b) => {
    const scoreDiff = scoreBank(a) - scoreBank(b);
    if (scoreDiff !== 0) return scoreDiff;
    return a.name.localeCompare(b.name);
  })
  .slice(0, 12);
}


