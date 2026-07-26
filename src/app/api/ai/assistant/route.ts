import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { callGeminiApi, parseTransactionWithGemini, askGeminiFinanceAssistant } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user profile to check gemini_api_key preference
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    const profileData = profile as any;
    const apiKey = profileData?.gemini_api_key || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Gemini API key is not configured. Please set GEMINI_API_KEY in environment or Settings." },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { mode, prompt, contextSummary, text } = body;

    if (mode === "parse") {
      const parsed = await parseTransactionWithGemini(text || prompt || "", apiKey);
      return NextResponse.json(parsed);
    }

    if (mode === "insights") {
      // Fetch user's financial overview to feed Gemini
      const { data: overview } = await supabase.rpc("get_finance_overview_v2");
      const summaryText = JSON.stringify(overview || {}).slice(0, 1500);

      const insightPrompt = `Provide a 3-bullet-point financial summary for this user:
- Bullet 1: Top spending category observation & advice
- Bullet 2: Net worth & savings progress encouragement
- Bullet 3: Actionable financial tip for this week
Keep it concise, friendly, and empowering.`;

      const response = await callGeminiApi(apiKey, insightPrompt, `User Financial Summary Data:\n${summaryText}`);
      return NextResponse.json({ success: true, answer: response });
    }

    // Default mode: "chat"
    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const answer = await askGeminiFinanceAssistant(prompt, contextSummary || "User Dashboard Context", apiKey);
    return NextResponse.json({ success: true, answer });
  } catch (error: any) {
    console.error("AI Assistant API Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process AI request" },
      { status: 500 }
    );
  }
}
