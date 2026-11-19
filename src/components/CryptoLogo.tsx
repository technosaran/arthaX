"use client";

import React, { useState } from "react";
import {
  normalizeCryptoSymbol,
  getCryptoLogoSources,
  getCryptoFallbackColor,
  KNOWN_CRYPTO_BRANDS,
} from "@/utils/cryptoLogos";

interface CryptoLogoProps {
  symbol: string;
  name?: string;
  size?: number;
  className?: string;
  showEarnBadge?: boolean;
}

/* =========================================================================
   AUTHENTIC BUILT-IN VECTOR MARKS (Infinite clarity, 100% offline, 0ms lag)
   ========================================================================= */

function BitcoinMark({ size }: { size: number }) {
  return (
    <div
      className="flex items-center justify-center flex-shrink-0 select-none overflow-hidden"
      style={{ width: size, height: size }}
      title="Bitcoin (BTC)"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="50" fill="#F7931A" />
        <path
          d="M66.3 43.6c.9-6-3.7-9.3-10-11.4l2-8.2-5-1.2-2 7.9c-1.3-.3-2.7-.6-4.1-.9l2-8.1-5-1.2-2 8.1c-1.1-.3-2.2-.5-3.3-.8l-7-1.7-1.3 5.4s3.7.9 3.6 1c2 .5 2.4 1.8 2.3 2.9l-2.3 9.4c.1 0 .3.1.5.2-.2-.1-.3-.1-.5-.2l-3.3 13.1c-.3.6-.9 1.6-2.4 1.2.1.1-3.6-.9-3.6-.9l-2.5 5.8 6.6 1.6c1.2.3 2.5.6 3.7.9l-2.1 8.3 5 1.2 2-8.2c1.4.4 2.7.7 4 .9l-2 8.2 5 1.2 2.1-8.3c8.5 1.6 14.8.9 17.5-6.7 2.2-6.1-.1-9.6-4.5-11.9 3.2-.7 5.6-2.8 6.2-7.2zm-11.1 15.6c-1.5 6.2-12 2.8-15.3 2l2.7-11c3.4.8 14.2 2.5 12.6 9zm1.6-15.8c-1.4 5.6-10.1 2.8-12.9 2.1l2.5-9.9c2.8.7 11.8 2 10.4 7.8z"
          fill="#FFFFFF"
        />
      </svg>
    </div>
  );
}

function EthereumMark({ size }: { size: number }) {
  return (
    <div
      className="flex items-center justify-center flex-shrink-0 select-none overflow-hidden"
      style={{ width: size, height: size }}
      title="Ethereum (ETH)"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="50" fill="#627EEA" />
        <g fill="#FFFFFF">
          <polygon points="50,18 49.6,19.4 49.6,60.6 50,61 68,50.3" fillOpacity="0.8" />
          <polygon points="50,18 32,50.3 50,61 50,18" />
          <polygon points="50,65.3 49.8,65.6 49.8,81.6 50,82 68,54.8" fillOpacity="0.8" />
          <polygon points="50,82 50,65.3 32,54.8" />
          <polygon points="50,61 68,50.3 50,42.2" fillOpacity="0.5" />
          <polygon points="32,50.3 50,61 50,42.2" fillOpacity="0.75" />
        </g>
      </svg>
    </div>
  );
}

function SolanaMark({ size }: { size: number }) {
  return (
    <div
      className="flex items-center justify-center flex-shrink-0 select-none overflow-hidden"
      style={{ width: size, height: size }}
      title="Solana (SOL)"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="50" fill="#000000" />
        <defs>
          <linearGradient id="solGrad" x1="20" y1="20" x2="80" y2="80" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#14F195" />
            <stop offset="100%" stopColor="#9945FF" />
          </linearGradient>
        </defs>
        {/* 3 Iconic Slanted Tracks */}
        <path
          d="M75.2 36.4c-.6-.6-1.5-1-2.4-1H27.1c-1.5 0-2.3 1.8-1.3 2.9l6.1 6.3c.6.6 1.5 1 2.4 1h45.7c1.5 0 2.3-1.8 1.3-2.9l-6.1-6.3z"
          fill="url(#solGrad)"
        />
        <path
          d="M24.8 53.6c.6.6 1.5 1 2.4 1h45.7c1.5 0 2.3-1.8 1.3-2.9l-6.1-6.3c-.6-.6-1.5-1-2.4-1H20c-1.5 0-2.3 1.8-1.3 2.9l6.1 6.3z"
          fill="url(#solGrad)"
        />
        <path
          d="M75.2 70.8c-.6-.6-1.5-1-2.4-1H27.1c-1.5 0-2.3 1.8-1.3 2.9l6.1 6.3c.6.6 1.5 1 2.4 1h45.7c1.5 0 2.3-1.8 1.3-2.9l-6.1-6.3z"
          fill="url(#solGrad)"
        />
      </svg>
    </div>
  );
}

function BnbMark({ size }: { size: number }) {
  return (
    <div
      className="flex items-center justify-center flex-shrink-0 select-none overflow-hidden"
      style={{ width: size, height: size }}
      title="BNB"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="50" fill="#F3BA2F" />
        <g fill="#FFFFFF">
          {/* Center Diamond */}
          <polygon points="50,38 62,50 50,62 38,50" />
          {/* Top Chevron */}
          <polygon points="50,22 58.5,30.5 54.3,34.7 50,30.5 45.7,34.7 41.5,30.5" />
          {/* Bottom Chevron */}
          <polygon points="50,78 41.5,69.5 45.7,65.3 50,69.5 54.3,65.3 58.5,69.5" />
          {/* Right Chevrons */}
          <polygon points="78,50 69.5,41.5 65.3,45.7 69.5,50 65.3,54.3 69.5,58.5" />
          {/* Left Chevrons */}
          <polygon points="22,50 30.5,58.5 34.7,54.3 30.5,50 34.7,45.7 30.5,41.5" />
        </g>
      </svg>
    </div>
  );
}

function UsdtMark({ size }: { size: number }) {
  return (
    <div
      className="flex items-center justify-center flex-shrink-0 select-none overflow-hidden"
      style={{ width: size, height: size }}
      title="Tether (USDT)"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="50" fill="#26A17B" />
        <path
          d="M58.7 45.3c-.3 0-1.7-.1-4.7-.2v-7.3h16.5V28H29.5v9.8h16.4v7.3c-3 .1-4.4.2-4.7.2C28.4 46 19 48.6 19 51.8c0 3.2 9.4 5.8 22.2 6.5v19.4h8.8V58.3c12.8-.7 22.2-3.3 22.2-6.5 0-3.2-9.4-5.8-13.5-6.5zm-8.7 8.7c-10.4 0-19.1-1.7-21.7-4.1 2.6-2.4 11.3-4.1 21.7-4.1s19.1 1.7 21.7 4.1c-2.6 2.4-11.3 4.1-21.7 4.1z"
          fill="#FFFFFF"
        />
      </svg>
    </div>
  );
}

function UsdcMark({ size }: { size: number }) {
  return (
    <div
      className="flex items-center justify-center flex-shrink-0 select-none overflow-hidden"
      style={{ width: size, height: size }}
      title="USD Coin (USDC)"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="50" fill="#2775CA" />
        <g stroke="#FFFFFF" strokeWidth="4.5" fill="none" strokeLinecap="round">
          <path d="M41 24 C28 29 22 43 25 56 C28 68 40 76 54 75 C66 74 76 64 76 52" />
          <path d="M59 76 C72 71 78 57 75 44 C72 32 60 24 46 25 C34 26 24 36 24 48" />
        </g>
        <path
          d="M50 33v4m0 26v4m-5.5-27h9c3 0 5 1.5 5 4s-2 4-5 4.5h-7c-3 .5-5 2-5 4.5s2 4 5 4h9"
          stroke="#FFFFFF"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </div>
  );
}

function XrpMark({ size }: { size: number }) {
  return (
    <div
      className="flex items-center justify-center flex-shrink-0 select-none overflow-hidden"
      style={{ width: size, height: size }}
      title="XRP"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="50" fill="#23292F" />
        <path
          d="M74.4 28h8.4L50 60.8 17.2 28h8.4L50 52.4 74.4 28zm0 44H82.8L50 39.2 17.2 72h8.4L50 47.6 74.4 72z"
          fill="#FFFFFF"
        />
      </svg>
    </div>
  );
}

function CardanoMark({ size }: { size: number }) {
  return (
    <div
      className="flex items-center justify-center flex-shrink-0 select-none overflow-hidden"
      style={{ width: size, height: size }}
      title="Cardano (ADA)"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="50" fill="#0033AD" />
        <circle cx="50" cy="50" r="9" fill="#FFFFFF" />
        {/* Surrounding circular constellation */}
        <circle cx="50" cy="26" r="4.5" fill="#FFFFFF" />
        <circle cx="50" cy="74" r="4.5" fill="#FFFFFF" />
        <circle cx="26" cy="50" r="4.5" fill="#FFFFFF" />
        <circle cx="74" cy="50" r="4.5" fill="#FFFFFF" />
        <circle cx="33" cy="33" r="3.5" fill="#FFFFFF" fillOpacity="0.8" />
        <circle cx="67" cy="33" r="3.5" fill="#FFFFFF" fillOpacity="0.8" />
        <circle cx="33" cy="67" r="3.5" fill="#FFFFFF" fillOpacity="0.8" />
        <circle cx="67" cy="67" r="3.5" fill="#FFFFFF" fillOpacity="0.8" />
      </svg>
    </div>
  );
}

function DogeMark({ size }: { size: number }) {
  return (
    <div
      className="flex items-center justify-center flex-shrink-0 select-none overflow-hidden"
      style={{ width: size, height: size }}
      title="Dogecoin (DOGE)"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="50" fill="#C2A633" />
        <path
          d="M34 26h18c14.4 0 24 8.6 24 24s-9.6 24-24 24H34V26zm13 10.5v10h14.5v6H47v12h5.5c8.5 0 13.5-5 13.5-14s-5-14-13.5-14H47z"
          fill="#FFFFFF"
        />
        <rect x="25" y="46.5" width="22" height="6" rx="2" fill="#FFFFFF" />
      </svg>
    </div>
  );
}

function AvaxMark({ size }: { size: number }) {
  return (
    <div
      className="flex items-center justify-center flex-shrink-0 select-none overflow-hidden"
      style={{ width: size, height: size }}
      title="Avalanche (AVAX)"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="50" fill="#E84142" />
        <path
          d="M48.2 23.3c.8-1.5 2.8-1.5 3.6 0l27.5 48.4c.8 1.4-.2 3.3-1.8 3.3H61.8c-.9 0-1.8-.5-2.2-1.3L50 56.4 44.5 66c-.5.8-1.3 1.3-2.2 1.3H22.5c-1.6 0-2.6-1.9-1.8-3.3l27.5-40.7z"
          fill="#FFFFFF"
        />
        <polygon points="62,69 73,69 67.5,59" fill="#FFFFFF" fillOpacity="0.8" />
      </svg>
    </div>
  );
}

function LinkMark({ size }: { size: number }) {
  return (
    <div
      className="flex items-center justify-center flex-shrink-0 select-none overflow-hidden"
      style={{ width: size, height: size }}
      title="Chainlink (LINK)"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="50" fill="#375BD2" />
        <path
          d="M50 20L24 35v30l26 15 26-15V35L50 20zm16 40.5L50 70 34 60.5v-21L50 30l16 9.5v21z"
          fill="#FFFFFF"
        />
      </svg>
    </div>
  );
}

function PolkadotMark({ size }: { size: number }) {
  return (
    <div
      className="flex items-center justify-center flex-shrink-0 select-none overflow-hidden"
      style={{ width: size, height: size }}
      title="Polkadot (DOT)"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="50" fill="#E6007A" />
        <ellipse cx="50" cy="42" rx="16" ry="18" fill="#FFFFFF" />
        <circle cx="50" cy="74" r="7" fill="#FFFFFF" />
        <circle cx="28" cy="58" r="5" fill="#FFFFFF" fillOpacity="0.85" />
        <circle cx="72" cy="58" r="5" fill="#FFFFFF" fillOpacity="0.85" />
      </svg>
    </div>
  );
}

function PolygonMark({ size }: { size: number }) {
  return (
    <div
      className="flex items-center justify-center flex-shrink-0 select-none overflow-hidden"
      style={{ width: size, height: size }}
      title="Polygon (MATIC / POL)"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="50" fill="#8247E5" />
        <path
          d="M68 37c-3 0-5.8 1.6-7.3 4.2L53 54.8 45.7 42c-1.5-2.6-4.3-4.2-7.3-4.2-4.8 0-8.6 3.9-8.6 8.6 0 1.9.6 3.6 1.7 5.1l14.2 24.6c1.5 2.6 4.3 4.2 7.3 4.2 3 0 5.8-1.6 7.3-4.2L67 59.2 74.3 72c1.5 2.6 4.3 4.2 7.3 4.2 4.8 0 8.6-3.9 8.6-8.6 0-1.9-.6-3.6-1.7-5.1L74.3 37.9c-1.5-2.6-4.3-4.2-7.3-4.2"
          stroke="#FFFFFF"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </div>
  );
}

function NearMark({ size }: { size: number }) {
  return (
    <div
      className="flex items-center justify-center flex-shrink-0 select-none overflow-hidden"
      style={{ width: size, height: size }}
      title="NEAR Protocol"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="50" fill="#111827" />
        <path
          d="M72 26H61.2c-1.8 0-3.4 1-4.2 2.6L38 60.5V26h-8v48h10.8c1.8 0 3.4-1 4.2-2.6L62 39.5V74h8V26z"
          fill="#FFFFFF"
        />
      </svg>
    </div>
  );
}

function TronMark({ size }: { size: number }) {
  return (
    <div
      className="flex items-center justify-center flex-shrink-0 select-none overflow-hidden"
      style={{ width: size, height: size }}
      title="TRON (TRX)"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="50" fill="#EF0027" />
        <path
          d="M26 26l48 16-24 38L26 26zm6 7.5l17.5 26.5L67 39.5 32 33.5zm20 30L65 42l-11 25.5z"
          fill="#FFFFFF"
        />
      </svg>
    </div>
  );
}

function TonMark({ size }: { size: number }) {
  return (
    <div
      className="flex items-center justify-center flex-shrink-0 select-none overflow-hidden"
      style={{ width: size, height: size }}
      title="Toncoin (TON)"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="50" fill="#0098EA" />
        <path
          d="M50 20L22 36l28 44 28-44-28-16zm-3.5 8.5v39L27 38.5l19.5-10zm7 0l19.5 10-19.5 28.5V28.5z"
          fill="#FFFFFF"
        />
      </svg>
    </div>
  );
}

function SuiMark({ size }: { size: number }) {
  return (
    <div
      className="flex items-center justify-center flex-shrink-0 select-none overflow-hidden"
      style={{ width: size, height: size }}
      title="Sui"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="50" fill="#2A82E4" />
        <path
          d="M50 20c-12 18-20 30-20 42 0 11 9 20 20 20s20-9 20-20c0-12-8-24-20-42zm0 69c-9 0-16-7-16-16 0-8 6-18 16-32 10 14 16 24 16 32 0 9-7 16-16 16z"
          fill="#FFFFFF"
        />
        <circle cx="50" cy="62" r="6" fill="#FFFFFF" />
      </svg>
    </div>
  );
}

function ArbitrumMark({ size }: { size: number }) {
  return (
    <div
      className="flex items-center justify-center flex-shrink-0 select-none overflow-hidden"
      style={{ width: size, height: size }}
      title="Arbitrum (ARB)"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="50" fill="#28A0F0" />
        <path
          d="M50 20L22 68l11 8 17-29 17 29 11-8-28-48zm0 27l-8 14h16l-8-14z"
          fill="#FFFFFF"
        />
      </svg>
    </div>
  );
}

function OptimismMark({ size }: { size: number }) {
  return (
    <div
      className="flex items-center justify-center flex-shrink-0 select-none overflow-hidden"
      style={{ width: size, height: size }}
      title="Optimism (OP)"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="50" fill="#FF0420" />
        <text
          x="50"
          y="63"
          fontSize="38"
          fontWeight="900"
          fontStyle="italic"
          fill="#FFFFFF"
          textAnchor="middle"
          fontFamily="system-ui, -apple-system, sans-serif"
          letterSpacing="-1.5px"
        >
          OP
        </text>
      </svg>
    </div>
  );
}

function LitecoinMark({ size }: { size: number }) {
  return (
    <div
      className="flex items-center justify-center flex-shrink-0 select-none overflow-hidden"
      style={{ width: size, height: size }}
      title="Litecoin (LTC)"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="50" fill="#345D9D" />
        <path
          d="M48 24h9v23.5l11-4-2 7.5-9 3.2V68h18v8H40V58.5l-9 3.2 2-7.5 9-3.2V24h6z"
          fill="#FFFFFF"
        />
      </svg>
    </div>
  );
}

function DaiMark({ size }: { size: number }) {
  return (
    <div
      className="flex items-center justify-center flex-shrink-0 select-none overflow-hidden"
      style={{ width: size, height: size }}
      title="Dai (DAI)"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="50" fill="#F5AC37" />
        <path
          d="M36 28h17c11.5 0 20 8.5 20 22s-8.5 22-20 22H36V28zm10 8.5v7h12v5H46v7h12v5H46v11h7c7 0 12.5-5 12.5-14s-5.5-14-12.5-14h-7z"
          fill="#FFFFFF"
        />
        <rect x="28" y="43.5" width="22" height="5" fill="#FFFFFF" />
        <rect x="28" y="55.5" width="22" height="5" fill="#FFFFFF" />
      </svg>
    </div>
  );
}

function UniswapMark({ size }: { size: number }) {
  return (
    <div
      className="flex items-center justify-center flex-shrink-0 select-none overflow-hidden"
      style={{ width: size, height: size }}
      title="Uniswap (UNI)"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="50" fill="#FF007A" />
        <path
          d="M68 28c-4 5-10 8-15 9l16-16c-3 1-9 4-13 8l10-14c-5 2-10 5-15 10l5-12c-4 2-8 5-12 10-1 1-3 4-4 7-6 10-5 22 2 30 2 2 4 4 7 5 3 1 7 1 10 0 7-3 12-10 13-17 1-6-1-14-4-20z"
          fill="#FFFFFF"
        />
      </svg>
    </div>
  );
}

/**
 * Renders the authentic built-in vector mark for top cryptocurrencies.
 */
function renderBuiltInVector(symbol: string, size: number): React.ReactNode | null {
  switch (symbol) {
    case "BTC":
      return <BitcoinMark size={size} />;
    case "ETH":
      return <EthereumMark size={size} />;
    case "SOL":
      return <SolanaMark size={size} />;
    case "BNB":
      return <BnbMark size={size} />;
    case "USDT":
      return <UsdtMark size={size} />;
    case "USDC":
      return <UsdcMark size={size} />;
    case "XRP":
      return <XrpMark size={size} />;
    case "ADA":
      return <CardanoMark size={size} />;
    case "DOGE":
      return <DogeMark size={size} />;
    case "AVAX":
      return <AvaxMark size={size} />;
    case "LINK":
      return <LinkMark size={size} />;
    case "DOT":
      return <PolkadotMark size={size} />;
    case "MATIC":
    case "POL":
      return <PolygonMark size={size} />;
    case "NEAR":
      return <NearMark size={size} />;
    case "TRX":
      return <TronMark size={size} />;
    case "TON":
      return <TonMark size={size} />;
    case "SUI":
      return <SuiMark size={size} />;
    case "ARB":
      return <ArbitrumMark size={size} />;
    case "OP":
      return <OptimismMark size={size} />;
    case "LTC":
      return <LitecoinMark size={size} />;
    case "DAI":
      return <DaiMark size={size} />;
    case "UNI":
      return <UniswapMark size={size} />;
    default:
      return null;
  }
}

/**
 * Universal Crypto Logo Component
 * 1. Checks authentic built-in offline vector mark (0ms lag, crisp SVG).
 * 2. Cascades through multi-tier HD CDN image sources (CoinCap, jsdelivr, TrustWallet).
 * 3. Gracefully falls back to high-definition styled token monogram with official brand colors.
 */
export default function CryptoLogo({
  symbol,
  name,
  size = 32,
  className = "",
  showEarnBadge = true,
}: CryptoLogoProps) {
  const { cleanSymbol, displaySymbol, isEarn } = normalizeCryptoSymbol(symbol);
  const sources = React.useMemo(() => getCryptoLogoSources(cleanSymbol), [cleanSymbol]);

  const [sourceIndex, setSourceIndex] = useState(0);
  const [allFailed, setAllFailed] = useState(false);

  // Check if a built-in vector exists
  const builtIn = renderBuiltInVector(cleanSymbol, size);

  // Fallback monogram styling
  const fallback = getCryptoFallbackColor(cleanSymbol);
  const brandInfo = KNOWN_CRYPTO_BRANDS[cleanSymbol];
  const displayName = name || brandInfo?.name || displaySymbol;

  const handleImgError = () => {
    if (sourceIndex + 1 < sources.length) {
      setSourceIndex((prev) => prev + 1);
    } else {
      setAllFailed(true);
    }
  };

  const currentSrc = sources[sourceIndex];

  return (
    <div
      className={`relative inline-flex items-center justify-center flex-shrink-0 select-none overflow-hidden ${className}`}
      style={{ width: size, height: size }}
      title={`${displayName} (${displaySymbol})`}
    >
      {builtIn ? (
        builtIn
      ) : !allFailed ? (
        <img
          src={currentSrc}
          alt={displaySymbol}
          width={size}
          height={size}
          className="w-full h-full object-contain rounded-[inherit]"
          loading="lazy"
          decoding="async"
          onError={handleImgError}
        />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center font-bold font-mono tracking-tight text-white border border-white/10 shadow-xs"
          style={{
            backgroundColor: fallback.bg,
            color: fallback.text,
            fontSize: `${Math.max(9, Math.floor(size * 0.34))}px`,
          }}
        >
          {cleanSymbol.slice(0, 3)}
        </div>
      )}

      {/* Discreet Binance Earn Badge */}
      {showEarnBadge && isEarn && (
        <span
          className="absolute -bottom-0.5 -right-0.5 bg-amber-400 text-black font-extrabold font-mono uppercase px-1 py-0.2 rounded-xs border border-black/40 leading-none shadow-xs"
          style={{ fontSize: "7px" }}
          title="Binance Earn (Staked / Flexible Savings)"
        >
          E
        </span>
      )}
    </div>
  );
}
export { CryptoLogo };
