"use client";

import React, { useState, useMemo } from "react";
import { PieChart as PieChartIcon } from "lucide-react";

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
  percentage?: number;
  subtitle?: string;
}

export interface InteractiveDonutChartProps {
  title?: string;
  totalLabel?: string;
  totalValue: number;
  segments: DonutSegment[];
  size?: number; // Diameter in px (default: 170)
  strokeWidth?: number; // Donut thickness (default: 16)
  formatter?: (val: number) => string;
  emptyMessage?: string;
  emptySubMessage?: string;
  variant?: "standard" | "compact";
  icon?: React.ReactNode;
  centerColor?: string;
  maxLegendHeight?: string;
}

export default function InteractiveDonutChart({
  title,
  totalLabel = "Total Assets",
  totalValue,
  segments,
  size = 170,
  strokeWidth = 16,
  formatter = (val: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(val),
  emptyMessage = "No allocation data available",
  emptySubMessage = "Record assets or transactions to populate this breakdown.",
  variant = "standard",
  icon,
  centerColor,
  maxLegendHeight = "max-h-52",
}: InteractiveDonutChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const radius = (size - strokeWidth * 2) / 2;
  const innerRadius = radius - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;

  // Filter valid positive segments and compute exact percentages
  const validSegments = useMemo(() => {
    const raw = segments.filter((s) => s.value > 0);
    const sum = totalValue > 0 ? totalValue : raw.reduce((acc, curr) => acc + curr.value, 0);

    return raw.map((s) => {
      const pct = sum > 0 ? (s.value / sum) * 100 : 0;
      return {
        ...s,
        percentage: pct,
      };
    });
  }, [segments, totalValue]);

  // Compute strokeDasharray and strokeDashoffset for each segment with clean gaps
  const renderedSegments = useMemo(() => {
    const gapAngle = validSegments.length > 1 ? 2.5 : 0; // 2.5px micro-gap between slices
    const gapPerSegment = (gapAngle / 360) * circumference;

    let offset = 0;
    const result = [];
    for (let idx = 0; idx < validSegments.length; idx++) {
      const seg = validSegments[idx];
      const rawDash = (seg.percentage / 100) * circumference;
      const strokeDash = Math.max(1, rawDash - gapPerSegment);
      result.push({
        ...seg,
        strokeDasharray: `${strokeDash} ${circumference}`,
        strokeDashoffset: -offset,
        index: idx,
      });
      offset += rawDash;
    }
    return result;
  }, [validSegments, circumference]);

  // Active highlighted segment (if hovered)
  const activeSegment =
    hoveredIndex !== null && renderedSegments[hoveredIndex]
      ? renderedSegments[hoveredIndex]
      : null;

  if (validSegments.length === 0 || totalValue <= 0) {
    return (
      <div className="h-48 flex flex-col items-center justify-center text-center p-6 text-xs opacity-60 w-full select-none">
        <div
          className="relative p-4 rounded-full mb-3 border"
          style={{
            borderColor: "var(--app-border-subtle)",
            backgroundColor: "var(--app-card)",
          }}
        >
          {icon || <PieChartIcon size={26} className="opacity-50 text-[var(--app-accent)]" />}
          <div className="absolute inset-0 rounded-full border border-dashed border-white/15 animate-spin" style={{ animationDuration: "14s" }} />
        </div>
        <p className="font-bold text-xs tracking-tight">{emptyMessage}</p>
        <p className="text-[11px] mt-1 opacity-70 max-w-xs leading-relaxed">{emptySubMessage}</p>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col ${
        variant === "compact"
          ? "items-center gap-5"
          : "sm:flex-row items-center gap-6 lg:gap-10"
      } w-full`}
    >
      {/* Donut SVG Ring Container with Luminescent Bloom */}
      <div className="flex justify-center items-center relative flex-shrink-0 select-none group">
        {/* Ambient radial blur halo matching active segment color */}
        <div
          className="absolute inset-0 rounded-full blur-2xl pointer-events-none transition-all duration-300 -z-10"
          style={{
            backgroundColor: activeSegment ? activeSegment.color : "transparent",
            opacity: activeSegment ? 0.22 : 0,
            transform: "scale(1.2)",
          }}
        />

        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-90 overflow-visible"
        >
          <defs>
            {/* High-intensity outer bloom filter for active slice */}
            <filter id={`donutGlow-${size}`} x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="4.5" result="blur" />
              <feDropShadow dx="0" dy="0" stdDeviation="6" floodOpacity="0.45" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            {/* Inner subtle bevel mask */}
            <radialGradient id={`centerLens-${size}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--app-card)" stopOpacity="0.9" />
              <stop offset="85%" stopColor="var(--app-bg)" stopOpacity="0.95" />
              <stop offset="100%" stopColor="var(--app-border)" stopOpacity="0.4" />
            </radialGradient>
          </defs>

          {/* Precision outer hairline guide circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius + strokeWidth / 2 + 3}
            fill="none"
            stroke="var(--app-border-subtle)"
            strokeWidth="0.75"
            strokeDasharray="2 3"
            opacity="0.4"
          />

          {/* Background track circle with rich subtle contrast */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--app-card)"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--app-border)"
            strokeWidth={strokeWidth}
            opacity="0.45"
          />

          {/* Render individual donut segments with precision arcs */}
          {renderedSegments.map((seg, idx) => {
            const isHovered = hoveredIndex === idx;
            const isAnyHovered = hoveredIndex !== null;
            const currentStrokeWidth = isHovered ? strokeWidth + 4 : strokeWidth;
            const currentOpacity = isHovered ? 1 : isAnyHovered ? 0.28 : 0.95;

            return (
              <circle
                key={idx}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth={currentStrokeWidth}
                strokeDasharray={seg.strokeDasharray}
                strokeDashoffset={seg.strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-200 ease-out cursor-pointer"
                style={{
                  opacity: currentOpacity,
                  filter: isHovered ? `url(#donutGlow-${size})` : "none",
                  transformOrigin: "center",
                }}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            );
          })}

          {/* Precision inner hairline guide circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={Math.max(4, innerRadius - 2)}
            fill="none"
            stroke="var(--app-border-subtle)"
            strokeWidth="0.75"
            strokeDasharray="2 3"
            opacity="0.4"
          />
        </svg>

        {/* Dynamic Center Crystal Lens Display */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none select-none rounded-full transition-all duration-200"
          style={{
            margin: strokeWidth + 6,
            background: `radial-gradient(circle, var(--app-card) 60%, var(--app-bg) 100%)`,
            boxShadow: activeSegment
              ? `inset 0 0 16px ${activeSegment.color}25, 0 4px 12px rgba(0,0,0,0.3)`
              : "inset 0 0 12px rgba(0,0,0,0.25), 0 2px 8px rgba(0,0,0,0.2)",
            border: activeSegment
              ? `1px solid ${activeSegment.color}45`
              : "1px solid var(--app-border-subtle)",
          }}
        >
          {activeSegment ? (
            <div className="flex flex-col items-center animate-in fade-in zoom-in-95 duration-150 px-2">
              <span
                className="text-[10px] font-bold uppercase tracking-wider truncate max-w-[95px] mb-0.5"
                style={{ color: activeSegment.color }}
              >
                {activeSegment.label}
              </span>
              <span className="text-xs sm:text-sm font-extrabold font-mono tracking-tight leading-tight">
                {formatter(activeSegment.value).replace(".00", "")}
              </span>
              <span
                className="text-[9px] font-bold font-mono px-2 py-0.5 mt-1 rounded-full border tracking-tight"
                style={{
                  backgroundColor: `${activeSegment.color}20`,
                  color: activeSegment.color,
                  borderColor: `${activeSegment.color}40`,
                }}
              >
                {activeSegment.percentage.toFixed(1)}%
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center animate-in fade-in duration-150 px-2">
              <span className="text-[9px] uppercase tracking-wider font-semibold opacity-60">
                {totalLabel}
              </span>
              <span
                className="text-xs sm:text-[13px] font-extrabold font-mono tracking-tight leading-tight mt-0.5"
                style={{ color: centerColor || "var(--app-fg)" }}
              >
                {formatter(totalValue).replace(".00", "")}
              </span>
              <span className="text-[9px] font-mono opacity-50 mt-0.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                {validSegments.length} {validSegments.length === 1 ? "Class" : "Classes"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Rich Interactive Legend with Proportional Progress Meters */}
      <div className="w-full sm:max-w-xs space-y-2.5">
        {title && (
          <div
            className="flex items-center justify-between pb-2 border-b select-none"
            style={{ borderColor: "var(--app-border-subtle)" }}
          >
            <div className="flex items-center gap-2">
              {icon || <PieChartIcon size={14} className="opacity-70 text-[var(--app-accent)]" />}
              <span className="text-[11px] uppercase font-bold tracking-wider opacity-80">
                {title}
              </span>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border opacity-70"
              style={{
                borderColor: "var(--app-border-subtle)",
                backgroundColor: "var(--app-card)",
              }}
            >
              {validSegments.length} {validSegments.length === 1 ? "Class" : "Classes"}
            </span>
          </div>
        )}

        <div className={`space-y-1.5 ${maxLegendHeight} overflow-y-auto pr-1`}>
          {renderedSegments.map((seg, idx) => {
            const isHovered = hoveredIndex === idx;
            const isAnyHovered = hoveredIndex !== null;

            return (
              <div
                key={idx}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                className={`group relative flex flex-col gap-1 text-xs p-2 rounded-xl border transition-all cursor-pointer ${
                  isHovered
                    ? "scale-[1.02] shadow-md"
                    : isAnyHovered
                    ? "opacity-35"
                    : "opacity-90 hover:opacity-100"
                }`}
                style={{
                  backgroundColor: isHovered ? "var(--app-card-hover)" : "var(--app-card)",
                  borderColor: isHovered ? `${seg.color}50` : "var(--app-border-subtle)",
                }}
              >
                {/* Top Row: Color indicator, Label, and Monetary Amount */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 overflow-hidden truncate">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0 transition-all duration-200"
                      style={{
                        backgroundColor: seg.color,
                        transform: isHovered ? "scale(1.3)" : "scale(1)",
                        boxShadow: isHovered ? `0 0 8px ${seg.color}` : "none",
                      }}
                    />
                    <span className="truncate text-[11px] font-semibold">{seg.label}</span>
                  </div>

                  <div className="flex items-center gap-2 font-mono flex-shrink-0 text-right">
                    <span className="text-[11px] font-bold">
                      {formatter(seg.value).replace(".00", "")}
                    </span>
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.2 rounded font-mono"
                      style={{
                        backgroundColor: `${seg.color}18`,
                        color: seg.color,
                      }}
                    >
                      {seg.percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Bottom Row: Micro Progress Distribution Bar */}
                <div
                  className="w-full h-1 rounded-full overflow-hidden"
                  style={{ backgroundColor: "var(--app-track-bg)" }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.max(3, seg.percentage)}%`,
                      backgroundColor: seg.color,
                      boxShadow: isHovered ? `0 0 6px ${seg.color}` : "none",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}