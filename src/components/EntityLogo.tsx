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
  const domain = getEntityDomain(name);

  // Multi-tier candidate URLs in order of clarity & speed
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

  const borderRadius = Math.max(6, Math.floor(size * 0.22));
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
