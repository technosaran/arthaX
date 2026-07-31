export type Bank = { name: string; domain: string; isBank?: boolean };

// Curated Bank registry containing top Indian & Global banks, small finance banks, payment banks, brokers & financial institutions
const BANKS: Bank[] = [
  // Major Public Sector Banks
  { name: "State Bank of India (SBI)",  domain: "sbi.co.in", isBank: true },
  { name: "HDFC Bank",                  domain: "hdfcbank.com", isBank: true },
  { name: "ICICI Bank",                 domain: "icicibank.com", isBank: true },
  { name: "Axis Bank",                  domain: "axisbank.com", isBank: true },
  { name: "Kotak Mahindra Bank",        domain: "kotak.com", isBank: true },
  { name: "Punjab National Bank (PNB)", domain: "pnbindia.in", isBank: true },
  { name: "Bank of Baroda (BOB)",       domain: "bankofbaroda.in", isBank: true },
  { name: "Canara Bank",                domain: "canarabank.com", isBank: true },
  { name: "Union Bank of India",        domain: "unionbankofindia.co.in", isBank: true },
  { name: "Bank of India (BOI)",        domain: "bankofindia.co.in", isBank: true },
  { name: "Indian Bank",                domain: "indianbank.in", isBank: true },
  { name: "Central Bank of India",      domain: "centralbankofindia.co.in", isBank: true },
  { name: "Indian Overseas Bank (IOB)", domain: "iob.in", isBank: true },
  { name: "UCO Bank",                   domain: "ucobank.com", isBank: true },
  { name: "Bank of Maharashtra",        domain: "bankofmaharashtra.in", isBank: true },
  { name: "Punjab & Sind Bank",         domain: "punjabandsindbank.co.in", isBank: true },

  // Major Private Sector Banks
  { name: "IDFC First Bank",            domain: "idfcfirstbank.com", isBank: true },
  { name: "IndusInd Bank",              domain: "indusind.com", isBank: true },
  { name: "Yes Bank",                   domain: "yesbank.in", isBank: true },
  { name: "Federal Bank",               domain: "federalbank.co.in", isBank: true },
  { name: "RBL Bank",                   domain: "rblbank.com", isBank: true },
  { name: "Bandhan Bank",               domain: "bandhanbank.com", isBank: true },
  { name: "IDBI Bank",                  domain: "idbibank.in", isBank: true },
  { name: "South Indian Bank",          domain: "southindianbank.com", isBank: true },
  { name: "Karur Vysya Bank (KVB)",     domain: "kvb.co.in", isBank: true },
  { name: "City Union Bank (CUB)",      domain: "cityunionbank.com", isBank: true },
  { name: "Tamilnad Mercantile Bank",   domain: "tmb.in", isBank: true },
  { name: "Karnataka Bank",             domain: "karnatakabank.com", isBank: true },
  { name: "CSB Bank",                   domain: "csb.co.in", isBank: true },
  { name: "Dhanlaxmi Bank",             domain: "dhanbank.com", isBank: true },
  { name: "Jammu & Kashmir Bank",       domain: "jkbank.com", isBank: true },
  { name: "Nainital Bank",              domain: "nainitalbank.co.in", isBank: true },

  // Small Finance & Payment Banks
  { name: "AU Small Finance Bank",      domain: "aubank.in", isBank: true },
  { name: "Equitas Small Finance Bank", domain: "equitasbank.com", isBank: true },
  { name: "Ujjivan Small Finance Bank", domain: "ujjivansfb.in", isBank: true },
  { name: "Jana Small Finance Bank",    domain: "janabank.com", isBank: true },
  { name: "Capital Small Finance Bank", domain: "capitalbank.co.in", isBank: true },
  { name: "ESAF Small Finance Bank",    domain: "esafbank.com", isBank: true },
  { name: "Suryoday Small Finance Bank",domain: "suryodaybank.com", isBank: true },
  { name: "Utkarsh Small Finance Bank", domain: "utkarsh.bank", isBank: true },
  { name: "Paytm Payments Bank",        domain: "paytmbank.com", isBank: true },
  { name: "Airtel Payments Bank",       domain: "airtel.in", isBank: true },
  { name: "Jio Payments Bank",          domain: "jio.com", isBank: true },
  { name: "India Post Payments Bank",   domain: "ippbonline.com", isBank: true },
  { name: "Fino Payments Bank",         domain: "finobank.com", isBank: true },

  // Co-operative Banks
  { name: "Saraswat Bank",              domain: "saraswatbank.com", isBank: true },
  { name: "Cosmos Bank",                domain: "cosmosbank.com", isBank: true },
  { name: "TJSB Bank",                  domain: "tjsbbank.co.in", isBank: true },
  { name: "SVC Bank",                   domain: "svcbank.com", isBank: true },
  { name: "Abhyudaya Bank",             domain: "abhyudayabank.co.in", isBank: true },
  { name: "Bharat Bank",                domain: "bharatbank.com", isBank: true },

  // Neo-Banks & Digital Fintech
  { name: "Jupiter",                    domain: "jupiter.money", isBank: true },
  { name: "Fi Money",                   domain: "fi.money", isBank: true },
  { name: "Niyo",                       domain: "goniyo.com", isBank: true },
  { name: "Slice",                      domain: "sliceit.com", isBank: false },
  { name: "OneCard",                    domain: "getonecard.app", isBank: false },
  { name: "PhonePe",                    domain: "phonepe.com", isBank: false },
  { name: "Google Pay",                 domain: "pay.google.com", isBank: false },
  { name: "CRED",                       domain: "cred.club", isBank: false },

  // Top Brokers & Trading Platforms
  { name: "Zerodha",                    domain: "zerodha.com", isBank: false },
  { name: "Groww",                      domain: "groww.in", isBank: false },
  { name: "Upstox",                     domain: "upstox.com", isBank: false },
  { name: "Angel One",                  domain: "angelone.in", isBank: false },
  { name: "Dhan",                       domain: "dhan.co", isBank: false },
  { name: "Paytm Money",                domain: "paytmmoney.com", isBank: false },
  { name: "5Paisa",                     domain: "5paisa.com", isBank: false },
  { name: "Sharekhan",                  domain: "sharekhan.com", isBank: false },
  { name: "Motilal Oswal",              domain: "motilaloswal.com", isBank: false },
  { name: "ICICI Direct",               domain: "icicidirect.com", isBank: false },
  { name: "HDFC Securities",            domain: "hdfcsec.com", isBank: false },
  { name: "Kotak Securities",           domain: "kotaksecurities.com", isBank: false },

  // Top Global Financial Institutions
  { name: "HSBC India",                 domain: "hsbc.co.in", isBank: true },
  { name: "Standard Chartered",         domain: "sc.com", isBank: true },
  { name: "Citibank India",             domain: "citibank.co.in", isBank: true },
  { name: "DBS Bank India",             domain: "dbs.com", isBank: true },
  { name: "Barclays India",             domain: "barclays.in", isBank: true },
  { name: "Deutsche Bank India",        domain: "deutschebank.co.in", isBank: true },
  { name: "Chase Bank",                 domain: "chase.com", isBank: true },
  { name: "Bank of America",            domain: "bankofamerica.com", isBank: true },
  { name: "Wells Fargo",                domain: "wellsfargo.com", isBank: true },
  { name: "Revolut",                    domain: "revolut.com", isBank: true },
  { name: "Wise",                       domain: "wise.com", isBank: true },
  { name: "PayPal",                     domain: "paypal.com", isBank: false },
];

const SHORTHAND_DOMAINS: Record<string, string> = {
  sbi: "sbi.co.in",
  sb: "sbi.co.in",
  sbibank: "sbi.co.in",
  sbicard: "sbi.co.in",
  sbisavings: "sbi.co.in",
  sbisalary: "sbi.co.in",
  "state bank": "sbi.co.in",
  "state bank of india": "sbi.co.in",
  "state bank of india (sbi)": "sbi.co.in",

  hdfc: "hdfcbank.com",
  hdfcbank: "hdfcbank.com",
  "hdfc bank": "hdfcbank.com",
  hdfcsavings: "hdfcbank.com",
  hdfcsalary: "hdfcbank.com",
  hdfccredit: "hdfcbank.com",
  hdfcsec: "hdfcsec.com",

  icici: "icicibank.com",
  icicibank: "icicibank.com",
  "icici bank": "icicibank.com",
  icicisavings: "icicibank.com",
  icicidirect: "icicidirect.com",
  icicipru: "icicipruamc.com",

  axis: "axisbank.com",
  axisbank: "axisbank.com",
  "axis bank": "axisbank.com",
  axissavings: "axisbank.com",
  axisdirect: "simple.axisdirect.in",

  kotak: "kotak.com",
  kotakbank: "kotak.com",
  "kotak bank": "kotak.com",
  "kotak mahindra": "kotak.com",
  "kotak mahindra bank": "kotak.com",
  kotak811: "kotak.com",
  "kotak 811": "kotak.com",
  kotaksec: "kotaksecurities.com",

  pnb: "pnbindia.in",
  pnbbank: "pnbindia.in",
  "punjab national bank": "pnbindia.in",

  bob: "bankofbaroda.in",
  baroda: "bankofbaroda.in",
  bankofbaroda: "bankofbaroda.in",
  "bank of baroda": "bankofbaroda.in",

  canara: "canarabank.com",
  canarabank: "canarabank.com",
  "canara bank": "canarabank.com",

  union: "unionbankofindia.co.in",
  unionbank: "unionbankofindia.co.in",
  "union bank": "unionbankofindia.co.in",
  "union bank of india": "unionbankofindia.co.in",

  boi: "bankofindia.co.in",
  bankofindia: "bankofindia.co.in",
  "bank of india": "bankofindia.co.in",

  indianbank: "indianbank.in",
  "indian bank": "indianbank.in",
  indian: "indianbank.in",

  cbi: "centralbankofindia.co.in",
  centralbank: "centralbankofindia.co.in",
  "central bank": "centralbankofindia.co.in",
  "central bank of india": "centralbankofindia.co.in",

  iob: "iob.in",
  iobbank: "iob.in",
  "indian overseas bank": "iob.in",

  uco: "ucobank.com",
  ucobank: "ucobank.com",
  "uco bank": "ucobank.com",

  bom: "bankofmaharashtra.in",
  bankofmaharashtra: "bankofmaharashtra.in",
  "bank of maharashtra": "bankofmaharashtra.in",

  psb: "punjabandsindbank.co.in",
  punjabandsind: "punjabandsindbank.co.in",
  "punjab & sind bank": "punjabandsindbank.co.in",
  "punjab and sind bank": "punjabandsindbank.co.in",

  idfc: "idfcfirstbank.com",
  idfcfirst: "idfcfirstbank.com",
  idfcbank: "idfcfirstbank.com",
  idfcfirstbank: "idfcfirstbank.com",
  "idfc first": "idfcfirstbank.com",
  "idfc bank": "idfcfirstbank.com",
  "idfc first bank": "idfcfirstbank.com",

  indusind: "indusind.com",
  indusindbank: "indusind.com",
  "indusind bank": "indusind.com",

  yes: "yesbank.in",
  yesbank: "yesbank.in",
  "yes bank": "yesbank.in",

  federal: "federalbank.co.in",
  federalbank: "federalbank.co.in",
  "federal bank": "federalbank.co.in",

  rbl: "rblbank.com",
  rblbank: "rblbank.com",
  "rbl bank": "rblbank.com",

  bandhan: "bandhanbank.com",
  bandhanbank: "bandhanbank.com",
  "bandhan bank": "bandhanbank.com",

  idbi: "idbibank.in",
  idbibank: "idbibank.in",
  "idbi bank": "idbibank.in",

  southindian: "southindianbank.com",
  southindianbank: "southindianbank.com",
  "south indian bank": "southindianbank.com",
  sib: "southindianbank.com",

  kvb: "kvb.co.in",
  karurvysya: "kvb.co.in",
  "karur vysya bank": "kvb.co.in",

  cub: "cityunionbank.com",
  cityunion: "cityunionbank.com",
  "city union bank": "cityunionbank.com",

  tmb: "tmb.in",
  tamilnad: "tmb.in",
  "tamilnad mercantile bank": "tmb.in",

  karnataka: "karnatakabank.com",
  karnatakabank: "karnatakabank.com",
  "karnataka bank": "karnatakabank.com",

  csb: "csb.co.in",
  catholicsyrian: "csb.co.in",
  "csb bank": "csb.co.in",

  dhanlaxmi: "dhanbank.com",
  dhanbank: "dhanbank.com",
  "dhanlaxmi bank": "dhanbank.com",

  jkbank: "jkbank.com",
  "j&k bank": "jkbank.com",
  "jammu & kashmir bank": "jkbank.com",

  nainital: "nainitalbank.co.in",
  nainitalbank: "nainitalbank.co.in",

  au: "aubank.in",
  aubank: "aubank.in",
  "au bank": "aubank.in",
  "au small finance bank": "aubank.in",

  equitas: "equitasbank.com",
  equitasbank: "equitasbank.com",
  "equitas small finance bank": "equitasbank.com",

  ujjivan: "ujjivansfb.in",
  ujjivansfb: "ujjivansfb.in",
  "ujjivan small finance bank": "ujjivansfb.in",

  jana: "janabank.com",
  janabank: "janabank.com",
  "jana small finance bank": "janabank.com",

  suryoday: "suryodaybank.com",
  esaf: "esafbank.com",
  utkarsh: "utkarsh.bank",
  capital: "capitalbank.co.in",

  paytm: "paytmbank.com",
  paytmbank: "paytmbank.com",
  "paytm payments bank": "paytmbank.com",

  airtel: "airtel.in",
  airtelbank: "airtel.in",
  "airtel payments bank": "airtel.in",

  jio: "jio.com",
  jiobank: "jio.com",
  "jio payments bank": "jio.com",

  ippb: "ippbonline.com",
  "india post": "ippbonline.com",
  "india post payments bank": "ippbonline.com",

  fino: "finobank.com",
  finobank: "finobank.com",

  saraswat: "saraswatbank.com",
  saraswatbank: "saraswatbank.com",

  cosmos: "cosmosbank.com",
  cosmosbank: "cosmosbank.com",

  tjsb: "tjsbbank.co.in",
  tjsbbank: "tjsbbank.co.in",

  svc: "svcbank.com",
  svcbank: "svcbank.com",

  abhyudaya: "abhyudayabank.co.in",
  bharatbank: "bharatbank.com",

  jupiter: "jupiter.money",
  fi: "fi.money",
  fimoney: "fi.money",
  niyo: "goniyo.com",
  slice: "sliceit.com",
  onecard: "getonecard.app",
  phonepe: "phonepe.com",
  gpay: "pay.google.com",
  googlepay: "pay.google.com",
  cred: "cred.club",

  zerodha: "zerodha.com",
  groww: "groww.in",
  upstox: "upstox.com",
  angelone: "angelone.in",
  dhan: "dhan.co",
  paytmmoney: "paytmmoney.com",
  "5paisa": "5paisa.com",
  sharekhan: "sharekhan.com",
  motilaloswal: "motilaloswal.com",

  hsbc: "hsbc.co.in",
  "hsbc bank": "hsbc.co.in",
  "hsbc india": "hsbc.co.in",
  "standard chartered": "sc.com",
  stanchart: "sc.com",
  citi: "citibank.co.in",
  citibank: "citibank.co.in",
  "citibank india": "citibank.co.in",
  dbs: "dbs.com",
  "dbs bank": "dbs.com",
  barclays: "barclays.in",
  deutsche: "deutschebank.co.in",
  chase: "chase.com",
  bofa: "bankofamerica.com",
  "bank of america": "bankofamerica.com",
  wellsfargo: "wellsfargo.com",
  "wells fargo": "wellsfargo.com",
  revolut: "revolut.com",
  wise: "wise.com",
  paypal: "paypal.com",
};

/**
 * Get the domain registered for a bank name or account title
 */
export function getBankDomain(bankName: string): string | null {
  if (!bankName) return null;
  const raw = bankName.trim();

  // 1. Direct match if input already contains a valid domain
  const domainRegex = /\b([a-z0-9\-]+\.(?:co\.in|com|in|co|io|ai|org|net|tech|app|dev|club|money|bank))\b/i;
  const directMatch = raw.match(domainRegex);
  if (directMatch) {
    return directMatch[1].toLowerCase();
  }

  // 2. Normalize input string
  const normalizedSearch = raw.toLowerCase().trim();

  // Direct lookup in shorthand dictionary
  if (SHORTHAND_DOMAINS[normalizedSearch]) {
    return SHORTHAND_DOMAINS[normalizedSearch];
  }

  // Strip account numbers, special symbols, and filler words
  const cleanedSearch = normalizedSearch
    .replace(/[\d\-_#()/\\:]+/g, " ")
    .replace(/\b(bank|checking|savings|account|wallet|card|primary|personal|business|salary|current|deposit|fd|rd|od|overdraft|loan|credit|debit|co-operative|cooperative|corp|ltd|limited)\b/g, "")
    .trim();

  if (cleanedSearch && SHORTHAND_DOMAINS[cleanedSearch]) {
    return SHORTHAND_DOMAINS[cleanedSearch];
  }

  // 3. Exact or cleaned match in BANKS list
  const cleanBankName = (bName: string) => bName.replace(/\s*\([^)]*\)/g, "").toLowerCase().trim();

  let bank = BANKS.find((b) => b.name.toLowerCase() === normalizedSearch || cleanBankName(b.name) === normalizedSearch);
  
  if (!bank && cleanedSearch) {
    bank = BANKS.find((b) => cleanBankName(b.name) === cleanedSearch);
  }

  if (!bank) {
    bank = BANKS.find((b) => {
      const match = b.name.match(/\(([^)]+)\)/);
      return match && match[1].toLowerCase() === normalizedSearch;
    });
  }

  // 4. Token-based matching against SHORTHAND_DOMAINS and BANKS
  const tokens = normalizedSearch.split(/[\s\-_\/]+/);
  for (const token of tokens) {
    const cleanToken = token.replace(/[^a-z0-9]/g, "");
    if (cleanToken.length >= 2 && SHORTHAND_DOMAINS[cleanToken]) {
      return SHORTHAND_DOMAINS[cleanToken];
    }
    const matched = BANKS.find((b) => {
      const clean = cleanBankName(b.name);
      return clean === cleanToken || clean.split(" ")[0] === cleanToken;
    });
    if (matched) return matched.domain;
  }

  // 5. Candidate substring match
  if (!bank) {
    const searchTarget = cleanedSearch || normalizedSearch;
    const candidates = BANKS.filter((b) => {
      const clean = cleanBankName(b.name);
      return clean.includes(searchTarget) || searchTarget.includes(clean);
    });

    if (candidates.length > 0) {
      candidates.sort((a, b) => {
        const cleanA = cleanBankName(a.name);
        const cleanB = cleanBankName(b.name);
        const diffA = Math.abs(cleanA.length - searchTarget.length);
        const diffB = Math.abs(cleanB.length - searchTarget.length);
        return diffA - diffB;
      });
      bank = candidates[0];
    }
  }

  if (bank) return bank.domain;

  // 6. Final fallback to clean first word if 3+ characters
  if (cleanedSearch.length >= 3) {
    const firstWord = cleanedSearch.split(/\s+/)[0];
    if (SHORTHAND_DOMAINS[firstWord]) return SHORTHAND_DOMAINS[firstWord];
    return `${firstWord}.com`;
  }

  const rawFirstWord = normalizedSearch.split(/\s+/)[0].replace(/[^a-z0-9]/g, "");
  if (rawFirstWord.length >= 3) {
    if (SHORTHAND_DOMAINS[rawFirstWord]) return SHORTHAND_DOMAINS[rawFirstWord];
    return `${rawFirstWord}.com`;
  }

  return null;
}

/**
 * Get ordered logo URLs for a bank dynamically using dedicated bank logo APIs.
 */
export function getBankLogoSources(bankNameOrDomain: string): string[] {
  if (!bankNameOrDomain) return [];
  const raw = bankNameOrDomain.trim();
  const domainRegex = /^[a-z0-9\-]+\.(?:co\.in|com|in|co|io|ai|org|net|tech|app|dev|club|money|bank)$/i;
  let domain: string | null = null;

  if (domainRegex.test(raw)) {
    domain = raw.toLowerCase();
  } else {
    domain = getBankDomain(raw);
  }

  if (!domain) return [];

  // Multi-source CDN chain:
  // 1. Clearbit Logo API (Official high-res brand vector/PNG logos, returns 404 on miss)
  // 2. Unavatar API (Aggregates multiple brand/social/icon APIs, returns 404 on miss)
  // 3. FaviconKit API (High quality 128px favicons, returns 404 on miss)
  // 4. DuckDuckGo ICO API (DuckDuckGo icon CDN)
  // 5. Google 128px Favicon CDN (Google favicon service fallback)
  return [
    `https://logo.clearbit.com/${domain}`,
    `https://unavatar.io/${domain}`,
    `https://api.faviconkit.com/${domain}/128`,
    `https://icons.duckduckgo.com/ip3/${domain}.ico`,
    `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
  ];
}

export function getBankLogoUrl(bankNameOrDomain: string, _size: number = 128): string | null {
  const sources = getBankLogoSources(bankNameOrDomain);
  return sources.length > 0 ? sources[0] : null;
}

/**
 * Search banks with intelligent ranking prioritizing exact matches and acronyms like SBI, HDFC, ICICI, etc.
 */
export function searchBanks(query: string, includeNonBanks: boolean = false): Bank[] {
  const bankPool = includeNonBanks ? BANKS : BANKS.filter((b) => b.isBank !== false);
  if (!query.trim()) return bankPool.slice(0, 10);
  const q = query.toLowerCase().trim();
  const cleanBankName = (name: string) => name.replace(/\s*\([^)]*\)/g, "").toLowerCase().trim();
  const acronymFor = (name: string) => name.match(/\(([^)]+)\)/)?.[1]?.toLowerCase() || "";

  const scoreBank = (bank: Bank) => {
    const name = bank.name.toLowerCase();
    const clean = cleanBankName(bank.name);
    const acronym = acronymFor(bank.name);

    if (acronym === q || clean === q || name === q) return -100;
    if (SHORTHAND_DOMAINS[q] === bank.domain) return -90;
    if (acronym.startsWith(q)) return -80;
    if (clean.startsWith(q) || name.startsWith(q)) return -50;
    if (clean.includes(q) || name.includes(q)) return 0;
    return 100;
  };
  
  return bankPool
    .filter((b) => scoreBank(b) < 100)
    .sort((a, b) => scoreBank(a) - scoreBank(b))
    .slice(0, 10);
}
