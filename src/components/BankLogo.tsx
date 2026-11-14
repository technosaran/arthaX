"use client";

import React, { useState } from "react";
import { Landmark } from "lucide-react";
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
      title="Cash in Hand"
    >
      <svg
        viewBox="0 0 170 170"
        className="w-full h-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="170" height="170" rx="38" fill="url(#cashGradBank)" />
        <defs>
          <linearGradient id="cashGradBank" x1="0" y1="0" x2="170" y2="170" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#064E3B" />
            <stop offset="100%" stopColor="#022c22" />
          </linearGradient>
        </defs>
        <rect
          x="22"
          y="36"
          width="126"
          height="98"
          rx="16"
          stroke="#34D399"
          strokeWidth="6"
          strokeOpacity="0.45"
          fill="none"
        />
        <circle cx="38" cy="52" r="5" fill="#34D399" fillOpacity="0.6" />
        <circle cx="132" cy="52" r="5" fill="#34D399" fillOpacity="0.6" />
        <circle cx="38" cy="118" r="5" fill="#34D399" fillOpacity="0.6" />
        <circle cx="132" cy="118" r="5" fill="#34D399" fillOpacity="0.6" />
        <circle cx="85" cy="85" r="30" stroke="#34D399" strokeWidth="5" strokeOpacity="0.3" fill="none" />
        <text
          x="50%"
          y="56%"
          dominantBaseline="central"
          textAnchor="middle"
          fill="#34D399"
          fontSize="54"
          fontWeight="bold"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          ₹
        </text>
      </svg>
    </div>
  );
}

function SbiMark({ size, className = "" }: { size: number; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
      title="State Bank of India"
    >
      <svg
        viewBox="0 0 500 500"
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="250" cy="250" r="45" fill="#FFFFFF" />
        <rect x="234" y="250" width="32" height="249" fill="#FFFFFF" />
        <path fill="#0072BC" d="m234,499a249,249 0 1,1 32,0V295a45,45 0 1,0-32,0Z" />
      </svg>
    </div>
  );
}

function HdfcMark({ size, className = "" }: { size: number; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
      title="HDFC Bank"
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="100" height="100" rx="16" fill="#004C8F" />
        <rect x="18" y="18" width="64" height="64" fill="#FFFFFF" />
        <rect x="42" y="10" width="16" height="80" fill="#004C8F" />
        <rect x="10" y="42" width="80" height="16" fill="#004C8F" />
        <rect x="34" y="34" width="32" height="32" fill="#ED232A" />
      </svg>
    </div>
  );
}

function IciciMark({ size, className = "" }: { size: number; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
      title="ICICI Bank"
    >
      <svg
        viewBox="0 0 252 252"
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          fillRule="evenodd"
          fill="#EF8022"
          d="M82.4,74.3c44-44,97.3-55.2,119.1-25.5c21.3,30.1,2.3,90.4-41.7,134 c-44,44-97.8,55.6-119.1,25.5C19.3,178.2,37.9,117.9,82.4,74.3z"
        />
        <path
          fillRule="evenodd"
          fill="#AC2930"
          d="M111.6,50.7c-5.1,3.7-9.7,7.9-14.8,12.5C58.2,101.7,42,154.1,61,180 c19.9,26.4,67.2,17.2,107.1-21.8c20.9-20.9,35.2-45,41.3-67.2c1.9-16.2-0.5-31.1-7.9-42.2C184.3,25.7,147.7,27.5,111.6,50.7z"
        />
        <path
          fillRule="evenodd"
          fill="#FFFFFF"
          d="M164.9,49.3c5.1,5.6,1.9,16.7-7,25.5c-8.8,8.8-20.4,11.6-25.5,7 c-5.1-5.6-2.3-16.7,6.5-26C148.2,47,159.8,44.7,164.9,49.3L164.9,49.3z M133.3,204.6c-20.4,15.8-42.2,23.6-63,19.9 c8.8,0.5,15.8-9.3,21.8-22.2c6-13.4,9.3-25.5,12.5-37.1c3.7-18.5,4.2-31.5,1.9-34.8c-3.2-4.2-11.1-3.2-20.4,1.9 c-4.6,2.8-10.2,0.9-3.2-7.4s34.3-28.7,44.5-31.5c10.7-3.2,23.2,0.9,19,13C143.1,115.1,105.1,215.3,133.3,204.6z"
        />
      </svg>
    </div>
  );
}

function AxisMark({ size, className = "" }: { size: number; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
      title="Axis Bank"
    >
      <svg
        viewBox="0 0 285 255"
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M 142.27,10.47 C 156.13,34.28 170.11,58.02 183.82,81.92 C 161.66,121.01 139.82,160.29 116.91,198.95 C 108.12,213.79 99.57,228.77 90.88,243.66 C 62.7,243.83 34.52,243.82 6.34,243.78 C 7.2,241.85 8.05,239.91 9.09,238.07 C 53.46,162.19 98,86.41 142.27,10.47 z"
          fill="#97144D"
        />
        <path
          d="M 142.28,155.63 C 170.56,155.62 198.84,155.42 227.12,155.89 C 243.96,185.25 261.34,214.29 278.03,243.73 C 249.75,243.87 221.48,243.76 193.2,243.74 C 176.37,214.28 158.79,185.27 142.28,155.63 z"
          fill="#97144D"
        />
      </svg>
    </div>
  );
}

function KotakMark({ size, className = "" }: { size: number; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 rounded-md overflow-hidden ${className}`}
      style={{ width: size, height: size, backgroundColor: "#ED1B24" }}
      title="Kotak Mahindra Bank"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full p-1" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M28 65 C18 52 24 35 38 35 C52 35 58 55 68 62 C78 69 86 62 86 50 C86 38 76 34 66 45"
          stroke="#FFFFFF"
          strokeWidth="9"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M72 35 C82 48 76 65 62 65 C48 65 42 45 32 38 C22 31 14 38 14 50 C14 62 24 66 34 55"
          stroke="#003366"
          strokeWidth="6"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </div>
  );
}

function PnbMark({ size, className = "" }: { size: number; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 rounded-md overflow-hidden ${className}`}
      style={{ width: size, height: size, backgroundColor: "#A20000" }}
      title="Punjab National Bank"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full p-1" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="32" stroke="#FFC20E" strokeWidth="10" />
        <rect x="45" y="24" width="10" height="42" rx="3" fill="#FFC20E" />
        <path d="M45 28 C35 28 32 36 32 40" stroke="#FFC20E" strokeWidth="8" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function BobMark({ size, className = "" }: { size: number; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 rounded-md overflow-hidden ${className}`}
      style={{ width: size, height: size, backgroundColor: "#F26522" }}
      title="Bank of Baroda"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full p-1" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="32" stroke="#FFFFFF" strokeWidth="7" />
        <circle cx="50" cy="50" r="18" fill="#FFFFFF" />
        <path d="M22 50 H78 M50 22 V78" stroke="#F26522" strokeWidth="5" />
      </svg>
    </div>
  );
}

function CanaraMark({ size, className = "" }: { size: number; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 rounded-md overflow-hidden ${className}`}
      style={{ width: size, height: size, backgroundColor: "#0076CE" }}
      title="Canara Bank"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full p-1.5" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M50 16L78 68H22L50 16Z" fill="#FFCC00" />
        <path d="M50 84L22 32H78L50 84Z" fill="#005B9E" fillOpacity="0.8" />
        <path d="M50 36L64 62H36L50 36Z" fill="#0076CE" />
      </svg>
    </div>
  );
}

function UnionMark({ size, className = "" }: { size: number; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 rounded-md overflow-hidden ${className}`}
      style={{ width: size, height: size, backgroundColor: "#004890" }}
      title="Union Bank of India"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full p-2" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M26 24V54C26 66 36 76 48 76C60 76 70 66 70 54V24" stroke="#ED1C24" strokeWidth="10" strokeLinecap="round" />
        <path d="M38 24V54C38 60 42 66 48 66C54 66 58 60 58 54V24" stroke="#FFFFFF" strokeWidth="8" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function BoiMark({ size, className = "" }: { size: number; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 rounded-md overflow-hidden ${className}`}
      style={{ width: size, height: size, backgroundColor: "#E31E24" }}
      title="Bank of India"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full p-2" fill="none" xmlns="http://www.w3.org/2000/svg">
        <polygon points="50,12 61,38 89,38 66,54 75,80 50,64 25,80 34,54 11,38 39,38" fill="#FFB81C" />
        <circle cx="50" cy="48" r="8" fill="#E31E24" />
      </svg>
    </div>
  );
}

function IndianBankMark({ size, className = "" }: { size: number; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 rounded-md overflow-hidden ${className}`}
      style={{ width: size, height: size, backgroundColor: "#004B87" }}
      title="Indian Bank"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full p-1.5" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="35" cy="45" r="18" stroke="#E41E26" strokeWidth="7" fill="none" />
        <circle cx="65" cy="45" r="18" stroke="#FFFFFF" strokeWidth="7" fill="none" />
        <circle cx="50" cy="68" r="18" stroke="#E41E26" strokeWidth="7" fill="none" />
      </svg>
    </div>
  );
}

function IdbiMark({ size, className = "" }: { size: number; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 rounded-md overflow-hidden ${className}`}
      style={{ width: size, height: size, backgroundColor: "#006837" }}
      title="IDBI Bank"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full p-2" fill="none" xmlns="http://www.w3.org/2000/svg">
        <polygon points="50,16 82,50 50,84 18,50" fill="#FFC20E" />
        <polygon points="50,28 72,50 50,72 28,50" fill="#006837" />
        <circle cx="50" cy="50" r="8" fill="#FFC20E" />
      </svg>
    </div>
  );
}

function IndusIndMark({ size, className = "" }: { size: number; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 rounded-md overflow-hidden ${className}`}
      style={{ width: size, height: size, backgroundColor: "#8B0000" }}
      title="IndusInd Bank"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full p-1.5" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="38" stroke="#E5A823" strokeWidth="4" />
        <path d="M28 62 C34 46 44 42 56 42 C64 42 70 46 76 56 C74 42 66 32 50 32 C38 32 30 40 28 62Z" fill="#E5A823" />
        <circle cx="62" cy="40" r="3" fill="#8B0000" />
      </svg>
    </div>
  );
}

function YesMark({ size, className = "" }: { size: number; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 rounded-md overflow-hidden ${className}`}
      style={{ width: size, height: size, backgroundColor: "#0B3082" }}
      title="Yes Bank"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full p-2" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M50 16L78 28V52C78 68 66 80 50 84C34 80 22 68 22 52V28L50 16Z" fill="#0B3082" stroke="#FFFFFF" strokeWidth="4" />
        <path d="M34 50L45 61L66 38" stroke="#ED1C24" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function IdfcMark({ size, className = "" }: { size: number; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 rounded-md overflow-hidden ${className}`}
      style={{ width: size, height: size, backgroundColor: "#9B1B30" }}
      title="IDFC FIRST Bank"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full p-2" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="22" y="22" width="24" height="24" rx="4" fill="#FFFFFF" />
        <rect x="54" y="22" width="24" height="24" rx="4" fill="#F3A83B" />
        <rect x="22" y="54" width="24" height="24" rx="4" fill="#F3A83B" />
        <rect x="54" y="54" width="24" height="24" rx="4" fill="#FFFFFF" />
      </svg>
    </div>
  );
}

function FederalMark({ size, className = "" }: { size: number; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 rounded-md overflow-hidden ${className}`}
      style={{ width: size, height: size, backgroundColor: "#003B70" }}
      title="Federal Bank"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full p-2" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="38" stroke="#FFB81C" strokeWidth="6" />
        <path d="M32 38H68M32 50H58M32 62H68" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function RblMark({ size, className = "" }: { size: number; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 rounded-md overflow-hidden ${className}`}
      style={{ width: size, height: size, backgroundColor: "#002B49" }}
      title="RBL Bank"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full p-2" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="24" y="24" width="22" height="22" rx="3" fill="#E31837" />
        <rect x="54" y="24" width="22" height="22" rx="3" fill="#FFFFFF" />
        <rect x="24" y="54" width="22" height="22" rx="3" fill="#00A3E0" />
        <rect x="54" y="54" width="22" height="22" rx="3" fill="#E31837" />
      </svg>
    </div>
  );
}

function BandhanMark({ size, className = "" }: { size: number; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 rounded-md overflow-hidden ${className}`}
      style={{ width: size, height: size, backgroundColor: "#C8102E" }}
      title="Bandhan Bank"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full p-2" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="36" fill="#C8102E" stroke="#FFC72C" strokeWidth="4" />
        <path d="M50 24 C58 36 62 46 62 56 C62 68 54 76 50 76 C46 76 38 68 38 56 C38 46 42 36 50 24Z" fill="#FFC72C" />
      </svg>
    </div>
  );
}

function AubankMark({ size, className = "" }: { size: number; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 rounded-md overflow-hidden ${className}`}
      style={{ width: size, height: size, backgroundColor: "#5B2C6F" }}
      title="AU Small Finance Bank"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full p-2" fill="none" xmlns="http://www.w3.org/2000/svg">
        <text x="50" y="62" fontSize="38" fontWeight="900" fill="#E67E22" textAnchor="middle" fontFamily="sans-serif">
          AU
        </text>
      </svg>
    </div>
  );
}

function StanchartMark({ size, className = "" }: { size: number; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 rounded-md overflow-hidden ${className}`}
      style={{ width: size, height: size, backgroundColor: "#0072CE" }}
      title="Standard Chartered"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full p-2" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M30 35C45 18 65 25 72 38C80 52 70 70 52 72C35 74 25 60 30 46" stroke="#009A44" strokeWidth="10" strokeLinecap="round" />
        <path d="M70 65C55 82 35 75 28 62C20 48 30 30 48 28C65 26 75 40 70 54" stroke="#FFFFFF" strokeWidth="8" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function DbsMark({ size, className = "" }: { size: number; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 rounded-md overflow-hidden ${className}`}
      style={{ width: size, height: size, backgroundColor: "#000000" }}
      title="DBS Bank"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full p-2" fill="none" xmlns="http://www.w3.org/2000/svg">
        <polygon points="50,18 68,36 50,54 32,36" fill="#FF3333" />
        <polygon points="68,36 86,54 68,72 50,54" fill="#FF3333" />
        <polygon points="50,54 68,72 50,90 32,72" fill="#FF3333" />
        <polygon points="32,36 50,54 32,72 14,54" fill="#FF3333" />
      </svg>
    </div>
  );
}

function AmexMark({ size, className = "" }: { size: number; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 rounded-md overflow-hidden ${className}`}
      style={{ width: size, height: size, backgroundColor: "#002663" }}
      title="American Express"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full p-1" fill="none" xmlns="http://www.w3.org/2000/svg">
        <text x="50" y="58" fontSize="22" fontWeight="900" fill="#FFFFFF" textAnchor="middle" fontFamily="system-ui, sans-serif" letterSpacing="1">
          AMEX
        </text>
      </svg>
    </div>
  );
}

function AppleMark({ size, className = "" }: { size: number; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 rounded-md overflow-hidden ${className}`}
      style={{ width: size, height: size, backgroundColor: "#000000" }}
      title="Apple"
    >
      <svg viewBox="0 0 170 170" className="w-full h-full p-2" fill="#FFFFFF" xmlns="http://www.w3.org/2000/svg">
        <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.05-7.62-7.85-11.77-14.41-6.1-9.7-10.78-20.91-14.05-33.64-3.26-12.72-4.9-24.52-4.9-35.39 0-14.36 3.48-26.04 10.45-35.03 6.97-8.99 15.68-13.59 26.13-13.8 4.35 0 9.48 1.25 15.39 3.75 5.91 2.5 9.71 3.81 11.4 3.93 1.91-.12 5.92-1.5 12.03-4.14 6.11-2.64 11.22-3.83 15.33-3.56 10.46.66 18.94 4.54 25.43 11.64-8.92 5.45-13.25 12.87-12.98 22.28.27 8.94 3.82 16.31 10.66 22.12 6.84 5.81 14.88 9.07 24.12 9.77-2.39 7.42-5.44 15.14-9.15 23.16zM119.22 31.84c0-7.22 2.61-13.9 7.83-20.04 5.22-6.14 11.58-10.07 19.08-11.8 0 1.09.05 2.18.05 3.27 0 7.33-2.77 14.24-8.31 20.73-5.54 6.49-12.08 10.02-18.65 10.59-.22-.92-.35-1.84-.35-2.75z"/>
      </svg>
    </div>
  );
}

function ZerodhaMark({ size, className = "" }: { size: number; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 rounded-md overflow-hidden ${className}`}
      style={{ width: size, height: size, backgroundColor: "#387ED1" }}
      title="Zerodha"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M24 32 H76 L32 68 H76" stroke="#FFFFFF" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    </div>
  );
}

function GrowwMark({ size, className = "" }: { size: number; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 rounded-md overflow-hidden ${className}`}
      style={{ width: size, height: size, backgroundColor: "#00D09C" }}
      title="Groww"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="26" stroke="#FFFFFF" strokeWidth="8" fill="none" strokeDasharray="120 40" strokeLinecap="round" />
        <path d="M48 36 L64 50 L48 64" stroke="#FFFFFF" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    </div>
  );
}

function PaytmMark({ size, className = "" }: { size: number; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 rounded-md overflow-hidden ${className}`}
      style={{ width: size, height: size, backgroundColor: "#002E6E" }}
      title="Paytm"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <text x="50" y="62" fontSize="30" fontWeight="900" fontFamily="system-ui, sans-serif" fill="#00BAF2" textAnchor="middle">
          paytm
        </text>
      </svg>
    </div>
  );
}

function CredMark({ size, className = "" }: { size: number; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 rounded-md overflow-hidden ${className}`}
      style={{ width: size, height: size, backgroundColor: "#111111" }}
      title="CRED"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full p-2" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M28 22H72V52C72 64 62 76 50 80C38 76 28 64 28 52V22Z" stroke="#FFFFFF" strokeWidth="7" fill="none" />
        <path d="M42 36H58V50C58 56 54 60 50 62C46 60 42 56 42 50V36Z" fill="#FFFFFF" />
      </svg>
    </div>
  );
}

function JupiterMark({ size, className = "" }: { size: number; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 rounded-md overflow-hidden ${className}`}
      style={{ width: size, height: size, backgroundColor: "#0F172A" }}
      title="Jupiter Money"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full p-2" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M56 26V58C56 68 48 76 38 76C28 76 24 68 24 64" stroke="#FF5722" strokeWidth="11" strokeLinecap="round" />
        <circle cx="56" cy="18" r="6" fill="#FF5722" />
      </svg>
    </div>
  );
}

function FiMark({ size, className = "" }: { size: number; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 rounded-md overflow-hidden ${className}`}
      style={{ width: size, height: size, backgroundColor: "#0C2228" }}
      title="Fi Money"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full p-2" fill="none" xmlns="http://www.w3.org/2000/svg">
        <text x="50" y="64" fontSize="36" fontWeight="900" fill="#00E599" textAnchor="middle" fontFamily="sans-serif">
          fi
        </text>
      </svg>
    </div>
  );
}

function AngelOneMark({ size, className = "" }: { size: number; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 rounded-md overflow-hidden ${className}`}
      style={{ width: size, height: size, backgroundColor: "#3B1E54" }}
      title="Angel One"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full p-2" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="38" cy="50" r="18" fill="#FF5722" />
        <circle cx="62" cy="50" r="18" fill="#00C49F" fillOpacity="0.85" />
      </svg>
    </div>
  );
}

function UpstoxMark({ size, className = "" }: { size: number; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 rounded-md overflow-hidden ${className}`}
      style={{ width: size, height: size, backgroundColor: "#4C2A85" }}
      title="Upstox"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full p-2" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M30 32V52C30 64 40 72 50 72C60 72 70 64 70 52V32" stroke="#FFFFFF" strokeWidth="10" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function ChaseMark({ size, className = "" }: { size: number; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 rounded-md overflow-hidden ${className}`}
      style={{ width: size, height: size, backgroundColor: "#117ACA" }}
      title="Chase"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full p-2" fill="none" xmlns="http://www.w3.org/2000/svg">
        <polygon points="50,18 78,18 64,42 36,42" fill="#FFFFFF" />
        <polygon points="82,50 82,78 58,64 58,36" fill="#FFFFFF" />
        <polygon points="50,82 22,82 36,58 64,58" fill="#FFFFFF" />
        <polygon points="18,50 18,22 42,36 42,64" fill="#FFFFFF" />
      </svg>
    </div>
  );
}

function CitiMark({ size, className = "" }: { size: number; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 rounded-md overflow-hidden ${className}`}
      style={{ width: size, height: size, backgroundColor: "#003B70" }}
      title="Citibank"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full p-1" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M44 32C56 22 72 26 80 34" stroke="#ED1C24" strokeWidth="7" strokeLinecap="round" />
        <text x="46" y="65" fontSize="28" fontWeight="bold" fill="#FFFFFF" textAnchor="middle" fontFamily="sans-serif">
          citi
        </text>
      </svg>
    </div>
  );
}

function HsbcMark({ size, className = "" }: { size: number; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 rounded-md overflow-hidden ${className}`}
      style={{ width: size, height: size, backgroundColor: "#FFFFFF", border: "1px solid rgba(0,0,0,0.1)" }}
      title="HSBC"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full p-2" fill="none" xmlns="http://www.w3.org/2000/svg">
        <polygon points="15,50 35,30 35,70" fill="#DB0011" />
        <polygon points="85,50 65,30 65,70" fill="#DB0011" />
        <polygon points="50,50 35,30 65,30" fill="#DB0011" />
        <polygon points="50,50 35,70 65,70" fill="#DB0011" />
      </svg>
    </div>
  );
}

function BofaMark({ size, className = "" }: { size: number; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 rounded-md overflow-hidden ${className}`}
      style={{ width: size, height: size, backgroundColor: "#002D72" }}
      title="Bank of America"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full p-2" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="20" y="28" width="26" height="8" rx="2" fill="#E31837" />
        <rect x="54" y="28" width="26" height="8" rx="2" fill="#E31837" />
        <rect x="20" y="44" width="26" height="8" rx="2" fill="#FFFFFF" />
        <rect x="54" y="44" width="26" height="8" rx="2" fill="#FFFFFF" />
        <rect x="20" y="60" width="60" height="8" rx="2" fill="#E31837" />
      </svg>
    </div>
  );
}

function WellsFargoMark({ size, className = "" }: { size: number; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 rounded-md overflow-hidden ${className}`}
      style={{ width: size, height: size, backgroundColor: "#CD1409" }}
      title="Wells Fargo"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full p-1" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="100" fill="#CD1409" />
        <text x="50" y="46" fontSize="16" fontWeight="900" fill="#FFCD00" textAnchor="middle" fontFamily="serif" letterSpacing="0.5">
          WELLS
        </text>
        <text x="50" y="66" fontSize="16" fontWeight="900" fill="#FFCD00" textAnchor="middle" fontFamily="serif" letterSpacing="0.5">
          FARGO
        </text>
      </svg>
    </div>
  );
}

function BarclaysMark({ size, className = "" }: { size: number; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 rounded-md overflow-hidden ${className}`}
      style={{ width: size, height: size, backgroundColor: "#00AEEF" }}
      title="Barclays"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full p-2" fill="none" xmlns="http://www.w3.org/2000/svg">
        <polygon points="50,22 62,42 84,36 72,56 82,78 58,68 50,82 42,68 18,78 28,56 16,36 38,42" fill="#FFFFFF" />
        <circle cx="50" cy="50" r="6" fill="#00AEEF" />
      </svg>
    </div>
  );
}

function GenericBankMark({
  name,
  size,
  className = "",
}: {
  name: string;
  size: number;
  className?: string;
}) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "BK";

  const fontSize = Math.max(9, Math.floor(size * 0.38));

  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 rounded-lg overflow-hidden select-none border ${className}`}
      style={{
        width: size,
        height: size,
        background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
        borderColor: "rgba(255, 255, 255, 0.15)",
        boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
      }}
      title={name}
    >
      <span
        className="font-bold font-mono tracking-wider leading-none text-white drop-shadow-sm"
        style={{ fontSize: `${fontSize}px` }}
      >
        {initials}
      </span>
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

  // 2. SBI
  if (/\b(sbi|state\s*bank)\b/i.test(clean)) return "sbi";

  // 3. HDFC
  if (/\bhdfc\b/i.test(clean)) return "hdfc";

  // 4. ICICI
  if (/\bicici\b/i.test(clean)) return "icici";

  // 5. Axis
  if (/\baxis\b/i.test(clean)) return "axis";

  // 6. Kotak
  if (/\bkotak\b/i.test(clean)) return "kotak";

  // 7. PNB
  if (/\b(pnb|punjab\s*national)\b/i.test(clean)) return "pnb";

  // 8. Bank of Baroda
  if (/\b(bob|baroda)\b/i.test(clean)) return "bob";

  // 9. Canara
  if (/\bcanara\b/i.test(clean)) return "canara";

  // 10. Union Bank
  if (/\bunion\s*bank\b/i.test(clean) || clean === "union") return "union";

  // 11. Bank of India
  if (/\b(boi|bank\s*of\s*india)\b/i.test(clean)) return "boi";

  // 12. Indian Bank
  if (/\bindian\s*bank\b/i.test(clean)) return "indianbank";

  // 13. IDBI
  if (/\bidbi\b/i.test(clean)) return "idbi";

  // 14. IndusInd
  if (/\bindusind\b/i.test(clean)) return "indusind";

  // 15. Yes Bank
  if (/\byes\s*bank\b/i.test(clean) || clean === "yes") return "yes";

  // 16. IDFC First
  if (/\b(idfc|idfc\s*first)\b/i.test(clean)) return "idfc";

  // 17. Federal Bank
  if (/\bfederal\b/i.test(clean)) return "federal";

  // 18. RBL Bank
  if (/\brbl\b/i.test(clean)) return "rbl";

  // 19. Bandhan Bank
  if (/\bbandhan\b/i.test(clean)) return "bandhan";

  // 20. AU Small Finance Bank
  if (/\b(au\s*bank|au\s*small|aubank)\b/i.test(clean)) return "aubank";

  // 21. Standard Chartered
  if (/\b(standard\s*chartered|stanchart)\b/i.test(clean)) return "stanchart";

  // 22. DBS Bank
  if (/\bdbs\b/i.test(clean)) return "dbs";

  // 23. Amex
  if (/\b(amex|american\s*express)\b/i.test(clean)) return "amex";

  // 24. Apple
  if (/\b(apple|apple\s*card|apple\s*cash)\b/i.test(clean)) return "apple";

  // 25. Zerodha / Kite
  if (/\b(zerodha|kite)\b/i.test(clean)) return "zerodha";

  // 26. Groww
  if (/\bgroww\b/i.test(clean)) return "groww";

  // 27. Paytm
  if (/\bpaytm\b/i.test(clean)) return "paytm";

  // 28. Cred
  if (/\b(cred|cred\s*pay)\b/i.test(clean)) return "cred";

  // 29. Jupiter
  if (/\bjupiter\b/i.test(clean)) return "jupiter";

  // 30. Fi Money
  if (/\b(fi\s*money|fi\s*bank)\b/i.test(clean) || clean === "fi") return "fi";

  // 31. Angel One
  if (/\b(angel\s*one|angel\s*broking)\b/i.test(clean)) return "angelone";

  // 32. Upstox
  if (/\bupstox\b/i.test(clean)) return "upstox";

  // 33. Chase
  if (/\b(chase|jpmorgan|jp\s*morgan)\b/i.test(clean)) return "chase";

  // 34. Citi
  if (/\b(citi|citibank)\b/i.test(clean)) return "citi";

  // 35. HSBC
  if (/\bhsbc\b/i.test(clean)) return "hsbc";

  // 36. Bank of America
  if (/\b(bofa|bank\s*of\s*america)\b/i.test(clean)) return "bofa";

  // 37. Wells Fargo
  if (/\b(wells\s*fargo|wellsfargo)\b/i.test(clean)) return "wellsfargo";

  // 38. Barclays
  if (/\bbarclays\b/i.test(clean)) return "barclays";

  return null;
}

function renderKnownMark(knownMark: string, size: number, className = ""): React.ReactNode {
  switch (knownMark) {
    case "cash":
      return <CashMark size={size} className={className} />;
    case "sbi":
      return <SbiMark size={size} className={className} />;
    case "hdfc":
      return <HdfcMark size={size} className={className} />;
    case "icici":
      return <IciciMark size={size} className={className} />;
    case "axis":
      return <AxisMark size={size} className={className} />;
    case "kotak":
      return <KotakMark size={size} className={className} />;
    case "pnb":
      return <PnbMark size={size} className={className} />;
    case "bob":
      return <BobMark size={size} className={className} />;
    case "canara":
      return <CanaraMark size={size} className={className} />;
    case "union":
      return <UnionMark size={size} className={className} />;
    case "boi":
      return <BoiMark size={size} className={className} />;
    case "indianbank":
      return <IndianBankMark size={size} className={className} />;
    case "idbi":
      return <IdbiMark size={size} className={className} />;
    case "indusind":
      return <IndusIndMark size={size} className={className} />;
    case "yes":
      return <YesMark size={size} className={className} />;
    case "idfc":
      return <IdfcMark size={size} className={className} />;
    case "federal":
      return <FederalMark size={size} className={className} />;
    case "rbl":
      return <RblMark size={size} className={className} />;
    case "bandhan":
      return <BandhanMark size={size} className={className} />;
    case "aubank":
      return <AubankMark size={size} className={className} />;
    case "stanchart":
      return <StanchartMark size={size} className={className} />;
    case "dbs":
      return <DbsMark size={size} className={className} />;
    case "amex":
      return <AmexMark size={size} className={className} />;
    case "apple":
      return <AppleMark size={size} className={className} />;
    case "zerodha":
      return <ZerodhaMark size={size} className={className} />;
    case "groww":
      return <GrowwMark size={size} className={className} />;
    case "paytm":
      return <PaytmMark size={size} className={className} />;
    case "cred":
      return <CredMark size={size} className={className} />;
    case "jupiter":
      return <JupiterMark size={size} className={className} />;
    case "fi":
      return <FiMark size={size} className={className} />;
    case "angelone":
      return <AngelOneMark size={size} className={className} />;
    case "upstox":
      return <UpstoxMark size={size} className={className} />;
    case "chase":
      return <ChaseMark size={size} className={className} />;
    case "citi":
      return <CitiMark size={size} className={className} />;
    case "hsbc":
      return <HsbcMark size={size} className={className} />;
    case "bofa":
      return <BofaMark size={size} className={className} />;
    case "wellsfargo":
      return <WellsFargoMark size={size} className={className} />;
    case "barclays":
      return <BarclaysMark size={size} className={className} />;
    default:
      return null;
  }
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

  // Priority 1: Authentic Built-In Vector Marks (100% offline, crystal clear, 0ms lag)
  const knownMark = getKnownBankMark(name);
  if (knownMark) {
    const markComponent = renderKnownMark(knownMark, size, className);
    if (showDomain) {
      const domain = getBankDomain(name);
      return (
        <div className={`flex items-center gap-2 flex-shrink-0 ${className}`}>
          {markComponent}
          {domain && (
            <span className="text-[11px] font-mono opacity-60 truncate">
              {domain}
            </span>
          )}
        </div>
      );
    }
    return markComponent;
  }

  // Priority 2: Verified Bank Domain (curated banks or explicit user domain, NEVER guessed .com)
  const domain = getBankDomain(name);
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
  const padding = isSmall ? 0 : isMedium ? 1 : 2;
  const borderRadius = isSmall ? 4 : isMedium ? 6 : 8;

  if (activeUrl) {
    return (
      <div className={`flex items-center gap-2 flex-shrink-0 ${className}`}>
        <div
          className="relative flex items-center justify-center overflow-hidden flex-shrink-0 transition-colors"
          style={{
            width: size,
            height: size,
            borderRadius: `${borderRadius}px`,
            backgroundColor: "transparent",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
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
        </div>

        {showDomain && domain && (
          <span className="text-[11px] font-mono opacity-60 truncate">
            {domain}
          </span>
        )}
      </div>
    );
  }

  // Priority 3: Sophisticated Monogram Badge for custom/unrecognized bank accounts
  return (
    <div className={`flex items-center gap-2 flex-shrink-0 ${className}`}>
      <GenericBankMark name={name} size={size} />
      {showDomain && domain && (
        <span className="text-[11px] font-mono opacity-60 truncate">
          {domain}
        </span>
      )}
    </div>
  );
}
