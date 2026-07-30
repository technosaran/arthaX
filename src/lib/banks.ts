export type Bank = { name: string; domain: string; isBank?: boolean };

// Curated Bank registry containing ONLY top, widely used banks & financial institutions
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
  { name: "Indian Overseas Bank",       domain: "iob.in", isBank: true },
  { name: "UCO Bank",                   domain: "ucobank.com", isBank: true },
  { name: "Bank of Maharashtra",        domain: "bankofmaharashtra.in", isBank: true },

  // Major Private Sector Banks
  { name: "IDFC First Bank",            domain: "idfcfirstbank.com", isBank: true },
  { name: "IndusInd Bank",              domain: "indusind.com", isBank: true },
  { name: "Yes Bank",                   domain: "yesbank.in", isBank: true },
  { name: "Federal Bank",               domain: "federalbank.co.in", isBank: true },
  { name: "RBL Bank",                   domain: "rblbank.com", isBank: true },
  { name: "Bandhan Bank",               domain: "bandhanbank.com", isBank: true },
  { name: "IDBI Bank",                  domain: "idbibank.in", isBank: true },

  // Payments & Small Finance Banks
  { name: "AU Small Finance Bank",      domain: "aubank.in", isBank: true },
  { name: "Paytm Payments Bank",        domain: "paytm.com", isBank: true },
  { name: "Airtel Payments Bank",       domain: "airtel.in", isBank: true },
  { name: "Jio Payments Bank",          domain: "jio.com", isBank: true },
  { name: "India Post Payments Bank",   domain: "ippbonline.com", isBank: true },

  // Neo-Banks & Digital Banking
  { name: "Jupiter",                    domain: "jupiter.money", isBank: true },
  { name: "Fi Money",                   domain: "fi.money", isBank: true },
  { name: "PhonePe",                    domain: "phonepe.com", isBank: false },
  { name: "Google Pay",                 domain: "pay.google.com", isBank: false },
  { name: "CRED",                       domain: "cred.club", isBank: false },

  // Top Brokers & Trading Platforms
  { name: "Zerodha",                    domain: "zerodha.com", isBank: false },
  { name: "Groww",                      domain: "groww.in", isBank: false },
  { name: "Upstox",                     domain: "upstox.com", isBank: false },
  { name: "Angel One",                  domain: "angelone.in", isBank: false },

  // Top Global Financial Institutions
  { name: "HSBC India",                 domain: "hsbc.co.in", isBank: true },
  { name: "Standard Chartered",         domain: "sc.com", isBank: true },
  { name: "Citibank India",             domain: "citibank.co.in", isBank: true },
  { name: "DBS Bank India",             domain: "dbs.com", isBank: true },
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
  bandhan: "bandhanbank.com",
  "bandhan bank": "bandhanbank.com",
  idbi: "idbibank.in",
  "idbi bank": "idbibank.in",
  au: "aubank.in",
  "au bank": "aubank.in",
  "au small finance bank": "aubank.in",
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
  revolut: "revolut.com",
  wise: "wise.com",
  paypal: "paypal.com",
  paytm: "paytm.com",
  phonepe: "phonepe.com",
  cred: "cred.club",
  zerodha: "zerodha.com",
  coin: "zerodha.com",
  "coin by zerodha": "zerodha.com",
  groww: "groww.in",
  upstox: "upstox.com",
  angelone: "angelone.in",
};

/**
 * Get the domain registered for a bank name or account title
 */
export function getBankDomain(bankName: string): string | null {
  if (!bankName) return null;
  const raw = bankName.trim();

  // Direct match if input already contains a domain
  const domainRegex = /\b([a-z0-9\-]+\.(?:co\.in|com|in|co|io|ai|org|net|tech|app|dev|club|money))\b/i;
  const directMatch = raw.match(domainRegex);
  if (directMatch) {
    return directMatch[1].toLowerCase();
  }

  const normalizedSearch = raw.toLowerCase().trim();

  if (SHORTHAND_DOMAINS[normalizedSearch]) {
    return SHORTHAND_DOMAINS[normalizedSearch];
  }

  const cleanBankName = (bName: string) => bName.replace(/\s*\([^)]*\)/g, "").toLowerCase().trim();

  let bank = BANKS.find((b) => b.name.toLowerCase() === normalizedSearch || cleanBankName(b.name) === normalizedSearch);
  
  if (!bank) {
    bank = BANKS.find((b) => {
      const match = b.name.match(/\(([^)]+)\)/);
      return match && match[1].toLowerCase() === normalizedSearch;
    });
  }

  if (!bank) {
    bank = BANKS.find((b) => cleanBankName(b.name) === normalizedSearch);
  }

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

const BANK_SLUGS: Record<string, string> = {
  "sbi.co.in": "sbi",
  "hdfcbank.com": "hdfc",
  "icicibank.com": "icici",
  "axisbank.com": "axis",
  "kotak.com": "kotak",
  "pnbindia.in": "pnb",
  "bankofbaroda.in": "bob",
  "canarabank.com": "canara",
  "unionbankofindia.co.in": "unionbank",
  "bankofindia.co.in": "bankofindia",
  "indianbank.in": "indianbank",
  "centralbankofindia.co.in": "centralbank",
  "iob.in": "iob",
  "ucobank.com": "uco",
  "bankofmaharashtra.in": "bankofmaharashtra",
  "idfcfirstbank.com": "idfcfirst",
  "yesbank.in": "yesbank",
  "indusind.com": "indusind",
  "federalbank.co.in": "federalbank",
  "rblbank.com": "rbl",
  "aubank.in": "aubank",
  "idbibank.in": "idbi",
  "chase.com": "chase",
  "bankofamerica.com": "bofa",
  "wellsfargo.com": "wellsfargo",
  "hsbc.com": "hsbc",
  "hsbc.co.in": "hsbc",
  "revolut.com": "revolut",
  "wise.com": "wise",
  "paytm.com": "paytm",
  "phonepe.com": "phonepe",
  "jupiter.money": "jupiter",
  "fi.money": "fi",
  "cred.club": "cred",
  "zerodha.com": "zerodha",
  "groww.in": "groww",
  "upstox.com": "upstox",
  "angelone.in": "angelone",
};

const BANK_INTERNET_LOGOS: Record<string, string[]> = {
  "sbi.co.in": [
    "https://upload.wikimedia.org/wikipedia/commons/c/cc/State_Bank_of_India_logo.svg",
    "https://logo.clearbit.com/sbi.co.in",
    "https://www.google.com/s2/favicons?domain=sbi.co.in&sz=128",
  ],
  "hdfcbank.com": [
    "https://upload.wikimedia.org/wikipedia/commons/2/28/HDFC_Bank_Logo.svg",
    "https://logo.clearbit.com/hdfcbank.com",
    "https://www.google.com/s2/favicons?domain=hdfcbank.com&sz=128",
  ],
  "icicibank.com": [
    "https://upload.wikimedia.org/wikipedia/commons/1/12/ICICI_Bank_Logo.svg",
    "https://logo.clearbit.com/icicibank.com",
    "https://www.google.com/s2/favicons?domain=icicibank.com&sz=128",
  ],
  "axisbank.com": [
    "https://upload.wikimedia.org/wikipedia/commons/1/1a/Axis_Bank_logo.svg",
    "https://logo.clearbit.com/axisbank.com",
    "https://www.google.com/s2/favicons?domain=axisbank.com&sz=128",
  ],
  "kotak.com": [
    "https://upload.wikimedia.org/wikipedia/commons/1/1b/Kotak_Mahindra_Bank_logo.svg",
    "https://logo.clearbit.com/kotak.com",
    "https://www.google.com/s2/favicons?domain=kotak.com&sz=128",
  ],
  "indianbank.in": [
    "https://upload.wikimedia.org/wikipedia/commons/4/47/Indian_Bank_logo.svg",
    "https://logo.clearbit.com/indianbank.in",
    "https://www.google.com/s2/favicons?domain=indianbank.in&sz=128",
  ],
  "pnbindia.in": [
    "https://upload.wikimedia.org/wikipedia/commons/b/b8/Punjab_National_Bank_Logo.svg",
    "https://logo.clearbit.com/pnbindia.in",
    "https://www.google.com/s2/favicons?domain=pnbindia.in&sz=128",
  ],
  "bankofbaroda.in": [
    "https://upload.wikimedia.org/wikipedia/commons/9/91/Bank_of_Baroda_Logo.svg",
    "https://logo.clearbit.com/bankofbaroda.in",
    "https://www.google.com/s2/favicons?domain=bankofbaroda.in&sz=128",
  ],
  "canarabank.com": [
    "https://upload.wikimedia.org/wikipedia/commons/5/50/Canara_Bank_Logo.svg",
    "https://logo.clearbit.com/canarabank.com",
    "https://www.google.com/s2/favicons?domain=canarabank.com&sz=128",
  ],
  "unionbankofindia.co.in": [
    "https://upload.wikimedia.org/wikipedia/commons/d/d0/Union_Bank_of_India_Logo.svg",
    "https://logo.clearbit.com/unionbankofindia.co.in",
    "https://www.google.com/s2/favicons?domain=unionbankofindia.co.in&sz=128",
  ],
  "idfcfirstbank.com": [
    "https://upload.wikimedia.org/wikipedia/commons/7/7b/IDFC_First_Bank_logo.svg",
    "https://logo.clearbit.com/idfcfirstbank.com",
    "https://www.google.com/s2/favicons?domain=idfcfirstbank.com&sz=128",
  ],
  "yesbank.in": [
    "https://upload.wikimedia.org/wikipedia/commons/b/b3/YES_Bank_logo.svg",
    "https://logo.clearbit.com/yesbank.in",
    "https://www.google.com/s2/favicons?domain=yesbank.in&sz=128",
  ],
  "bankofindia.co.in": [
    "https://upload.wikimedia.org/wikipedia/commons/8/87/Bank_of_India_logo.svg",
    "https://logo.clearbit.com/bankofindia.co.in",
    "https://www.google.com/s2/favicons?domain=bankofindia.co.in&sz=128",
  ],
  "paytm.com": [
    "https://upload.wikimedia.org/wikipedia/commons/2/24/Paytm_Logo.svg",
    "https://logo.clearbit.com/paytm.com",
  ],
  "phonepe.com": [
    "https://upload.wikimedia.org/wikipedia/commons/7/71/PhonePe_Logo.svg",
    "https://logo.clearbit.com/phonepe.com",
  ],
};

/**
 * Get ordered logo URLs for a bank from verified internet hyperlinks.
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

  const sources: string[] = [];

  if (domain && BANK_INTERNET_LOGOS[domain]) {
    sources.push(...BANK_INTERNET_LOGOS[domain]);
  }

  if (domain) {
    sources.push(`https://logo.clearbit.com/${domain}`);
    sources.push(`https://www.google.com/s2/favicons?domain=${domain}&sz=128`);
    sources.push(`https://unavatar.io/${domain}`);
  }

  return Array.from(new Set(sources));
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
