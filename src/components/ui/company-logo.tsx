"use client";

import React, { useState, useEffect, memo } from "react";
import { getCompanyDomain, getCompanyLogoUrls } from "@/lib/companies";
import { getFastLogoCandidateUrls, saveResolvedLogoUrl, getResolvedLogoUrl } from "@/lib/logo-cache";

interface CompanyLogoProps {
  name?: string | null;
  category?: string;
  size?: number;
  className?: string;
}

const CATEGORY_STYLES: Record<string, { bg: string; color: string; icon: string }> = {
  Salary: { bg: "rgba(16, 185, 129, 0.12)", color: "#10b981", icon: "🏢" },
  Work: { bg: "rgba(14, 165, 233, 0.12)", color: "#0ea5e9", icon: "💻" },
  Freelance: { bg: "rgba(168, 85, 247, 0.12)", color: "#a855f7", icon: "🚀" },
  Gift: { bg: "rgba(244, 63, 94, 0.12)", color: "#f43f5e", icon: "💝" },
  Bonus: { bg: "rgba(245, 158, 11, 0.12)", color: "#f59e0b", icon: "✨" },
  Refund: { bg: "rgba(56, 189, 248, 0.12)", color: "#38bdf8", icon: "↩️" },
  Others: { bg: "rgba(148, 163, 184, 0.12)", color: "#94a3b8", icon: "📦" },
};

export const CompanyLogo = memo(function CompanyLogo({
  name,
  category = "Salary",
  size = 44,
  className = "",
}: CompanyLogoProps) {
  const domain = getCompanyDomain(name || "");
  const cachedUrl = domain ? getResolvedLogoUrl(domain) : null;

  const [urlIndex, setUrlIndex] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [loaded, setLoaded] = useState(!!cachedUrl);

  const candidateUrls = domain ? getCompanyLogoUrls(domain) : [];

  useEffect(() => {
    const isCached = domain ? !!getResolvedLogoUrl(domain) : false;
    setUrlIndex(0);
    setHasError(false);
    setLoaded(isCached);
  }, [name, domain]);

  const currentUrl = candidateUrls[urlIndex];
  const catStyle = CATEGORY_STYLES[category] || CATEGORY_STYLES.Salary;

  const renderFallback = () => {
    return (
      <div
        className={`relative flex items-center justify-center rounded-xl border border-white/10 shadow-md overflow-hidden flex-shrink-0 ${className}`}
        style={{
          width: size,
          height: size,
          background: catStyle.bg,
          minWidth: size,
          minHeight: size,
        }}
        title={name || category}
      >
        <span className="text-sm select-none">{catStyle.icon}</span>
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
      title={name || "Company Logo"}
    >
      <img
        key={currentUrl}
        src={currentUrl}
        alt={name || "Company Logo"}
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

CompanyLogo.displayName = "CompanyLogo";
export default CompanyLogo;
