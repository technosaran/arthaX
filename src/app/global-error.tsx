"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Critical Root Layout Error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-slate-950 text-white min-h-screen flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="max-w-md w-full p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-6">
          <div className="text-4xl">⚠️</div>
          <h1 className="text-2xl font-bold tracking-tight text-white">System Outage Detected</h1>
          <p className="text-sm text-slate-400">
            A critical application framework error occurred. Click below to reload the session safely.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="w-full py-3 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs uppercase tracking-wider hover:bg-emerald-400 transition-all cursor-pointer"
          >
            Reload Application
          </button>
        </div>
      </body>
    </html>
  );
}
