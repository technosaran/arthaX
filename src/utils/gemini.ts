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
  intent:
    | "expense"
    | "income"
    | "transfer"
    | "balance_query"
    | "spending_query"
    | "budget_query"
    | "set_budget"
    | "stocks_query"
    | "quote_query"
    | "mf_query"
    | "bullion_query"
    | "portfolio_query"
    | "chart_query"
    | "add_stock"
    | "undo"
    | "advice"
    | "ambiguous"
    | "unknown";
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
  symbol?: string;
  quantity?: number;
  price?: number;
  exchange?: "NSE" | "BSE";
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
• Or by sending a voice note or photo of any receipt/bill.
4. Always be helpful, financially prudent, and encouraging. Never invent inaccurate financial figures.`;

const PARSER_SYSTEM_INSTRUCTION = `You are ArthaX AI, an elite financial parser, multimodal speech transcriber, and intelligence engine.
Analyze the user's input (which may be natural text, a voice audio recording, a photo of a receipt/invoice/bill, a UPI payment screenshot, or an investment screenshot) and extract the financial intent into structured JSON.

Allowed intent values:
- "expense": A purchase, payment, restaurant/grocery bill, debit SMS, or expense (e.g. "Dinner 500", "Spent 150 on coffee", receipt photos, UPI sent payment screenshots).
- "income": Money received, salary, freelance, dividend, credit SMS, or received payment screenshot (e.g. "Salary 85000", "Received 5000 from client", "UPI received 1200").
- "transfer": Moving money between user's own accounts (e.g. "Transfer 5000 HDFC to Cash", "Move 2000 from SBI to ICICI").
- "balance_query": Inquiring about bank balance, liquid cash, or account balances (e.g. "How much in ICICI?", "What is my balance?", "Check accounts").
- "spending_query": Inquiring about spending history (e.g. "How much did I spend today?", "What did I spend this week?", "Monthly spending").
- "chart_query": Asking for a visual spending breakdown, chart, or graph (e.g. "Show my spending chart", "Generate pie chart", "/chart").
- "budget_query": Inquiring about budgets, category limits, or progress bars (e.g. "How are my budgets?", "Show budget").
- "set_budget": Setting or updating a monthly budget for a category (e.g. "Set food budget to 8000", "/setbudget Shopping 5000", "Limit dining to 10k").
- "portfolio_query": Asking for total net worth or overall portfolio overview (e.g. "What is my net worth?", "Portfolio summary", "Total assets").
- "stocks_query": Checking stock holdings, equity portfolio, or stock performance (e.g. "Show my stocks", "My stock portfolio", "How are my shares?").
- "quote_query": Inquiring about the live price or quote of a specific stock ticker (e.g. "Price of Reliance", "/quote TCS", "What is Tata Motors trading at?").
- "add_stock": Recording a stock buy transaction (e.g. "Bought 10 shares of RELIANCE at 2400", "/addstock INFY 5 1850").
- "mf_query": Checking mutual fund holdings, SIPs, or mutual fund portfolio (e.g. "My mutual funds", "Check SIPs").
- "bullion_query": Checking physical gold or silver holdings and rates (e.g. "How much gold do I have?", "Check silver holdings", "Bullion value").
- "undo": Asking to undo, delete, or cancel the last transaction (e.g. "Undo", "Cancel last", "Delete that expense").
- "advice": Financial question, general advice, savings advice, or affordability inquiry (e.g. "Can I afford dinner?", "How can I save more?").
- "ambiguous": The user only provided a standalone number or very vague input without merchant or purpose (e.g. "623", "500").
- "unknown": Unrecognized query.

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
1. Multimodal Audio (Voice notes):
   - Always accurately transcribe speech into "transcribedText".
   - Determine the user's intent from the spoken words (could be expense, income, transfer, balance_query, spending_query, chart_query, budget_query, set_budget, portfolio_query, stocks_query, quote_query, add_stock, mf_query, bullion_query, undo, or advice).
2. Multimodal Photos (Receipts, Bills, Screenshots):
   - For Receipts/Bills: Extract merchant name (title), total payable amount (amount), and appropriate category. Set intent: "expense".
   - For UPI Payment Screenshots (GPay, PhonePe, Paytm, BHIM):
     - If "Paid to" or "Sent to" or debit: intent: "expense", title: recipient name, amount: transaction amount, category: appropriate category based on merchant, accountQuery: bank name/last four digits if visible.
     - If "Received from" or credited: intent: "income", title: sender name, amount: transaction amount, category: "Payment Received", accountQuery: bank name if visible.
   - For Stock/Investment Screenshots: Extract symbol, quantity, and price if an order/holding is visible, or set intent: "stocks_query".
3. For Advice: Provide a helpful, concise HTML answer in adviceResponse.
4. For Stocks: If stock ticker/symbol is mentioned, set "symbol" (uppercase e.g. "RELIANCE", "TCS", "INFY"), "exchange": "NSE" (or "BSE" if mentioned).
5. For Set Budget: Extract "category" and "amount".
6. Return JSON ONLY with keys: intent, amount, title, category, accountQuery, fromAccountQuery, toAccountQuery, isFamilyTransfer, transcribedText, adviceResponse, confidence, symbol, quantity, price, exchange.`;

const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-flash-latest",
  "gemini-2.5-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-3.5-flash-lite",
];

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
    promptInstruction = `Examine this photo (receipt, bill, invoice, UPI payment screenshot, or investment screenshot). Extract the financial details, whether money was paid (expense), received (income), or invested (stocks/mf). ${text ? `User note: "${text}"` : ""}`;
  } else if (mediaBase64 && (mediaMimeType?.startsWith("audio/") || mediaMimeType === "application/octet-stream")) {
    promptInstruction = `Listen to this voice message. Transcribe it into transcribedText, and identify the user's financial intent (expense, income, transfer, balance, spending, chart, budget, portfolio, stocks, quote, or advice).`;
  } else {
    promptInstruction = `Parse this financial input: "${text || ""}"`;
  }

  promptInstruction += ` User: ${userName}.`;
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

