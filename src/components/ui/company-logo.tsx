"use client";

import React, { useState, useMemo, memo } from "react";
import { getCompanyDomain, getCompanyLogoUrls } from "@/lib/companies";
import { saveResolvedLogoUrl } from "@/lib/logo-cache";

type CompanyLogoProps = {
  name?: string | null;
  companyName?: string | null;
  category?: string | null;
  size?: number;
  className?: string;
};

type LogoLoadState = {
  key: string;
  imgLoaded: boolean;
  srcIndex: number;
  allFailed: boolean;
};

const CATEGORIES: Record<string, string> = {
  salary: "🏢",
  work: "💻",
  freelance: "🚀",
  gift: "💝",
  bonus: "✨",
  refund: "↩️",
  others: "📦",
};

export const CompanyLogo = memo(function CompanyLogo({
  name,
  companyName,
  category,
  size = 52,
  className = "",
}: CompanyLogoProps) {
  const queryName = useMemo(() => {
    return (name ? name.trim() : "") || (companyName ? companyName.trim() : "");
  }, [name, companyName]);

  const domain = useMemo(() => {
    return queryName ? getCompanyDomain(queryName) : null;
  }, [queryName]);

  const sources = useMemo(() => {
    return domain ? getCompanyLogoUrls(domain) : [];
  }, [domain]);

  const logoKey = `${domain || "fallback"}:${queryName}`;
  const [loadState, setLoadState] = useState<LogoLoadState>(() => ({
    key: logoKey,
    imgLoaded: false,
    srcIndex: 0,
    allFailed: false,
  }));
  const activeLoadState = loadState.key === logoKey
    ? loadState
    : { key: logoKey, imgLoaded: false, srcIndex: 0, allFailed: false };
  const { imgLoaded, srcIndex, allFailed } = activeLoadState;

  const fallbackIcon = useMemo(() => {
    const cat = (category || "").toLowerCase().trim();
    return CATEGORIES[cat] || "📦";
  }, [category]);

  const fallbackStyle = useMemo(() => {
    if (!queryName) return { text: fallbackIcon, bg: "rgba(255,255,255,0.05)", color: "#ffffff" };
    const clean = queryName.trim();
    const lower = clean.toLowerCase();

    if (lower.includes("google")) return { text: "G", bg: "#4285F4", color: "#ffffff" };
    if (lower.includes("zoom")) return { text: "ZM", bg: "#2D8CFF", color: "#ffffff" };
    if (lower.includes("salesforce")) return { text: "SF", bg: "#00A1E0", color: "#ffffff" };
    if (lower.includes("microsoft")) return { text: "MS", bg: "#00A4EF", color: "#ffffff" };
    if (lower.includes("apple")) return { text: "", bg: "#000000", color: "#ffffff" };
    if (lower.includes("amazon")) return { text: "a", bg: "#FF9900", color: "#000000" };
    if (lower.includes("infosys")) return { text: "INFY", bg: "#007CC3", color: "#ffffff" };
    if (lower.includes("tcs")) return { text: "TCS", bg: "#005697", color: "#ffffff" };
    if (lower.includes("wipro")) return { text: "WIP", bg: "#1F2269", color: "#ffffff" };
    if (lower.includes("kfc")) return { text: "KFC", bg: "#E4002B", color: "#ffffff" };

    // Generic expense keyword fallbacks
    if (lower.includes("home") || lower.includes("rent") || lower.includes("house") || lower.includes("flat")) {
      return { text: "🏠", bg: "#d97706", color: "#ffffff" };
    }
    if (lower.includes("dress") || lower.includes("cloth") || lower.includes("wear") || lower.includes("fashion") || lower.includes("shop")) {
      return { text: "🛍️", bg: "#c026d3", color: "#ffffff" };
    }
    if (lower.includes("food") || lower.includes("dine") || lower.includes("restaurant") || lower.includes("eat") || lower.includes("cafe")) {
      return { text: "🍔", bg: "#e11d48", color: "#ffffff" };
    }
    if (lower.includes("grocery") || lower.includes("groceries") || lower.includes("supermarket") || lower.includes("mart")) {
      return { text: "🛒", bg: "#16a34a", color: "#ffffff" };
    }
    if (lower.includes("electricity") || lower.includes("power") || lower.includes("utility") || lower.includes("bill") || lower.includes("water") || lower.includes("gas")) {
      return { text: "⚡", bg: "#0284c7", color: "#ffffff" };
    }
    if (lower.includes("fuel") || lower.includes("petrol") || lower.includes("diesel") || lower.includes("gasoline")) {
      return { text: "⛽", bg: "#ea580c", color: "#ffffff" };
    }

    let hash = 0;
    for (let i = 0; i < clean.length; i++) {
      hash = clean.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    const firstLetter = clean.charAt(0).toUpperCase();

    return {
      text: firstLetter,
      bg: `hsl(${hue}, 55%, 45%)`,
      color: "#ffffff",
    };
  }, [queryName, fallbackIcon]);

  const handleImgError = () => {
    if (srcIndex < sources.length - 1) {
      setLoadState({ key: logoKey, imgLoaded: false, srcIndex: srcIndex + 1, allFailed: false });
    } else {
      setLoadState({ key: logoKey, imgLoaded: false, srcIndex, allFailed: true });
    }
  };

  const handleImgLoad = () => {
    setLoadState({ key: logoKey, imgLoaded: true, srcIndex, allFailed: false });
    if (domain && sources[srcIndex]) {
      saveResolvedLogoUrl(domain, sources[srcIndex]);
    }
  };

  const showImage = queryName && !allFailed && sources.length > 0;

  return (
    <div
      className={`relative flex items-center justify-center rounded-2xl overflow-hidden shrink-0 transition-all border border-white/10 ${className}`}
      style={{
        width: size,
        height: size,
        minWidth: size,
        background: imgLoaded ? "#ffffff" : fallbackStyle.bg,
      }}
      title={queryName || "Company Logo"}
    >
      <span
        aria-hidden={imgLoaded}
        className="font-black select-none text-center"
        style={{
          color: fallbackStyle.color,
          fontSize: `${size * (fallbackStyle.text.length > 2 ? 0.3 : 0.42)}px`,
          opacity: imgLoaded ? 0 : 1,
          transition: "opacity 0.2s ease",
          zIndex: 1,
        }}
      >
        {fallbackStyle.text || fallbackIcon}
      </span>

      {showImage && (
        /* eslint-disable-next-line @next/next/no-img-element -- Logo sources include SVG and favicon endpoints. */
        <img
          key={sources[srcIndex]}
          src={sources[srcIndex]}
          alt={queryName || "Company logo"}
          width={size}
          height={size}
          className="absolute inset-0 w-full h-full object-contain p-1.5 rounded-xl z-10 bg-white shadow-sm"
          style={{
            opacity: imgLoaded ? 1 : 0,
            transition: "opacity 0.2s ease",
          }}
          onError={handleImgError}
          onLoad={handleImgLoad}
          loading="eager"
          decoding="async"
        />
      )}
    </div>
  );
});

CompanyLogo.displayName = "CompanyLogo";
export default CompanyLogo;
