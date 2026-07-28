"use client";

import React, { useState, useMemo, memo } from "react";
import { getBankDomain, getBankLogoUrls } from "@/lib/banks";
import { saveResolvedLogoUrl } from "@/lib/logo-cache";

interface BankLogoProps {
  bankName?: string | null;
  accountName?: string;
  type?: string;
  size?: number;
  className?: string;
}

type LogoLoadState = {
  key: string;
  imgLoaded: boolean;
  srcIndex: number;
  allFailed: boolean;
};

/**
 * Brand-accurate colors for major Indian & Global banks & fintechs.
 * Used as the fallback logo when real image fails to load.
 */
const BANK_BRANDS: Record<string, { abbr: string; bg: string; fg: string }> = {
  "state bank of india (sbi)":  { abbr: "SBI",   bg: "#1a4d8f", fg: "#ffffff" },
  "state bank of india":        { abbr: "SBI",   bg: "#1a4d8f", fg: "#ffffff" },
  "sbi":                         { abbr: "SBI",   bg: "#1a4d8f", fg: "#ffffff" },
  "punjab national bank (pnb)": { abbr: "PNB",   bg: "#d71920", fg: "#ffffff" },
  "pnb":                         { abbr: "PNB",   bg: "#d71920", fg: "#ffffff" },
  "bank of baroda (bob)":       { abbr: "BOB",   bg: "#f36f21", fg: "#ffffff" },
  "canara bank":                 { abbr: "CB",    bg: "#ffd700", fg: "#1a237e" },
  "union bank of india":        { abbr: "UBI",   bg: "#e53935", fg: "#ffffff" },
  "bank of india (boi)":        { abbr: "BOI",   bg: "#ff6f00", fg: "#ffffff" },
  "indian bank":                 { abbr: "IB",    bg: "#1565c0", fg: "#ffffff" },
  "central bank of india":      { abbr: "CBI",   bg: "#c62828", fg: "#ffffff" },
  "indian overseas bank":       { abbr: "IOB",   bg: "#0d47a1", fg: "#ffffff" },
  "uco bank":                    { abbr: "UCO",   bg: "#7b1fa2", fg: "#ffffff" },
  "bank of maharashtra":        { abbr: "BOM",   bg: "#1b5e20", fg: "#ffffff" },
  "punjab & sind bank":         { abbr: "PSB",   bg: "#880e4f", fg: "#ffffff" },
  "hdfc bank":                   { abbr: "HDFC",  bg: "#004b8d", fg: "#ffffff" },
  "hdfc":                        { abbr: "HDFC",  bg: "#004b8d", fg: "#ffffff" },
  "icici bank":                  { abbr: "ICICI", bg: "#f57c00", fg: "#ffffff" },
  "icici":                       { abbr: "ICICI", bg: "#f57c00", fg: "#ffffff" },
  "axis bank":                   { abbr: "AXIS",  bg: "#97144d", fg: "#ffffff" },
  "axis":                        { abbr: "AXIS",  bg: "#97144d", fg: "#ffffff" },
  "kotak mahindra bank":        { abbr: "KMB",   bg: "#ed1c24", fg: "#ffffff" },
  "kotak":                       { abbr: "KMB",   bg: "#ed1c24", fg: "#ffffff" },
  "indusind bank":               { abbr: "IIB",   bg: "#1a237e", fg: "#ffffff" },
  "yes bank":                    { abbr: "YES",   bg: "#0033a0", fg: "#ffffff" },
  "idfc first bank":            { abbr: "IDFC",  bg: "#9c1d26", fg: "#ffffff" },
  "federal bank":                { abbr: "FB",    bg: "#002f6c", fg: "#ffd700" },
  "south indian bank":          { abbr: "SIB",   bg: "#009688", fg: "#ffffff" },
  "karnataka bank":              { abbr: "KB",    bg: "#e65100", fg: "#ffffff" },
  "rbl bank":                    { abbr: "RBL",   bg: "#003399", fg: "#ff6600" },
  "karur vysya bank":           { abbr: "KVB",   bg: "#6a1b9a", fg: "#ffffff" },
  "bandhan bank":                { abbr: "BB",    bg: "#e53935", fg: "#ffffff" },
  "idbi bank":                   { abbr: "IDBI",  bg: "#1b5e20", fg: "#ffffff" },
  "city union bank":            { abbr: "CUB",   bg: "#0d47a1", fg: "#ffd700" },
  "dcb bank":                    { abbr: "DCB",   bg: "#1a237e", fg: "#ffffff" },
  "tamilnad mercantile bank":   { abbr: "TMB",   bg: "#b71c1c", fg: "#ffd700" },
  "j&k bank":                   { abbr: "JKB",   bg: "#0d47a1", fg: "#ffffff" },
  "csb bank":                    { abbr: "CSB",   bg: "#f44336", fg: "#ffffff" },
  "dhanlaxmi bank":              { abbr: "DLB",   bg: "#1565c0", fg: "#ffffff" },
  "hsbc india":                  { abbr: "HSBC",  bg: "#db0011", fg: "#ffffff" },
  "hsbc":                        { abbr: "HSBC",  bg: "#db0011", fg: "#ffffff" },
  "standard chartered":         { abbr: "SC",    bg: "#0072aa", fg: "#ffffff" },
  "citibank india":              { abbr: "CITI",  bg: "#003b70", fg: "#ffffff" },
  "citibank":                    { abbr: "CITI",  bg: "#003b70", fg: "#ffffff" },
  "dbs":                         { abbr: "DBS",   bg: "#e4002b", fg: "#ffffff" },
  "deutsche bank india":        { abbr: "DB",    bg: "#0018a8", fg: "#ffffff" },
  "barclays india":              { abbr: "BRC",   bg: "#00aeef", fg: "#ffffff" },
  "j.p. morgan india":          { abbr: "JPM",   bg: "#003087", fg: "#ffffff" },
  "au small finance bank":      { abbr: "AU",    bg: "#6a1b9a", fg: "#ffd740" },
  "equitas small finance bank": { abbr: "EQ",    bg: "#00695c", fg: "#ffffff" },
  "ujjivan small finance bank": { abbr: "UJ",    bg: "#ff6f00", fg: "#ffffff" },
  "paytm payments bank":        { abbr: "PTM",   bg: "#00baf2", fg: "#042e60" },
  "paytm":                       { abbr: "PTM",   bg: "#00baf2", fg: "#042e60" },
  "airtel payments bank":       { abbr: "AIR",   bg: "#ed1c24", fg: "#ffffff" },
  "jio payments bank":          { abbr: "JIO",   bg: "#0a3878", fg: "#ffffff" },
  "india post payments bank":   { abbr: "IPPB",  bg: "#e53935", fg: "#ffffff" },
  "fino payments bank":         { abbr: "FINO",  bg: "#1565c0", fg: "#ffffff" },
  "jupiter":                     { abbr: "JUP",   bg: "#6c5ce7", fg: "#ffffff" },
  "fi money":                    { abbr: "Fi",    bg: "#6200ea", fg: "#ffffff" },
  "niyo":                        { abbr: "NIYO",  bg: "#1de9b6", fg: "#1a1a2e" },
  "slice":                       { abbr: "SLC",   bg: "#ff3d00", fg: "#ffffff" },
  "onecard":                     { abbr: "1C",    bg: "#000000", fg: "#c0c0c0" },
  "fampay":                      { abbr: "FAM",   bg: "#ffea00", fg: "#1a1a2e" },
  "mobikwik":                    { abbr: "MK",    bg: "#0070f3", fg: "#ffffff" },
  "phonepe":                     { abbr: "PPe",   bg: "#5f259f", fg: "#ffffff" },
  "google pay":                  { abbr: "GPay",  bg: "#4285f4", fg: "#ffffff" },
  "amazon pay":                  { abbr: "APay",  bg: "#ff9900", fg: "#232f3e" },
  "cred":                        { abbr: "CRED",  bg: "#1a1a2e", fg: "#c5a47e" },
  "bharatpe":                    { abbr: "BPe",   bg: "#0041c4", fg: "#ffffff" },
  "zerodha":                     { abbr: "ZRD",   bg: "#387ed1", fg: "#ffffff" },
  "coin":                        { abbr: "ZRD",   bg: "#387ed1", fg: "#ffffff" },
  "coin by zerodha":             { abbr: "ZRD",   bg: "#387ed1", fg: "#ffffff" },
  "upstox":                      { abbr: "UPX",   bg: "#6c3dab", fg: "#ffffff" },
  "groww":                       { abbr: "GRW",   bg: "#5367ff", fg: "#ffffff" },
  "angel one":                   { abbr: "AO",    bg: "#1f1f2e", fg: "#00d09c" },
  "kuvera":                      { abbr: "KUV",   bg: "#0070f3", fg: "#ffffff" },
  "smallcase":                   { abbr: "SC",    bg: "#2f363f", fg: "#17caa6" },
  "chase":                       { abbr: "CHASE", bg: "#005ea6", fg: "#ffffff" },
  "bank of america":             { abbr: "BOFA",  bg: "#d4001a", fg: "#ffffff" },
  "wells fargo":                 { abbr: "WF",    bg: "#cd1409", fg: "#ffff00" },
  "savings":                     { abbr: "🏦",    bg: "#059669", fg: "#ffffff" },
  "savings 2":                   { abbr: "🏦",    bg: "#0d9488", fg: "#ffffff" },
  "checking":                    { abbr: "💳",    bg: "#4f46e5", fg: "#ffffff" },
  "cash":                        { abbr: "💵",    bg: "#15803d", fg: "#ffffff" },
  "cash reserve":                { abbr: "💵",    bg: "#15803d", fg: "#ffffff" },
  "salary":                      { abbr: "💼",    bg: "#2563eb", fg: "#ffffff" },
  "capital one":                 { abbr: "CAP1",  bg: "#004977", fg: "#ffffff" },
  "wise":                        { abbr: "WISE",  bg: "#9fe870", fg: "#2e008b" },
  "revolut":                     { abbr: "REV",   bg: "#000000", fg: "#ffffff" },
  "paypal":                      { abbr: "PP",    bg: "#003087", fg: "#ffffff" },
};

const DOMAIN_BRANDS: Record<string, { abbr: string; bg: string; fg: string }> = {
  "sbi.co.in":            { abbr: "SBI",   bg: "#1a4d8f", fg: "#ffffff" },
  "hdfcbank.com":         { abbr: "HDFC",  bg: "#004b8d", fg: "#ffffff" },
  "icicibank.com":        { abbr: "ICICI", bg: "#f57c00", fg: "#ffffff" },
  "axisbank.com":         { abbr: "AXIS",  bg: "#97144d", fg: "#ffffff" },
  "kotak.com":            { abbr: "KMB",   bg: "#ed1c24", fg: "#ffffff" },
  "pnbindia.in":          { abbr: "PNB",   bg: "#d71920", fg: "#ffffff" },
  "bankofbaroda.in":      { abbr: "BOB",   bg: "#f36f21", fg: "#ffffff" },
  "canarabank.com":       { abbr: "CB",    bg: "#ffd700", fg: "#1a237e" },
  "unionbankofindia.co.in": { abbr: "UBI", bg: "#e53935", fg: "#ffffff" },
  "bankofindia.co.in":    { abbr: "BOI",   bg: "#ff6f00", fg: "#ffffff" },
  "indianbank.in":        { abbr: "IB",    bg: "#1565c0", fg: "#ffffff" },
  "idfcfirstbank.com":    { abbr: "IDFC",  bg: "#9c1d26", fg: "#ffffff" },
  "indusind.com":         { abbr: "IIB",   bg: "#1a237e", fg: "#ffffff" },
  "yesbank.in":           { abbr: "YES",   bg: "#0033a0", fg: "#ffffff" },
  "federalbank.co.in":    { abbr: "FB",    bg: "#002f6c", fg: "#ffd700" },
  "rblbank.com":          { abbr: "RBL",   bg: "#003399", fg: "#ff6600" },
  "paytm.com":            { abbr: "PTM",   bg: "#00baf2", fg: "#042e60" },
  "phonepe.com":           { abbr: "PPe",   bg: "#5f259f", fg: "#ffffff" },
  "pay.google.com":       { abbr: "GPay",  bg: "#4285f4", fg: "#ffffff" },
  "cred.club":            { abbr: "CRED",  bg: "#1a1a2e", fg: "#c5a47e" },
  "zerodha.com":          { abbr: "ZRD",   bg: "#387ed1", fg: "#ffffff" },
  "groww.in":             { abbr: "GRW",   bg: "#5367ff", fg: "#ffffff" },
  "chase.com":            { abbr: "CHASE", bg: "#005ea6", fg: "#ffffff" },
  "bankofamerica.com":   { abbr: "BOFA",  bg: "#d4001a", fg: "#ffffff" },
  "wellsfargo.com":       { abbr: "WF",    bg: "#cd1409", fg: "#ffff00" },
  "capitalone.com":       { abbr: "CAP1",  bg: "#004977", fg: "#ffffff" },
  "wise.com":             { abbr: "WISE",  bg: "#9fe870", fg: "#2e008b" },
  "revolut.com":          { abbr: "REV",   bg: "#000000", fg: "#ffffff" },
  "paypal.com":           { abbr: "PP",    bg: "#003087", fg: "#ffffff" },
};

/**
 * Resolve brand metadata by exact key, domain, or brand token search
 */
function resolveBankBrand(queryName: string, domain?: string | null): { abbr: string; bg: string; fg: string } | null {
  if (domain && DOMAIN_BRANDS[domain.toLowerCase()]) {
    return DOMAIN_BRANDS[domain.toLowerCase()];
  }

  const key = queryName.toLowerCase().trim();
  if (BANK_BRANDS[key]) {
    return BANK_BRANDS[key];
  }

  // Token-based keyword lookup (e.g. "SBI Salary" -> match "sbi", "My HDFC Bank" -> match "hdfc")
  const tokens = key.split(/[\s\-_\/]+/);
  for (const token of tokens) {
    if (BANK_BRANDS[token]) {
      return BANK_BRANDS[token];
    }
  }

  // Keyword substring lookup
  for (const [brandKey, brandObj] of Object.entries(BANK_BRANDS)) {
    if (key.includes(brandKey) || brandKey.includes(key)) {
      return brandObj;
    }
  }

  return null;
}

/**
 * Build a list of real logo image URLs from fast, high-reliability logo CDNs.
 */
export const BankLogo = memo(function BankLogo({
  bankName,
  accountName,
  type,
  size = 48,
  className = "",
}: BankLogoProps) {
  const queryName = useMemo(() => {
    return (
      (bankName ? bankName.trim() : "") ||
      (accountName ? accountName.trim() : "") ||
      (type ? type.trim() : "")
    );
  }, [accountName, bankName, type]);

  const domain = useMemo(() => {
    return queryName ? getBankDomain(queryName) : null;
  }, [queryName]);

  const sources = useMemo(() => {
    return domain ? getBankLogoUrls(domain) : [];
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

  const brand = useMemo(() => {
    return resolveBankBrand(queryName, domain);
  }, [domain, queryName]);

  const fallbackStyle = useMemo(() => {
    const getInitialsInternal = (name: string) => {
      if (!name) return "?";
      if (brand) return brand.abbr;
      return (
        name
          .replace(/\(.*?\)/g, "")
          .split(/\s+/)
          .filter((w) => w.length > 0)
          .slice(0, 2)
          .map((w) => w[0])
          .join("")
          .toUpperCase() || name.charAt(0).toUpperCase()
      );
    };

    const abbrStr = getInitialsInternal(queryName);
    if (brand) {
      const fontSize = size * (abbrStr.length > 3 ? 0.22 : abbrStr.length > 2 ? 0.26 : 0.34);
      return {
        abbr: abbrStr,
        background: brand.bg,
        color: brand.fg,
        fontSize: `${fontSize}px`,
        boxShadow: `0 4px 14px ${brand.bg}44, inset 0 1px 0 rgba(255,255,255,0.2)`,
      };
    }

    const key = queryName.toLowerCase().trim();
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = key.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    const bgColor = `hsl(${hue}, 55%, 45%)`;
    const fontSize = size * (abbrStr.length > 2 ? 0.26 : 0.34);

    return {
      abbr: abbrStr,
      background: `linear-gradient(135deg, ${bgColor}, hsl(${(hue + 30) % 360}, 55%, 50%))`,
      color: "#ffffff",
      fontSize: `${fontSize}px`,
      boxShadow: `0 4px 14px ${bgColor}44, inset 0 1px 0 rgba(255,255,255,0.2)`,
    };
  }, [brand, queryName, size]);

  const currentSource = sources[srcIndex];
  const showImage = Boolean(currentSource) && !allFailed;

  const handleImgLoad = () => {
    setLoadState({ key: logoKey, imgLoaded: true, srcIndex, allFailed: false });
    if (domain && currentSource) {
      saveResolvedLogoUrl(domain, currentSource);
    }
  };

  const handleImgError = () => {
    if (srcIndex < sources.length - 1) {
      setLoadState({ key: logoKey, imgLoaded: false, srcIndex: srcIndex + 1, allFailed: false });
    } else {
      setLoadState({ key: logoKey, imgLoaded: false, srcIndex, allFailed: true });
    }
  };

  if (!queryName) {
    return (
      <div
        className={`flex items-center justify-center rounded-2xl ${className}`}
        style={{
          width: size,
          height: size,
          minWidth: size,
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <svg
          width={size * 0.45}
          height={size * 0.45}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          viewBox="0 0 24 24"
          style={{ color: "var(--text-muted)" }}
        >
          <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 v5m-4 0h4" />
        </svg>
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden flex items-center justify-center select-none font-black rounded-xl shadow-md border border-white/15 ${className}`}
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        background: imgLoaded ? "#ffffff" : fallbackStyle.background,
        color: fallbackStyle.color,
        fontSize: fallbackStyle.fontSize,
        boxShadow: fallbackStyle.boxShadow,
      }}
      title={queryName}
    >
      <span
        aria-hidden={imgLoaded}
        className="font-black select-none text-center"
        style={{
          color: fallbackStyle.color,
          fontSize: fallbackStyle.fontSize,
          opacity: imgLoaded ? 0 : 1,
          transition: "opacity 0.2s ease",
          zIndex: 1,
        }}
      >
        {fallbackStyle.abbr}
      </span>

      {showImage && (
        /* eslint-disable-next-line @next/next/no-img-element -- Logo sources include SVG and favicon endpoints. */
        <img
          key={currentSource}
          src={currentSource}
          alt={`${queryName} logo`}
          width={size}
          height={size}
          className="absolute inset-0 z-10 h-full w-full rounded-xl bg-white object-contain p-1.5 shadow-sm"
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

BankLogo.displayName = "BankLogo";
export default BankLogo;
