"use client";

import React, { useState } from "react";
import { Building2, Utensils, ShoppingCart, Film, Car, HeartPulse, Zap, Home, DollarSign, Wallet } from "lucide-react";
import {
  getEntityDomain,
  getEntityVectorLogo,
  getEntityLogoDev,
  getEntityGoogleFavicon,
} from "@/utils/entityLogos";

interface EntityLogoProps {
  name: string;
  category?: string;
  size?: number;
  className?: string;
}

export default function EntityLogo({
  name,
  category = "",
  size = 40,
  className = "",
}: EntityLogoProps) {
  const [failedSources, setFailedSources] = useState<Record<string, number>>({});
  const domain = getEntityDomain(name);

  // Generate 2-letter uppercase initials
  const initials =
    name
      .trim()
      .split(/[\s/\\-_]+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "TX";

  // Multi-tier candidate URLs in order of clarity & speed
  const candidateUrls: string[] = domain
    ? [
        getEntityVectorLogo(domain),
        getEntityLogoDev(domain, size),
        getEntityGoogleFavicon(domain, 128),
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

  const getCategoryIcon = () => {
    const cat = (category || "").toLowerCase();
    if (cat.includes("food") || cat.includes("dining")) return <Utensils size={size * 0.45} className="opacity-60 text-amber-400" />;
    if (cat.includes("housing") || cat.includes("rent")) return <Home size={size * 0.45} className="opacity-60 text-rose-400" />;
    if (cat.includes("shopping") || cat.includes("lifestyle")) return <ShoppingCart size={size * 0.45} className="opacity-60 text-pink-400" />;
    if (cat.includes("entertainment") || cat.includes("ott")) return <Film size={size * 0.45} className="opacity-60 text-cyan-400" />;
    if (cat.includes("transport") || cat.includes("fuel")) return <Car size={size * 0.45} className="opacity-60 text-purple-400" />;
    if (cat.includes("health") || cat.includes("medical")) return <HeartPulse size={size * 0.45} className="opacity-60 text-emerald-400" />;
    if (cat.includes("utilities") || cat.includes("bills")) return <Zap size={size * 0.45} className="opacity-60 text-blue-400" />;
    if (cat.includes("salary") || cat.includes("bonus")) return <Building2 size={size * 0.45} className="opacity-60 text-emerald-400" />;
    return <Building2 size={size * 0.45} className="opacity-50" />;
  };

  const borderRadius = Math.max(6, Math.floor(size * 0.22));

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden flex-shrink-0 transition-all ${className}`}
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
          className="w-full h-full object-contain p-1.5"
          loading="lazy"
        />
      ) : (
        /* High-Definition Monogram / Category Placeholder */
        <div className="flex flex-col items-center justify-center text-center w-full h-full p-1 select-none">
          {initials && initials.length > 0 ? (
            <span
              className="font-bold font-mono tracking-tight leading-none"
              style={{
                fontSize: Math.max(9, Math.floor(size * 0.38)),
                color: "var(--app-fg)",
              }}
            >
              {initials}
            </span>
          ) : (
            getCategoryIcon()
          )}
        </div>
      )}
    </div>
  );
}
