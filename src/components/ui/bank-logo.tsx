"use client";

import React, { useState, useEffect, memo } from "react";
import { getBankDomain, getBankLogoUrls } from "@/lib/banks";
import { getFastLogoCandidateUrls, saveResolvedLogoUrl, getResolvedLogoUrl } from "@/lib/logo-cache";

interface BankLogoProps {
  bankName?: string | null;
  accountName?: string;
  type?: string;
  size?: number;
  className?: string;
}

const CATEGORY_STYLES: Record<string, { bg: string; color: string; path: string }> = {
  checking: {
    bg: "rgba(14, 165, 233, 0.12)",
    color: "#0ea5e9",
    path: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
  },
  savings: {
    bg: "rgba(16, 185, 129, 0.12)",
    color: "#10b981",
    path: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  credit: {
    bg: "rgba(244, 63, 94, 0.12)",
    color: "#f43f5e",
    path: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z",
  },
  investment: {
    bg: "rgba(56, 189, 248, 0.12)",
    color: "#38bdf8",
    path: "M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z",
  },
  cash: {
    bg: "rgba(245, 158, 11, 0.12)",
    color: "#f59e0b",
    path: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z",
  },
};

export const BankLogo = memo(function BankLogo({
  bankName,
  accountName,
  type = "checking",
  size = 72,
  className = "",
}: BankLogoProps) {
  const domain = getBankDomain(bankName || accountName || "");
  const cachedUrl = domain ? getResolvedLogoUrl(domain) : null;

  const [urlIndex, setUrlIndex] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [loaded, setLoaded] = useState(!!cachedUrl);

  const candidateUrls = domain ? getBankLogoUrls(domain) : [];

  useEffect(() => {
    const isCached = domain ? !!getResolvedLogoUrl(domain) : false;
    setUrlIndex(0);
    setHasError(false);
    setLoaded(isCached);
  }, [bankName, accountName, domain]);

  const currentUrl = candidateUrls[urlIndex];
  const style = CATEGORY_STYLES[type] || CATEGORY_STYLES.checking;

  const renderFallback = () => {
    return (
      <div
        className={`relative flex items-center justify-center rounded-xl border border-white/10 shadow-md overflow-hidden flex-shrink-0 ${className}`}
        style={{
          width: size,
          height: size,
          background: style.bg,
          minWidth: size,
          minHeight: size,
        }}
        title={bankName || accountName || type}
      >
        <svg
          className="w-1/2 h-1/2"
          style={{ color: style.color }}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d={style.path} />
        </svg>
      </div>
    );
  };

  if (!domain || candidateUrls.length === 0 || hasError || !currentUrl) {
    return renderFallback();
  }

  const handleImageLoad = () => {
    setLoaded(true);
    if (domain && currentUrl) {
      saveResolvedLogoUrl(domain, currentUrl);
    }
  };

  const handleImageError = () => {
    if (urlIndex + 1 < candidateUrls.length) {
      setUrlIndex((prev) => prev + 1);
    } else {
      setHasError(true);
    }
  };

  return (
    <div
      className={`relative flex items-center justify-center rounded-2xl bg-white shadow-[0_2px_8px_rgba(0,0,0,0.35)] border border-white/30 overflow-hidden flex-shrink-0 transition-transform hover:scale-105 ${className}`}
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
      }}
      title={bankName || accountName || "Bank Logo"}
    >
      <img
        key={currentUrl}
        src={currentUrl}
        alt={bankName || accountName || "Bank Logo"}
        onLoad={handleImageLoad}
        onError={handleImageError}
        style={{ imageRendering: "-webkit-optimize-contrast" }}
        className="w-full h-full object-contain p-1 transition-opacity duration-150 opacity-100"
        loading="eager"
        decoding="async"
      />
    </div>
  );
});

BankLogo.displayName = "BankLogo";
export default BankLogo;
