"use client";

import React, { useState } from "react";
import { Banknote, Pencil, Trash2 } from "lucide-react";
import BankLogo from "@/components/BankLogo";

export interface AccountData {
  id: string;
  name: string;
  type: string;
  balance: number;
  last_four?: string;
  created_at?: string;
}

export type CardThemeId =
  | "apple-cash"
  | "sbi-sapphire"
  | "hdfc-cobalt"
  | "icici-ruby"
  | "axis-plum"
  | "kotak-ruby"
  | "demat-cyan"
  | "credit-matte"
  | "amex-gold"
  | "apple-titanium";

export type CardNetworkType = "visa" | "mastercard" | "rupay" | "cash" | "amex";

export interface AppleWalletCardTheme {
  id: CardThemeId;
  name: string;
  bgGradient: string;
  ambientGlow: string;
  borderColor: string;
  chipVariant: "gold" | "silver" | "titanium";
  network: CardNetworkType;
  accentColor: string;
  badgeText: string;
  subLabel: string;
}

export function getAppleWalletTheme(name: string, type: string): AppleWalletCardTheme {
  const clean = (name || "").trim().toLowerCase();
  const cleanType = (type || "").trim().toLowerCase();

  // 1. Cash in Hand / Liquid Cash / Vault
  if (
    clean.includes("cash") ||
    cleanType.includes("liquid") ||
    clean === "vault" ||
    clean.includes("in hand")
  ) {
    return {
      id: "apple-cash",
      name: "Apple Cash Vault",
      bgGradient: "linear-gradient(145deg, #051910 0%, #0d2e20 48%, #04140d 100%)",
      ambientGlow: "radial-gradient(circle at 82% 18%, rgba(16, 185, 129, 0.28) 0%, transparent 62%)",
      borderColor: "rgba(16, 185, 129, 0.35)",
      chipVariant: "gold",
      network: "cash",
      accentColor: "#10b981",
      badgeText: "PERMANENT VAULT",
      subLabel: "LIQUID CASH RESERVE",
    };
  }

  // 2. SBI (State Bank of India)
  if (clean.includes("sbi") || clean.includes("state bank")) {
    return {
      id: "sbi-sapphire",
      name: "SBI Midnight Sapphire",
      bgGradient: "linear-gradient(145deg, #07172e 0%, #0d2953 48%, #051325 100%)",
      ambientGlow: "radial-gradient(circle at 82% 18%, rgba(59, 130, 246, 0.28) 0%, transparent 62%)",
      borderColor: "rgba(59, 130, 246, 0.32)",
      chipVariant: "silver",
      network: "rupay",
      accentColor: "#3b82f6",
      badgeText: "DEBIT CARD",
      subLabel: "SAVINGS ACCOUNT",
    };
  }

  // 3. HDFC Bank
  if (clean.includes("hdfc")) {
    return {
      id: "hdfc-cobalt",
      name: "HDFC Royal Cobalt",
      bgGradient: "linear-gradient(145deg, #081734 0%, #102d60 48%, #061127 100%)",
      ambientGlow: "radial-gradient(circle at 82% 18%, rgba(79, 140, 255, 0.28) 0%, transparent 62%)",
      borderColor: "rgba(99, 102, 241, 0.32)",
      chipVariant: "gold",
      network: "visa",
      accentColor: "#4f46e5",
      badgeText: "DEBIT CARD",
      subLabel: "PREFERRED SAVINGS",
    };
  }

  // 4. ICICI Bank
  if (clean.includes("icici")) {
    return {
      id: "icici-ruby",
      name: "ICICI Crimson Ruby",
      bgGradient: "linear-gradient(145deg, #240c16 0%, #3d1424 48%, #1a070f 100%)",
      ambientGlow: "radial-gradient(circle at 82% 18%, rgba(244, 63, 94, 0.28) 0%, transparent 62%)",
      borderColor: "rgba(244, 63, 94, 0.32)",
      chipVariant: "gold",
      network: "visa",
      accentColor: "#f43f5e",
      badgeText: "DEBIT CARD",
      subLabel: "SAVINGS ACCOUNT",
    };
  }

  // 5. Axis Bank
  if (clean.includes("axis")) {
    return {
      id: "axis-plum",
      name: "Axis Plum Obsidian",
      bgGradient: "linear-gradient(145deg, #24091b 0%, #3b0e2c 48%, #170411 100%)",
      ambientGlow: "radial-gradient(circle at 82% 18%, rgba(236, 72, 153, 0.28) 0%, transparent 62%)",
      borderColor: "rgba(236, 72, 153, 0.32)",
      chipVariant: "gold",
      network: "mastercard",
      accentColor: "#ec4899",
      badgeText: "DEBIT CARD",
      subLabel: "BURGUNDY SAVINGS",
    };
  }

  // 6. Kotak Mahindra Bank
  if (clean.includes("kotak")) {
    return {
      id: "kotak-ruby",
      name: "Kotak Crimson",
      bgGradient: "linear-gradient(145deg, #260c12 0%, #3e141d 48%, #1a060b 100%)",
      ambientGlow: "radial-gradient(circle at 82% 18%, rgba(239, 68, 68, 0.28) 0%, transparent 62%)",
      borderColor: "rgba(239, 68, 68, 0.32)",
      chipVariant: "silver",
      network: "visa",
      accentColor: "#ef4444",
      badgeText: "DEBIT CARD",
      subLabel: "811 SAVINGS",
    };
  }

  // 7. Trading & Demat (Zerodha, Groww, Angel One, Upstox)
  if (
    clean.includes("zerodha") ||
    clean.includes("groww") ||
    clean.includes("kite") ||
    clean.includes("upstox") ||
    clean.includes("angel") ||
    cleanType.includes("trading") ||
    cleanType.includes("demat")
  ) {
    return {
      id: "demat-cyan",
      name: "Brokerage Obsidian",
      bgGradient: "linear-gradient(145deg, #091724 0%, #11253a 48%, #060f18 100%)",
      ambientGlow: "radial-gradient(circle at 82% 18%, rgba(6, 182, 212, 0.28) 0%, transparent 62%)",
      borderColor: "rgba(6, 182, 212, 0.32)",
      chipVariant: "titanium",
      network: "visa",
      accentColor: "#06b6d4",
      badgeText: "TRADING & DEMAT",
      subLabel: "PORTFOLIO ASSETS",
    };
  }

  // 8. Amex / American Express
  if (clean.includes("amex") || clean.includes("american express")) {
    return {
      id: "amex-gold",
      name: "Amex Centurion Platinum",
      bgGradient: "linear-gradient(145deg, #251f14 0%, #3a3220 48%, #19150d 100%)",
      ambientGlow: "radial-gradient(circle at 82% 18%, rgba(245, 158, 11, 0.28) 0%, transparent 62%)",
      borderColor: "rgba(245, 158, 11, 0.35)",
      chipVariant: "gold",
      network: "amex",
      accentColor: "#f59e0b",
      badgeText: "CHARGE CARD",
      subLabel: "CENTURION ACCESS",
    };
  }

  // 9. Credit Card (Generic)
  if (cleanType.includes("credit")) {
    return {
      id: "credit-matte",
      name: "Matte Black Credit",
      bgGradient: "linear-gradient(145deg, #121316 0%, #1e2026 48%, #0a0b0d 100%)",
      ambientGlow: "radial-gradient(circle at 82% 18%, rgba(255, 255, 255, 0.16) 0%, transparent 62%)",
      borderColor: "rgba(255, 255, 255, 0.25)",
      chipVariant: "gold",
      network: "mastercard",
      accentColor: "#f59e0b",
      badgeText: "CREDIT CARD",
      subLabel: "PLATINUM REWARDS",
    };
  }

  // 10. Default Apple Titanium Space Card
  return {
    id: "apple-titanium",
    name: "Apple Space Titanium",
    bgGradient: "linear-gradient(145deg, #141518 0%, #20232a 48%, #0e0f11 100%)",
    ambientGlow: "radial-gradient(circle at 82% 18%, rgba(255, 255, 255, 0.14) 0%, transparent 62%)",
    borderColor: "rgba(255, 255, 255, 0.22)",
    chipVariant: "titanium",
    network: "visa",
    accentColor: "#ffffff",
    badgeText: `DEBIT • ${cleanType ? cleanType.toUpperCase() : "ACCOUNT"}`,
    subLabel: type || "SAVINGS ACCOUNT",
  };
}

/**
 * Laser-Etched EMV Microchip Component
 */
function EMVChip({ variant = "gold" }: { variant?: "gold" | "silver" | "titanium" }) {
  const isGold = variant === "gold";
  const isSilver = variant === "silver";

  return (
    <div
      className={`relative w-10 sm:w-11 h-7 sm:h-8 rounded-[6px] overflow-hidden select-none flex items-center justify-center ${
        isGold
          ? "bg-gradient-to-br from-[#f5df9e] via-[#cfa54c] to-[#926c21] border border-[#fceeaf]/70"
          : isSilver
          ? "bg-gradient-to-br from-[#f2f4f8] via-[#cfd5e0] to-[#8d97a6] border border-white/70"
          : "bg-gradient-to-br from-[#3b3e47] via-[#24262b] to-[#121316] border border-white/30"
      }`}
      style={{
        boxShadow:
          "inset 0 1px 2px rgba(255,255,255,0.4), inset 0 -1px 2px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.5)",
      }}
    >
      <svg
        viewBox="0 0 44 32"
        className="w-full h-full opacity-80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Outer border groove */}
        <rect
          x="1.5"
          y="1.5"
          width="41"
          height="29"
          rx="4"
          stroke={isGold ? "#6b4a13" : isSilver ? "#4a5160" : "#000000"}
          strokeWidth="0.8"
          strokeOpacity="0.7"
        />
        {/* Center contact pad */}
        <rect
          x="14"
          y="8"
          width="16"
          height="16"
          rx="2.5"
          stroke={isGold ? "#6b4a13" : isSilver ? "#4a5160" : "#000000"}
          strokeWidth="0.8"
          strokeOpacity="0.7"
        />
        {/* Horizontal channels */}
        <line
          x1="1.5"
          y1="16"
          x2="14"
          y2="16"
          stroke={isGold ? "#6b4a13" : isSilver ? "#4a5160" : "#000000"}
          strokeWidth="0.8"
          strokeOpacity="0.7"
        />
        <line
          x1="30"
          y1="16"
          x2="42.5"
          y2="16"
          stroke={isGold ? "#6b4a13" : isSilver ? "#4a5160" : "#000000"}
          strokeWidth="0.8"
          strokeOpacity="0.7"
        />
        {/* Vertical channels */}
        <line
          x1="22"
          y1="1.5"
          x2="22"
          y2="8"
          stroke={isGold ? "#6b4a13" : isSilver ? "#4a5160" : "#000000"}
          strokeWidth="0.8"
          strokeOpacity="0.7"
        />
        <line
          x1="22"
          y1="24"
          x2="22"
          y2="30.5"
          stroke={isGold ? "#6b4a13" : isSilver ? "#4a5160" : "#000000"}
          strokeWidth="0.8"
          strokeOpacity="0.7"
        />
        {/* Diagonal notch */}
        <path
          d="M17 11L27 21"
          stroke={isGold ? "#6b4a13" : isSilver ? "#4a5160" : "#000000"}
          strokeWidth="0.6"
          strokeOpacity="0.5"
        />
      </svg>
    </div>
  );
}

/**
 * Minimalist Contactless / NFC Tap-to-Pay Symbol
 */
function ContactlessWave({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`w-4.5 h-4.5 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M7 16.5a4.5 4.5 0 0 1 0-9" opacity="0.45" />
      <path d="M10.5 19a8 8 0 0 1 0-14" opacity="0.75" />
      <path d="M14 21.5a11.5 11.5 0 0 1 0-19" opacity="0.95" />
    </svg>
  );
}

/**
 * Card Network Logos: RuPay, Visa, Mastercard, Apple Cash
 */
function RuPayLogo() {
  return (
    <div className="flex items-center gap-1 select-none">
      <span className="font-sans font-extrabold tracking-tight text-xs text-white drop-shadow-sm">
        RuPay
      </span>
      <div className="flex -space-x-1">
        <span className="w-1.5 h-2.5 bg-[#00A551] transform skew-x-[-22deg] rounded-sm" />
        <span className="w-1.5 h-2.5 bg-[#F37021] transform skew-x-[-22deg] rounded-sm" />
      </div>
    </div>
  );
}

function VisaLogo() {
  return (
    <span className="font-sans font-black italic tracking-tighter text-sm text-white select-none drop-shadow-sm">
      VISA
    </span>
  );
}

function MastercardLogo() {
  return (
    <div className="flex items-center -space-x-2 select-none drop-shadow-sm">
      <div className="w-4 h-4 rounded-full bg-[#EB001B]/90 shadow-sm" />
      <div className="w-4 h-4 rounded-full bg-[#F79E1B]/90 shadow-sm mix-blend-screen" />
    </div>
  );
}

function AmexLogo() {
  return (
    <span className="font-sans font-extrabold tracking-widest text-[10px] text-amber-200 border border-amber-300/40 px-1 py-0.5 rounded select-none">
      AMEX
    </span>
  );
}

function AppleCashBadge() {
  return (
    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/10 border border-white/15 backdrop-blur-md select-none">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]" />
      <span className="text-[9px] font-mono font-bold tracking-wider text-emerald-300 uppercase">
        VAULT CASH
      </span>
    </div>
  );
}

export interface AppleWalletCardProps {
  account: AccountData;
  isCash?: boolean;
  onEditCash?: (acc: AccountData) => void;
  onDelete?: (id: string) => void;
  formatCurrency?: (val: number) => string;
  className?: string;
  isStacked?: boolean;
  stackIndex?: number;
  isActiveInStack?: boolean;
  onSelectInStack?: () => void;
}

export default function AppleWalletCard({
  account,
  isCash = false,
  onEditCash,
  onDelete,
  formatCurrency,
  className = "",
  isStacked = false,
  stackIndex = 0,
  isActiveInStack = false,
  onSelectInStack,
}: AppleWalletCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const theme = getAppleWalletTheme(account.name, account.type);

  const formatINR = (val: number) => {
    if (formatCurrency) return formatCurrency(val);
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(val);
  };

  // Capitalize bank name nicely for Apple Wallet feel
  const displayName = account.name
    .split(" ")
    .map((word) =>
      word.length <= 4 && !word.toLowerCase().includes("bank")
        ? word.toUpperCase()
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    )
    .join(" ");

  return (
    <div
      onClick={isStacked ? onSelectInStack : undefined}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`group relative aspect-[1.586/1] w-full rounded-[22px] sm:rounded-[24px] p-5 sm:p-6 flex flex-col justify-between overflow-hidden transition-all duration-300 ease-out select-none ${
        isStacked
          ? "cursor-pointer"
          : "hover:-translate-y-1.5 hover:shadow-2xl"
      } ${className}`}
      style={{
        background: theme.bgGradient,
        borderWidth: "1px",
        borderStyle: "solid",
        borderColor: theme.borderColor,
        boxShadow: isHovered
          ? `
            inset 0 1px 1px 0 rgba(255, 255, 255, 0.45),
            inset 0 -1px 1px 0 rgba(0, 0, 0, 0.5),
            inset 0 0 0 1px rgba(255, 255, 255, 0.12),
            0 24px 44px -12px rgba(0, 0, 0, 0.85),
            0 8px 18px -4px rgba(0, 0, 0, 0.5)
          `
          : `
            inset 0 1px 1px 0 rgba(255, 255, 255, 0.35),
            inset 0 -1px 1px 0 rgba(0, 0, 0, 0.5),
            inset 0 0 0 1px rgba(255, 255, 255, 0.08),
            0 16px 36px -12px rgba(0, 0, 0, 0.75),
            0 4px 14px -3px rgba(0, 0, 0, 0.4)
          `,
        ...(isStacked && {
          transform: isActiveInStack
            ? "translateY(0px) scale(1)"
            : `translateY(${stackIndex * -64}px) scale(${1 - stackIndex * 0.025})`,
          zIndex: isActiveInStack ? 30 : 20 - stackIndex,
        }),
      }}
    >
      {/* 1. Ambient Dynamic Radial Glow */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-500"
        style={{
          background: theme.ambientGlow,
          opacity: isHovered ? 1 : 0.85,
        }}
      />

      {/* 2. Apple Satin Metallic Specular Sheen (Glides on hover) */}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.03] via-white/[0.06] to-transparent pointer-events-none" />
      <div
        className="absolute -inset-full bg-gradient-to-tr from-transparent via-white/[0.08] to-transparent transform -rotate-45 pointer-events-none transition-transform duration-1000 ease-out"
        style={{
          transform: isHovered
            ? "rotate(-45deg) translate(80%, 80%)"
            : "rotate(-45deg) translate(-80%, -80%)",
        }}
      />

      {/* 3. Micro Texture Mesh */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px)",
          backgroundSize: "14px 14px",
        }}
      />

      {/* 4. Top Header Row: Logo, Branding & Frosted Action Pills */}
      <div className="relative z-10 flex items-start justify-between">
        <div className="flex items-center gap-3">
          {isCash ? (
            <div className="w-10 h-10 rounded-xl overflow-hidden shadow-md ring-1 ring-emerald-500/30 flex-shrink-0 flex items-center justify-center bg-[#064E3B]">
              <BankLogo name="cash" size={40} />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-xl bg-white shadow-md flex items-center justify-center flex-shrink-0 overflow-hidden ring-1 ring-white/20 p-1">
              <BankLogo name={account.name} size={30} />
            </div>
          )}

          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] sm:text-[10px] font-mono tracking-[0.2em] uppercase font-semibold text-white/55">
                {isCash ? "APPLE CASH • VAULT" : `DEBIT • ${account.type}`}
              </span>
              {isCash && (
                <span className="px-1.5 py-0.2 rounded-full text-[8px] font-mono font-bold tracking-wider bg-emerald-500/20 border border-emerald-400/40 text-emerald-300">
                  BUILT-IN
                </span>
              )}
            </div>
            <div className="text-base sm:text-lg font-bold tracking-tight text-white capitalize mt-0.5 truncate max-w-[160px] sm:max-w-[210px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
              {displayName}
            </div>
          </div>
        </div>

        {/* Top Right Controls: Contactless Wave + Frosted Actions */}
        <div className="flex items-center gap-2.5">
          <ContactlessWave className="text-white/60 drop-shadow-sm" />

          {isCash ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEditCash?.(account);
              }}
              title="Update Cash in Hand"
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 hover:bg-white/20 active:scale-95 text-white backdrop-blur-md border border-white/15 transition-all shadow-sm cursor-pointer"
            >
              <Pencil size={11} />
              <span>Edit</span>
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.(account.id);
              }}
              title={`Remove ${account.name}`}
              aria-label={`Remove ${account.name}`}
              className="w-7 h-7 rounded-full bg-white/10 hover:bg-red-500/25 active:scale-90 text-white/50 hover:text-red-300 border border-white/10 hover:border-red-500/30 backdrop-blur-md flex items-center justify-center transition-all opacity-70 group-hover:opacity-100 shadow-sm cursor-pointer"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* 5. Middle Section: Authentic EMV Chip & Masked Card Digits */}
      <div className="relative z-10 my-auto pt-3">
        <div className="flex items-center justify-between">
          <EMVChip variant={theme.chipVariant} />

          <span className="text-[9px] font-mono tracking-[0.24em] uppercase text-white/40 font-medium">
            {isCash ? "LIQUID TENDER" : "SECURE CONTACTLESS"}
          </span>
        </div>

        {/* Card Number Mask */}
        <div className="font-mono text-xs sm:text-sm tracking-[0.22em] font-medium text-white/85 select-all drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] mt-2.5">
          {isCash ? (
            <span>••••  ••••  CASH  HOLD</span>
          ) : (
            <span>••••  ••••  ••••  {account.last_four || "8821"}</span>
          )}
        </div>
      </div>

      {/* 6. Bottom Row: Card Balance & Card Network Insignia */}
      <div className="relative z-10 flex items-end justify-between pt-2 border-t border-white/10">
        <div>
          <span className="text-[9px] uppercase font-mono tracking-[0.18em] text-white/50 block font-semibold">
            AVAILABLE BALANCE
          </span>
          <span className="text-lg sm:text-2xl font-bold font-mono tracking-tight text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
            {formatINR(account.balance)}
          </span>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          {/* Authentic Network Badge */}
          {theme.network === "cash" ? (
            <AppleCashBadge />
          ) : theme.network === "rupay" ? (
            <RuPayLogo />
          ) : theme.network === "mastercard" ? (
            <MastercardLogo />
          ) : theme.network === "amex" ? (
            <AmexLogo />
          ) : (
            <VisaLogo />
          )}

          {/* Minimalist Live Status Dot */}
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)] animate-pulse" />
            <span className="text-[9px] font-mono font-semibold tracking-widest text-emerald-300 uppercase">
              ACTIVE
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
