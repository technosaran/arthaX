/**
 * Smart Expense & Indian SMS Parser Utility
 * Parses casual messages (e.g., "Dinner 650 HDFC", "Spent 1,25,000 for flight on ICICI")
 * as well as structured Indian bank debit/card/UPI SMS alerts into structured transactions.
 */

export interface AccountSummary {
  id: string;
  name: string;
  type: string;
  balance: number;
  last_four?: string | null;
}

export interface ParsedExpense {
  amount: number;
  title: string;
  category: string;
  accountQuery?: string;
  rawText: string;
  reference?: string;
  parsedDate?: string;
  channel?: "UPI" | "CARD" | "NETBANKING" | "ATM" | "CASH" | "OTHER";
}

export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Supports both Western (100,000.00) and Indian (1,25,000.50) grouping plus plain numbers. */
export const INDIAN_NUMBER_PATTERN = "(?:[0-9]{1,3}(?:,[0-9]{2,3})+|[0-9]+)(?:\\.[0-9]{1,2})?";

export function parseFormattedNumber(raw?: string | null): number {
  if (!raw) return 0;
  const normalized = raw.replace(/,/g, "").trim();
  if (!normalized || !/^\d+(?:\.\d+)?$/.test(normalized)) return 0;
  const num = Number(normalized);
  return Number.isFinite(num) && num > 0 ? Number(num.toFixed(2)) : 0;
}

export function applyIndianMultiplier(base: number, unitRaw?: string | null): number {
  if (!Number.isFinite(base) || base <= 0) return 0;
  const unit = (unitRaw || "").trim().toLowerCase();
  if (!unit) return Number(base.toFixed(2));
  if (unit === "k" || unit.startsWith("thousand")) return Number((base * 1000).toFixed(2));
  if (unit === "l" || unit === "lac" || unit === "lacs" || unit === "lakh" || unit === "lakhs") {
    return Number((base * 100000).toFixed(2));
  }
  if (unit === "cr" || unit === "crore" || unit === "crores") {
    return Number((base * 10000000).toFixed(2));
  }
  return Number(base.toFixed(2));
}

export function extractAmountFromText(text: string): { amount: number; matchedToken?: string } {
  const clean = (text || "").trim();
  if (!clean) return { amount: 0 };

  // 1. Shorthand multipliers: 2.5k, 1.5 lakh, 2L, 1.2 cr
  const multiplierRe = new RegExp(
    `(?:₹|rs\\.?|inr)?\\s*(${INDIAN_NUMBER_PATTERN})\\s*(k|thousand|lac|lacs|lakh|lakhs|cr|crore|crores|l)(?=\\b|\\s|$)`,
    "i"
  );
  const multMatch = clean.match(multiplierRe);
  if (multMatch) {
    const val = applyIndianMultiplier(parseFormattedNumber(multMatch[1]), multMatch[2]);
    if (val > 0) return { amount: val, matchedToken: multMatch[0] };
  }

  // 2. Explicit currency prefix or suffix: ₹1,25,000, Rs. 420.00, INR 1,250.00, 500/-, 500 rs
  const explicitPrefixRe = new RegExp(`(?:₹|rs\\.?|inr)\\s*(${INDIAN_NUMBER_PATTERN})`, "i");
  const prefMatch = clean.match(explicitPrefixRe);
  if (prefMatch) {
    const val = parseFormattedNumber(prefMatch[1]);
    if (val > 0) return { amount: val, matchedToken: prefMatch[0] };
  }

  const explicitSuffixRe = new RegExp(`(${INDIAN_NUMBER_PATTERN})\\s*(?:₹|rs\\.?|inr|rupees|/-)`, "i");
  const sufMatch = clean.match(explicitSuffixRe);
  if (sufMatch) {
    const val = parseFormattedNumber(sufMatch[1]);
    if (val > 0) return { amount: val, matchedToken: sufMatch[0] };
  }

  // 3. Standalone numeric token (ignore 4-digit years like 2026 if another number exists, and ignore card endings after XX/**)
  const sanitizedForNumeric = clean
    .replace(/\b(?:ending|xx+|x{1,4}|\*{2,}|a\/c\s*no\.?|acct?|card)\s*[xX*]?\d{4,}\b/gi, " ")
    .replace(/\b\d{1,2}[/-](?:\d{1,2}|[a-zA-Z]{3})[/-]\d{2,4}\b/g, " ")
    .replace(/\b(?:ref(?:\s*no)?|utr|rrn)[:\s#-]*[A-Za-z0-9]{6,}\b/gi, " ");

  const allNumbersRe = new RegExp(`\\b(${INDIAN_NUMBER_PATTERN})\\b`, "g");
  let candidate: { amount: number; matchedToken?: string } = { amount: 0 };
  let m: RegExpExecArray | null;
  while ((m = allNumbersRe.exec(sanitizedForNumeric)) !== null) {
    const val = parseFormattedNumber(m[1]);
    if (val > 0) {
      candidate = { amount: val, matchedToken: m[0] };
      break;
    }
  }
  return candidate;
}

const KNOWN_VPA_MERCHANTS: Record<string, string> = {
  swiggy: "Swiggy",
  zomato: "Zomato",
  blinkit: "Blinkit",
  grofers: "Blinkit",
  zepto: "Zepto",
  bigbasket: "BigBasket",
  bbdaily: "BigBasket",
  amazon: "Amazon",
  amazonpay: "Amazon",
  flipkart: "Flipkart",
  myntra: "Myntra",
  ajio: "Ajio",
  nykaa: "Nykaa",
  dmart: "DMart",
  uber: "Uber",
  olacabs: "Ola",
  rapido: "Rapido",
  blusmart: "BluSmart",
  irctc: "IRCTC",
  indigo: "IndiGo",
  redbus: "RedBus",
  fastag: "NETC FASTag",
  airtel: "Airtel",
  jio: "Reliance Jio",
  netflix: "Netflix",
  spotify: "Spotify",
  hotstar: "Disney+ Hotstar",
  bookmyshow: "BookMyShow",
  bms: "BookMyShow",
  cred: "CRED",
  zerodha: "Zerodha",
  groww: "Groww",
  upstox: "Upstox",
  apollo: "Apollo Pharmacy",
  pharmeasy: "PharmEasy",
  "1mg": "Tata 1mg",
  nobroker: "NoBroker",
};

const STOP_WORDS = new Set([
  "spent", "spend", "paid", "pay", "for", "on", "at", "via", "using", "with", "from", "to",
  "the", "a", "an", "my", "rs", "inr", "rupees", "rs.", "debited", "credited", "your",
  "account", "a/c", "ac", "acct", "bank", "card", "credit", "debit", "upi", "ending", "dear",
  "customer", "user", "alert", "sms", "txn", "transaction", "bal", "avl", "available",
  "balance", "transferred", "sent", "withdrawn", "purchase", "purchased", "bought", "buy",
  "order", "ordered", "payment", "info", "vpa", "ref", "utr", "rrn", "not", "you", "call",
  "report", "block", "click", "here",
]);

const ACCOUNT_STOP_WORDS = new Set([
  "bank", "account", "savings", "current", "credit", "debit", "card", "in", "hand", "a/c", "ac",
  "wallet", "the", "my", "primary", "salary", "cash",
]);

const KNOWN_BANK_NAMES = [
  "hdfc", "sbi", "icici", "axis", "kotak", "indian bank", "idib", "idfc", "indusind",
  "yes bank", "pnb", "bob", "baroda", "canara", "union", "federal", "rbl", "amex",
  "citibank", "citi", "hsbc", "sc", "standard chartered", "gpay", "phonepe", "paytm", "cash",
];

// Ordered by specificity — avoid ambiguous short overlaps like bare "auto" or "mobile"
const CATEGORY_RULES: Array<{ category: string; keywords: string[] }> = [
  {
    category: "Food & Dining",
    keywords: [
      "swiggy", "zomato", "dinner", "lunch", "breakfast", "brunch", "supper",
      "coffee", "tea", "chai", "cafe", "starbucks", "chaayos", "chai point",
      "third wave", "blue tokai", "restaurant", "dhaba", "hotel", "food",
      "pizza", "burger", "mcdonalds", "mcdonald", "kfc", "dominos", "subway",
      "biryani", "dosa", "idli", "tiffin", "canteen", "bakery", "snacks",
      "drinks", "pub", "bar", "dining", "eats", "haldiram", "bikanervala",
    ],
  },
  {
    category: "Groceries & Essentials",
    keywords: [
      "blinkit", "zepto", "instamart", "bigbasket", "bbdaily", "dmart", "d-mart",
      "jiomart", "nature basket", "spencers", "reliance smart", "more supermarket",
      "grocery", "groceries", "supermarket", "vegetables", "veggies", "fruits",
      "milk", "dairy", "bread", "provisions", "kirana", "ration", "eggs",
      "meat", "chicken", "fish", "mutton", "water can", "bisleri",
    ],
  },
  {
    category: "Transport & Fuel",
    keywords: [
      "uber", "ola", "rapido", "blusmart", "namma yatri", "meru", "taxi", "cab",
      "auto rickshaw", "autorickshaw", "rickshaw", "metro", "bmrc", "dmrc", "bus",
      "train", "irctc", "petrol", "diesel", "cng", "ev charging", "shell",
      "hpcl", "bpcl", "iocl", "indianoil", "indian oil", "bharat petroleum",
      "nayara", "fuel", "gas station", "parking", "toll", "fastag",
    ],
  },
  {
    category: "Travel & Vacations",
    keywords: [
      "indigo", "air india", "vistara", "akasa", "spicejet", "makemytrip",
      "goibibo", "cleartrip", "yatra", "ixigo", "redbus", "abhibus", "airbnb",
      "oyo", "booking.com", "agoda", "flight", "airline", "airport", "lounge",
      "resort", "vacation", "trip", "holiday", "visa fee", "passport",
    ],
  },
  {
    category: "Utilities & Bills",
    keywords: [
      "electricity", "electric", "power bill", "bescom", "tneb", "msedcl",
      "mahavitaran", "tata power", "adani electricity", "bses", "water bill",
      "bwssb", "lpg", "cylinder", "indane", "hp gas", "bharat gas", "piped gas",
      "igl", "mgl", "adani gas", "wifi", "broadband", "jiofiber", "airtel xstream",
      "act fibernet", "hathway", "bsnl", "airtel", "jio", "vodafone", "vi postpaid",
      "mobile recharge", "postpaid", "prepaid", "recharge", "dth", "tata play",
      "dish tv", "maintenance", "mygate", "apnacomplex", "society bill",
    ],
  },
  {
    category: "Housing & Rent",
    keywords: [
      "rent", "house rent", "pg rent", "flat rent", "nobroker", "housing",
      "security deposit", "brokerage", "plumber", "electrician", "carpenter",
      "urban company", "urbanclap",
    ],
  },
  {
    category: "Health & Medical",
    keywords: [
      "pharmacy", "medical", "medicine", "meds", "apollo", "medplus", "1mg",
      "tata 1mg", "pharmeasy", "netmeds", "truemeds", "doctor", "clinic",
      "hospital", "fortis", "max hospital", "manipal", "medanta", "narayana",
      "health", "dental", "dentist", "lab test", "thyrocare", "lal path",
      "diagnost", "checkup", "lenskart", "opticals",
    ],
  },
  {
    category: "Fitness & Sports",
    keywords: ["gym", "cult.fit", "cultfit", "curefit", "fitness", "workout", "yoga", "decathlon"],
  },
  {
    category: "Subscriptions & SaaS",
    keywords: [
      "spotify", "apple music", "youtube", "yt premium", "icloud",
      "google one", "google play", "apple.com", "app store", "chatgpt", "openai",
      "claude", "anthropic", "cursor", "github", "vercel", "aws", "canva",
      "notion", "adobe", "microsoft 365", "subscription",
    ],
  },
  {
    category: "Entertainment & OTT",
    keywords: [
      "netflix", "prime video", "amazon prime", "hotstar", "jiohotstar", "sonyliv",
      "zee5", "bookmyshow", "pvr", "inox", "cinepolis", "movie", "cinema", "concert",
      "event", "game", "gaming", "steam", "playstation", "xbox", "bowling",
      "club", "amusement",
    ],
  },
  {
    category: "Electronics & Gadgets",
    keywords: [
      "croma", "reliance digital", "vijay sales", "apple store", "iphone",
      "ipad", "macbook", "laptop", "mobile phone", "smartphone", "oneplus",
      "samsung", "earbuds", "airpods", "headphones", "charger", "cable",
      "electronics", "camera", "keyboard", "mouse", "monitor", "ssd",
    ],
  },
  {
    category: "Shopping & Lifestyle",
    keywords: [
      "amazon", "flipkart", "myntra", "ajio", "meesho", "nykaa", "tata cliq",
      "zudio", "westside", "trends", "lifestyle", "shoppers stop", "pantaloons",
      "max fashion", "uniqlo", "h&m", "zara", "decathlon", "nike", "adidas",
      "puma", "ikea", "pepperfry", "tanishq", "kalyan", "malabar", "shopping",
      "shop", "clothes", "shirt", "shoes", "bag", "apparel", "salon", "spa",
      "haircut", "barber", "gift", "present",
    ],
  },
  {
    category: "Education & Learning",
    keywords: [
      "course", "tuition", "fees", "school", "college", "university", "udemy",
      "coursera", "edx", "upgrad", "scaler", "books", "stationery", "exam fee",
    ],
  },
  {
    category: "Investments & Wealth",
    keywords: [
      "zerodha", "groww", "upstox", "angel one", "kite", "coin", "kuvera",
      "indmoney", "sip", "mutual fund", "nps", "ppf", "gold", "safegold",
      "mmtc-pamp", "lic", "insurance premium", "acko", "hdfc life", "sbi life",
    ],
  },
];

const SHORT_BOUNDARY_WORDS = new Set([
  "tea", "bar", "pub", "cab", "bus", "gym", "gas", "pg", "sip", "nps", "ppf",
  "lic", "aws", "jio", "pvr", "oyo", "lpg", "dth", "shop", "bar", "oil",
]);

function matchesKeyword(lowerText: string, kw: string): boolean {
  if (SHORT_BOUNDARY_WORDS.has(kw) || (!kw.includes(" ") && kw.length <= 4)) {
    return new RegExp(`\\b${escapeRegExp(kw)}\\b`, "i").test(lowerText);
  }
  return lowerText.includes(kw);
}

export function inferExpenseCategory(text: string): string {
  const lower = (text || "").toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((kw) => matchesKeyword(lower, kw))) {
      return rule.category;
    }
  }
  return "Other & Contingency";
}

function parseSmsDate(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const clean = raw.trim();
  const months: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };
  const dMonY = clean.match(/\b(\d{1,2})[-/\s]([a-zA-Z]{3,9})[-/\s](\d{2,4})\b/);
  if (dMonY) {
    const day = dMonY[1].padStart(2, "0");
    const mon = months[dMonY[2].slice(0, 3).toLowerCase()];
    const yr = dMonY[3].length === 2 ? `20${dMonY[3]}` : dMonY[3];
    if (mon) return `${yr}-${mon}-${day}`;
  }
  const dmy = clean.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);
  if (dmy) {
    const day = dmy[1].padStart(2, "0");
    const mon = dmy[2].padStart(2, "0");
    const yr = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    if (Number(mon) >= 1 && Number(mon) <= 12 && Number(day) >= 1 && Number(day) <= 31) {
      return `${yr}-${mon}-${day}`;
    }
  }
  const iso = clean.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return iso[0];
  return undefined;
}

function cleanMerchantSegment(raw: string): string {
  let s = raw
    .replace(/\b(?:on|at|dated?)\s+\d{1,2}[-/ ](?:[a-zA-Z]{3,9}|\d{1,2})[-/ ]\d{2,4}.*$/i, "")
    .replace(/\b(?:avl|available|clear|closing)?\s*bal(?:ance)?[:\s].*$/i, "")
    .replace(/\b(?:upi\s*)?(?:ref(?:\s*no)?|utr|rrn|txn\s*id)[:\s#-].*$/i, "")
    .replace(/\bnot\s+you\b.*$/i, "")
    .replace(/\((?:upi|imps|neft|card)[^)]*\)/gi, "")
    .trim();

  // Check if merchant segment contains a VPA handle e.g. swiggy@icici
  const vpaMatch = s.match(/([a-zA-Z0-9._-]+)@[a-zA-Z0-9]+/);
  if (vpaMatch) {
    const handle = vpaMatch[1].toLowerCase().replace(/[^a-z0-9]/g, "");
    for (const [k, brand] of Object.entries(KNOWN_VPA_MERCHANTS)) {
      if (handle === k || handle.startsWith(k)) {
        return brand;
      }
    }
    const readableHandle = vpaMatch[1].replace(/[._-]+/g, " ").trim();
    if (readableHandle.length >= 2 && !/^\d+$/.test(readableHandle)) {
      return readableHandle.replace(/\b\w/g, (c) => c.toUpperCase());
    }
  }

  // Handle UPI/P2M/123456789012/SWIGGY/... or UPI-SWIGGY-...
  const upiSlash = s.match(/UPI\/(?:P2M|P2P|DR|CR)\/\d{6,16}\/([^/\s]+)/i);
  if (upiSlash && upiSlash[1]) {
    s = upiSlash[1];
  } else {
    const upiDash = s.match(/UPI[-/]([A-Za-z][A-Za-z0-9\s]{2,25})(?:[-/]|$)/i);
    if (upiDash && upiDash[1]) {
      s = upiDash[1];
    }
  }

  s = s.replace(/[.,;:!?-]+$/g, "").trim();
  if (!s) return "";
  return s
    .split(/\s+/)
    .map((w) => (w.length <= 3 && w === w.toUpperCase() ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ");
}

function detectChannel(text: string): ParsedExpense["channel"] {
  const lower = text.toLowerCase();
  if (/\bupi\b|@[a-z]+/i.test(lower)) return "UPI";
  if (/\batm\b|withdrawn/i.test(lower)) return "ATM";
  if (/\b(?:credit\s*card|debit\s*card|pos)\b|\bcard\s+(?:xx+\d*|\*+\d*|no\.?|ending|\d{4})\b/i.test(lower)) {
    return "CARD";
  }
  if (/\b(?:neft|imps|rtgs|netbanking)\b/i.test(lower)) return "NETBANKING";
  if (/\bcash\b/i.test(lower)) return "CASH";
  return "OTHER";
}

function detectAccountQueryFromText(
  text: string,
  knownAccounts: AccountSummary[],
  channelHint?: ParsedExpense["channel"]
): string | undefined {
  const clean = text;
  const lower = clean.toLowerCase();

  // 1. Account / card last 4 digits: ending 1234, XX1234, **1234, A/c X5678, Card 9012
  const digitMatches = Array.from(
    clean.matchAll(/(?:ending(?:\s+with)?|a\/c(?:\s*no\.?)?|acct?|card(?:\s*no\.?)?|xx+|\*+|x)\s*[:-]*\s*[xX*]*(\d{4})\b/gi)
  );
  for (const m of digitMatches) {
    const digits = m[1];
    const matched = knownAccounts.find((a) => a.last_four && a.last_four === digits);
    if (matched) return matched.name;
  }

  // 2. Card vs Bank disambiguation along with brand name
  const prefersCard = channelHint === "CARD" || /\bcard\b/i.test(clean);
  let bestAcc: AccountSummary | undefined;
  let bestScore = 0;

  for (const acc of knownAccounts) {
    const accLower = acc.name.toLowerCase();
    let score = 0;

    // Explicit bank or account word match
    const words = accLower
      .split(/\s+/)
      .filter((w) => w.length >= 2 && !ACCOUNT_STOP_WORDS.has(w));
    for (const w of words) {
      if (new RegExp(`\\b${escapeRegExp(w)}\\b`, "i").test(lower)) {
        score += 30;
      }
    }

    if (score > 0) {
      const isCardAcc = /card/i.test(acc.type) || /card/i.test(acc.name);
      if (prefersCard && isCardAcc) score += 20;
      if (!prefersCard && !isCardAcc) score += 10;
      if (score > bestScore) {
        bestScore = score;
        bestAcc = acc;
      }
    }
  }
  if (bestAcc) return bestAcc.name;

  // 3. Fallback: literal account name or known bank token
  const literalMatch = knownAccounts.find((a) => new RegExp(`\\b${escapeRegExp(a.name)}\\b`, "i").test(clean));
  if (literalMatch) return literalMatch.name;

  for (const bank of KNOWN_BANK_NAMES) {
    if (new RegExp(`\\b${escapeRegExp(bank)}\\b`, "i").test(lower)) {
      return bank.toUpperCase();
    }
  }

  return undefined;
}

/**
 * Parses natural language, iOS Shortcuts, Telegram/WhatsApp chat, and Indian bank SMS alerts.
 */
export function parseExpenseMessage(text: string, knownAccounts: AccountSummary[] = []): ParsedExpense {
  const clean = (text || "").trim().replace(/\s+/g, " ");
  if (!clean) {
    return {
      amount: 0,
      title: "",
      category: "Other & Contingency",
      rawText: "",
    };
  }

  const channel = detectChannel(clean);
  const parsedDate = parseSmsDate(clean);
  const refMatch =
    clean.match(/\b(?:upi\s*)?(?:ref(?:\s*no)?|utr|rrn)[:\s#-]*([A-Za-z0-9]{6,22})\b/i) ||
    clean.match(/\bUPI\/(?:P2M|P2P|DR|CR)\/([0-9]{8,16})\b/i);
  const reference = refMatch?.[1];

  let amount = 0;
  let title = "";
  let matchedAccountQuery = detectAccountQueryFromText(clean, knownAccounts, channel);

  const isDebitSMS =
    /(?:debited|spent|paid|sent|withdrawn|charged|purchase\s+of|txn\s+of)/i.test(clean) &&
    /(?:a\/c|ac\b|acct|account|card|upi|vpa|rs\.?|inr|₹|avl\s*bal|bal\b)/i.test(clean);

  if (isDebitSMS) {
    // Extract exact debited/spent amount (never Avl Bal)
    const smsAmtRe = new RegExp(
      `(?:debited(?:\\s+(?:by|with|for|of))?|spent|paid|sent|withdrawn|charged|purchase\\s+of|txn\\s+of)\\s*(?:rs\\.?|inr|₹)?\\s*(${INDIAN_NUMBER_PATTERN})`,
      "i"
    );
    const prefixBeforeVerbAmtRe = new RegExp(
      `(?:rs\\.?|inr|₹)\\s*(${INDIAN_NUMBER_PATTERN})\\s+(?:has\\s+been\\s+|was\\s+)?(?:debited|spent|paid|sent|withdrawn|charged)`,
      "i"
    );

    const mVerb = clean.match(smsAmtRe);
    const mPre = clean.match(prefixBeforeVerbAmtRe);
    if (mVerb) {
      amount = parseFormattedNumber(mVerb[1]);
    } else if (mPre) {
      amount = parseFormattedNumber(mPre[1]);
    }

    if (amount <= 0) {
      // Strip Avl Bal tail before falling back to currency extraction
      const withoutBal = clean.replace(/\b(?:avl|available|clear|closing)?\s*bal(?:ance)?[:\s].*$/i, "");
      amount = extractAmountFromText(withoutBal).amount;
    }

    // Merchant extraction patterns for Indian bank SMS
    const merchantRe =
      /(?:\b(?:at|to|towards|for|merchant)\b|info[:\s-]+|vpa\s+)\s*([A-Za-z0-9@._*&/ -]{2,65}?)(?=\s+(?:on\s+\d|via\s+|from\s+|using\s+|avl\s*bal|bal\b|\(?(?:ref|upi\s*ref|utr|rrn)\b|not\s+you|$)|[.;]|$)/i;
    const mMerch = clean.match(merchantRe);
    if (mMerch && mMerch[1]) {
      const cleaned = cleanMerchantSegment(mMerch[1]);
      if (cleaned && !/^(?:your|a\/c|account|card|upi)$/i.test(cleaned)) {
        title = cleaned;
      }
    }

    // Also inspect VPA handles anywhere in the SMS if merchant wasn't clean
    if (!title) {
      const vpaFallback = clean.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9]+)/);
      if (vpaFallback) {
        title = cleanMerchantSegment(vpaFallback[1]);
      }
    }
  } else {
    // Conversational / natural input: "Dinner 750 HDFC", "1,25,000 laptop SBI", "Spent 350 for lunch on HDFC"
    const withoutBal = clean.replace(/\b(?:avl|available)?\s*bal(?:ance)?[:\s].*$/i, "");
    const extracted = extractAmountFromText(withoutBal);
    amount = extracted.amount;
  }

  // Title fallback for conversational text or SMS without explicit "at MERCHANT"
  let cleanTitle = title;
  if (!cleanTitle) {
    let working = clean
      .replace(/\b(?:avl|available|clear|closing)?\s*bal(?:ance)?[:\s].*$/i, "")
      .replace(/\b(?:upi\s*)?(?:ref(?:\s*no)?|utr|rrn)[:\s#-]*[A-Za-z0-9]{6,22}\b/gi, "");

    // Strip amount tokens
    const amtStripRe = new RegExp(
      `(?:₹|rs\\.?|inr)?\\s*${INDIAN_NUMBER_PATTERN}\\s*(?:₹|rs\\.?|inr|rupees|/-|k|thousand|lac|lacs|lakh|lakhs|cr|crore|crores|l)?\\b`,
      "gi"
    );
    working = working.replace(amtStripRe, " ");

    // Strip account indicator phrases & dates
    working = working
      .replace(/\b(?:on|via|using|with|from|to|in)\s+(?:my\s+)?[a-zA-Z0-9\s]+(?:bank|account|card|a\/c|cash)\b/gi, " ")
      .replace(/\bending(?:\s+with)?\s+[xX*]?\d{4}\b/gi, " ")
      .replace(/\b(?:xx+|\*+|a\/c\s*no\.?)\s*\d{4,}\b/gi, " ")
      .replace(/\b\d{1,2}[/-](?:[a-zA-Z]{3,9}|\d{1,2})[/-]\d{2,4}\b/g, " ");

    if (matchedAccountQuery) {
      for (const word of matchedAccountQuery.split(/\s+/)) {
        if (word.length >= 2) {
          working = working.replace(new RegExp(`\\b${escapeRegExp(word)}\\b`, "gi"), " ");
        }
      }
    }

    for (const acc of knownAccounts) {
      const bankWords = acc.name
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length >= 3 && !ACCOUNT_STOP_WORDS.has(w));
      for (const bw of bankWords) {
        working = working.replace(new RegExp(`\\b${escapeRegExp(bw)}\\b`, "gi"), " ");
      }
      if (acc.last_four) {
        working = working.replace(new RegExp(`\\b${escapeRegExp(acc.last_four)}\\b`, "gi"), " ");
      }
    }

    for (const bank of KNOWN_BANK_NAMES) {
      working = working.replace(new RegExp(`\\b${escapeRegExp(bank)}\\b`, "gi"), " ");
    }

    const words = working
      .replace(/[^\w\s&@'-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 0 && !STOP_WORDS.has(w.toLowerCase()) && !/^\d+$/.test(w));

    cleanTitle = words.join(" ").trim();
  }

  const category = inferExpenseCategory(`${cleanTitle} ${clean}`);

  if (!cleanTitle) {
    cleanTitle = category === "Other & Contingency" ? "Expense" : `${category.split(" ")[0]} Expense`;
  } else if (cleanTitle.length > 0) {
    cleanTitle = cleanMerchantSegment(cleanTitle) || cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
  }

  // Re-evaluate matchedAccountQuery cleanly if account had explicit name tokens stripped
  if (!matchedAccountQuery) {
    matchedAccountQuery = detectAccountQueryFromText(clean, knownAccounts, channel);
  }

  return {
    amount: Number.isNaN(amount) || !Number.isFinite(amount) ? 0 : Number(amount.toFixed(2)),
    title: cleanTitle,
    category,
    accountQuery: matchedAccountQuery,
    rawText: clean,
    ...(reference ? { reference } : {}),
    ...(parsedDate ? { parsedDate } : {}),
    ...(channel && channel !== "OTHER" ? { channel } : {}),
  };
}

/**
 * Scores and matches a parsed account query against user's accounts.
 * Gracefully falls back to Cash or first active account if no signal matches.
 */
export function matchAccount(
  query: string | undefined,
  accounts: AccountSummary[]
): AccountSummary | undefined {
  if (!accounts || accounts.length === 0) return undefined;

  const cashFallback = () =>
    accounts.find((a) => a.name.toLowerCase().includes("cash") || a.type.toLowerCase().includes("cash")) ||
    accounts[0];

  if (!query || !query.trim()) {
    return cashFallback();
  }

  const q = query.toLowerCase().trim();
  const prefersCard = /\b(?:card|cc)\b/i.test(q);
  const prefersBank = /\b(?:savings|current|salary|bank|a\/c)\b/i.test(q);

  let best: AccountSummary | undefined;
  let bestScore = 0;

  for (const acc of accounts) {
    const nameLower = acc.name.toLowerCase();
    const typeLower = acc.type.toLowerCase();
    const isCard = typeLower.includes("card") || nameLower.includes("card");
    let score = 0;

    if (nameLower === q) score += 100;
    if (acc.last_four && acc.last_four.toLowerCase() === q) score += 90;
    if (nameLower.includes(q) || q.includes(nameLower)) score += 60;

    const words = nameLower
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !ACCOUNT_STOP_WORDS.has(w));
    for (const w of words) {
      if (new RegExp(`\\b${escapeRegExp(w)}\\b`, "i").test(q) || w === q) {
        score += 35;
      } else if (q.includes(w) || w.includes(q)) {
        score += 20;
      }
    }

    if (q.includes("cash") && (nameLower.includes("cash") || typeLower.includes("cash"))) {
      score += 45;
    }

    if (score > 0) {
      if (prefersCard && isCard) score += 20;
      if (prefersBank && !isCard) score += 15;
      if (score > bestScore) {
        bestScore = score;
        best = acc;
      }
    }
  }

  return best || cashFallback();
}
