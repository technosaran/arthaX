export interface ParsedExpense {
  amount: number;
  title: string;
  category: string;
  accountQuery?: string;
  notes?: string;
  rawText: string;
}

export interface AccountSummary {
  id: string;
  name: string;
  type: string;
  balance: number;
  last_four?: string | null;
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "Food & Dining": [
    "food", "dining", "dinner", "lunch", "breakfast", "brunch", "snack", "snacks",
    "cafe", "coffee", "tea", "chai", "boba", "starbucks", "swiggy", "zomato", "restaurant",
    "pizza", "burger", "subway", "mcdonalds", "kfc", "dominos", "eat", "meal",
    "biryani", "dhaba", "canteen", "bakery", "pastry", "bar", "pub", "beer", "liquor"
  ],
  "Groceries & Essentials": [
    "grocery", "groceries", "blinkit", "zepto", "instamart", "bigbasket", "supermarket",
    "vegetable", "vegetables", "fruits", "milk", "dairy", "bread", "ration", "kirana", "provisions"
  ],
  "Transport & Fuel": [
    "fuel", "petrol", "diesel", "cng", "gas", "uber", "ola", "rapido", "namma yatri",
    "taxi", "cab", "auto", "metro", "bus", "train", "flight", "toll", "fastag", "parking",
    "irctc", "indigo", "air india"
  ],
  "Utilities & Bills": [
    "bill", "electricity", "water", "wifi", "broadband", "internet",
    "mobile", "recharge", "airtel", "jio", "vi", "dth", "cylinder", "piped gas", "lpg"
  ],
  "Housing & Rent": [
    "rent", "house rent", "flat rent", "landlord", "maintenance", "society", "pg", "hostel"
  ],
  "Shopping & Lifestyle": [
    "shopping", "amazon", "flipkart", "myntra", "ajio", "meesho", "zara", "h&m",
    "clothes", "shoes", "bag", "mall", "market", "dress", "fashion"
  ],
  "Electronics & Gadgets": [
    "gadget", "electronics", "laptop", "phone", "mobile", "charger",
    "headphones", "earbuds", "apple", "samsung", "croma", "reliance digital"
  ],
  "Health & Medical": [
    "doctor", "hospital", "clinic", "medicine", "medicines", "meds", "pharmacy", "apollo",
    "1mg", "medplus", "dental", "dentist", "checkup", "blood test", "lab", "diagnostic"
  ],
  "Fitness & Sports": [
    "gym", "fitness", "workout", "protein", "creatine", "supplement", "badminton", "turf", "cult"
  ],
  "Entertainment & OTT": [
    "movie", "cinema", "theatre", "pvr", "inox", "bookmyshow",
    "netflix", "prime", "hotstar", "spotify", "youtube", "concert", "game", "gaming"
  ],
  "Subscriptions & SaaS": [
    "subscription", "saas", "chatgpt", "openai", "claude", "github", "cursor", "icloud", "google one", "canva"
  ],
  "Personal Care & Grooming": [
    "salon", "haircut", "spa", "parlour", "shave", "grooming", "barber"
  ],
  "Education & Learning": [
    "course", "udemy", "coursera", "book", "books", "tuition", "school", "college", "fees", "exam"
  ],
  "Vehicle & Servicing": [
    "servicing", "service", "bike service", "car wash", "tyre", "puncture", "mechanic"
  ],
  "Investments & Wealth": [
    "sip", "mutual fund", "stocks", "zerodha", "groww", "investment", "gold", "crypto"
  ],
  "Gifts & Celebrations": [
    "gift", "birthday", "anniversary", "party", "celebration", "treat"
  ],
};

// Generic stop words to never treat as standalone account name keywords
const ACCOUNT_STOP_WORDS = new Set([
  "bank", "account", "ac", "a/c", "card", "hand", "the", "and", "for", "with", "from", "in", "of", "to", "my", "our"
]);

/**
 * Intelligent parser that extracts amount, account, category, and title from chat messages,
 * voice shortcuts, and bank SMS debit alerts.
 */
export function parseExpenseMessage(text: string, knownAccounts: AccountSummary[] = []): ParsedExpense {
  const clean = text.trim();
  let remainingText = clean;
  let amount = 0;
  let matchedAccountQuery: string | undefined;

  // -------------------------------------------------------------
  // Step 1: Detect Bank / UPI Debit SMS
  // E.g.: "Dear SBI User, your A/c ending 1234 debited by Rs. 240.00 on 11-Nov-26 for Swiggy"
  // E.g.: "Sent Rs.500.00 from HDFC Bank A/C **5678 to ZOMATO via UPI"
  // -------------------------------------------------------------
  const isDebitSMS = /(?:debited|spent|paid|sent|withdrawn)/i.test(clean) && /(?:a\/c|account|card|upi|rs\.?|inr|₹)/i.test(clean);

  if (isDebitSMS) {
    // 1A. Debit amount pattern
    const smsAmountRegex = /(?:debited (?:by|with|for)?|spent|paid|sent|withdrawn)\s*(?:rs\.?|inr|₹)?\s*([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)/i;
    const smsAmountMatch = clean.match(smsAmountRegex);

    if (smsAmountMatch) {
      amount = parseFloat(smsAmountMatch[1].replace(/,/g, ""));
      remainingText = remainingText.replace(smsAmountMatch[0], " ");
    }

    // 1B. Account last four in SMS: e.g. "ending 1234", "**1234", "A/C ...1234"
    const lastFourMatch = clean.match(/(?:ending|a\/c|ac|card)[^\d]*(\d{4})/i);
    if (lastFourMatch) {
      const l4 = lastFourMatch[1];
      const acc = knownAccounts.find((a) => a.last_four && a.last_four === l4);
      if (acc) {
        matchedAccountQuery = acc.name;
      } else {
        matchedAccountQuery = l4;
      }
      remainingText = remainingText.replace(lastFourMatch[0], " ");
    }

    // 1C. Merchant in SMS: e.g. "to ZOMATO", "for Swiggy", "at Starbucks"
    const merchantMatch = clean.match(/(?:to|for|at)\s+(?:UPI\/)?([A-Za-z0-9 &._-]+?)(?:\s+(?:on|via|ref|bal|available|\.)|$)/i);
    if (merchantMatch && merchantMatch[1]) {
      const candidateMerchant = merchantMatch[1].trim();
      if (candidateMerchant.length > 2 && !/^(the|a|an|my)$/i.test(candidateMerchant)) {
        remainingText = candidateMerchant;
      }
    }
  }

  // -------------------------------------------------------------
  // Step 2: Extract Amount for Standard Chat / Voice Shortcuts
  // -------------------------------------------------------------
  if (amount <= 0) {
    // 2A. Check multiplier format: "2k", "1.5k", "10k"
    const kMatch = remainingText.match(/(?:^|\s)(?:₹|rs\.?|inr)?\s*([0-9]+(?:\.[0-9]+)?)\s*k\b/i);
    if (kMatch) {
      amount = parseFloat(kMatch[1]) * 1000;
      remainingText = remainingText.replace(kMatch[0], " ").trim();
    }
  }

  if (amount <= 0) {
    // 2B. Currency explicitly prefixed or suffixed: ₹500, Rs. 500, 500 rs, 500/-, 500 inr
    const explicitCurrencyRegex = /(?:₹|rs\.?|inr)\s*([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)|\b([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)\s*(?:₹|rs\.?|inr|rupees|\/-)/i;
    const explicitMatch = remainingText.match(explicitCurrencyRegex);

    if (explicitMatch) {
      const rawNum = (explicitMatch[1] || explicitMatch[2]).replace(/,/g, "");
      amount = parseFloat(rawNum);
      remainingText = remainingText.replace(explicitMatch[0], " ").trim();
    }
  }

  if (amount <= 0) {
    // 2C. Standalone number that is NOT a time (8pm, 8:30), ordinal (1st, 2nd, 11th), or 4-digit year (2026)
    // Find all standalone numbers and select the one most likely to be an amount
    const genericNumberRegex = /\b([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)\b/g;
    let match: RegExpExecArray | null;

    while ((match = genericNumberRegex.exec(remainingText)) !== null) {
      const rawNum = match[1].replace(/,/g, "");
      const numVal = parseFloat(rawNum);
      const matchIndex = match.index;
      const matchLen = match[0].length;
      const afterText = remainingText.slice(matchIndex + matchLen, matchIndex + matchLen + 6).toLowerCase();
      const beforeText = remainingText.slice(Math.max(0, matchIndex - 6), matchIndex).toLowerCase();

      // Guard against time: 8pm, 8 am, 10:30
      if (/^\s*(?:am|pm|hrs?|mins?)\b/i.test(afterText) || /(?:at|by)\s*$/i.test(beforeText)) {
        continue;
      }
      // Guard against ordinals: 1st, 2nd, 3rd, 11th
      if (/^\s*(?:st|nd|rd|th)\b/i.test(afterText)) {
        continue;
      }
      // Guard against years (e.g. 2025, 2026)
      if (numVal >= 2020 && numVal <= 2035 && rawNum.length === 4) {
        continue;
      }

      // Valid amount candidate found
      amount = numVal;
      remainingText =
        remainingText.slice(0, matchIndex) + " " + remainingText.slice(matchIndex + matchLen);
      break;
    }
  }

  // -------------------------------------------------------------
  // Step 3: Match Account if not already extracted from SMS
  // -------------------------------------------------------------
  if (!matchedAccountQuery && knownAccounts.length > 0) {
    for (const acc of knownAccounts) {
      const accNameClean = acc.name.toLowerCase();
      const lastFour = acc.last_four;

      // Check last four explicitly
      if (lastFour && new RegExp(`\\b${lastFour}\\b`, "i").test(remainingText)) {
        matchedAccountQuery = acc.name;
        remainingText = remainingText.replace(new RegExp(`\\b${lastFour}\\b`, "i"), " ");
        break;
      }

      // Check full account name
      if (new RegExp(`\\b${accNameClean}\\b`, "i").test(remainingText)) {
        matchedAccountQuery = acc.name;
        remainingText = remainingText.replace(new RegExp(`\\b${accNameClean}\\b`, "i"), " ");
        break;
      }

      // Check distinctive brand words (excluding stop words like 'bank', 'hand', 'card')
      const distinctWords = accNameClean
        .split(/\s+/)
        .map((w) => w.replace(/[^a-z0-9]/g, ""))
        .filter((w) => w.length >= 3 && !ACCOUNT_STOP_WORDS.has(w));

      for (const word of distinctWords) {
        const wordRegex = new RegExp(`\\b${word}\\b`, "i");
        if (wordRegex.test(remainingText)) {
          matchedAccountQuery = acc.name;
          remainingText = remainingText.replace(wordRegex, " ");
          break;
        }
      }

      if (matchedAccountQuery) break;
    }
  }

  // Fallback common account keywords
  if (!matchedAccountQuery) {
    const commonAccountKeywords = [
      "cash", "hdfc", "sbi", "icici", "axis", "kotak", "pnb", "bob", "paytm",
      "gpay", "phonepe", "cred", "wallet", "credit card", "debit card"
    ];
    for (const ca of commonAccountKeywords) {
      const reg = new RegExp(`\\b${ca}\\b`, "i");
      if (reg.test(remainingText)) {
        matchedAccountQuery = ca;
        remainingText = remainingText.replace(reg, " ");
        break;
      }
    }
  }

  // -------------------------------------------------------------
  // Step 4: Determine Category by Keywords
  // -------------------------------------------------------------
  let category = "Shopping & Lifestyle";
  const lowerText = clean.toLowerCase();

  for (const [catName, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      const kwRegex = new RegExp(`\\b${kw}\\b`, "i");
      if (kwRegex.test(lowerText)) {
        category = catName;
        break;
      }
    }
    if (category !== "Shopping & Lifestyle") break;
  }

  // -------------------------------------------------------------
  // Step 5: Clean Title
  // -------------------------------------------------------------
  // Remove filler phrases and symbols
  let cleanTitle = remainingText
    .replace(/\b(spent|paid|for|on|from|in|at|using|via|through|log|record|add|expense|rs|inr|rupees|amount|rupee|card|account|ac|a\/c|balance|bal|upi)\b/gi, " ")
    .replace(/[/\-_:;,*#~`!?"'()[\]{}]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // If clean title is empty or only 1 character, default to Category or known merchant
  if (cleanTitle.length <= 1) {
    cleanTitle = category;
  } else {
    // Capitalize first letter
    cleanTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
  }

  return {
    amount: Number(amount.toFixed(2)),
    title: cleanTitle,
    category,
    accountQuery: matchedAccountQuery,
    rawText: clean,
  };
}

/**
 * Match parsed account query to the user's actual accounts list.
 * Gracefully defaults to Cash or first active account if unassigned.
 */
export function matchAccount(
  query: string | undefined,
  accounts: AccountSummary[]
): AccountSummary | undefined {
  if (!accounts || accounts.length === 0) return undefined;

  if (!query || !query.trim()) {
    // Default to Cash in Hand or first account
    return accounts.find((a) => a.name.toLowerCase().includes("cash") || a.type.toLowerCase().includes("cash")) || accounts[0];
  }

  const q = query.toLowerCase().trim();

  // 1. Exact match on account name
  const exact = accounts.find((a) => a.name.toLowerCase() === q);
  if (exact) return exact;

  // 2. Last four match
  const last4 = accounts.find((a) => a.last_four && a.last_four.toLowerCase() === q);
  if (last4) return last4;

  // 3. Substring match
  const partial = accounts.find((a) => a.name.toLowerCase().includes(q) || q.includes(a.name.toLowerCase()));
  if (partial) return partial;

  // 4. Distinctive brand word match
  const brandMatch = accounts.find((a) => {
    const words = a.name
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !ACCOUNT_STOP_WORDS.has(w));
    return words.some((w) => q.includes(w) || w.includes(q));
  });
  if (brandMatch) return brandMatch;

  // 5. If query was "cash", prioritize cash account
  if (q.includes("cash")) {
    const cashAcc = accounts.find((a) => a.name.toLowerCase().includes("cash") || a.type.toLowerCase().includes("cash"));
    if (cashAcc) return cashAcc;
  }

  // Fallback to Cash or first account
  return accounts.find((a) => a.name.toLowerCase().includes("cash")) || accounts[0];
}
