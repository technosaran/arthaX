"use client";

import React, { useState, useEffect, useMemo } from "react";
import { EntityCategory } from "@/lib/logo-engine/types";

interface LogoProps {
  name: string;
  category?: EntityCategory;
  size?: number;
  rounded?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const CATEGORY_EMOJIS: Record<string, string> = {
  bank: "🏦",
  investment: "📈",
  mutual_fund: "📊",
  crypto: "🪙",
  insurance: "🛡️",
  payment_app: "💳",
  upi: "📱",
  merchant: "🛍️",
  government: "🏛️",
  general: "💼",
};

export function Logo({
  name,
  category = "general",
  size = 40,
  rounded = true,
  className = "",
  style = {},
}: LogoProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const cleanName = useMemo(() => (name || "").trim(), [name]);

  useEffect(() => {
    if (!cleanName) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setHasError(false);

    // Fetch logo metadata from /api/logo endpoint
    const encoded = encodeURIComponent(cleanName);
    const categoryQuery = category ? `&category=${category}` : "";

    fetch(`/api/logo?merchant=${encoded}${categoryQuery}&json=true`)
      .then((res) => {
        if (!res.ok) throw new Error("Logo lookup failed");
        return res.json();
      })
      .then((data) => {
        if (isMounted && data?.best_logo_url) {
          setLogoUrl(data.best_logo_url);
        }
      })
      .catch(() => {
        if (isMounted) setHasError(true);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [cleanName, category]);

  const dimensionStyle: React.CSSProperties = {
    width: `${size}px`,
    height: `${size}px`,
    minWidth: `${size}px`,
    minHeight: `${size}px`,
    ...style,
  };

  const roundedClass = rounded ? "rounded-xl" : "rounded-none";

  if (isLoading) {
    return (
      <div
        style={dimensionStyle}
        className={`animate-pulse bg-white/10 border border-white/10 shrink-0 ${roundedClass} ${className}`}
      />
    );
  }

  if (hasError || !logoUrl) {
    const emoji = CATEGORY_EMOJIS[category] || "💼";
    const letter = (cleanName || "B").charAt(0).toUpperCase();

    return (
      <div
        style={dimensionStyle}
        className={`flex items-center justify-center shrink-0 border border-white/15 bg-gradient-to-br from-slate-800 to-slate-950 text-sky-400 font-extrabold text-sm shadow-sm select-none ${roundedClass} ${className}`}
      >
        {emoji !== "💼" ? emoji : letter}
      </div>
    );
  }

  return (
    <div
      style={dimensionStyle}
      className={`flex items-center justify-center shrink-0 border border-white/15 bg-slate-900/90 p-1 shadow-sm overflow-hidden ${roundedClass} ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logoUrl}
        alt={cleanName}
        className="w-full h-full object-contain rounded-lg"
        loading="lazy"
        onError={() => setHasError(true)}
      />
    </div>
  );
}

export default Logo;
