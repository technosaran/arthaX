"use client";

import { useUser } from "@/context/user-context";

type GreetingProps = {
  monthlySpend?: number;
  monthlyIncome?: number;
  budgetLimit?: number;
};

export default function Greeting({
  monthlySpend: _monthlySpend = 0,
  monthlyIncome: _monthlyIncome = 0,
  budgetLimit: _budgetLimit = 0,
}: GreetingProps) {
  const { username, loading } = useUser();

  const now = new Date();
  const hour = now.getHours();

  const greetingInfo = (() => {
    if (hour >= 5 && hour < 12) {
      return {
        text: "Good morning",
        emoji: "☀️",
        subtitle: "Start your morning with financial clarity. Early decisions compound growth.",
      };
    }
    if (hour >= 12 && hour < 17) {
      return {
        text: "Good afternoon",
        emoji: "🌤️",
        subtitle: "Mid-day portfolio check. Keep asset velocity high & cashflow optimized.",
      };
    }
    if (hour >= 17 && hour < 21) {
      return {
        text: "Good evening",
        emoji: "🌆",
        subtitle: "Review today's yield and track your progress toward long-term wealth goals.",
      };
    }
    return {
      text: "Good night",
      emoji: "🌙",
      subtitle: "Markets rest, but your financial engine keeps working around the clock.",
    };
  })();

  return (
    <div className="animate-fade-in space-y-3 select-none">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>

          {/* Main Title */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-none [font-family:'Outfit',sans-serif] text-white flex flex-wrap items-center gap-2">
            {!loading && <span className="inline-block hover:scale-125 transition-transform duration-300 cursor-default">{greetingInfo.emoji}</span>}
            <span>{greetingInfo.text},</span>{" "}
            {loading ? (
              <span className="inline-block w-40 h-10 rounded-xl align-middle bg-white/10 animate-pulse" />
            ) : (
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-purple-200 to-sky-300 drop-shadow-md">
                {username || "Commander"}
              </span>
            )}
          </h1>

          {/* Subtitle */}
          <p className="text-xs sm:text-sm text-[--text-secondary] font-medium leading-relaxed mt-2.5 max-w-2xl">
            {greetingInfo.subtitle}
          </p>
        </div>
      </div>
    </div>
  );
}
