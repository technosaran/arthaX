"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Dashboard Error]:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4">
      <div className="text-center space-y-3">
        <h2 className="text-2xl font-semibold text-white">
          Something went wrong
        </h2>
        <p className="text-slate-400 text-sm max-w-md">
          An unexpected error occurred while loading this page. You can try
          again or return to the dashboard.
        </p>
        {error.digest && (
          <p className="text-xs text-slate-500 font-mono">
            Error ID: {error.digest}
          </p>
        )}
      </div>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-lg transition-colors text-sm"
        >
          Try again
        </button>
        <a
          href="/dashboard"
          className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors text-sm"
        >
          Go to Dashboard
        </a>
      </div>
    </div>
  );
}
