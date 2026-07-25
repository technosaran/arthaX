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

  // Primary model: gemini-2.5-flash
  let endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(cleanKey)}`;
  let response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  // Fallback to gemini-2.0-flash if 2.5 is unavailable or error 404
  if (!response.ok && (response.status === 404 || response.status === 400)) {
    endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(cleanKey)}`;
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!candidate) {
    throw new Error("Gemini returned empty candidate text");
  }

  return candidate;
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
