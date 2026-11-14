"use client";

import React, { useState } from "react";
import {
  Building2,
  Utensils,
  ShoppingCart,
  Film,
  Car,
  HeartPulse,
  Zap,
  Home,
  Coffee,
  Fuel,
  Plane,
  Smartphone,
  TrendingUp,
  Receipt,
} from "lucide-react";
import {
  getEntityDomain,
  getEntityVectorLogo,
  getEntityLogoDev,
  getEntityGoogleFavicon,
} from "@/utils/entityLogos";

interface EntityLogoProps {
  name: string;
  category?: string;
  size?: number;
  className?: string;
}

interface VisualMatch {
  icon?: React.ReactNode;
  initials?: string;
  bg: string;
  border: string;
}

/* =========================================================================
   AUTHENTIC BUILT-IN MERCHANT & BRAND VECTOR MARKS (Infinite clarity)
   ========================================================================= */

function SwiggyMark({ size }: { size: number }) {
  return (
    <div className="w-full h-full flex items-center justify-center rounded-lg bg-[#FC8019] overflow-hidden select-none" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="w-full h-full p-2" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M50 14 C36 14 26 24 26 38 C26 56 50 86 50 86 C50 86 74 56 74 38 C74 24 64 14 50 14Z" fill="#FFFFFF" />
        <path d="M50 26 C43 26 38 31 38 38 C38 45 43 50 50 50 C57 50 62 45 62 38 C62 31 57 26 50 26Z" fill="#FC8019" />
      </svg>
    </div>
  );
}

function ZomatoMark({ size }: { size: number }) {
  const fontSize = Math.max(10, Math.floor(size * 0.44));
  return (
    <div className="w-full h-full flex items-center justify-center rounded-lg bg-[#E23744] overflow-hidden select-none" style={{ width: size, height: size }}>
      <span className="font-black italic text-white tracking-tighter leading-none" style={{ fontSize: `${fontSize}px` }}>
        zomato
      </span>
    </div>
  );
}

function AmazonMark({ size }: { size: number }) {
  return (
    <div className="w-full h-full flex items-center justify-center rounded-lg bg-[#131921] overflow-hidden select-none" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="w-full h-full p-2" fill="none" xmlns="http://www.w3.org/2000/svg">
        <text x="50" y="48" fontSize="30" fontWeight="900" fill="#FFFFFF" textAnchor="middle" fontFamily="sans-serif">
          a
        </text>
        <path d="M25 64 Q50 78 75 64" stroke="#FF9900" strokeWidth="5" strokeLinecap="round" />
        <polygon points="76,64 70,59 78,56" fill="#FF9900" />
      </svg>
    </div>
  );
}

function FlipkartMark({ size }: { size: number }) {
  return (
    <div className="w-full h-full flex items-center justify-center rounded-lg bg-[#2874F0] overflow-hidden select-none" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="w-full h-full p-1.5" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M30 30L38 18H62L70 30V80H30V30Z" fill="#FFE11B" />
        <text x="50" y="62" fontSize="36" fontWeight="900" fontStyle="italic" fill="#2874F0" textAnchor="middle" fontFamily="sans-serif">
          f
        </text>
      </svg>
    </div>
  );
}

function BlinkitMark({ size }: { size: number }) {
  return (
    <div className="w-full h-full flex items-center justify-center rounded-lg bg-[#F8CB46] overflow-hidden select-none" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="w-full h-full p-1" fill="none" xmlns="http://www.w3.org/2000/svg">
        <text x="50" y="66" fontSize="46" fontWeight="900" fill="#0C831F" textAnchor="middle" fontFamily="sans-serif">
          b
        </text>
      </svg>
    </div>
  );
}

function ZeptoMark({ size }: { size: number }) {
  const fontSize = Math.max(9, Math.floor(size * 0.38));
  return (
    <div className="w-full h-full flex items-center justify-center rounded-lg bg-[#3C006B] overflow-hidden select-none" style={{ width: size, height: size }}>
      <span className="font-black italic text-[#FF3269] tracking-tighter leading-none" style={{ fontSize: `${fontSize}px` }}>
        zepto
      </span>
    </div>
  );
}

function UberMark({ size }: { size: number }) {
  const fontSize = Math.max(9, Math.floor(size * 0.34));
  return (
    <div className="w-full h-full flex items-center justify-center rounded-lg bg-[#000000] overflow-hidden select-none" style={{ width: size, height: size }}>
      <span className="font-extrabold text-white tracking-tight leading-none" style={{ fontSize: `${fontSize}px` }}>
        Uber
      </span>
    </div>
  );
}

function OlaMark({ size }: { size: number }) {
  return (
    <div className="w-full h-full flex items-center justify-center rounded-lg bg-[#141414] overflow-hidden select-none" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="w-full h-full p-2" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="32" stroke="#B8DE06" strokeWidth="8" />
        <text x="50" y="58" fontSize="22" fontWeight="900" fill="#B8DE06" textAnchor="middle" fontFamily="sans-serif">
          OLA
        </text>
      </svg>
    </div>
  );
}

function NetflixMark({ size }: { size: number }) {
  return (
    <div className="w-full h-full flex items-center justify-center rounded-lg bg-[#000000] overflow-hidden select-none" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="w-full h-full p-2" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M30 20V80H42V42L58 80H70V20H58V58L42 20H30Z" fill="#E50914" />
      </svg>
    </div>
  );
}

function SpotifyMark({ size }: { size: number }) {
  return (
    <div className="w-full h-full flex items-center justify-center rounded-lg bg-[#121212] overflow-hidden select-none" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="w-full h-full p-1.5" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="38" fill="#1DB954" />
        <path d="M32 40 C46 35 62 38 72 44" stroke="#121212" strokeWidth="6" strokeLinecap="round" />
        <path d="M35 50 C46 46 58 48 68 54" stroke="#121212" strokeWidth="5" strokeLinecap="round" />
        <path d="M38 60 C46 57 56 59 64 64" stroke="#121212" strokeWidth="4" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function GoogleMark({ size }: { size: number }) {
  return (
    <div className="w-full h-full flex items-center justify-center rounded-lg bg-[#FFFFFF] border border-black/10 overflow-hidden select-none" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="w-full h-full p-2" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M88 51.5C88 48.7 87.7 46.5 87.2 44.5H50V58.3H71.7C70.8 62.9 67.8 67 63.5 69.8V79.2H76.7C84.4 72.1 88 61.6 88 51.5Z" fill="#4285F4" />
        <path d="M50 90C60.8 90 69.9 86.4 76.7 80.2L63.5 70.8C59.8 73.3 55.3 74.8 50 74.8C39.5 74.8 30.6 67.8 27.4 58.2H13.8V68.7C20.6 82.2 34.6 90 50 90Z" fill="#34A853" />
        <path d="M27.4 58.2C26.6 55.7 26.1 53 26.1 50C26.1 47 26.6 44.3 27.4 41.8V31.3H13.8C10.9 37 9.3 43.3 9.3 50C9.3 56.7 10.9 63 13.8 68.7L27.4 58.2Z" fill="#FBBC05" />
        <path d="M50 25.2C56 25.2 61.4 27.3 65.6 31.3L77 19.9C69.9 13.3 60.8 9.3 50 9.3C34.6 9.3 20.6 17.8 13.8 31.3L27.4 41.8C30.6 32.2 39.5 25.2 50 25.2Z" fill="#EA4335" />
      </svg>
    </div>
  );
}

function YouTubeMark({ size }: { size: number }) {
  return (
    <div className="w-full h-full flex items-center justify-center rounded-lg bg-[#FF0000] overflow-hidden select-none" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="w-full h-full p-2" fill="none" xmlns="http://www.w3.org/2000/svg">
        <polygon points="42,35 68,50 42,65" fill="#FFFFFF" />
      </svg>
    </div>
  );
}

function AppleMerchantMark({ size }: { size: number }) {
  return (
    <div className="w-full h-full flex items-center justify-center rounded-lg bg-[#000000] overflow-hidden select-none" style={{ width: size, height: size }}>
      <svg viewBox="0 0 170 170" className="w-full h-full p-2" fill="#FFFFFF" xmlns="http://www.w3.org/2000/svg">
        <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.05-7.62-7.85-11.77-14.41-6.1-9.7-10.78-20.91-14.05-33.64-3.26-12.72-4.9-24.52-4.9-35.39 0-14.36 3.48-26.04 10.45-35.03 6.97-8.99 15.68-13.59 26.13-13.8 4.35 0 9.48 1.25 15.39 3.75 5.91 2.5 9.71 3.81 11.4 3.93 1.91-.12 5.92-1.5 12.03-4.14 6.11-2.64 11.22-3.83 15.33-3.56 10.46.66 18.94 4.54 25.43 11.64-8.92 5.45-13.25 12.87-12.98 22.28.27 8.94 3.82 16.31 10.66 22.12 6.84 5.81 14.88 9.07 24.12 9.77-2.39 7.42-5.44 15.14-9.15 23.16zM119.22 31.84c0-7.22 2.61-13.9 7.83-20.04 5.22-6.14 11.58-10.07 19.08-11.8 0 1.09.05 2.18.05 3.27 0 7.33-2.77 14.24-8.31 20.73-5.54 6.49-12.08 10.02-18.65 10.59-.22-.92-.35-1.84-.35-2.75z"/>
      </svg>
    </div>
  );
}

function StarbucksMark({ size }: { size: number }) {
  return (
    <div className="w-full h-full flex items-center justify-center rounded-lg bg-[#00704A] overflow-hidden select-none" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="w-full h-full p-2" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="36" stroke="#FFFFFF" strokeWidth="6" />
        <polygon points="50,28 54,40 66,40 56,48 60,60 50,52 40,60 44,48 34,40 46,40" fill="#FFFFFF" />
      </svg>
    </div>
  );
}

function McDonaldsMark({ size }: { size: number }) {
  return (
    <div className="w-full h-full flex items-center justify-center rounded-lg bg-[#DA291C] overflow-hidden select-none" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="w-full h-full p-1.5" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M26 76V44C26 30 38 28 42 42C44 48 46 54 48 60C50 54 52 48 54 42C58 28 70 30 70 44V76" stroke="#FFC72C" strokeWidth="12" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function AirtelMark({ size }: { size: number }) {
  return (
    <div className="w-full h-full flex items-center justify-center rounded-lg bg-[#E40000] overflow-hidden select-none" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="w-full h-full p-2" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M30 68 C22 55 24 38 36 28 C48 18 64 20 72 34 C80 48 76 66 60 72 C48 76 38 72 30 68Z" stroke="#FFFFFF" strokeWidth="8" fill="none" />
      </svg>
    </div>
  );
}

function JioMark({ size }: { size: number }) {
  const fontSize = Math.max(10, Math.floor(size * 0.44));
  return (
    <div className="w-full h-full flex items-center justify-center rounded-lg bg-[#0A2885] overflow-hidden select-none" style={{ width: size, height: size }}>
      <span className="font-black text-white italic tracking-tight leading-none" style={{ fontSize: `${fontSize}px` }}>
        Jio
      </span>
    </div>
  );
}

function PhonePeMark({ size }: { size: number }) {
  const fontSize = Math.max(10, Math.floor(size * 0.44));
  return (
    <div className="w-full h-full flex items-center justify-center rounded-lg bg-[#5F259F] overflow-hidden select-none" style={{ width: size, height: size }}>
      <span className="font-black text-white tracking-tight leading-none" style={{ fontSize: `${fontSize}px` }}>
        पे
      </span>
    </div>
  );
}

function CredMerchantMark({ size }: { size: number }) {
  return (
    <div className="w-full h-full flex items-center justify-center rounded-lg bg-[#111111] overflow-hidden select-none" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="w-full h-full p-2" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M28 22H72V52C72 64 62 76 50 80C38 76 28 64 28 52V22Z" stroke="#FFFFFF" strokeWidth="7" fill="none" />
        <path d="M42 36H58V50C58 56 54 60 50 62C46 60 42 56 42 50V36Z" fill="#FFFFFF" />
      </svg>
    </div>
  );
}

function getKnownEntityMark(name: string): string | null {
  if (!name || !name.trim()) return null;
  const clean = name.trim().toLowerCase();

  if (/\bswiggy\b/i.test(clean) || /\binstamart\b/i.test(clean)) return "swiggy";
  if (/\bzomato\b/i.test(clean)) return "zomato";
  if (/\bamazon\b/i.test(clean) || /\bprime\b/i.test(clean) && !/\bprimary\b/i.test(clean)) return "amazon";
  if (/\bflipkart\b/i.test(clean)) return "flipkart";
  if (/\bblinkit\b/i.test(clean) || /\bgrofers\b/i.test(clean)) return "blinkit";
  if (/\bzepto\b/i.test(clean)) return "zepto";
  if (/\buber\b/i.test(clean)) return "uber";
  if (/\bola\b/i.test(clean)) return "ola";
  if (/\bnetflix\b/i.test(clean)) return "netflix";
  if (/\bspotify\b/i.test(clean)) return "spotify";
  if (/\byoutube\b/i.test(clean) || /\byt\b/i.test(clean)) return "youtube";
  if (/\bgoogle\b/i.test(clean) || /\bgpay\b/i.test(clean)) return "google";
  if (/\bapple\b/i.test(clean) && !/\bapples\b/i.test(clean) && !/\bpineapple\b/i.test(clean)) return "apple";
  if (/\bstarbucks\b/i.test(clean)) return "starbucks";
  if (/\bmcdonald/i.test(clean) || /\bmcd\b/i.test(clean)) return "mcdonalds";
  if (/\bairtel\b/i.test(clean)) return "airtel";
  if (/\bjio\b/i.test(clean)) return "jio";
  if (/\bphonepe\b/i.test(clean)) return "phonepe";
  if (/\bcred\b/i.test(clean) && !/\bcredit\b/i.test(clean)) return "cred";

  return null;
}

function renderKnownEntityMark(mark: string, size: number): React.ReactNode {
  switch (mark) {
    case "swiggy":
      return <SwiggyMark size={size} />;
    case "zomato":
      return <ZomatoMark size={size} />;
    case "amazon":
      return <AmazonMark size={size} />;
    case "flipkart":
      return <FlipkartMark size={size} />;
    case "blinkit":
      return <BlinkitMark size={size} />;
    case "zepto":
      return <ZeptoMark size={size} />;
    case "uber":
      return <UberMark size={size} />;
    case "ola":
      return <OlaMark size={size} />;
    case "netflix":
      return <NetflixMark size={size} />;
    case "spotify":
      return <SpotifyMark size={size} />;
    case "google":
      return <GoogleMark size={size} />;
    case "youtube":
      return <YouTubeMark size={size} />;
    case "apple":
      return <AppleMerchantMark size={size} />;
    case "starbucks":
      return <StarbucksMark size={size} />;
    case "mcdonalds":
      return <McDonaldsMark size={size} />;
    case "airtel":
      return <AirtelMark size={size} />;
    case "jio":
      return <JioMark size={size} />;
    case "phonepe":
      return <PhonePeMark size={size} />;
    case "cred":
      return <CredMerchantMark size={size} />;
    default:
      return null;
  }
}

function getEntityVisual(name: string, category: string, size: number): VisualMatch {
  const cleanName = (name || "").toLowerCase();
  const cleanCat = (category || "").toLowerCase();
  const iconSize = Math.max(13, Math.round(size * 0.48));

  // 1. Tea / Chai / Coffee / Cafe / Beverages
  if (
    cleanName.includes("tea") ||
    cleanName.includes("chai") ||
    cleanName.includes("coffee") ||
    cleanName.includes("cafe") ||
    cleanName.includes("starbucks") ||
    cleanName.includes("chaayos") ||
    cleanName.includes("beverage")
  ) {
    return {
      icon: <Coffee size={iconSize} className="text-amber-500" />,
      bg: "rgba(245, 158, 11, 0.12)",
      border: "rgba(245, 158, 11, 0.28)",
    };
  }

  // 2. Food & Dining / Restaurant / Meals
  if (
    cleanCat.includes("food") ||
    cleanCat.includes("dining") ||
    cleanName.includes("food") ||
    cleanName.includes("lunch") ||
    cleanName.includes("dinner") ||
    cleanName.includes("breakfast") ||
    cleanName.includes("snack") ||
    cleanName.includes("restaurant") ||
    cleanName.includes("pizza") ||
    cleanName.includes("burger") ||
    cleanName.includes("biryani") ||
    cleanName.includes("bakery") ||
    cleanName.includes("sweet") ||
    cleanName.includes("hotel")
  ) {
    return {
      icon: <Utensils size={iconSize} className="text-amber-500" />,
      bg: "rgba(245, 158, 11, 0.12)",
      border: "rgba(245, 158, 11, 0.28)",
    };
  }

  // 3. Groceries / Supermarket
  if (
    cleanCat.includes("grocer") ||
    cleanName.includes("grocer") ||
    cleanName.includes("supermarket") ||
    cleanName.includes("vegetable") ||
    cleanName.includes("veggie") ||
    cleanName.includes("fruit") ||
    cleanName.includes("milk") ||
    cleanName.includes("ration")
  ) {
    return {
      icon: <ShoppingCart size={iconSize} className="text-emerald-500" />,
      bg: "rgba(16, 185, 129, 0.12)",
      border: "rgba(16, 185, 129, 0.28)",
    };
  }

  // 4. Fuel & Gas
  if (
    cleanName.includes("petrol") ||
    cleanName.includes("diesel") ||
    cleanName.includes("fuel") ||
    cleanName.includes("cng") ||
    cleanName.includes("gas")
  ) {
    return {
      icon: <Fuel size={iconSize} className="text-orange-500" />,
      bg: "rgba(249, 115, 22, 0.12)",
      border: "rgba(249, 115, 22, 0.28)",
    };
  }

  // 5. Transport / Commute / Cabs
  if (
    cleanCat.includes("transport") ||
    cleanName.includes("cab") ||
    cleanName.includes("taxi") ||
    cleanName.includes("auto") ||
    cleanName.includes("ride") ||
    cleanName.includes("uber") ||
    cleanName.includes("ola") ||
    cleanName.includes("rapido") ||
    cleanName.includes("car") ||
    cleanName.includes("fastag") ||
    cleanName.includes("toll") ||
    cleanName.includes("parking")
  ) {
    return {
      icon: <Car size={iconSize} className="text-purple-400" />,
      bg: "rgba(168, 85, 247, 0.12)",
      border: "rgba(168, 85, 247, 0.28)",
    };
  }

  // 6. Flights / Travel
  if (
    cleanCat.includes("travel") ||
    cleanName.includes("flight") ||
    cleanName.includes("airline") ||
    cleanName.includes("airport") ||
    cleanName.includes("trip")
  ) {
    return {
      icon: <Plane size={iconSize} className="text-sky-400" />,
      bg: "rgba(56, 189, 248, 0.12)",
      border: "rgba(56, 189, 248, 0.28)",
    };
  }

  // 7. Housing / Rent / Maintenance
  if (
    cleanCat.includes("housing") ||
    cleanCat.includes("rent") ||
    cleanName.includes("rent") ||
    cleanName.includes("flat") ||
    cleanName.includes("apartment") ||
    cleanName.includes("maintenance") ||
    cleanName.includes("pg") ||
    cleanName.includes("society") ||
    cleanName.includes("house")
  ) {
    return {
      icon: <Home size={iconSize} className="text-rose-400" />,
      bg: "rgba(244, 63, 94, 0.12)",
      border: "rgba(244, 63, 94, 0.28)",
    };
  }

  // 8. Utilities & Electricity
  if (
    cleanCat.includes("utilit") ||
    cleanName.includes("electric") ||
    cleanName.includes("power") ||
    cleanName.includes("bill") ||
    cleanName.includes("water") ||
    cleanName.includes("lpg")
  ) {
    return {
      icon: <Zap size={iconSize} className="text-yellow-400" />,
      bg: "rgba(234, 179, 8, 0.12)",
      border: "rgba(234, 179, 8, 0.28)",
    };
  }

  // 9. Mobile, Wifi, Telecom
  if (
    cleanName.includes("wifi") ||
    cleanName.includes("broadband") ||
    cleanName.includes("fiber") ||
    cleanName.includes("internet") ||
    cleanName.includes("recharge") ||
    cleanName.includes("mobile") ||
    cleanName.includes("phone")
  ) {
    return {
      icon: <Smartphone size={iconSize} className="text-blue-400" />,
      bg: "rgba(96, 165, 250, 0.12)",
      border: "rgba(96, 165, 250, 0.28)",
    };
  }

  // 10. Entertainment, OTT, Movies
  if (
    cleanCat.includes("entertain") ||
    cleanCat.includes("ott") ||
    cleanName.includes("movie") ||
    cleanName.includes("cinema") ||
    cleanName.includes("pvr") ||
    cleanName.includes("inox") ||
    cleanName.includes("theatre") ||
    cleanName.includes("show") ||
    cleanName.includes("netflix") ||
    cleanName.includes("prime") ||
    cleanName.includes("hotstar") ||
    cleanName.includes("spotify")
  ) {
    return {
      icon: <Film size={iconSize} className="text-cyan-400" />,
      bg: "rgba(6, 182, 212, 0.12)",
      border: "rgba(6, 182, 212, 0.28)",
    };
  }

  // 11. Health & Medical & Gym
  if (
    cleanCat.includes("health") ||
    cleanCat.includes("medical") ||
    cleanName.includes("doctor") ||
    cleanName.includes("hospital") ||
    cleanName.includes("clinic") ||
    cleanName.includes("pharmacy") ||
    cleanName.includes("medicine") ||
    cleanName.includes("meds") ||
    cleanName.includes("gym") ||
    cleanName.includes("fitness") ||
    cleanName.includes("dentist")
  ) {
    return {
      icon: <HeartPulse size={iconSize} className="text-emerald-400" />,
      bg: "rgba(16, 185, 129, 0.12)",
      border: "rgba(16, 185, 129, 0.28)",
    };
  }

  // 12. Salary, Inflow, Employer, Company
  if (
    cleanCat.includes("salary") ||
    cleanCat.includes("income") ||
    cleanCat.includes("stipend") ||
    cleanCat.includes("bonus") ||
    cleanName.includes("salary") ||
    cleanName.includes("stipend") ||
    cleanName.includes("payroll") ||
    cleanName.includes("employer") ||
    cleanName.includes("bonus")
  ) {
    return {
      icon: <Building2 size={iconSize} className="text-emerald-400" />,
      bg: "rgba(16, 185, 129, 0.12)",
      border: "rgba(16, 185, 129, 0.28)",
    };
  }

  // 13. Investment, Dividends, Stocks, Trading
  if (
    cleanCat.includes("invest") ||
    cleanName.includes("dividend") ||
    cleanName.includes("interest") ||
    cleanName.includes("sip") ||
    cleanName.includes("mutual fund") ||
    cleanName.includes("stock") ||
    cleanName.includes("shares")
  ) {
    return {
      icon: <TrendingUp size={iconSize} className="text-emerald-400" />,
      bg: "rgba(16, 185, 129, 0.12)",
      border: "rgba(16, 185, 129, 0.28)",
    };
  }

  // 14. Shopping & Retail
  if (
    cleanCat.includes("shopping") ||
    cleanName.includes("shopping") ||
    cleanName.includes("clothes") ||
    cleanName.includes("mall") ||
    cleanName.includes("store")
  ) {
    return {
      icon: <ShoppingCart size={iconSize} className="text-pink-400" />,
      bg: "rgba(236, 72, 153, 0.12)",
      border: "rgba(236, 72, 153, 0.28)",
    };
  }

  // Fallback: 2-letter uppercase Monogram or Receipt
  const initials =
    name
      .trim()
      .split(/[\s/\\-_]+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "";

  if (initials.length >= 2) {
    return {
      initials,
      bg: "var(--app-bg)",
      border: "var(--app-border-subtle)",
    };
  }

  return {
    icon: <Receipt size={iconSize} className="opacity-60" />,
    bg: "var(--app-bg)",
    border: "var(--app-border-subtle)",
  };
}

export default function EntityLogo({
  name,
  category = "",
  size = 40,
  className = "",
}: EntityLogoProps) {
  const [failedSources, setFailedSources] = useState<Record<string, number>>({});
  const borderRadius = Math.max(6, Math.floor(size * 0.22));

  // Priority 1: Built-in Authentic Vector Marks (Swiggy, Zomato, Amazon, Uber, etc.)
  const knownMark = getKnownEntityMark(name);
  if (knownMark) {
    return (
      <div
        className={`relative flex items-center justify-center overflow-hidden flex-shrink-0 select-none ${className}`}
        style={{
          width: size,
          height: size,
          borderRadius: `${borderRadius}px`,
        }}
      >
        {renderKnownEntityMark(knownMark, size)}
      </div>
    );
  }

  // Priority 2: Verified Domain (curated dictionary only, NEVER guessed .com from title tokens)
  const domain = getEntityDomain(name);
  const candidateUrls: string[] = domain
    ? [
        getEntityVectorLogo(domain),
        getEntityLogoDev(domain, size),
        getEntityGoogleFavicon(domain, 128),
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

  const visual = getEntityVisual(name, category, size);

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden flex-shrink-0 transition-all ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: `${borderRadius}px`,
        backgroundColor: activeUrl ? "#ffffff" : visual.bg,
        borderColor: activeUrl ? "var(--app-border-subtle)" : visual.border,
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
          className="w-full h-full object-contain p-1.5"
          style={{
            imageRendering: "-webkit-optimize-contrast",
          }}
          loading="lazy"
        />
      ) : visual.icon ? (
        <div className="flex items-center justify-center w-full h-full select-none">
          {visual.icon}
        </div>
      ) : (
        <span
          className="font-bold font-mono tracking-tight leading-none select-none"
          style={{
            fontSize: Math.max(9, Math.floor(size * 0.38)),
            color: "var(--app-fg)",
          }}
        >
          {visual.initials}
        </span>
      )}
    </div>
  );
}
