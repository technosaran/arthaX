"use client";

import { motion } from "framer-motion";

type TickerItem = {
  symbol: string;
  name: string;
  price: string;
  changePct: number;
  icon: string;
};

export default function MarketWatchlist() {
  const tickers: TickerItem[] = [
    { symbol: "NIFTY 50", name: "NIFTY", price: "24,820.50", changePct: 0.45, icon: "🇮🇳" },
    { symbol: "SENSEX", name: "SENSEX", price: "81,450.20", changePct: 0.32, icon: "📈" },
    { symbol: "Gold (10g)", name: "Gold", price: "₹72,400", changePct: 0.18, icon: "🪙" },
    { symbol: "USD / INR", name: "USD", price: "₹83.62", changePct: -0.05, icon: "💵" },
    { symbol: "Bitcoin", name: "BTC", price: "₹57,40,000", changePct: 2.15, icon: "⚡" },
  ];

  return (
    <div className="w-full glass-card-static rich-border px-4 py-2.5 flex items-center justify-between gap-4 overflow-x-auto no-scrollbar border border-white/5 bg-white/[0.01]">
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-[11px] font-extrabold uppercase tracking-wider text-[--text-muted]">Market Watchlist</span>
      </div>

      <div className="flex items-center gap-6 overflow-x-auto no-scrollbar py-0.5">
        {tickers.map((t) => (
          <div key={t.symbol} className="flex items-center gap-2 flex-shrink-0 text-xs font-bold">
            <span className="text-sm">{t.icon}</span>
            <span className="text-[--text-secondary]">{t.name}:</span>
            <span className="text-white tabular-nums">{t.price}</span>
            <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md ${t.changePct >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
              {t.changePct >= 0 ? "▲ +" : "▼ "}{Math.abs(t.changePct)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
