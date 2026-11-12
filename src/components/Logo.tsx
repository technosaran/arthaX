"use client";

import React from "react";

interface LogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
}

export default function Logo({
  size = 32,
  showText = false,
  className = "",
}: LogoProps) {
  return (
    <div className={`flex items-center select-none ${showText ? "gap-2.5" : ""} ${className}`}>
      {/* High-Precision Vector Fintech Emblem (0ms latency, razor-sharp on Retina/4K) */}
      <div
        className="relative flex-shrink-0 rounded-xl overflow-hidden shadow-sm flex items-center justify-center transition-transform hover:scale-105"
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
            {/* Obsidian Dark Plate Gradient */}
            <linearGradient id="axPlateGrad" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#131922" />
              <stop offset="100%" stopColor="#080b0f" />
            </linearGradient>

            {/* Neon Fintech Emerald Gradient */}
            <linearGradient id="axGreenGrad" x1="20" y1="20" x2="90" y2="90" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#34D399" />
              <stop offset="50%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>

            {/* Platinum Silver Apex Blade Gradient */}
            <linearGradient id="axSilverGrad" x1="20" y1="80" x2="80" y2="20" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#F8FAFC" />
              <stop offset="60%" stopColor="#E2E8F0" />
              <stop offset="100%" stopColor="#94A3B8" />
            </linearGradient>

            {/* Core Luminescence Glow */}
            <linearGradient id="axCoreGlow" x1="50" y1="40" x2="50" y2="60" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#34D399" />
            </linearGradient>
          </defs>

          {/* Rounded Base Tile */}
          <rect
            x="2"
            y="2"
            width="96"
            height="96"
            rx="22"
            fill="url(#axPlateGrad)"
            stroke="rgba(255, 255, 255, 0.12)"
            strokeWidth="2"
          />

          {/* Outer Geometric Precision Rhombus Accent */}
          <path
            d="M50 14 L84 50 L50 86 L16 50 Z"
            stroke="url(#axGreenGrad)"
            strokeWidth="1.5"
            strokeOpacity="0.35"
            fill="none"
          />

          {/* Left Apex Blade: 'A' Left Stroke (Silver/Platinum) */}
          <path
            d="M50 20 L24 76 H38 L50 48 L62 76 H76 L50 20 Z"
            fill="url(#axSilverGrad)"
            fillOpacity="0.95"
          />

          {/* Interlocking Dynamic 'X' Blade (Neon Emerald) */}
          <path
            d="M78 26 L22 74 H36 L78 38 V26 Z"
            fill="url(#axGreenGrad)"
          />
          <path
            d="M74 74 L46 48 L56 38 L84 64 V74 H74 Z"
            fill="url(#axGreenGrad)"
          />

          {/* Precision Horizontal Crossbar & Core Prism */}
          <path
            d="M36 58 H64 L59 50 H41 L36 58 Z"
            fill="url(#axCoreGlow)"
          />

          {/* Apex Summit Light Point */}
          <circle cx="50" cy="20" r="2.5" fill="#FFFFFF" />
        </svg>
      </div>

      {/* Modern Fintech Wordmark */}
      {showText && (
        <span className="text-base font-extrabold tracking-tight flex items-center leading-none">
          <span style={{ color: "var(--app-fg)" }}>artha</span>
          <span
            className="ml-0.5 font-black text-[#10B981]"
            style={{ color: "var(--app-accent, #10B981)" }}
          >
            X
          </span>
        </span>
      )}
    </div>
  );
}
