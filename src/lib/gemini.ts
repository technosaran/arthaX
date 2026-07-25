/**
 * Native Google Gemini API integration for FinanceOS & Telegram Bot
 * Connects directly to Google Generative AI REST API with zero external npm dependencies.
 * Provides graceful fallback if API Key is missing, disabled, or fails.
 */

export interface GeminiParsedIntent {
  success: boolean;
  intentType: "expense" | "income" | "transfer" | "stock" | "mutual_fund" | "inquiry" | "unknown";
  amount: number | null;
  category: string;
  description: string;
  accountName: string | null;
  symbol?: string | null;
  quantity?: number | null;
  price?: number | null;
  fundName?: string | null;
  answer?: string;
  error?: string;
}

/**
 * Check if Gemini AI is enabled and configured for a user profile
 */
export function isGeminiActiveForProfile(profile: any): boolean {
  if (!profile) return false;
  if (profile.gemini_enabled === false) return false;
  const key = profile.gemini_api_key || process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  return !!key && key.trim().length > 0;
}

/**
 * Get active Gemini API key for a profile (or process.env fallback)
 */
export function getGeminiApiKeyForProfile(profile: any): string | null {
  if (!profile || profile.gemini_enabled === false) return null;
  const key = profile.gemini_api_key || process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  return key?.trim() || null;
}

/**
 * Low-level caller for Google Gemini REST API (gemini-2.5-flash with fallback to gemini-1.5-flash)
 */
export async function callGeminiApi(
  apiKey: string,
  prompt: string,
  systemInstruction?: string
): Promise<string> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    throw new Error("Gemini API key is empty");
  }

  const payload: any = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
  };

  if (systemInstruction) {
    payload.systemInstruction = {
      parts: [{ text: systemInstruction }],
    };
  }

  // Model fallback list for maximum reliability across API keys
  const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
  let responseText = "";
  let lastError = "";

  for (const model of models) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(cleanKey)}`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (candidate) {
          return candidate;
        }
      } else {
        lastError = await res.text();
      }
    } catch (e: any) {
      lastError = e.message || String(e);
    }
  }

  throw new Error(`Gemini API call failed across models: ${lastError}`);
}

/**
 * Intelligent financial text parser powered by Gemini AI
 */
export async function parseTransactionWithGemini(
  text: string,
  apiKey: string
): Promise<GeminiParsedIntent> {
  try {
    const systemPrompt = `You are an expert financial AI parser for FinanceOS. Analyze user text (which may contain typos, slang, hinglish, stock purchases, or mutual fund investments) and extract structured JSON matching this EXACT TypeScript schema:
{
  "intentType": "expense" | "income" | "transfer" | "stock" | "mutual_fund" | "inquiry" | "unknown",
  "amount": number | null,
  "category": "Food" | "Transport" | "Shopping" | "Utilities" | "Entertainment" | "Health" | "Housing" | "Salary" | "Gift" | "Work" | "Investments" | "Other",
  "description": "Short clean description",
  "accountName": "bank/account name if explicitly mentioned or null",
  "symbol": "Stock ticker symbol (e.g. TATAMOTORS, RELIANCE, AAPL, TCS) if applicable or null",
  "quantity": number or null,
  "price": number or null,
  "fundName": "Name of mutual fund if applicable or null"
}
Only output raw JSON without markdown code blocks.`;

    const resultText = await callGeminiApi(apiKey, `Parse this financial text: "${text}"`, systemPrompt);
    const cleanedJson = resultText.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleanedJson);

    return {
      success: true,
      intentType: parsed.intentType || "unknown",
      amount: typeof parsed.amount === "number" && parsed.amount > 0 ? parsed.amount : (parsed.quantity && parsed.price ? parsed.quantity * parsed.price : null),
      category: parsed.category || (parsed.intentType === "stock" || parsed.intentType === "mutual_fund" ? "Investments" : "Other"),
      description: parsed.description || text,
      accountName: parsed.accountName || null,
      symbol: parsed.symbol || null,
      quantity: typeof parsed.quantity === "number" ? parsed.quantity : null,
      price: typeof parsed.price === "number" ? parsed.price : null,
      fundName: parsed.fundName || null,
    };
  } catch (error: any) {
    return {
      success: false,
      intentType: "unknown",
      amount: null,
      category: "Other",
      description: text,
      accountName: null,
      error: error.message || "Failed to parse with Gemini",
    };
  }
}

export interface GeminiAutonomousDecision {
  action: "CREATE_ACCOUNT" | "LOG_EXPENSE" | "LOG_INCOME" | "FAMILY_TRANSFER" | "BUY_STOCK" | "BUY_MUTUAL_FUND" | "TRANSFER_BETWEEN_ACCOUNTS" | "FINANCIAL_QUERY" | "UNKNOWN";
  accountName?: string | null;
  accountType?: "checking" | "savings" | "credit" | "investment" | "cash" | null;
  initialBalance?: number | null;
  amount?: number | null;
  category?: string | null;
  description?: string | null;
  targetAccountName?: string | null;
  fromAccountName?: string | null;
  toAccountName?: string | null;
  familyMemberName?: string | null;
  symbol?: string | null;
  quantity?: number | null;
  price?: number | null;
  fundName?: string | null;
  replyMessage?: string | null;
  reasoning?: string | null;
}

export async function parseAutonomousTelegramIntent(
  text: string,
  userContext: string,
  apiKey: string
): Promise<GeminiAutonomousDecision> {
  try {
    const systemPrompt = `You are the Autonomous Financial AI Engine for FinanceOS & Telegram.
Analyze user natural language messages and autonomously decide what financial action to execute.

User's Live Financial Context (Existing Accounts, Balances, Family):
${userContext}

Respond ONLY with valid JSON matching this schema:
{
  "action": "CREATE_ACCOUNT" | "LOG_EXPENSE" | "LOG_INCOME" | "FAMILY_TRANSFER" | "BUY_STOCK" | "BUY_MUTUAL_FUND" | "TRANSFER_BETWEEN_ACCOUNTS" | "FINANCIAL_QUERY" | "UNKNOWN",
  "accountName": string or null (e.g. "SBI", "HDFC", "ICICI"),
  "accountType": "checking" | "savings" | "credit" | "investment" | "cash" or null (default "checking" for banks),
  "initialBalance": number or null,
  "amount": number or null,
  "category": "Food" | "Transport" | "Shopping" | "Utilities" | "Entertainment" | "Health" | "Housing" | "Salary" | "Gift" | "Work" | "Investments" | "Other" or null,
  "description": string or null,
  "targetAccountName": string or null,
  "fromAccountName": string or null,
  "toAccountName": string or null,
  "familyMemberName": string or null,
  "symbol": string or null,
  "quantity": number or null,
  "price": number or null,
  "fundName": string or null,
  "replyMessage": string or null,
  "reasoning": string or null
}

Action Selection Rules:
1. "CREATE_ACCOUNT": If user asks to create, add, or open a bank/account (e.g. "create account SBI", "add account HDFC 5000", "create account sbi 200"). Extract accountName ("SBI"), accountType ("checking"), initialBalance (e.g. 200 or 0).
2. "LOG_EXPENSE": If user spent money (e.g. "500 Swiggy", "paid 1200 rent").
3. "LOG_INCOME": If user received money (e.g. "50000 salary credited", "got 2000 refund").
4. "FAMILY_TRANSFER": If user transferred money to family (e.g. "sent 1000 to Mom").
5. "BUY_STOCK": If user bought stocks (e.g. "bought 10 shares of SBI at 800").
6. "BUY_MUTUAL_FUND": If user invested in mutual fund (e.g. "invested 5000 in Parag Parikh Flexi Cap").
7. "TRANSFER_BETWEEN_ACCOUNTS": If user transferred between own accounts (e.g. "moved 5000 from HDFC to SBI").
8. "FINANCIAL_QUERY": If user asked a question, for net worth, advice, or summary. Provide friendly concise markdown in "replyMessage".

Output raw JSON with no markdown tags.`;

    const resultText = await callGeminiApi(apiKey, `User message: "${text}"`, systemPrompt);
    const cleanedJson = resultText.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleanedJson);

    return {
      action: parsed.action || "UNKNOWN",
      accountName: parsed.accountName || null,
      accountType: parsed.accountType || "checking",
      initialBalance: typeof parsed.initialBalance === "number" ? parsed.initialBalance : null,
      amount: typeof parsed.amount === "number" ? parsed.amount : null,
      category: parsed.category || null,
      description: parsed.description || null,
      targetAccountName: parsed.targetAccountName || null,
      fromAccountName: parsed.fromAccountName || null,
      toAccountName: parsed.toAccountName || null,
      familyMemberName: parsed.familyMemberName || null,
      symbol: parsed.symbol || null,
      quantity: typeof parsed.quantity === "number" ? parsed.quantity : null,
      price: typeof parsed.price === "number" ? parsed.price : null,
      fundName: parsed.fundName || null,
      replyMessage: parsed.replyMessage || null,
      reasoning: parsed.reasoning || null,
    };
  } catch (error: any) {
    return {
      action: "UNKNOWN",
      reasoning: error.message || "Failed to process autonomous intent",
    };
  }
}

/**
 * Conversational AI Assistant for financial questions & advice
 */
export async function askGeminiFinanceAssistant(
  query: string,
  contextSummary: string,
  apiKey: string
): Promise<string> {
  const systemPrompt = `You are an expert AI Financial Coach for FinanceOS. Answer user questions concisely (max 3-4 bullet points), friendly, and actionable using the user's financial context when relevant. User context:\n${contextSummary}`;

  return await callGeminiApi(apiKey, query, systemPrompt);
}
