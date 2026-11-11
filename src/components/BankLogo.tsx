"use client";

import React, { useState } from "react";
import { Landmark } from "lucide-react";
import {
  getBankDomain,
  getVectorLogoUrl,
  getLogosDevUrl,
  getGoogleFaviconUrl,
} from "@/utils/bankLogos";

interface BankLogoProps {
  name: string;
  size?: number;
  className?: string;
  showDomain?: boolean;
}

export default function BankLogo({
  name,
  size = 36,
  className = "",
  showDomain = false,
}: BankLogoProps) {
  // Store failed candidate counts keyed by bank name (avoids useEffect setState cascading renders)
  const [failedSources, setFailedSources] = useState<Record<string, number>>({});
  const domain = getBankDomain(name);

  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase() || "BK";

  if (!name.trim()) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border flex-shrink-0 ${className}`}
        style={{
          width: size,
          height: size,
          borderColor: "var(--app-border-subtle)",
          backgroundColor: "var(--app-bg)",
        }}
      >
        <Landmark size={Math.max(10, size * 0.45)} className="opacity-40" />
      </div>
    );
  }

  // Multi-tier candidate URLs in order of clarity & resolution:
  // 1. Vector SVG (Unavatar) -> Infinite resolution, zero pixelation, crystal-clear vector graphics
  // 2. High-Density Retina PNG (Logo.dev) -> 600x600 px lossless high-resolution raster
  // 3. Favicon Backup (Google) -> High-res icon fallback
  const candidateUrls: string[] = domain
    ? [
        getVectorLogoUrl(domain),
        getLogosDevUrl(domain, size),
        getGoogleFaviconUrl(domain, 128),
      ]
    : [];

  const candidateIndex = failedSources[name] || 0;
  const activeUrl = candidateIndex < candidateUrls.length ? candidateUrls[candidateIndex] : null;

  const handleImageError = () => {
    setFailedSources((prev) => ({
      ...prev,
      [name]: (prev[name] || 0) + 1,
    }));
  };

  // Responsive sizing, padding, and corner radius
  const isSmall = size < 20;
  const isMedium = size >= 20 && size < 32;
  const padding = isSmall ? 1 : isMedium ? 2 : 3.5;
  const borderRadius = isSmall ? 4 : isMedium ? 6 : 8;
  const monogramFontSize = Math.max(7, Math.floor(size * 0.4));

  return (
    <div className={`flex items-center gap-2 flex-shrink-0 ${className}`}>
      <div
        className="relative flex items-center justify-center overflow-hidden flex-shrink-0 transition-colors"
        style={{
          width: size,
          height: size,
          borderRadius: `${borderRadius}px`,
          backgroundColor: activeUrl ? "#ffffff" : "var(--app-bg)",
          borderColor: "var(--app-border-subtle)",
          borderWidth: "1px",
          borderStyle: "solid",
        }}
      >
        {activeUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            key={activeUrl}
            src={activeUrl}
            alt={`${name} logo`}
            onError={handleImageError}
            draggable={false}
            loading="eager"
            decoding="async"
            className="w-full h-full object-contain"
            style={{
              padding: `${padding}px`,
              imageRendering: "-webkit-optimize-contrast",
            }}
          />
        ) : (
          /* Graceful Monogram Fallback */
          <span
            className="font-bold font-mono tracking-tight select-none leading-none"
            style={{
              color: "var(--app-fg)",
              fontSize: `${monogramFontSize}px`,
            }}
          >
            {initials}
          </span>
        )}
      </div>

      {showDomain && domain && (
        <span className="text-[11px] font-mono opacity-60 truncate">
          {domain}
        </span>
      )}
    </div>
  );
}
