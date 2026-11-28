import { z } from "zod";
import { inferExpenseCategory } from "@/utils/expenseParser";

const DEFAULT_GEMINI_MODELS = [
  process.env.GEMINI_MODEL?.trim(),
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
].filter((m): m is string => Boolean(m));

export const GEMINI_MODELS = Array.from(new Set(DEFAULT_GEMINI_MODELS));

const NORMALIZED_EXPENSE_CATEGORIES = new Set([
  "Housing & Rent",
  "Groceries & Essentials",
  "Food & Dining",
  "Utilities & Bills",
  "Transport & Fuel",
  "Vehicle & Servicing",
  "Shopping & Lifestyle",
  "Electronics & Gadgets",
  "Health & Medical",
  "Fitness & Sports",
  "Entertainment & OTT",
  "Travel & Vacations",
  "Subscriptions & SaaS",
  "Debt & Loan EMI",
  "Insurance & Protection",
  "Education & Learning",
  "Personal Care & Grooming",
  "Investments & Wealth",
  "Taxes & Professional Fees",
  "Home & Maintenance",
  "Family & Child Care",
  "Gifts & Celebrations",
  "Other & Contingency",
]);

const GEMINI_INTENTS = [
  "expense",
  "income",
  "transfer",
  "advice",
  "unknown",
  "balance_query",
  "spending_query",
  "budget_query",
  "chart_query",
  "portfolio_query",
  "stocks_query",
  "quote_query",
  "add_stock",
  "mf_query",
  "bullion_query",
  "set_budget",
  "undo",
] as const;

export type GeminiIntent = (typeof GEMINI_INTENTS)[number];

const ParsedFinancialAISchema = z.object({
  intent: z.enum(GEMINI_INTENTS).default("unknown"),
  amount: z.union([z.number(), z.string(), z.null()]).optional(),
  title: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  accountQuery: z.string().nullable().optional(),
  fromAccountQuery: z.string().nullable().optional(),
  toAccountQuery: z.string().nullable().optional(),
  transcribedText: z.string().nullable().optional(),
  adviceResponse: z.string().nullable().optional(),
  symbol: z.string().nullable().optional(),
  quantity: z.union([z.number(), z.string(), z.null()]).optional(),
  price: z.union([z.number(), z.string(), z.null()]).optional(),
  exchange: z.string().nullable().optional(),
  confidence: z.union([z.number(), z.string()]).optional(),
});

export interface ParsedFinancialAI {
  intent: GeminiIntent;
  amount?: number;
  title?: string;
  category?: string;
  accountQuery?: string;
  fromAccountQuery?: string;
  toAccountQuery?: string;
  transcribedText?: string;
  adviceResponse?: string;
  symbol?: string;
  quantity?: number;
  price?: number;
  exchange?: string;
  confidence: number;
}

const SYSTEM_INSTRUCTIONS = `You are arthaX AI — a sharp, authoritative, warm Personal Financial Concierge & CFO for an Indian user.
All currency values are in Indian Rupees (₹ / INR). Treat Indian numbering (Lakhs / Crores) and Indian context (UPI, SIP, Mutual Funds, FD, EPF, PPF, Nifty 50, Indian Taxes under New/Old Regimes, Indian Bank Accounts) naturally.

Formatting Rules (STRICT):
1. Format output using simple Telegram HTML tags ONLY: <b>bold</b>, <i>italic</i>, <code>code</code>.
2. NEVER use Markdown syntax like **asterisks**, _underscores_, # headings, or backticks! Write bullet lists with plain "•" dots or emojis.
3. Keep answers punchy, clear, actionable, and concise (under 250 words unless a detailed breakdown is explicitly asked).
4. Tailor advice directly to the user's real live numbers provided in the prompt when available.`;

function isRetryableGeminiStatus(status: number): boolean {
  return status === 404 || status === 408 || status === 429 || status >= 500;
}

function sanitizePositiveNumber(raw: unknown): number | undefined {
  if (raw === null || raw === undefined) return undefined;
  const cleaned =
    typeof raw === "string" ? Number(raw.replace(/[₹,\s]/g, "").trim()) : Number(raw);
  if (!Number.isFinite(cleaned) || cleaned <= 0) return undefined;
  return Number(cleaned.toFixed(4));
}

function normalizeAiCategory(
  intent: GeminiIntent,
  rawCategory: string | null | undefined,
  title: string | undefined,
  rawText: string
): string | undefined {
  if (intent === "expense" || intent === "set_budget") {
    if (rawCategory && NORMALIZED_EXPENSE_CATEGORIES.has(rawCategory.trim())) {
      return rawCategory.trim();
    }
    return inferExpenseCategory(`${title || ""} ${rawCategory || ""} ${rawText}`);
  }
  if (intent === "income") {
    return rawCategory?.trim() || "Salary";
  }
  return rawCategory?.trim() || undefined;
}

function extractJsonObject(rawText: string): unknown {
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const startIdx = cleaned.indexOf("{");
  const endIdx = cleaned.lastIndexOf("}");
  if (startIdx === -1 || endIdx <= startIdx) return null;
  return JSON.parse(cleaned.slice(startIdx, endIdx + 1));
}

export async function generateFinancialAnswer({
  prompt: userPrompt,
  question,
  financialContext,
  accountsSummary,
  userName,
}: {
  prompt?: string;
  question?: string;
  financialContext?: string;
  accountsSummary?: { name: string; balance: number; type: string }[];
  userName?: string;
}): Promise<{ success: boolean; text: string; answer: string | null; error?: string }> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return { success: false, text: "", answer: null, error: "Gemini API key not configured" };
  }

  const effectiveQuery = (userPrompt || question || "").trim();
  const contextSummary =
    financialContext ||
    (accountsSummary && accountsSummary.length > 0
      ? `Linked Accounts: ${accountsSummary.map((a) => `${a.name} (${a.type}: ₹${a.balance})`).join(", ")}`
      : "No pre-loaded summary.");

  const fullPrompt = `${SYSTEM_INSTRUCTIONS}

${userName ? `User Name: ${userName}` : ""}
=== USER LIVE FINANCIAL SUMMARY ===
${contextSummary}
====================================

User Question: "${effectiveQuery}"

Respond directly to the user in helpful, insightful, HTML-formatted text.`;

  let lastError = "Failed to generate answer from Gemini";

  for (const model of GEMINI_MODELS) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(9000),
          body: JSON.stringify({
            contents: [{ parts: [{ text: fullPrompt }] }],
            generationConfig: {
              temperature: 0.35,
              maxOutputTokens: 800,
            },
          }),
        }
      );

      if (!response.ok) {
        const errBody = await response.text().catch(() => "");
        lastError = `HTTP ${response.status} on ${model}: ${errBody.slice(0, 120)}`;
        if (!isRetryableGeminiStatus(response.status)) {
          return { success: false, text: "", answer: null, error: lastError };
        }
        continue;
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof text === "string" && text.trim()) {
        const trimmed = text.trim();
        return { success: true, text: trimmed, answer: trimmed };
      }
      lastError = `Empty response from ${model}`;
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  return { success: false, text: "", answer: null, error: lastError };
}

export async function parseFinancialInputWithGemini({
  text,
  mediaBase64,
  mediaMimeType,
  userName,
  accountsSummary,
}: {
  text?: string;
  mediaBase64?: string;
  mediaMimeType?: string;
  userName?: string;
  accountsSummary?: { name: string; balance: number; type: string }[];
}): Promise<ParsedFinancialAI | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;

  const accountNames = accountsSummary?.map((a) => `${a.name} (${a.type}, ₹${a.balance})`).join(", ") || "Cash in Hand";

  const prompt = `You are a precision Indian Financial Data Extractor & Assistant for arthaX.
User accounts: [${accountNames}]
${userName ? `User: ${userName}` : ""}

Task:
Analyze the provided input (text, voice audio, or image receipt / UPI screenshot) and extract structured JSON matching schema:
{
  "intent": "expense"|"income"|"transfer"|"advice"|"unknown"|"balance_query"|"spending_query"|"budget_query"|"chart_query"|"portfolio_query"|"stocks_query"|"quote_query"|"add_stock"|"mf_query"|"bullion_query"|"set_budget"|"undo",
  "amount": number|null,
  "title": string|null,
  "category": string|null,
  "accountQuery": string|null,
  "fromAccountQuery": string|null,
  "toAccountQuery": string|null,
  "transcribedText": string|null,
  "adviceResponse": string|null,
  "symbol": string|null,
  "quantity": number|null,
  "price": number|null,
  "exchange": "NSE"|"BSE"|null,
  "confidence": number
}

Rules:
- EXPENSE categories MUST be one of: "Food & Dining", "Groceries & Essentials", "Transport & Fuel", "Travel & Vacations", "Utilities & Bills", "Housing & Rent", "Health & Medical", "Fitness & Sports", "Subscriptions & SaaS", "Entertainment & OTT", "Electronics & Gadgets", "Shopping & Lifestyle", "Education & Learning", "Investments & Wealth", "Debt & Loan EMI", "Insurance & Protection", "Other & Contingency".
- For query commands like showing balance/spending/budget/chart/portfolio/stocks/mf/bullion or undo last transaction, map to the matching intent.
- For stock quote or add_stock voice commands, populate "symbol", "quantity", "price", and "exchange" ("NSE" default).
- For set_budget commands, set intent="set_budget", category, amount.
- For ADVICE / QUESTION, set intent="advice" and provide an HTML formatted response (only <b>, <i>, <code>) in "adviceResponse".
- Transcribe audio accurately in "transcribedText".

Input text/caption: "${(text || "").trim()}"`;

  const parts: Array<Record<string, unknown>> = [{ text: prompt }];
  if (mediaBase64 && mediaMimeType) {
    parts.push({
      inlineData: {
        mimeType: mediaMimeType,
        data: mediaBase64,
      },
    });
  }

  for (const model of GEMINI_MODELS) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(12000),
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 600,
              responseMimeType: "application/json",
            },
          }),
        }
      );

      if (!response.ok) {
        if (!isRetryableGeminiStatus(response.status)) {
          return null;
        }
        continue;
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof rawText !== "string" || !rawText.trim()) continue;

      const rawJson = extractJsonObject(rawText);
      const parsed = ParsedFinancialAISchema.safeParse(rawJson);
      if (!parsed.success) continue;

      const d = parsed.data;
      const sanitizedAmount = sanitizePositiveNumber(d.amount);
      const sanitizedQty = sanitizePositiveNumber(d.quantity);
      const sanitizedPrice = sanitizePositiveNumber(d.price);
      const cleanTitle = d.title?.trim() || undefined;
      const confidenceRaw = Number(d.confidence);
      const confidence =
        Number.isFinite(confidenceRaw) && confidenceRaw >= 0 && confidenceRaw <= 1
          ? confidenceRaw
          : 0.85;

      return {
        intent: d.intent,
        amount: sanitizedAmount !== undefined ? Number(sanitizedAmount.toFixed(2)) : undefined,
        title: cleanTitle,
        category: normalizeAiCategory(d.intent, d.category, cleanTitle, text || ""),
        accountQuery: d.accountQuery?.trim() || undefined,
        fromAccountQuery: d.fromAccountQuery?.trim() || undefined,
        toAccountQuery: d.toAccountQuery?.trim() || undefined,
        transcribedText: d.transcribedText?.trim() || undefined,
        adviceResponse: d.adviceResponse?.trim() || undefined,
        symbol: d.symbol?.trim().toUpperCase() || undefined,
        quantity: sanitizedQty,
        price: sanitizedPrice !== undefined ? Number(sanitizedPrice.toFixed(2)) : undefined,
        exchange: d.exchange?.trim().toUpperCase() || undefined,
        confidence,
      };
    } catch {
      continue;
    }
  }

  return null;
}
