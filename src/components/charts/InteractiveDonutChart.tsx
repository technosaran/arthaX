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
  size?: number; // Diameter in px (default: 160)
  strokeWidth?: number; // Donut thickness (default: 14)
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
  size = 160,
  strokeWidth = 14,
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
  maxLegendHeight = "max-h-48",
}: InteractiveDonutChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const radius = (size - strokeWidth * 2) / 2;
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

  // Compute strokeDasharray and strokeDashoffset for each segment
  const renderedSegments = useMemo(() => {
    let accumulatedOffset = 0;
    return validSegments.map((seg, idx) => {
      const strokeDash = (seg.percentage / 100) * circumference;
      const offset = accumulatedOffset;
      accumulatedOffset += strokeDash;

      return {
        ...seg,
        strokeDasharray: `${strokeDash} ${circumference}`,
        strokeDashoffset: -offset,
        index: idx,
      };
    });
  }, [validSegments, circumference]);

  // Active highlighted segment (if hovered)
  const activeSegment = hoveredIndex !== null && renderedSegments[hoveredIndex]
    ? renderedSegments[hoveredIndex]
    : null;

  if (validSegments.length === 0 || totalValue <= 0) {
    return (
      <div className="h-44 flex flex-col items-center justify-center text-center p-4 text-xs opacity-60 w-full select-none">
        <div className="p-3 rounded-full mb-2" style={{ backgroundColor: "var(--app-track-bg)" }}>
          {icon || <PieChartIcon size={24} className="opacity-50" />}
        </div>
        <p className="font-semibold text-xs">{emptyMessage}</p>
        <p className="text-[11px] mt-1 opacity-75 max-w-xs">{emptySubMessage}</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${variant === "compact" ? "items-center gap-4" : "sm:flex-row items-center gap-6 lg:gap-8"} w-full`}>
      {/* Donut SVG Ring Container */}
      <div className="flex justify-center items-center relative flex-shrink-0 select-none">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-90 overflow-visible"
        >
          {/* Outer glow filter for hovered slice */}
          <defs>
            <filter id={`donutGlow-${size}`} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Background track circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--app-track-bg)"
            strokeWidth={strokeWidth}
          />

          {/* Render individual donut segments */}
          {renderedSegments.map((seg, idx) => {
            const isHovered = hoveredIndex === idx;
            const isAnyHovered = hoveredIndex !== null;
            const currentStrokeWidth = isHovered ? strokeWidth + 4 : strokeWidth;
            const currentOpacity = isHovered ? 1 : isAnyHovered ? 0.35 : 1;

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
                className="transition-all duration-300 ease-out cursor-pointer"
                style={{
                  opacity: currentOpacity,
                  filter: isHovered ? `url(#donutGlow-${size})` : "none",
                }}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            );
          })}
        </svg>

        {/* Dynamic Center Label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none select-none px-2 transition-all duration-200">
          {activeSegment ? (
            <div className="flex flex-col items-center animate-in fade-in zoom-in-95 duration-150">
              <span
                className="text-[10px] font-bold uppercase tracking-wider truncate max-w-[100px] mb-0.5"
                style={{ color: activeSegment.color }}
              >
                {activeSegment.label}
              </span>
              <span className="text-xs sm:text-sm font-extrabold font-mono tracking-tight leading-tight">
                {formatter(activeSegment.value).replace(".00", "")}
              </span>
              <span
                className="text-[9px] font-bold font-mono px-1.5 py-0.2 mt-0.5 rounded-full"
                style={{
                  backgroundColor: `${activeSegment.color}22`,
                  color: activeSegment.color,
                }}
              >
                {activeSegment.percentage.toFixed(1)}%
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center animate-in fade-in duration-150">
              <span className="text-[9px] uppercase tracking-wider font-semibold opacity-60">
                {totalLabel}
              </span>
              <span
                className="text-xs sm:text-[13px] font-extrabold font-mono tracking-tight leading-tight mt-0.5"
                style={{ color: centerColor || "var(--app-fg)" }}
              >
                {formatter(totalValue).replace(".00", "")}
              </span>
              <span className="text-[9px] font-mono opacity-50 mt-0.5">
                {validSegments.length} {validSegments.length === 1 ? "Item" : "Items"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Legend Column with Interactive Hover Highlight */}
      <div className="w-full sm:max-w-xs space-y-2">
        {title && (
          <div
            className="flex items-center justify-between pb-1.5 border-b select-none"
            style={{ borderColor: "var(--app-border-subtle)" }}
          >
            <div className="flex items-center gap-1.5">
              {icon || <PieChartIcon size={13} className="opacity-70" />}
              <span className="text-[10px] uppercase font-bold tracking-wider opacity-70">
                {title}
              </span>
            </div>
            <span className="text-[10px] font-mono opacity-50">
              {validSegments.length} {validSegments.length === 1 ? "Class" : "Classes"}
            </span>
          </div>
        )}

        <div className={`space-y-1 ${maxLegendHeight} overflow-y-auto pr-1`}>
          {renderedSegments.map((seg, idx) => {
            const isHovered = hoveredIndex === idx;
            const isAnyHovered = hoveredIndex !== null;

            return (
              <div
                key={idx}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                className={`flex items-center justify-between text-xs py-1 px-1.5 rounded-lg transition-all cursor-pointer ${
                  isHovered
                    ? "bg-[var(--app-card-hover)] scale-[1.01]"
                    : isAnyHovered
                    ? "opacity-40"
                    : "opacity-90 hover:opacity-100"
                }`}
              >
                {/* Segment Color Dot & Label */}
                <div className="flex items-center gap-2 overflow-hidden truncate pr-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0 transition-transform duration-200"
                    style={{
                      backgroundColor: seg.color,
                      transform: isHovered ? "scale(1.25)" : "scale(1)",
                      boxShadow: isHovered ? `0 0 6px ${seg.color}` : "none",
                    }}
                  />
                  <span className="truncate text-[11px] font-medium">{seg.label}</span>
                </div>

                {/* Percentage & INR Amount in Kite Tabular Num */}
                <div className="flex items-center gap-2 font-mono flex-shrink-0 text-right">
                  <span className="text-[11px] font-bold">
                    {seg.percentage.toFixed(1)}%
                  </span>
                  <span className="opacity-50 text-[10px]">
                    ({formatter(seg.value).replace(".00", "")})
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
