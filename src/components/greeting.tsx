"use client";

import { useUser } from "@/context/user-context";

type GreetingProps = {
  monthlySpend?: number;
  monthlyIncome?: number;
  budgetLimit?: number;
};

export default function Greeting({ monthlySpend: _monthlySpend = 0, monthlyIncome: _monthlyIncome = 0, budgetLimit: _budgetLimit = 0 }: GreetingProps) {
  const { username, loading } = useUser();

  const now = new Date();
  const hour = now.getHours();

  const greeting =
    hour < 5 ? "Good night" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : hour < 21 ? "Good evening" : "Good night";
  const emoji = hour < 5 ? "🌙" : hour < 12 ? "☀️" : hour < 17 ? "🌤️" : hour < 21 ? "🌆" : "🌙";

  return (
    <div className="animate-fade-in space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-none [font-family:'Outfit',sans-serif] text-white">
            {!loading && <span className="inline-block animate-bounce mr-2">{emoji}</span>}
            {greeting},{" "}
            {loading ? (
              <span className="inline-block w-36 h-10 rounded-xl align-middle bg-white/10 animate-pulse" />
            ) : (
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-purple-200 to-sky-300 drop-shadow-sm">
                {username || "Commander"}
              </span>
            )}
          </h1>
          <p className="text-xs sm:text-sm text-[--text-muted] font-medium leading-relaxed mt-2 max-w-xl">
            Welcome back to your financial intelligence terminal & net worth dashboard.
          </p>
        </div>
      </div>
    </div>
  );
}

