"use client";

import React from "react";
import Image from "next/image";

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
      {/* Luxury Obsidian Precision Rhombus Logo (Nano Banana) */}
      <div
        className="relative flex-shrink-0 rounded-lg overflow-hidden border border-white/10 shadow-sm"
        style={{ width: size, height: size }}
      >
        <Image
          src="/logos/option4.jpg"
          alt="arthaX logo"
          width={size}
          height={size}
          className="w-full h-full object-cover"
          priority
        />
      </div>

      {/* Modern Fintech Wordmark */}
      {showText && (
        <span className="text-base font-extrabold tracking-tight flex items-center leading-none">
          <span>artha</span>
          <span
            className="ml-0.5 font-black"
            style={{ color: "var(--app-accent)" }}
          >
            X
          </span>
        </span>
      )}
    </div>
  );
}
