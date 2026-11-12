"use client";

import React, { useState } from "react";
import { Landmark, Banknote } from "lucide-react";
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

/* =========================================================================
   AUTHENTIC BUILT-IN VECTOR MARKS (Infinite clarity, 100% offline, 0ms lag)
   ========================================================================= */

function CashMark({ size, className = "" }: { size: number; className?: string }) {
  const iconSize = Math.max(12, Math.round(size * 0.58));
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 rounded-md border ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: "rgba(16, 185, 129, 0.14)",
        borderColor: "rgba(16, 185, 129, 0.35)",
        color: "#10b981",
      }}
      title="Cash Account"
    >
      <Banknote size={iconSize} strokeWidth={2.2} />
    </div>
  );
}

function SbiMark({ size, className = "" }: { size: number; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 rounded-md overflow-hidden ${className}`}
      style={{
        width: size,
        height: size,
      }}
      title="State Bank of India"
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="50" cy="50" r="48" fill="#0072BC" />
        <circle cx="50" cy="46" r="14" fill="#FFFFFF" />
        <rect x="44" y="46" width="12" height="44" fill="#FFFFFF" />
      </svg>
    </div>
  );
}

function HdfcMark({ size, className = "" }: { size: number; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 rounded-md overflow-hidden border ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: "#FFFFFF",
        borderColor: "rgba(0, 76, 143, 0.3)",
      }}
      title="HDFC Bank"
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="100" height="100" rx="16" fill="#FFFFFF" />
        {/* 4 Blue Corner L-brackets */}
        <path d="M16 16 H42 V28 H28 V42 H16 Z" fill="#004C8F" />
        <path d="M84 16 H58 V28 H72 V42 H84 Z" fill="#004C8F" />
        <path d="M16 84 H42 V72 H28 V58 H16 Z" fill="#004C8F" />
        <path d="M84 84 H58 V72 H72 V58 H84 Z" fill="#004C8F" />
        {/* Center Red Square */}
        <rect x="36" y="36" width="28" height="28" fill="#ED232A" />
      </svg>
    </div>
  );
}

function IciciMark({ size, className = "" }: { size: number; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 rounded-md overflow-hidden border ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: "#881B1B",
        borderColor: "rgba(243, 112, 33, 0.4)",
      }}
      title="ICICI Bank"
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="100" height="100" rx="16" fill="#881B1B" />
        <circle cx="50" cy="28" r="9" fill="#F37021" />
        <path
          d="M36 46 C42 42 58 42 62 48 C66 54 60 62 48 70 C40 76 42 82 54 82 C62 82 66 78 66 78"
          stroke="#F37021"
          strokeWidth="9"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </div>
  );
}

function AxisMark({ size, className = "" }: { size: number; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 rounded-md overflow-hidden border ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: "#861F41",
        borderColor: "rgba(134, 31, 65, 0.4)",
      }}
      title="Axis Bank"
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="100" height="100" rx="16" fill="#861F41" />
        <polygon points="50,18 84,82 61,82 50,60 39,82 16,82" fill="#FFFFFF" />
        <polygon points="50,38 68,72 56,72 50,60 44,72 32,72" fill="#861F41" />
      </svg>
    </div>
  );
}

function KotakMark({ size, className = "" }: { size: number; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 rounded-md overflow-hidden border ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: "#ED1B24",
        borderColor: "rgba(237, 27, 36, 0.4)",
      }}
      title="Kotak Mahindra Bank"
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="100" height="100" rx="16" fill="#ED1B24" />
        <path
          d="M26 62 C20 54 22 40 34 38 C46 36 54 48 62 60 C70 72 78 76 86 68 C92 62 90 48 80 44 C70 40 62 52 54 64"
          stroke="#FFFFFF"
          strokeWidth="8"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </div>
  );
}

function ZerodhaMark({ size, className = "" }: { size: number; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 rounded-md overflow-hidden border ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: "#387ED1",
        borderColor: "rgba(56, 126, 209, 0.4)",
      }}
      title="Zerodha"
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="100" height="100" rx="16" fill="#387ED1" />
        <path
          d="M24 32 H76 L32 68 H76"
          stroke="#FFFFFF"
          strokeWidth="12"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </div>
  );
}

function GrowwMark({ size, className = "" }: { size: number; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 rounded-md overflow-hidden border ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: "#00D09C",
        borderColor: "rgba(0, 208, 156, 0.4)",
      }}
      title="Groww"
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="100" height="100" rx="16" fill="#00D09C" />
        <circle cx="50" cy="50" r="26" stroke="#FFFFFF" strokeWidth="8" fill="none" strokeDasharray="120 40" strokeLinecap="round" />
        <path d="M48 36 L64 50 L48 64" stroke="#FFFFFF" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    </div>
  );
}

function PaytmMark({ size, className = "" }: { size: number; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 rounded-md overflow-hidden border ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: "#002E6E",
        borderColor: "rgba(0, 186, 242, 0.4)",
      }}
      title="Paytm"
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="100" height="100" rx="16" fill="#002E6E" />
        <text
          x="50"
          y="62"
          fontSize="30"
          fontWeight="900"
          fontFamily="system-ui, -apple-system, sans-serif"
          fill="#00BAF2"
          textAnchor="middle"
        >
          paytm
        </text>
      </svg>
    </div>
  );
}

function BobMark({ size, className = "" }: { size: number; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 rounded-md overflow-hidden border ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: "#F26522",
        borderColor: "rgba(242, 101, 34, 0.4)",
      }}
      title="Bank of Baroda"
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="100" height="100" rx="16" fill="#F26522" />
        <circle cx="50" cy="50" r="28" fill="#FFFFFF" />
        <circle cx="50" cy="50" r="16" fill="#F26522" />
        <path d="M34 50 H66 M50 34 V66" stroke="#FFFFFF" strokeWidth="4" />
      </svg>
    </div>
  );
}

function PnbMark({ size, className = "" }: { size: number; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 rounded-md overflow-hidden border ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: "#A20000",
        borderColor: "rgba(255, 194, 14, 0.4)",
      }}
      title="Punjab National Bank"
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="100" height="100" rx="16" fill="#A20000" />
        <circle cx="50" cy="50" r="30" fill="#FFC20E" />
        <circle cx="50" cy="50" r="20" fill="#A20000" />
        <rect x="44" y="30" width="12" height="40" fill="#FFC20E" />
      </svg>
    </div>
  );
}

export function getKnownBankMark(name: string): string | null {
  if (!name || !name.trim()) return null;
  const clean = name.trim().toLowerCase();

  // 1. Cash / Liquid
  if (
    clean.includes("cash") ||
    clean === "vault" ||
    clean.includes("in hand") ||
    clean.includes("liquid")
  ) {
    return "cash";
  }

  // 2. SBI (State Bank of India)
  if (
    clean === "sbi" ||
    clean.startsWith("sbi ") ||
    clean.endsWith(" sbi") ||
    clean.includes(" sbi ") ||
    clean.includes("state bank")
  ) {
    return "sbi";
  }

  // 3. HDFC
  if (clean.includes("hdfc")) {
    return "hdfc";
  }

  // 4. ICICI
  if (clean.includes("icici")) {
    return "icici";
  }

  // 5. Axis
  if (
    clean === "axis" ||
    clean.startsWith("axis ") ||
    clean.endsWith(" axis") ||
    clean.includes(" axis ") ||
    clean.includes("axis bank")
  ) {
    return "axis";
  }

  // 6. Kotak
  if (clean.includes("kotak")) {
    return "kotak";
  }

  // 7. Zerodha / Kite
  if (clean.includes("zerodha") || clean.includes("kite")) {
    return "zerodha";
  }

  // 8. Groww
  if (clean.includes("groww")) {
    return "groww";
  }

  // 9. Paytm
  if (clean.includes("paytm")) {
    return "paytm";
  }

  // 10. Bank of Baroda
  if (clean === "bob" || clean.includes("baroda") || clean.includes("bank of baroda")) {
    return "bob";
  }

  // 11. PNB
  if (clean === "pnb" || clean.includes("punjab national")) {
    return "pnb";
  }

  return null;
}

export default function BankLogo({
  name,
  size = 36,
  className = "",
  showDomain = false,
}: BankLogoProps) {
  const [failedSources, setFailedSources] = useState<Record<string, number>>({});

  if (!name || !name.trim()) {
    return (
      <div
        className={`flex items-center justify-center rounded-md border flex-shrink-0 ${className}`}
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

  const knownMark = getKnownBankMark(name);
  const domain = getBankDomain(name);

  // If matched to an authentic vector mark, render it immediately
  if (knownMark) {
    return (
      <div className={`flex items-center gap-2 flex-shrink-0 ${className}`}>
        {knownMark === "cash" && <CashMark size={size} />}
        {knownMark === "sbi" && <SbiMark size={size} />}
        {knownMark === "hdfc" && <HdfcMark size={size} />}
        {knownMark === "icici" && <IciciMark size={size} />}
        {knownMark === "axis" && <AxisMark size={size} />}
        {knownMark === "kotak" && <KotakMark size={size} />}
        {knownMark === "zerodha" && <ZerodhaMark size={size} />}
        {knownMark === "groww" && <GrowwMark size={size} />}
        {knownMark === "paytm" && <PaytmMark size={size} />}
        {knownMark === "bob" && <BobMark size={size} />}
        {knownMark === "pnb" && <PnbMark size={size} />}

        {showDomain && domain && (
          <span className="text-[11px] font-mono opacity-60 truncate">
            {domain}
          </span>
        )}
      </div>
    );
  }

  // Multi-tier candidate URLs for other international or domestic institutions:
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

  const isSmall = size < 20;
  const isMedium = size >= 20 && size < 32;
  const padding = isSmall ? 1 : isMedium ? 2 : 3.5;
  const borderRadius = isSmall ? 4 : isMedium ? 6 : 8;
  const monogramFontSize = Math.max(7, Math.floor(size * 0.38));

  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase() || "BK";

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
