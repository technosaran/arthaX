"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#07080c] text-white antialiased flex items-center justify-center p-6 font-sans">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0d0f16] p-7 shadow-2xl space-y-5 text-center">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
              <line x1="12" x2="12" y1="9" y2="13" />
              <line x1="12" x2="12.01" y1="17" y2="17" />
            </svg>
          </div>

          <div className="space-y-2">
            <h1 className="text-lg font-bold tracking-tight">Something went wrong</h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              ArthaX encountered an unexpected application error. Your financial data remains safe and intact.
            </p>
            {error?.digest && (
              <p className="text-[11px] font-mono text-slate-500 pt-1">
                Reference ID: {error.digest}
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
            {reset && (
              <button
                type="button"
                onClick={() => reset()}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm transition-colors cursor-pointer"
              >
                Try Again
              </button>
            )}
            <button
              type="button"
              onClick={() => window.location.assign("/")}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white font-medium text-sm transition-colors cursor-pointer"
            >
              Reload Dashboard
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
