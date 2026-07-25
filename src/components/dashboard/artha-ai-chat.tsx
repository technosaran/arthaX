"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Message = {
  id: string;
  sender: "user" | "ai";
  text: string;
};

type ArthaAIChatProps = {
  monthlySpend?: number;
  monthlyIncome?: number;
  netWorth?: number;
};

export default function ArthaAIChat({ monthlySpend = 48000, monthlyIncome = 82000, netWorth = 1250000 }: ArthaAIChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      sender: "ai",
      text: "👋 Hi! I am Artha AI, your intelligent financial assistant. How can I guide your decisions today?",
    },
  ]);

  const promptChips = [
    "How much did I spend this month?",
    "Show my biggest expense.",
    "Can I afford an iPhone?",
    "How much should I save?",
  ];

  const handleSend = (textToSend?: string) => {
    const q = textToSend || input;
    if (!q.trim()) return;

    const userMsg: Message = { id: String(Date.now()), sender: "user", text: q };
    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput("");

    // Simulate decision-driven AI answer
    setTimeout(() => {
      let aiText = "Based on your financial data, your cash flows and portfolio remain in strong health.";
      const lower = q.toLowerCase();

      if (lower.includes("spend")) {
        aiText = `You have spent ₹${monthlySpend.toLocaleString()} this month out of ₹${monthlyIncome.toLocaleString()} total income (${Math.round((monthlySpend/monthlyIncome)*100)}% spend ratio).`;
      } else if (lower.includes("biggest") || lower.includes("expense")) {
        aiText = "Your biggest expense category this month is Food & Dining (₹18,500, 38% of total expenses).";
      } else if (lower.includes("iphone") || lower.includes("afford")) {
        const netSaved = monthlyIncome - monthlySpend;
        if (netSaved >= 40000) {
          aiText = `Yes! You saved ₹${netSaved.toLocaleString()} this month with ₹${netWorth.toLocaleString()} net worth. Paying cash or zero-cost EMI won't stress your budget.`;
        } else {
          aiText = "Consider saving for 2 more months to avoid dipping into your 6-month emergency reserve.";
        }
      } else if (lower.includes("save")) {
        aiText = "We recommend saving 30% of income (₹24,600/month). Allocate 60% to Mutual Funds and 40% to your Emergency Fund.";
      }

      setMessages((prev) => [...prev, { id: String(Date.now() + 1), sender: "ai", text: aiText }]);
    }, 600);
  };

  return (
    <>
      <div className="fixed bottom-6 right-24 z-50">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-600 text-white font-bold text-xs shadow-[0_10px_30px_rgba(14,165,233,0.4)] hover:scale-105 active:scale-95 transition-all border border-white/20 cursor-pointer"
        >
          <span className="text-base animate-pulse">🤖</span>
          <span>Ask Artha AI</span>
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="w-full max-w-md bg-slate-950 border-l border-white/10 h-full flex flex-col justify-between shadow-2xl p-6 relative"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 text-lg">
                    🤖
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white tracking-tight">Artha AI Financial Advisor</h3>
                    <p className="text-xs text-[--text-muted]">Decision-driven intelligence</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-white flex items-center justify-center text-sm font-bold border border-white/10 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-1">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                        m.sender === "user"
                          ? "bg-gradient-to-r from-sky-500 to-indigo-600 text-white font-medium"
                          : "bg-white/[0.04] border border-white/10 text-[--text-secondary]"
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick Prompt Chips */}
              <div className="py-2 flex gap-2 overflow-x-auto no-scrollbar">
                {promptChips.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => handleSend(chip)}
                    className="px-3 py-1.5 rounded-full text-[10px] font-bold bg-white/5 hover:bg-sky-500/20 hover:text-sky-300 text-[--text-secondary] border border-white/10 whitespace-nowrap transition-colors cursor-pointer"
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* Input */}
              <div className="pt-3 border-t border-white/10 flex items-center gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder="Ask any financial question..."
                  className="flex-1 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-xs text-white placeholder:text-[--text-muted] focus:outline-none focus:border-sky-500/50"
                />
                <button
                  type="button"
                  onClick={() => handleSend()}
                  className="px-4 py-3 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-500 text-white text-xs font-bold hover:brightness-110 transition-all cursor-pointer"
                >
                  Send
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
