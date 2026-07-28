"use client";

import React, { useState, useEffect, memo } from "react";
import { getAMCDomain, getAMCLogoUrls } from "@/lib/amcs";
import { getFastLogoCandidateUrls, saveResolvedLogoUrl, getResolvedLogoUrl } from "@/lib/logo-cache";

interface AMCLogoProps {
  amcName?: string | null;
  fundName?: string | null;
  size?: number;
  className?: string;
}

export const AMCLogo = memo(function AMCLogo({
  amcName,
  fundName,
  size = 80,
  className = "",
}: AMCLogoProps) {
  const domain = getAMCDomain(amcName, fundName);
  const cachedUrl = domain ? getResolvedLogoUrl(domain) : null;

  const [urlIndex, setUrlIndex] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [loaded, setLoaded] = useState(!!cachedUrl);

  const candidateUrls = domain ? getAMCLogoUrls(domain) : [];

  useEffect(() => {
    const isCached = domain ? !!getResolvedLogoUrl(domain) : false;
    setUrlIndex(0);
    setHasError(false);
    setLoaded(isCached);
  }, [amcName, fundName, domain]);

  const currentUrl = candidateUrls[urlIndex];

  const renderFallback = () => {
    const rawTitle = (amcName || fundName || "MF").trim();
    const badge = rawTitle
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 3)
      .toUpperCase();

    return (
      <div
        className={`relative flex items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 border border-white/20 shadow-md text-white font-black tracking-tighter flex-shrink-0 select-none ${className}`}
        style={{
          width: size,
          height: size,
          minWidth: size,
          minHeight: size,
          fontSize: Math.max(10, Math.floor(size * 0.3)),
        }}
        title={amcName || fundName || "Mutual Fund"}
      >
        {badge}
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
      title={amcName || fundName || "AMC Logo"}
    >
      {/* Show fallback badge while image is loading */}
      {!loaded && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800"
          style={{ zIndex: 1 }}
        >
          <div className="absolute inset-0 animate-pulse bg-white/10" style={{ zIndex: 2 }} />
        </div>
      )}
      <img
        key={currentUrl}
        src={currentUrl}
        alt={amcName || fundName || "AMC Logo"}
        onLoad={handleImageLoad}
        onError={handleImageError}
        style={{ opacity: loaded ? 1 : 0, transition: "opacity 0.3s ease", zIndex: 3 }}
        className="w-full h-full object-contain p-0.5"
        loading="eager"
        decoding="async"
      />
    </div>
  );
});

AMCLogo.displayName = "AMCLogo";
export default AMCLogo;
