"use client";

import React, { useState, useMemo, useId } from "react";
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
  size?: number; // Diameter in px (default: 175)
  strokeWidth?: number; // Donut thickness (default: 16)
  formatter?: (val: number) => string;
  emptyMessage?: string;
  emptySubMessage?: string;
  variant?: "standard" | "compact";
  icon?: React.ReactNode;
  centerColor?: string;
  maxLegendHeight?: string;
  align?: "start" | "center" | "end";
  maxLegendWidth?: string;
  className?: string;
  unitLabel?: string; // Singular label for units (default: "Class")
}

// Convert polar angle (degrees from 12 o'clock) to cartesian SVG coordinates
function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number
) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

// Generate SVG elliptical arc path definition
function describeArc(
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number
) {
  const sweep = Math.max(0.1, endAngle - startAngle);
  const clampedSweep = Math.min(sweep, 359.99);
  const effectiveEndAngle = startAngle + clampedSweep;

  const start = polarToCartesian(centerX, centerY, radius, startAngle);
  const end = polarToCartesian(centerX, centerY, radius, effectiveEndAngle);

  const largeArcFlag = clampedSweep > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

export default function InteractiveDonutChart({
  title,
  totalLabel = "Total Assets",
  totalValue,
  segments,
  size = 175,
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
  align = "start",
  maxLegendWidth = "sm:max-w-xs",
  className = "",
  unitLabel = "Class",
}: InteractiveDonutChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Generate unique filter & gradient IDs per instance to prevent clashes with multiple charts
  const reactId = useId();
  const instanceId = useMemo(() => reactId.replace(/[^a-zA-Z0-9]/g, "_"), [reactId]);
  const glowFilterId = `donutGlow-${instanceId}`;
  const centerLensGradId = `centerLens-${instanceId}`;

  // Geometry dimensions
  const outerPadding = 6;
  const radius = (size - strokeWidth) / 2 - outerPadding;
  const innerRadius = radius - strokeWidth / 2;
  const outerRadius = radius + strokeWidth / 2;

  // Filter valid positive segments and compute true mathematical percentages
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

  // Compute rendered segment geometry with guaranteed minimum visual presence for small slices
  const renderedSegments = useMemo(() => {
    const count = validSegments.length;
    if (count === 0) return [];

    // Single segment spans 100% of the circle with no gaps
    if (count === 1) {
      return [
        {
          ...validSegments[0],
          visualPercentage: 100,
          startAngle: 0,
          endAngle: 360,
          sweepAngle: 360,
          isFullCircle: true,
          index: 0,
        },
      ];
    }

    // Dynamic minimum visual percentage:
    // Ensures small slices (e.g. 0.1% Liquid Cash) remain visibly distinct and clickable
    const minVisualPct = Math.min(3.5, 75 / count);

    let boostCount = 0;
    let nonBoostSum = 0;
    validSegments.forEach((seg) => {
      if (seg.percentage < minVisualPct) {
        boostCount++;
      } else {
        nonBoostSum += seg.percentage;
      }
    });

    const boostedPool = boostCount * minVisualPct;
    const remainingPool = Math.max(0, 100 - boostedPool);

    const visualPcts = validSegments.map((seg) => {
      if (seg.percentage < minVisualPct) {
        return minVisualPct;
      }
      return nonBoostSum > 0 ? (seg.percentage / nonBoostSum) * remainingPool : seg.percentage;
    });

    // Gap angle between slices (in degrees) for crisp, clean radial cuts
    const gapAngle = count > 6 ? 2.0 : 2.5;
    const totalGaps = count * gapAngle;
    const availableDegrees = Math.max(1, 360 - totalGaps);

    let currentAngle = 0;
    return validSegments.map((seg, idx) => {
      const vPct = visualPcts[idx];
      const sweepAngle = (vPct / 100) * availableDegrees;
      const startAngle = currentAngle + gapAngle / 2;
      const endAngle = startAngle + sweepAngle;
      currentAngle = endAngle + gapAngle / 2;

      return {
        ...seg,
        visualPercentage: vPct,
        startAngle,
        endAngle,
        sweepAngle,
        isFullCircle: false,
        index: idx,
      };
    });
  }, [validSegments]);

  // Active highlighted or pinned segment
  const activeIndex = hoveredIndex !== null ? hoveredIndex : selectedIndex;
  const activeSegment =
    activeIndex !== null && renderedSegments[activeIndex]
      ? renderedSegments[activeIndex]
      : null;

  // Toggle selection on click (allows sticky lock & mobile inspection)
  const handleSelectSegment = (idx: number) => {
    setSelectedIndex((prev) => (prev === idx ? null : idx));
  };

  // Formatted values and responsive typography
  const formattedCenterTotal = useMemo(() => {
    return formatter(totalValue).replace(".00", "");
  }, [formatter, totalValue]);

  const centerTotalFontSize = useMemo(() => {
    const len = formattedCenterTotal.length;
    if (len > 16) return "text-[11px] font-bold tracking-tighter";
    if (len > 12) return "text-xs font-bold tracking-tight";
    if (len > 8) return "text-sm sm:text-base font-extrabold tracking-tight";
    return "text-base sm:text-lg font-extrabold tracking-tight";
  }, [formattedCenterTotal]);

  const activeSegmentFormatted = useMemo(() => {
    if (!activeSegment) return "";
    return formatter(activeSegment.value).replace(".00", "");
  }, [formatter, activeSegment]);

  const activeSegmentFontSize = useMemo(() => {
    const len = activeSegmentFormatted.length;
    if (len > 16) return "text-[11px] font-bold tracking-tighter";
    if (len > 12) return "text-xs sm:text-sm font-bold tracking-tight";
    if (len > 8) return "text-sm sm:text-base font-extrabold tracking-tight";
    return "text-base sm:text-lg font-extrabold tracking-tight";
  }, [activeSegmentFormatted]);

  // Safe percentage formatter (prevents showing "0.0%" for tiny positive balances)
  const formatPercentage = (pct: number) => {
    if (pct > 0 && pct < 0.05) return "<0.1%";
    return `${pct.toFixed(1)}%`;
  };

  const alignmentClass = useMemo(() => {
    if (variant === "compact") return "items-center gap-5";
    if (align === "end") {
      return "sm:flex-row flex-wrap sm:flex-nowrap items-center justify-center xl:justify-end gap-6 lg:gap-8";
    }
    if (align === "center") {
      return "sm:flex-row flex-wrap sm:flex-nowrap items-center justify-center gap-6 lg:gap-8";
    }
    return "sm:flex-row flex-wrap sm:flex-nowrap items-center justify-center lg:justify-start gap-6 lg:gap-8";
  }, [variant, align]);

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
          <div
            className="absolute inset-0 rounded-full border border-dashed border-[var(--app-border)] animate-spin"
            style={{ animationDuration: "14s" }}
          />
        </div>
        <p className="font-bold text-xs tracking-tight">{emptyMessage}</p>
        <p className="text-[11px] mt-1 opacity-70 max-w-xs leading-relaxed">{emptySubMessage}</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${alignmentClass} w-full ${className}`.trim()}>
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
          className="overflow-visible select-none"
        >
          <defs>
            {/* High-intensity outer bloom filter for active slice */}
            <filter id={glowFilterId} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="4.5" result="blur" />
              <feDropShadow dx="0" dy="0" stdDeviation="6" floodOpacity="0.45" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            {/* Inner subtle bevel mask */}
            <radialGradient id={centerLensGradId} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--app-card)" stopOpacity="0.9" />
              <stop offset="85%" stopColor="var(--app-bg)" stopOpacity="0.95" />
              <stop offset="100%" stopColor="var(--app-border)" stopOpacity="0.4" />
            </radialGradient>
          </defs>

          {/* Precision outer hairline guide circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={outerRadius + 3}
            fill="none"
            stroke="var(--app-border-subtle)"
            strokeWidth="0.75"
            strokeDasharray="2 3"
            opacity="0.35"
          />

          {/* Background track circle */}
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
            opacity="0.25"
          />

          {/* Render segments: single circle for 100%, precision arcs for multiple */}
          {renderedSegments.map((seg, idx) => {
            const isHovered = hoveredIndex === idx;
            const isSelected = selectedIndex === idx;
            const isActive = isHovered || isSelected;
            const isAnyActive = activeIndex !== null;

            const currentStrokeWidth = isActive ? strokeWidth + 4 : strokeWidth;
            const currentOpacity = isActive ? 1 : isAnyActive ? 0.35 : 0.95;

            if (seg.isFullCircle) {
              return (
                <circle
                  key={idx}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={currentStrokeWidth}
                  className="transition-all duration-200 ease-out cursor-pointer"
                  style={{
                    opacity: currentOpacity,
                    filter: isActive ? `url(#${glowFilterId})` : "none",
                  }}
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  onClick={() => handleSelectSegment(idx)}
                />
              );
            }

            return (
              <path
                key={idx}
                d={describeArc(size / 2, size / 2, radius, seg.startAngle, seg.endAngle)}
                fill="none"
                stroke={seg.color}
                strokeWidth={currentStrokeWidth}
                strokeLinecap="butt"
                className="transition-all duration-200 ease-out cursor-pointer"
                style={{
                  opacity: currentOpacity,
                  filter: isActive ? `url(#${glowFilterId})` : "none",
                }}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={() => handleSelectSegment(idx)}
              />
            );
          })}

          {/* Precision inner hairline guide circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={Math.max(4, innerRadius - 3)}
            fill="none"
            stroke="var(--app-border-subtle)"
            strokeWidth="0.75"
            strokeDasharray="2 3"
            opacity="0.35"
          />
        </svg>

        {/* Dynamic Center Crystal Lens Display */}
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center text-center select-none rounded-full transition-all duration-200 overflow-hidden ${
            selectedIndex !== null ? "cursor-pointer" : "pointer-events-none"
          }`}
          style={{
            margin: strokeWidth + outerPadding + 3,
            background: `radial-gradient(circle, var(--app-card) 60%, var(--app-bg) 100%)`,
            boxShadow: activeSegment
              ? `inset 0 0 16px ${activeSegment.color}25, 0 4px 12px rgba(0,0,0,0.3)`
              : "inset 0 0 12px rgba(0,0,0,0.25), 0 2px 8px rgba(0,0,0,0.2)",
            border: activeSegment
              ? `1px solid ${activeSegment.color}45`
              : "1px solid var(--app-border-subtle)",
          }}
          onClick={() => {
            if (selectedIndex !== null) setSelectedIndex(null);
          }}
          title={selectedIndex !== null ? "Click to reset to total overview" : undefined}
        >
          {activeSegment ? (
            <div
              className="flex flex-col items-center justify-center text-center w-full px-2 max-w-[124px] animate-in fade-in zoom-in-95 duration-150"
              onClick={(e) => {
                if (selectedIndex !== null) {
                  e.stopPropagation();
                  setSelectedIndex(null);
                }
              }}
            >
              {/* Category / Asset Name: NEVER truncated with ellipsis, wraps cleanly */}
              <span
                className={`font-bold tracking-tight text-center line-clamp-2 leading-tight break-words mb-0.5 ${
                  activeSegment.label.length > 20
                    ? "text-[9px]"
                    : activeSegment.label.length > 13
                    ? "text-[10px]"
                    : "text-[11px]"
                }`}
                style={{ color: activeSegment.color }}
                title={activeSegment.label}
              >
                {activeSegment.label}
              </span>

              {/* Formatted Value */}
              <span
                className={`${activeSegmentFontSize} font-extrabold font-mono leading-tight my-0.5 text-center`}
                style={{ color: "var(--app-fg)" }}
                title={activeSegmentFormatted}
              >
                {activeSegmentFormatted}
              </span>

              {/* Percentage Pill & Pinned Tag */}
              <div className="flex items-center gap-1 mt-0.5">
                <span
                  className="text-[9.5px] font-bold font-mono px-2 py-0.5 rounded-full border tracking-tight"
                  style={{
                    backgroundColor: `${activeSegment.color}20`,
                    color: activeSegment.color,
                    borderColor: `${activeSegment.color}45`,
                  }}
                >
                  {formatPercentage(activeSegment.percentage)}
                </span>
                {selectedIndex === activeSegment.index && (
                  <span
                    className="text-[8px] uppercase font-bold tracking-wider px-1 py-0.5 rounded opacity-75"
                    style={{
                      backgroundColor: `${activeSegment.color}15`,
                      color: activeSegment.color,
                    }}
                    title="Pinned - click to unlock"
                  >
                    PIN
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center w-full px-2 max-w-[124px] animate-in fade-in duration-150">
              <span className="text-[9px] uppercase tracking-wider font-semibold opacity-60 line-clamp-1 text-center">
                {totalLabel}
              </span>
              <span
                className={`${centerTotalFontSize} font-extrabold font-mono leading-tight my-0.5 text-center`}
                style={{ color: centerColor || "var(--app-fg)" }}
                title={formattedCenterTotal}
              >
                {formattedCenterTotal}
              </span>
              <span className="text-[9px] font-mono opacity-60 flex items-center justify-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {validSegments.length} {validSegments.length === 1 ? unitLabel : `${unitLabel}s`}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Rich Interactive Legend with Proportional Progress Meters */}
      <div
        className={`w-full sm:w-auto min-w-0 space-y-2.5 ${
          align === "end" ? "sm:flex-initial" : "flex-1"
        } ${maxLegendWidth}`}
      >
        {title && (
          <div
            className="flex items-center justify-between pb-2 border-b select-none"
            style={{ borderColor: "var(--app-border-subtle)" }}
          >
            <div className="flex items-center gap-2">
              {icon || (
                <PieChartIcon
                  size={14}
                  className="opacity-70 text-[var(--app-accent)]"
                />
              )}
              <span className="text-[11px] uppercase font-bold tracking-wider opacity-80">
                {title}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {selectedIndex !== null && (
                <button
                  type="button"
                  onClick={() => setSelectedIndex(null)}
                  className="text-[9.5px] font-semibold text-[var(--app-muted)] hover:text-[var(--app-fg)] transition-colors px-1.5 py-0.5 rounded hover:bg-[var(--app-card-hover)] cursor-pointer"
                  title="Reset to total view"
                >
                  Reset
                </button>
              )}
              <span
                className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border opacity-75"
                style={{
                  borderColor: "var(--app-border-subtle)",
                  backgroundColor: "var(--app-card)",
                }}
              >
                {validSegments.length}{" "}
                {validSegments.length === 1 ? unitLabel : `${unitLabel}s`}
              </span>
            </div>
          </div>
        )}

        <div className={`space-y-1.5 ${maxLegendHeight} overflow-y-auto pr-1`}>
          {renderedSegments.map((seg, idx) => {
            const isHovered = hoveredIndex === idx;
            const isSelected = selectedIndex === idx;
            const isActive = isHovered || isSelected;
            const isAnyActive = activeIndex !== null;

            return (
              <div
                key={idx}
                role="button"
                tabIndex={0}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={() => handleSelectSegment(idx)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleSelectSegment(idx);
                  }
                }}
                className={`group relative flex flex-col gap-1 text-xs p-2 rounded-xl border transition-all duration-150 cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-[var(--app-accent)] ${
                  isActive
                    ? "scale-[1.01] shadow-md ring-1 ring-offset-0"
                    : isAnyActive
                    ? "opacity-40 hover:opacity-75"
                    : "opacity-90 hover:opacity-100"
                }`}
                style={{
                  backgroundColor: isActive
                    ? "var(--app-card-hover)"
                    : "var(--app-card)",
                  borderColor: isActive
                    ? `${seg.color}65`
                    : "var(--app-border-subtle)",
                  boxShadow: isActive ? `0 0 12px ${seg.color}20` : "none",
                }}
              >
                {/* Top Row: Color indicator, Label, and Monetary Amount */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 overflow-hidden truncate">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0 transition-transform duration-200"
                      style={{
                        backgroundColor: seg.color,
                        transform: isActive ? "scale(1.25)" : "scale(1)",
                        boxShadow: isActive ? `0 0 8px ${seg.color}` : "none",
                      }}
                    />
                    <div className="flex flex-col truncate">
                      <span className="truncate text-[11px] font-semibold">
                        {seg.label}
                      </span>
                      {seg.subtitle && (
                        <span className="text-[9.5px] opacity-60 truncate font-mono">
                          {seg.subtitle}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 font-mono flex-shrink-0 text-right">
                    <span className="text-[11px] font-bold">
                      {formatter(seg.value).replace(".00", "")}
                    </span>
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded font-mono border"
                      style={{
                        backgroundColor: `${seg.color}15`,
                        color: seg.color,
                        borderColor: `${seg.color}35`,
                      }}
                    >
                      {formatPercentage(seg.percentage)}
                    </span>
                  </div>
                </div>

                {/* Bottom Row: Micro Progress Distribution Bar */}
                <div
                  className="w-full h-1.5 rounded-full overflow-hidden"
                  style={{
                    backgroundColor:
                      "var(--app-track-bg, rgba(255,255,255,0.06))",
                  }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.max(
                        3.5,
                        Math.min(100, seg.percentage)
                      )}%`,
                      backgroundColor: seg.color,
                      boxShadow: isActive ? `0 0 6px ${seg.color}` : "none",
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
