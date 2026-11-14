export interface GeminiMessageOptions {
  prompt: string;
  userName?: string;
  accountsSummary?: Array<{ name: string; balance: number; type: string }>;
}

export interface GeminiResponse {
  success: boolean;
  text?: string;
  error?: string;
}

export interface GeminiMultimodalOptions {
  text?: string;
  mediaBase64?: string;
  mediaMimeType?: string;
  userName?: string;
  accountsSummary?: Array<{ name: string; balance: number; type: string }>;
}

export interface ParsedFinancialAI {
  intent: "expense" | "income" | "transfer" | "balance_query" | "spending_query" | "undo" | "advice" | "ambiguous" | "unknown";
  amount?: number;
  title?: string;
  category?: string;
  accountQuery?: string;
  fromAccountQuery?: string;
  toAccountQuery?: string;
  isFamilyTransfer?: boolean;
  transcribedText?: string;
  adviceResponse?: string;
  confidence: number;
}

const SYSTEM_INSTRUCTION = `You are ArthaX AI, an elite, highly intelligent personal finance assistant embedded in the arthaX Telegram Bot.
Your goal is to answer financial questions, budgeting queries, investing concepts, saving tips, and conversational queries with warmth, precision, and actionable advice.

Formatting Rules:
1. Format output using Telegram-supported HTML: <b>bold</b>, <i>italic</i>, and <code>code</code>.
2. Keep responses concise (typically 2-4 sentences or short, punchy bullet points) suitable for instant reading on mobile Telegram.
3. If the user mentions spending, buying something, or asking how to log an expense in arthaX, remind them they can log it right here in this chat by typing:
• <code>Dinner 500 HDFC</code>
• <code>Petrol 1200 Cash</code>
• <code>Uber 320</code>
• Or by forwarding/copying any official bank debit SMS.
4. Always be helpful, financially prudent, and encouraging. Never invent inaccurate financial figures.`;

const PARSER_SYSTEM_INSTRUCTION = `You are ArthaX AI, an elite financial parser and intelligence engine.
Analyze the user's input (which may be natural text, a voice audio recording, or a photo of a receipt/invoice/bill) and extract the financial intent into structured JSON.

Allowed intent values:
- "expense": A purchase, payment, bill, debit SMS, or expense (e.g. "Dinner 500", "Spent 150 on coffee", "Paid electricity 1200").
- "income": Money received, salary, freelance, dividend, credit (e.g. "Salary 85000", "Received 5000 from client").
- "transfer": Moving money between user's own accounts (e.g. "Transfer 5000 HDFC to Cash", "Move 2000 from SBI to ICICI").
- "balance_query": Inquiring about bank balance, net worth, or money in account (e.g. "How much in ICICI?", "What is my balance?").
- "spending_query": Inquiring about spending history (e.g. "How much did I spend today?", "What did I spend this week?").
- "undo": Asking to undo, delete, or cancel the last transaction (e.g. "Undo", "Cancel last", "Delete that expense").
- "advice": Financial question, general advice, or affordability inquiry (e.g. "Can I afford dinner?", "How can I save more?").
- "ambiguous": The user only provided a standalone number or very vague input without merchant or purpose (e.g. "623", "500").

Standard Categories:
- Food & Dining
- Groceries & Essentials
- Transport & Fuel
- Utilities & Bills
- Housing & Rent
- Shopping & Lifestyle
- Electronics & Gadgets
- Health & Medical
- Fitness & Sports
- Entertainment & OTT
- Subscriptions & SaaS
- Personal Care & Grooming
- Education & Learning
- Vehicle & Servicing
- Investments & Wealth
- Family & Child Care
- Gifts & Celebrations
- Other & Contingency

Rules:
1. If sending money to a family member (Mom, Dad, Wife, Mother, Father, Child, Sister, Brother, Son, Daughter), set isFamilyTransfer: true and category: "Family & Child Care".
2. For receipts/bills: Extract total amount, merchant/shop name, and best category.
3. For voice audio: Transcribe speech into transcribedText, and parse the financial intent.
4. For advice/queries: Provide a helpful, concise HTML answer in adviceResponse.
5. Return JSON ONLY with keys: intent, amount, title, category, accountQuery, fromAccountQuery, toAccountQuery, isFamilyTransfer, transcribedText, adviceResponse, confidence.`;

const GEMINI_MODELS = ["gemini-3.5-flash-lite", "gemini-flash-latest", "gemini-flash-lite-latest"];

/**
 * Calls Google Gemini Generative Language API using fast flash models.
 */
export async function generateFinancialAnswer({
  prompt,
  userName = "Friend",
  accountsSummary = [],
}: GeminiMessageOptions): Promise<GeminiResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { success: false, error: "GEMINI_API_KEY is not configured." };
  }

  let contextSnippet = `User's Name: ${userName}.\n`;
  if (accountsSummary.length > 0) {
    const accList = accountsSummary
      .map((a) => `${a.name} (${a.type}): ₹${a.balance}`)
      .join(", ");
    contextSnippet += `User's linked accounts summary: ${accList}.\n`;
  }

  const fullPrompt = `${contextSnippet}\nUser Query: ${prompt}`;

  const payload = {
    system_instruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }],
    },
    contents: [
      {
        parts: [{ text: fullPrompt }],
      },
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 500,
    },
  };

  for (const model of GEMINI_MODELS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 9000);

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        continue;
      }

      const data = await res.json();
      const answerText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (answerText && typeof answerText === "string") {
        return { success: true, text: answerText.trim() };
      }
    } catch {
      // try fallback model
    }
  }

  return { success: false, error: "All Gemini model attempts were exhausted or timed out." };
}

/**
 * Multimodal AI Parser for Text, Voice Audio, and Receipt Photos
 */
export async function parseFinancialInputWithGemini({
  text,
  mediaBase64,
  mediaMimeType,
  userName = "User",
  accountsSummary = [],
}: GeminiMultimodalOptions): Promise<ParsedFinancialAI | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const parts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }> = [];

  if (mediaBase64 && mediaMimeType) {
    parts.push({
      inline_data: {
        mime_type: mediaMimeType,
        data: mediaBase64,
      },
    });
  }

  let promptInstruction = "";
  if (mediaBase64 && mediaMimeType?.startsWith("image/")) {
    promptInstruction = `Examine this receipt or bill photo. Extract the total payable amount, merchant name, category, and date. ${text ? `User note: "${text}"` : ""}`;
  } else if (mediaBase64 && (mediaMimeType?.startsWith("audio/") || mediaMimeType === "application/octet-stream")) {
    promptInstruction = `Listen to this voice message. Transcribe it, and extract the financial transaction or question.`;
  } else {
    promptInstruction = `Parse this financial input: "${text || ""}"`;
  }

  if (accountsSummary.length > 0) {
    promptInstruction += `\nUser's existing accounts: ${accountsSummary.map((a) => a.name).join(", ")}. If an account name is mentioned or implied, map it to accountQuery.`;
  }

  parts.push({ text: promptInstruction });

  const payload = {
    system_instruction: {
      parts: [{ text: PARSER_SYSTEM_INSTRUCTION }],
    },
    contents: [{ parts }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2,
      maxOutputTokens: 600,
    },
  };

  for (const model of GEMINI_MODELS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        continue;
      }

      const data = await res.json();
      const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (jsonText) {
        const parsed = JSON.parse(jsonText) as ParsedFinancialAI;
        return parsed;
      }
    } catch (err) {
      console.warn(`[Gemini Multimodal] Model ${model} failed:`, err);
    }
  }

  return null;
}

