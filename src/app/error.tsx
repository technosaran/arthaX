"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to monitoring service (Sentry / internal security log)
    console.error("Global Route Error Caught:", error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
      <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-6 text-rose-400 shadow-[0_0_30px_rgba(244,63,94,0.2)]">
        <AlertTriangle className="w-8 h-8" />
      </div>

      <span className="text-xs font-black uppercase tracking-[0.25em] text-rose-400 mb-2">
        System Recovery Mode
      </span>
      <h1 className="text-3xl font-serif text-white tracking-tight mb-3">
        Unexpected Error Occurred
      </h1>
      <p className="text-sm text-slate-400 max-w-md mb-8 leading-relaxed">
        {error.message || "An isolated runtime issue occurred. Your financial data remains secure."}
      </p>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="px-5 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs tracking-wider uppercase hover:bg-emerald-400 transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.3)] cursor-pointer"
        >
          <RefreshCw className="w-4 h-4 animate-spin-reverse" /> Re-initialize App
        </button>
        <a
          href="/dashboard"
          className="px-5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 font-bold text-xs tracking-wider uppercase hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
        >
          Return to Dashboard
        </a>
      </div>
    </div>
  );
}
