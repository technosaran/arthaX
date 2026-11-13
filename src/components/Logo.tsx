"use client";

import React, { useId } from "react";

interface LogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
}

/**
 * arthaX Sovereign Brand Mark & Wordmark
 *
 * An iconic, high-precision vector monogram fusing:
 * - The Sanskrit "Artha" (Sovereignty, Capital Elevation, Ascending Apex 'A')
 * - The "X" (Exponential Multiplier, Kinetic Exchange, Infinite Growth)
 *
 * Razor-sharp on 4K/Retina displays, scalable from 16px to 512px with zero distortion.
 */
export default function Logo({
  size = 32,
  showText = false,
  className = "",
}: LogoProps) {
  const rawId = useId();
  // Sanitize id for SVG attribute safety
  const id = `ax-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  // Wordmark font sizing relative to the mark
  const textClass =
    size >= 44
      ? "text-xl tracking-tight"
      : size >= 36
      ? "text-lg tracking-tight"
      : "text-[15px] tracking-tight";

  return (
    <div
      className={`inline-flex items-center select-none ${
        showText ? "gap-2.5" : ""
      } ${className}`}
    >
      {/* High-Precision Sovereign Vector Emblem */}
      <div
        className="relative flex-shrink-0 rounded-2xl overflow-hidden shadow-sm flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 group cursor-pointer"
        style={{
          width: size,
          height: size,
        }}
      >
        <svg
          viewBox="0 0 100 100"
          width={size}
          height={size}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-sm"
        >
          <defs>
            {/* Deep Obsidian Vault Base Plate */}
            <linearGradient
              id={`${id}-bg`}
              x1="0"
              y1="0"
              x2="100"
              y2="100"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#0F141D" />
              <stop offset="50%" stopColor="#080C12" />
              <stop offset="100%" stopColor="#020407" />
            </linearGradient>

            {/* Radial Emerald-Cyan Ambient Core Aura */}
            <radialGradient
              id={`${id}-aura`}
              cx="50"
              cy="48"
              r="44"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#00F5A0" stopOpacity="0.32" />
              <stop offset="45%" stopColor="#00D26A" stopOpacity="0.12" />
              <stop offset="75%" stopColor="#0EA5E9" stopOpacity="0.04" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </radialGradient>

            {/* Holographic Chamfered Rim Gradient */}
            <linearGradient
              id={`${id}-rim`}
              x1="0"
              y1="0"
              x2="100"
              y2="100"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="rgba(255,255,255,0.3)" />
              <stop offset="35%" stopColor="rgba(0,245,160,0.35)" />
              <stop offset="70%" stopColor="rgba(14,165,233,0.2)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.04)" />
            </linearGradient>

            {/* Sovereign Emerald Gradient (Left Ascent & Primary Apex) */}
            <linearGradient
              id={`${id}-emerald`}
              x1="18"
              y1="18"
              x2="82"
              y2="82"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#00F5A0" />
              <stop offset="30%" stopColor="#10B981" />
              <stop offset="70%" stopColor="#059669" />
              <stop offset="100%" stopColor="#047857" />
            </linearGradient>

            {/* Electric Cyan-Azure Gradient (Back Crossing Ray) */}
            <linearGradient
              id={`${id}-cyan`}
              x1="18"
              y1="28"
              x2="82"
              y2="76"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#38BDF8" />
              <stop offset="40%" stopColor="#0EA5E9" />
              <stop offset="80%" stopColor="#0284C7" />
              <stop offset="100%" stopColor="#0369A1" />
            </linearGradient>

            {/* Fore Multiplier Blade Gradient (Crossing Over with Platinum Sheen) */}
            <linearGradient
              id={`${id}-fore`}
              x1="82"
              y1="24"
              x2="22"
              y2="78"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="25%" stopColor="#6EE7B7" />
              <stop offset="65%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#047857" />
            </linearGradient>

            {/* Apex Summit Flare Gradient */}
            <linearGradient
              id={`${id}-apex`}
              x1="50"
              y1="12"
              x2="50"
              y2="26"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#00F5A0" />
            </linearGradient>

            {/* Ambient Drop Shadow for Dimensional Layering */}
            <filter id={`${id}-drop`} x="-25%" y="-25%" width="150%" height="150%">
              <feDropShadow
                dx="0"
                dy="5"
                stdDeviation="5"
                floodColor="#000000"
                floodOpacity="0.65"
              />
            </filter>

            {/* Interlacing Weave Shadow */}
            <filter id={`${id}-weave`} x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow
                dx="-1"
                dy="4"
                stdDeviation="3.5"
                floodColor="#000000"
                floodOpacity="0.8"
              />
            </filter>
          </defs>

          {/* Squircle Canvas Tile with Micro-Bevel */}
          <rect
            x="2"
            y="2"
            width="96"
            height="96"
            rx="24"
            fill={`url(#${id}-bg)`}
            stroke={`url(#${id}-rim)`}
            strokeWidth="1.5"
          />
          <rect
            x="2"
            y="2"
            width="96"
            height="96"
            rx="24"
            fill={`url(#${id}-aura)`}
          />

          {/* Architectural Alignment Lattice Guide */}
          <circle
            cx="50"
            cy="50"
            r="32"
            stroke="rgba(255, 255, 255, 0.05)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />

          {/* 1. BACK RAY OF THE 'X' (Upper-Left to Lower-Right) */}
          <path
            d="M22 30 L78 74"
            stroke={`url(#${id}-cyan)`}
            strokeWidth="10"
            strokeLinecap="round"
          />

          {/* 2. THE SOVEREIGN APEX CHEVRON ('A' ASCENT & SUMMIT) */}
          <path
            d="M22 74 L47.5 18.5 C48.8 16 51.2 16 52.5 18.5 L78 74"
            stroke={`url(#${id}-emerald)`}
            strokeWidth="10.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={`url(#${id}-drop)`}
          />

          {/* 3. FORE MULTIPLIER BLADE ('X' FOREGROUND WEAVE) */}
          <path
            d="M78 30 L50 52 L22 74"
            stroke={`url(#${id}-fore)`}
            strokeWidth="10"
            strokeLinecap="round"
            filter={`url(#${id}-weave)`}
          />

          {/* 4. HORIZONTAL TITANIUM CROSSBAR OF 'A' */}
          <path
            d="M35 52 H65"
            stroke="#FFFFFF"
            strokeWidth="4.5"
            strokeLinecap="round"
            opacity="0.95"
            filter={`url(#${id}-drop)`}
          />

          {/* 5. CENTRAL RADIANT PRISM NEXUS */}
          <circle cx="50" cy="52" r="3" fill="#00F5A0" />
          <circle cx="50" cy="52" r="1.5" fill="#FFFFFF" />

          {/* 6. ZENITH APEX SUMMIT BEACON */}
          <circle cx="50" cy="18" r="3.2" fill={`url(#${id}-apex)`} />
          <circle cx="50" cy="18" r="1.5" fill="#FFFFFF" />
        </svg>
      </div>

      {/* World-Class Modern Fintech Wordmark */}
      {showText && (
        <span
          className={`font-extrabold flex items-center leading-none ${textClass}`}
        >
          <span
            style={{ color: "var(--app-fg)" }}
            className="transition-colors tracking-tight text-white font-bold"
          >
            artha
          </span>
          <span
            className="ml-0.5 font-black bg-gradient-to-tr from-amber-400 via-amber-300 to-yellow-300 bg-clip-text text-transparent"
            style={{
              filter: "drop-shadow(0 0 10px rgba(245, 158, 11, 0.4))",
            }}
          >
            X
          </span>
        </span>
      )}
    </div>
  );
}
