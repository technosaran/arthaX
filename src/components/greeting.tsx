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

  const subtitle = "Here is your financial portfolio and net worth command center.";

  return (
    <div className="animate-fade-in-up space-y-1.5">
      <h1
        className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight [font-family:'Outfit',sans-serif]"
        style={{ color: "var(--text-primary)" }}
      >
        {!loading && <span className="inline-block animate-float mr-2">{emoji}</span>}
        {greeting},{" "}
        {loading ? (
          <span className="inline-block w-32 h-10 rounded-xl align-middle skeleton" />
        ) : (
          <span className="gradient-text">{username || "User"}</span>
        )}
      </h1>

      <p className="text-xs sm:text-sm text-[--text-muted] font-medium leading-relaxed max-w-xl">
        {subtitle}
      </p>
    </div>
  );
}

