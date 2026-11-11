export interface ParsedExpense {
  amount: number;
  title: string;
  category: string;
  accountQuery?: string;
  notes?: string;
  rawText: string;
}

interface AccountSummary {
  id: string;
  name: string;
  type: string;
  balance: number;
  last_four?: string | null;
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "Food & Dining": [
    "food", "dining", "dinner", "lunch", "breakfast", "brunch", "snack",
    "cafe", "coffee", "tea", "starbucks", "swiggy", "zomato", "restaurant",
    "pizza", "burger", "subway", "mcdonalds", "kfc", "dominos", "eat", "meal"
  ],
  "Groceries & Essentials": [
    "grocery", "groceries", "blinkit", "zepto", "instamart", "supermarket",
    "vegetable", "vegetables", "fruits", "milk", "dairy", "bread", "ration"
  ],
  "Transport & Fuel": [
    "fuel", "petrol", "diesel", "cng", "gas", "uber", "ola", "rapido",
    "taxi", "cab", "auto", "metro", "bus", "train", "flight", "toll", "parking"
  ],
  "Utilities & Bills": [
    "bill", "electricity", "water", "wifi", "broadband", "internet",
    "mobile", "recharge", "airtel", "jio", "vi", "dth", "cylinder", "piped gas"
  ],
  "Housing & Rent": [
    "rent", "house rent", "flat rent", "landlord", "maintenance", "society"
  ],
  "Shopping & Lifestyle": [
    "shopping", "amazon", "flipkart", "myntra", "ajio", "zara", "h&m",
    "clothes", "shoes", "bag", "mall", "market", "dress"
  ],
  "Electronics & Gadgets": [
    "gadget", "electronics", "laptop", "phone", "mobile", "charger",
    "headphones", "earbuds", "apple", "samsung", "croma", "reliance digital"
  ],
  "Health & Medical": [
    "doctor", "hospital", "clinic", "medicine", "medicines", "meds", "pharmacy", "apollo",
    "1mg", "medplus", "dental", "dentist", "checkup", "blood test", "lab"
  ],
  "Fitness & Sports": [
    "gym", "fitness", "workout", "protein", "creatine", "supplement", "badminton", "turf"
  ],
  "Entertainment & OTT": [
    "movie", "cinema", "theatre", "pvr", "inox", "bookmyshow",
    "netflix", "prime", "hotstar", "spotify", "youtube", "concert", "game", "gaming"
  ],
  "Subscriptions & SaaS": [
    "subscription", "saas", "chatgpt", "openai", "github", "cursor", "icloud", "google one"
  ],
  "Personal Care & Grooming": [
    "salon", "haircut", "spa", "parlour", "shave", "grooming", "barber"
  ],
  "Education & Learning": [
    "course", "udemy", "coursera", "book", "books", "tuition", "school", "college", "fees"
  ],
  "Vehicle & Servicing": [
    "servicing", "service", "bike service", "car wash", "tyre", "puncture", "mechanic"
  ],
  "Investments & Wealth": [
    "sip", "mutual fund", "stocks", "zerodha", "groww", "investment", "gold"
  ],
  "Gifts & Celebrations": [
    "gift", "birthday", "anniversary", "party", "celebration", "treat"
  ],
};

/**
 * Intelligent parser that extracts amount, account, category, and title from chat messages.
 * Examples:
 *   "500 dinner hdfc"
 *   "spent 250 on groceries cash"
 *   "Petrol 1200 icici"
 *   "swiggy 420 axis bank"
 *   "uber 350"
 */
export function parseExpenseMessage(text: string, knownAccounts: AccountSummary[] = []): ParsedExpense {
  const clean = text.trim();
  let remainingText = clean;

  // 1. Extract Amount: handles ₹500, Rs. 500, 500.00, 1500, 1,500
  let amount = 0;
  const amountRegex = /(?:₹|rs\.?|inr)?\s*([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|\.[0-9]{1,2})\b/i;
  const amountMatch = remainingText.match(amountRegex);

  if (amountMatch) {
    const rawNum = amountMatch[1].replace(/,/g, "");
    amount = parseFloat(rawNum);
    remainingText = remainingText.replace(amountMatch[0], " ").trim();
  }

  // Clean common filler words
  remainingText = remainingText
    .replace(/\b(spent|paid|for|on|from|in|at|using|via|through|log|record|add|expense|rs|inr|rupees|amount|rupee)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  // 2. Identify Account
  let matchedAccountQuery: string | undefined;
  if (knownAccounts.length > 0) {
    for (const acc of knownAccounts) {
      const accNameClean = acc.name.toLowerCase();
      const lastFour = acc.last_four;
      
      // Check full name or individual significant words (e.g. "hdfc", "sbi", "cash", "axis")
      const words = accNameClean.split(/\s+/).filter((w) => w.length >= 3);
      const candidates = [accNameClean, ...words];
      if (lastFour) candidates.push(lastFour);

      for (const cand of candidates) {
        const wordRegex = new RegExp(`\\b${cand}\\b`, "i");
        if (wordRegex.test(remainingText)) {
          matchedAccountQuery = acc.name;
          remainingText = remainingText.replace(wordRegex, " ").trim();
          break;
        }
      }
      if (matchedAccountQuery) break;
    }
  }

  // Fallback check for common account terms if not matched yet
  if (!matchedAccountQuery) {
    const commonAccounts = ["cash", "credit card", "debit card", "hdfc", "sbi", "icici", "axis", "kotak", "paytm", "gpay", "wallet"];
    for (const ca of commonAccounts) {
      const reg = new RegExp(`\\b${ca}\\b`, "i");
      if (reg.test(remainingText)) {
        matchedAccountQuery = ca;
        remainingText = remainingText.replace(reg, " ").trim();
        break;
      }
    }
  }

  // 3. Determine Category by keywords
  let category = "Shopping & Lifestyle";
  const lowerRemaining = remainingText.toLowerCase();

  for (const [catName, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      const kwRegex = new RegExp(`\\b${kw}\\b`, "i");
      if (kwRegex.test(lowerRemaining)) {
        category = catName;
        break;
      }
    }
    if (category !== "Shopping & Lifestyle") break;
  }

  // 4. Determine Title
  const cleanTitle = remainingText
    .replace(/\b(card|account|ac|a\/c)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const title = cleanTitle.length > 0
    ? cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1)
    : category;

  return {
    amount,
    title,
    category,
    accountQuery: matchedAccountQuery,
    rawText: clean,
  };
}

/**
 * Match parsed account query to the user's actual accounts list
 */
export function matchAccount(
  query: string | undefined,
  accounts: AccountSummary[]
): AccountSummary | undefined {
  if (!accounts || accounts.length === 0) return undefined;
  if (!query) {
    // Default to Cash or first active account if no account specified
    return accounts.find((a) => a.name.toLowerCase().includes("cash")) || accounts[0];
  }

  const q = query.toLowerCase().trim();
  // Exact match
  const exact = accounts.find((a) => a.name.toLowerCase() === q);
  if (exact) return exact;

  // Substring match
  const partial = accounts.find((a) => a.name.toLowerCase().includes(q));
  if (partial) return partial;

  // Last four match
  const last4 = accounts.find((a) => a.last_four && a.last_four === q);
  if (last4) return last4;

  return accounts[0];
}
