"use client";

import React, { useState, useEffect, useMemo, memo } from "react";
import Image from "next/image";
import { getCompanyDomain, getCompanyLogoUrls } from "@/lib/companies";

type CompanyLogoProps = {
  name?: string | null;
  companyName?: string | null;
  category?: string | null;
  size?: number;
  className?: string;
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

function getLogoSources(companyName: string): string[] {
  const domain = getCompanyDomain(companyName);
  if (!domain) return [];
  return getCompanyLogoUrls(domain);
}

export const CompanyLogo = memo(function CompanyLogo({
  name,
  companyName,
  category,
  size = 44,
  className = "",
}: CompanyLogoProps) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [srcIndex, setSrcIndex] = useState(0);
  const [allFailed, setAllFailed] = useState(false);

  const queryName = useMemo(() => {
    return (name ? name.trim() : "") || (companyName ? companyName.trim() : "");
  }, [name, companyName]);

  const sources = useMemo(() => {
    return queryName ? getLogoSources(queryName) : [];
  }, [queryName]);

  // Reset image state when queryName changes to prevent stale logos
  useEffect(() => {
    setImgLoaded(false);
    setSrcIndex(0);
    setAllFailed(false);
  }, [queryName]);

  const fallbackIcon = useMemo(() => {
    const cat = (category || "").toLowerCase().trim();
    return CATEGORIES[cat] || "📦";
  }, [category]);

  const handleImgError = () => {
    if (srcIndex < sources.length - 1) {
      setSrcIndex((prev) => prev + 1);
    } else {
      setAllFailed(true);
    }
  };

  const handleImgLoad = () => {
    setImgLoaded(true);
  };

  const showImage = queryName && !allFailed && sources.length > 0;

  return (
    <div
      className={`relative flex items-center justify-center rounded-2xl overflow-hidden shrink-0 transition-all bg-white/5 border border-white/10 ${className}`}
      style={{
        width: size,
        height: size,
        minWidth: size,
      }}
      title={queryName || "Company Logo"}
    >
      {(!showImage || allFailed) && (
        <div 
          className="absolute inset-0 flex items-center justify-center select-none"
          style={{ fontSize: `${size * 0.45}px` }}
        >
          {fallbackIcon}
        </div>
      )}

      {showImage && !imgLoaded && (
        <div className="absolute inset-0 animate-pulse bg-white/10" />
      )}

      {showImage && (
        <Image
          src={sources[srcIndex]}
          alt={queryName || "Company logo"}
          width={size}
          height={size}
          unoptimized
          className={`object-contain bg-white transition-opacity duration-300 ${
            imgLoaded ? "opacity-100" : "opacity-0"
          }`}
          style={{
            position: "absolute",
            inset: "0",
            width: `${size}px`,
            height: `${size}px`,
            objectFit: "contain",
            padding: `${Math.max(size * 0.1, 4)}px`,
            borderRadius: "var(--radius-md, 14px)",
            zIndex: 3,
            imageRendering: "-webkit-optimize-contrast",
          }}
          onError={handleImgError}
          onLoad={handleImgLoad}
        />
      )}
    </div>
  );
});

CompanyLogo.displayName = "CompanyLogo";
export default CompanyLogo;
