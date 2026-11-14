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

/**
 * Calls Google Gemini Generative Language API using gemini-flash-latest
 * with automatic fallback to gemini-flash-lite-latest.
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

  // Provide high-level context without sensitive data
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

  const models = ["gemini-flash-latest", "gemini-flash-lite-latest", "gemini-2.5-flash"];

  for (const model of models) {
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
        const errJson = await res.json().catch(() => ({}));
        console.warn(`[Gemini API] Model ${model} returned HTTP ${res.status}:`, errJson);
        continue; // Try fallback model
      }

      const data = await res.json();
      const answerText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (answerText && typeof answerText === "string") {
        return { success: true, text: answerText.trim() };
      }
    } catch (err: unknown) {
      console.warn(`[Gemini API] Exception calling ${model}:`, err);
    }
  }

  return { success: false, error: "All Gemini model attempts were exhausted or timed out." };
}
