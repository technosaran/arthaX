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
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
      title="Apple Cash / Vault"
    >
      <svg
        viewBox="0 0 170 170"
        className="w-full h-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="170" height="170" rx="38" fill="url(#appleCashGradBank)" />
        <defs>
          <linearGradient id="appleCashGradBank" x1="0" y1="0" x2="170" y2="170" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#064E3B" />
            <stop offset="100%" stopColor="#022c22" />
          </linearGradient>
        </defs>
        <path
          d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.05-7.62-7.85-11.77-14.41-6.1-9.7-10.78-20.91-14.05-33.64-3.26-12.72-4.9-24.52-4.9-35.39 0-14.36 3.48-26.04 10.45-35.03 6.97-8.99 15.68-13.59 26.13-13.8 4.35 0 9.48 1.25 15.39 3.75 5.91 2.5 9.71 3.81 11.4 3.93 1.91-.12 5.92-1.5 12.03-4.14 6.11-2.64 11.22-3.83 15.33-3.56 10.46.66 18.94 4.54 25.43 11.64-8.92 5.45-13.25 12.87-12.98 22.28.27 8.94 3.82 16.31 10.66 22.12 6.84 5.81 14.88 9.07 24.12 9.77-2.39 7.42-5.44 15.14-9.15 23.16zM119.22 31.84c0-7.22 2.61-13.9 7.83-20.04 5.22-6.14 11.58-10.07 19.08-11.8 0 1.09.05 2.18.05 3.27 0 7.33-2.77 14.24-8.31 20.73-5.54 6.49-12.08 10.02-18.65 10.59-.22-.92-.35-1.84-.35-2.75z"
          fill="#34D399"
        />
      </svg>
    </div>
  );
}

function SbiMark({ size, className = "" }: { size: number; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
      }}
      title="State Bank of India"
    >
      <svg
        viewBox="0 0 500 500"
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="250" cy="250" r="45" fill="#FFFFFF" />
        <rect x="234" y="250" width="32" height="249" fill="#FFFFFF" />
        <path fill="#0072BC" d="m234,499a249,249 0 1,1 32,0V295a45,45 0 1,0-32,0" />
      </svg>
    </div>
  );
}

function HdfcMark({ size, className = "" }: { size: number; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
      }}
      title="HDFC Bank"
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="100" height="100" rx="16" fill="#004c8f" />
        <rect x="18" y="18" width="64" height="64" fill="#ffffff" />
        <rect x="42" y="10" width="16" height="80" fill="#004c8f" />
        <rect x="10" y="42" width="80" height="16" fill="#004c8f" />
        <rect x="34" y="34" width="32" height="32" fill="#ed232a" />
      </svg>
    </div>
  );
}

function IciciMark({ size, className = "" }: { size: number; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
      }}
      title="ICICI Bank"
    >
      <svg
        viewBox="-2.07 -1.48 19 19"
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g transform="translate(-122.10512,-47.344444)">
          <g transform="matrix(0.96229857,0,0,0.96229857,4.6085251,2.3884509)">
            <path
              d="m 126.52861,50.421605 c 3.74965,-3.722081 8.29855,-4.688086 10.11894,-2.151117 1.82039,2.536968 0.22049,7.664648 -3.52916,11.386729 -3.74964,3.749642 -8.29854,4.714269 -10.14649,2.14974 -1.79145,-2.563151 -0.19155,-7.664649 3.55671,-11.385352"
              fill="#f06321"
            />
            <path
              d="m 129.01046,48.435852 c -0.41341,0.303169 -0.82682,0.661459 -1.24023,1.048687 -3.28111,3.252171 -4.66053,7.718392 -3.03306,9.952192 1.6812,2.232422 5.70645,1.405599 9.07024,-1.87551 1.82039,-1.763889 3.03306,-3.804763 3.52916,-5.706456 0.1378,-1.405599 -0.0551,-2.647211 -0.68902,-3.584277 -1.43316,-1.984375 -4.52134,-1.820389 -7.63709,0.165364"
              fill="#ae282e"
            />
            <path
              d="m 133.75229,48.849264 v 0.08268 c -0.0275,0.468533 -0.30317,1.047309 -0.79926,1.543403 -0.74414,0.71658 -1.73633,0.992187 -2.15112,0.580154 -0.46853,-0.440972 -0.19154,-1.406977 0.55259,-2.178678 0.77171,-0.744141 1.76389,-0.992188 2.17731,-0.551216 0.1378,0.137804 0.22048,0.303169 0.22048,0.523655 m -2.86632,12.654524 c -1.76527,1.322917 -3.58428,1.985754 -5.34954,1.710146 0.74414,0.02756 1.35185,-0.80064 1.84794,-1.903071 0.4961,-1.129991 0.77171,-2.1773 1.01975,-3.170866 0.35829,-1.570963 0.38586,-2.673394 0.19293,-2.921441 -0.30317,-0.387228 -0.96463,-0.303168 -1.73771,0.137804 -0.38585,0.220486 -0.88194,0.08268 -0.30179,-0.633898 0.60634,-0.716579 2.94901,-2.426725 3.77583,-2.702332 0.93844,-0.248047 1.98575,0.110243 1.62746,1.129991 -0.24942,0.744141 -3.50159,9.235612 -1.07487,8.353667"
              fill="#ffffff"
            />
          </g>
        </g>
      </svg>
    </div>
  );
}

function AxisMark({ size, className = "" }: { size: number; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
      }}
      title="Axis Bank"
    >
      <svg
        viewBox="0 0 285 255"
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M 142.27,10.47 C 156.13,34.28 170.11,58.02 183.82,81.92 C 161.66,121.01 139.82,160.29 116.91,198.95 C 108.12,213.79 99.57,228.77 90.88,243.66 C 62.7,243.83 34.52,243.82 6.34,243.78 C 7.2,241.85 8.05,239.91 9.09,238.07 C 53.46,162.19 98,86.41 142.27,10.47 z"
          fill="#ae285d"
        />
        <path
          d="M 142.28,155.63 C 170.56,155.62 198.84,155.42 227.12,155.89 C 243.96,185.25 261.34,214.29 278.03,243.73 C 249.75,243.87 221.48,243.76 193.2,243.74 C 176.37,214.28 158.79,185.27 142.28,155.63 z"
          fill="#ae285d"
        />
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

  // Cash / Vault has no domain; render authentic Apple Cash mark immediately
  if (knownMark === "cash") {
    return (
      <div className={`flex items-center gap-2 flex-shrink-0 ${className}`}>
        <CashMark size={size} />
      </div>
    );
  }

  // Tier 1: User's configured Logo.dev API (#1 Priority)
  // Tier 2: Vector SVG (Unavatar)
  // Tier 3: Google Favicon service
  const candidateUrls: string[] = domain
    ? [
        getLogosDevUrl(domain, size),
        getVectorLogoUrl(domain),
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
  const padding = isSmall ? 0 : isMedium ? 1 : 2;
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
          backgroundColor: activeUrl ? "transparent" : "var(--app-bg)",
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
        ) : knownMark ? (
          <>
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
          </>
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
