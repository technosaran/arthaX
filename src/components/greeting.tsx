"use client";

import { useUser } from "@/context/user-context";
import { format } from "date-fns";

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
        tag: "Morning Session",
        badgeColor: "from-amber-500/20 to-orange-500/10 border-amber-500/30 text-amber-300",
      };
    }
    if (hour >= 12 && hour < 17) {
      return {
        text: "Good afternoon",
        emoji: "🌤️",
        subtitle: "Mid-day portfolio check. Keep asset velocity high & cashflow optimized.",
        tag: "Afternoon Session",
        badgeColor: "from-sky-500/20 to-blue-500/10 border-sky-500/30 text-sky-300",
      };
    }
    if (hour >= 17 && hour < 21) {
      return {
        text: "Good evening",
        emoji: "🌆",
        subtitle: "Review today's yield and track your progress toward long-term wealth goals.",
        tag: "Evening Review",
        badgeColor: "from-purple-500/20 to-pink-500/10 border-purple-500/30 text-purple-300",
      };
    }
    return {
      text: "Good night",
      emoji: "🌙",
      subtitle: "Markets rest, but your financial engine keeps working around the clock.",
      tag: "Night Owl Terminal",
      badgeColor: "from-indigo-500/20 to-violet-500/10 border-indigo-500/30 text-indigo-300",
    };
  })();

  const dateString = format(now, "EEEE, MMMM d, yyyy");

  return (
    <div className="animate-fade-in space-y-3 select-none">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          {/* Top Pill Badges */}
          <div className="flex flex-wrap items-center gap-2 mb-2.5">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase bg-gradient-to-r border shadow-sm ${greetingInfo.badgeColor}`}>
              <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
              {greetingInfo.tag}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold text-[--text-muted] bg-white/[0.04] border border-white/10 shadow-sm">
              <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {dateString}
            </span>
          </div>

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
