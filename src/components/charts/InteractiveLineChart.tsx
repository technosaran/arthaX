"use client";

import React, { useState, useMemo, useRef } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Activity,
  BarChart3,
  Award,
} from "lucide-react";
import {
  buildMonotoneCubicPath,
  getNiceScale,
  abbreviateINR,
} from "@/utils/chartMath";

export interface LinePoint {
  key?: string;
  label: string; // e.g. "Jun", "Jul"
  fullLabel?: string; // e.g. "July 2026"
  value: number;
}

export interface InteractiveLineChartProps {
  data: LinePoint[];
  color?: string; // Modern emerald "#10b981", rose "#f43f5e", cyan, etc.
  gradientId?: string;
  title?: string;
  subtitle?: string;
  formatter?: (val: number) => string;
  emptyMessage?: string;
  className?: string;
  type?: "expense" | "income" | "networth";
  defaultView?: "area" | "bar";
}

export default function InteractiveLineChart({
  data,
  color = "#10b981",
  gradientId = "interactiveChartGradient",
  title,
  subtitle,
  formatter = (val: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val),
  emptyMessage = "No historical trajectory data available for this period.",
  className = "",
  type = "income",
  defaultView = "area",
}: InteractiveLineChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"area" | "bar">(defaultView);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Layout boundaries for SVG coordinate system (600 x 210)
  const svgWidth = 600;
  const svgHeight = 210;
  const paddingLeft = 56;
  const paddingRight = 24;
  const paddingTop = 26;
  const paddingBottom = 40;
  const plotWidth = svgWidth - paddingLeft - paddingRight;
  const plotHeight = svgHeight - paddingTop - paddingBottom;
  const baselineY = paddingTop + plotHeight;

  // Maximum value calculation
  const rawMax = useMemo(() => {
    if (!data || data.length === 0) return 0;
    return Math.max(...data.map((d) => d.value), 0);
  }, [data]);

  // Total and Average across all points
  const totalVal = useMemo(() => {
    if (!data || data.length === 0) return 0;
    return data.reduce((sum, d) => sum + d.value, 0);
  }, [data]);

  const averageVal = useMemo(() => {
    if (!data || data.length === 0) return 0;
    return totalVal / data.length;
  }, [data, totalVal]);

  // Nice scale calculations: perfectly rounded intervals
  const scale = useMemo(() => {
    return getNiceScale(rawMax, 4);
  }, [rawMax]);

  const maxVal = scale.max;

  // Peak point for highlighting
  const peakPoint = useMemo(() => {
    if (!data || data.length === 0) return null;
    const sorted = [...data].sort((a, b) => b.value - a.value);
    return sorted[0]?.value > 0 ? sorted[0] : null;
  }, [data]);

  // Compute (x, y) coordinates for each data point
  const points = useMemo(() => {
    const count = data.length;
    if (count === 0) return [];

    return data.map((item, idx) => {
      const x =
        paddingLeft +
        (count > 1 ? (idx / (count - 1)) * plotWidth : plotWidth / 2);
      const ratio = maxVal > 0 ? Math.min(1, Math.max(0, item.value / maxVal)) : 0;
      const y = paddingTop + plotHeight - ratio * plotHeight;
      return {
        ...item,
        x,
        y,
        index: idx,
      };
    });
  }, [data, maxVal, plotWidth, plotHeight, paddingLeft, paddingTop]);

  // Identify index of peak point
  const peakPointIndex = useMemo(() => {
    if (!peakPoint) return -1;
    return points.findIndex((pt) => pt.value === peakPoint.value);
  }, [peakPoint, points]);

  // Build Monotone Cubic Spline (Fritsch-Carlson) - completely prevents undershoot below baseline!
  const linePath = useMemo(() => {
    if (points.length === 0) return "";
    return buildMonotoneCubicPath(points, baselineY, paddingTop);
  }, [points, baselineY, paddingTop]);

  // Area fill path closing along bottom baseline
  const areaPath = useMemo(() => {
    if (points.length === 0 || !linePath) return "";
    const firstX = points[0].x.toFixed(2);
    const lastX = points[points.length - 1].x.toFixed(2);
    return `${linePath} L ${lastX} ${baselineY.toFixed(2)} L ${firstX} ${baselineY.toFixed(2)} Z`;
  }, [linePath, points, baselineY]);

  // Y-axis horizontal ticks
  const yTicks = useMemo(() => {
    return scale.ticks.map((val) => {
      const ratio = maxVal > 0 ? val / maxVal : 0;
      const y = paddingTop + plotHeight - ratio * plotHeight;
      return {
        val,
        y,
        label: abbreviateINR(val),
      };
    });
  }, [scale, maxVal, paddingTop, plotHeight]);

  // Bar column geometry for Bar view
  const barColumns = useMemo(() => {
    const count = points.length;
    if (count === 0) return [];
    const colWidth = Math.min(38, Math.max(22, (plotWidth / count) * 0.48));

    return points.map((pt) => {
      const barHeight = Math.max(0, baselineY - pt.y);
      return {
        ...pt,
        barX: pt.x - colWidth / 2,
        barY: pt.y,
        barWidth: colWidth,
        barHeight,
      };
    });
  }, [points, plotWidth, baselineY]);

  // Mouse / Touch hover tracking
  const handlePointerMove = (clientX: number) => {
    if (!svgRef.current || points.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relativeX = (clientX - rect.left) * (svgWidth / rect.width);

    // Hit-test to nearest month index
    let closestIdx = 0;
    let minDistance = Infinity;

    points.forEach((pt, i) => {
      const dist = Math.abs(pt.x - relativeX);
      if (dist < minDistance) {
        minDistance = dist;
        closestIdx = i;
      }
    });

    setHoveredIdx(closestIdx);
  };

  const activePoint =
    hoveredIdx !== null && points[hoveredIdx] ? points[hoveredIdx] : null;

  // Month-over-Month Delta
  const momGrowth = useMemo(() => {
    if (!activePoint || activePoint.index === 0) return null;
    const prev = points[activePoint.index - 1].value;
    const curr = activePoint.value;
    if (prev === 0 && curr === 0) return 0;
    if (prev === 0) return 100;
    return ((curr - prev) / prev) * 100;
  }, [activePoint, points]);

  // Percentage of 6-Month Total
  const activePercentOfTotal = useMemo(() => {
    if (!activePoint || totalVal <= 0) return 0;
    return (activePoint.value / totalVal) * 100;
  }, [activePoint, totalVal]);

  const isAllZero = rawMax === 0;

  return (
    <div className={`w-full flex flex-col justify-between select-none ${className}`}>
      {/* Top Chart Header & Telemetry Badges */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-2 border-b"
        style={{ borderColor: "var(--app-border-subtle)" }}
      >
        <div>
          {title && (
            <h3 className="text-sm font-extrabold tracking-tight flex items-center gap-2">
              <span>{title}</span>
              <span
                className="w-2 h-2 rounded-full ring-2 ring-opacity-30"
                style={{
                  backgroundColor: color,
                  boxShadow: `0 0 8px ${color}`,
                }}
              />
            </h3>
          )}
          {subtitle && (
            <p className="text-[11px] opacity-60 font-mono mt-0.5">{subtitle}</p>
          )}
        </div>

        {/* Right Section: Metrics + View Toggle */}
        <div className="flex items-center flex-wrap gap-2">
          {/* 6-Month Total */}
          {totalVal > 0 && (
            <div
              className="px-2.5 py-1 rounded-lg border text-[10px] font-mono font-bold flex items-center gap-1.5 shadow-xs"
              style={{
                borderColor: "var(--app-border-subtle)",
                backgroundColor: "var(--app-card)",
              }}
            >
              <span className="opacity-55 uppercase text-[9px] tracking-wider">6M Total:</span>
              <span style={{ color }}>{abbreviateINR(totalVal)}</span>
            </div>
          )}

          {/* Peak Badge */}
          {peakPoint && (
            <div
              className="px-2.5 py-1 rounded-lg border text-[10px] font-mono font-bold flex items-center gap-1.5 shadow-xs"
              style={{
                borderColor: "var(--app-border-subtle)",
                backgroundColor: "var(--app-card)",
                color: color,
              }}
            >
              <Award size={11} className="opacity-80" />
              <span className="opacity-60 text-[9px] uppercase tracking-wider">Peak:</span>
              <span>{abbreviateINR(peakPoint.value)}</span>
              <span className="text-[9px] opacity-60">({peakPoint.label})</span>
            </div>
          )}

          {/* Average Badge */}
          {averageVal > 0 && (
            <div
              className="hidden sm:flex px-2.5 py-1 rounded-lg border text-[10px] font-mono font-medium opacity-80 shadow-xs"
              style={{
                borderColor: "var(--app-border-subtle)",
                backgroundColor: "var(--app-card)",
              }}
            >
              <span className="opacity-55 uppercase text-[9px] mr-1">Avg:</span>
              <span>{abbreviateINR(averageVal)}/mo</span>
            </div>
          )}

          {/* View Mode Switcher: Area Curve vs. Monthly Columns */}
          <div
            className="flex items-center p-0.5 rounded-lg border ml-1 shadow-xs"
            style={{
              borderColor: "var(--app-border-subtle)",
              backgroundColor: "var(--app-card)",
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode("area")}
              className={`p-1.5 rounded-md transition-all ${
                viewMode === "area"
                  ? "text-white shadow-xs"
                  : "opacity-45 hover:opacity-100"
              }`}
              style={
                viewMode === "area"
                  ? { backgroundColor: color, color: "#ffffff" }
                  : undefined
              }
              title="Trend Curve View"
            >
              <Activity size={12} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("bar")}
              className={`p-1.5 rounded-md transition-all ${
                viewMode === "bar"
                  ? "text-white shadow-xs"
                  : "opacity-45 hover:opacity-100"
              }`}
              style={
                viewMode === "bar"
                  ? { backgroundColor: color, color: "#ffffff" }
                  : undefined
              }
              title="Monthly Columns View"
            >
              <BarChart3 size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Chart Canvas */}
      <div className="relative w-full overflow-visible">
        {data.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-center p-6 text-xs opacity-60">
            <Calendar size={28} className="opacity-40 mb-2" />
            <p className="font-semibold">{emptyMessage}</p>
          </div>
        ) : (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-48 sm:h-52 overflow-visible cursor-crosshair touch-none"
            onMouseMove={(e) => handlePointerMove(e.clientX)}
            onMouseLeave={() => setHoveredIdx(null)}
            onTouchMove={(e) => {
              if (e.touches[0]) handlePointerMove(e.touches[0].clientX);
            }}
            onTouchEnd={() => setHoveredIdx(null)}
          >
            <defs>
              {/* Rich 4-stop volumetric area gradient */}
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.35" />
                <stop offset="40%" stopColor={color} stopOpacity="0.14" />
                <stop offset="80%" stopColor={color} stopOpacity="0.03" />
                <stop offset="100%" stopColor={color} stopOpacity="0.0" />
              </linearGradient>

              {/* Bar gradient with vibrant top cap */}
              <linearGradient id={`barGradient-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.95" />
                <stop offset="60%" stopColor={color} stopOpacity="0.65" />
                <stop offset="100%" stopColor={color} stopOpacity="0.30" />
              </linearGradient>

              {/* Laser crosshair scanning beam */}
              <linearGradient id={`crosshairBeam-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.1" />
                <stop offset="50%" stopColor={color} stopOpacity="0.75" />
                <stop offset="100%" stopColor={color} stopOpacity="0.15" />
              </linearGradient>

              {/* Glowing neon drop-shadow filter */}
              <filter id={`lineGlow-${gradientId}`} x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="5" floodColor={color} floodOpacity="0.45" />
              </filter>
            </defs>

            {/* Horizontal Reference Grid Lines & Nice Ticks */}
            {yTicks.map((tick, idx) => {
              const isBase = tick.val === 0;
              return (
                <g key={idx}>
                  <line
                    x1={paddingLeft}
                    y1={tick.y}
                    x2={svgWidth - paddingRight}
                    y2={tick.y}
                    stroke="var(--app-border-subtle)"
                    strokeDasharray={isBase ? undefined : "3 4"}
                    strokeWidth={isBase ? 1.25 : 0.75}
                    opacity={isBase ? 0.85 : 0.45}
                  />
                  <text
                    x={paddingLeft - 10}
                    y={tick.y + 3.5}
                    textAnchor="end"
                    className="text-[9px] font-mono fill-current opacity-55 select-none font-semibold"
                  >
                    {tick.label}
                  </text>
                </g>
              );
            })}

            {/* All-Zero Notification Banner in Chart Void */}
            {isAllZero && (
              <g>
                <rect
                  x={paddingLeft + plotWidth * 0.2}
                  y={paddingTop + plotHeight * 0.35}
                  width={plotWidth * 0.6}
                  height="30"
                  rx="6"
                  fill="var(--app-card)"
                  stroke="var(--app-border-subtle)"
                  strokeWidth="1"
                  opacity="0.85"
                />
                <text
                  x={paddingLeft + plotWidth * 0.5}
                  y={paddingTop + plotHeight * 0.35 + 18}
                  textAnchor="middle"
                  className="text-[10px] font-mono fill-current opacity-60 font-semibold"
                >
                  No outflow recorded across these 6 months
                </text>
              </g>
            )}

            {/* VIEW MODE 1: AREA / CURVED TREND */}
            {viewMode === "area" && (
              <>
                {/* Volumetric Area Fill Under Curve */}
                {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}

                {/* Layer 1: Ambient Glow Stroke */}
                {linePath && (
                  <path
                    d={linePath}
                    fill="none"
                    stroke={color}
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.25"
                    filter={`url(#lineGlow-${gradientId})`}
                  />
                )}

                {/* Layer 2: Precision Foreground Line Path */}
                {linePath && (
                  <path
                    d={linePath}
                    fill="none"
                    stroke={color}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Pinned Peak Callout Halo (when unhovered) */}
                {hoveredIdx === null && peakPointIndex >= 0 && points[peakPointIndex] && (
                  <g className="transition-opacity duration-200">
                    <circle
                      cx={points[peakPointIndex].x}
                      cy={points[peakPointIndex].y}
                      r="7"
                      fill={color}
                      opacity="0.2"
                      className="animate-ping"
                    />
                    <circle
                      cx={points[peakPointIndex].x}
                      cy={points[peakPointIndex].y}
                      r="4.5"
                      fill={color}
                      stroke="var(--app-card)"
                      strokeWidth="2"
                    />
                  </g>
                )}

                {/* Data Points on Curve */}
                {points.map((pt, idx) => {
                  const isHovered = hoveredIdx === idx;
                  const isPeak = idx === peakPointIndex;
                  const isZero = pt.value === 0;

                  return (
                    <g key={idx}>
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isHovered ? 6 : isPeak ? 4.5 : isZero ? 2.5 : 3.5}
                        fill={isHovered ? color : isZero ? "var(--app-card)" : "var(--app-card)"}
                        stroke={color}
                        strokeWidth={isHovered ? 2.5 : isZero ? 1.5 : 2}
                        opacity={isZero && !isHovered ? 0.6 : 1}
                        className="transition-all duration-200"
                        style={{
                          filter: isHovered ? `drop-shadow(0 0 6px ${color})` : "none",
                        }}
                      />
                    </g>
                  );
                })}
              </>
            )}

            {/* VIEW MODE 2: MONTHLY COLUMNS / BARS */}
            {viewMode === "bar" && (
              <g>
                {barColumns.map((col, idx) => {
                  const isHovered = hoveredIdx === idx;
                  const isPeak = idx === peakPointIndex;
                  const isZero = col.value === 0;

                  return (
                    <g key={idx} className="transition-all duration-150">
                      {/* Subtle background slot track */}
                      <rect
                        x={col.barX}
                        y={paddingTop}
                        width={col.barWidth}
                        height={plotHeight}
                        rx="5"
                        fill="currentColor"
                        opacity={isHovered ? 0.08 : 0.03}
                      />

                      {/* Active colored bar or zero pip */}
                      {isZero ? (
                        <rect
                          x={col.x - 9}
                          y={baselineY - 2}
                          width="18"
                          height="2"
                          rx="1"
                          fill="currentColor"
                          opacity={isHovered ? 0.6 : 0.25}
                        />
                      ) : (
                        <rect
                          x={col.barX}
                          y={col.barY}
                          width={col.barWidth}
                          height={col.barHeight}
                          rx="4"
                          fill={`url(#barGradient-${gradientId})`}
                          opacity={isHovered ? 1 : 0.85}
                          style={{
                            filter: isHovered
                              ? `drop-shadow(0 0 8px ${color})`
                              : isPeak
                              ? `drop-shadow(0 0 4px ${color}60)`
                              : "none",
                          }}
                        />
                      )}
                    </g>
                  );
                })}
              </g>
            )}

            {/* Static Month Labels along the X-Axis */}
            {points.map((pt, idx) => {
              const isHovered = hoveredIdx === idx;
              return (
                <g key={idx}>
                  {isHovered && (
                    <rect
                      x={pt.x - 18}
                      y={svgHeight - 26}
                      width={36}
                      height={18}
                      rx={5}
                      fill="var(--app-card)"
                      stroke="var(--app-border)"
                      strokeWidth="1"
                    />
                  )}
                  <text
                    x={pt.x}
                    y={svgHeight - 14}
                    textAnchor="middle"
                    className={`text-[10px] font-mono transition-all duration-150 select-none ${
                      isHovered
                        ? "font-bold fill-current opacity-100"
                        : "fill-current opacity-55"
                    }`}
                    style={isHovered ? { fill: color } : undefined}
                  >
                    {pt.label}
                  </text>
                </g>
              );
            })}

            {/* Interactive Vertical Crosshair Guide & Hover Scanner */}
            {activePoint && (
              <g className="transition-all duration-100 pointer-events-none">
                {/* Vertical laser guide beam */}
                <line
                  x1={activePoint.x}
                  y1={paddingTop - 4}
                  x2={activePoint.x}
                  y2={baselineY}
                  stroke={`url(#crosshairBeam-${gradientId})`}
                  strokeWidth="1.5"
                  strokeDasharray="2 3"
                />

                {/* Horizontal reference projection in Area mode */}
                {viewMode === "area" && (
                  <line
                    x1={paddingLeft}
                    y1={activePoint.y}
                    x2={activePoint.x}
                    y2={activePoint.y}
                    stroke={color}
                    strokeWidth="1"
                    strokeDasharray="2 2"
                    opacity="0.35"
                  />
                )}

                {/* Hover Target Beacon in Area Mode */}
                {viewMode === "area" && (
                  <>
                    <circle
                      cx={activePoint.x}
                      cy={activePoint.y}
                      r="12"
                      fill={color}
                      opacity="0.22"
                      className="animate-pulse"
                    />
                    <circle
                      cx={activePoint.x}
                      cy={activePoint.y}
                      r="6.5"
                      fill={color}
                      opacity="0.45"
                    />
                    <circle
                      cx={activePoint.x}
                      cy={activePoint.y}
                      r="4"
                      fill="#ffffff"
                      stroke={color}
                      strokeWidth="2.5"
                    />
                  </>
                )}
              </g>
            )}
          </svg>
        )}

        {/* Dynamic Glassmorphic Floating HUD Tooltip */}
        {activePoint && (
          <div
            className="absolute pointer-events-none z-20 flex flex-col items-center transition-transform duration-75 ease-out"
            style={{
              left: `${(activePoint.x / svgWidth) * 100}%`,
              top: `${Math.max(8, (activePoint.y / svgHeight) * 100 - 28)}%`,
              transform: `translate(${
                activePoint.x > svgWidth * 0.72
                  ? "-90%"
                  : activePoint.x < svgWidth * 0.28
                  ? "-10%"
                  : "-50%"
              }, -100%)`,
            }}
          >
            <div
              className="px-3.5 py-2.5 rounded-2xl border shadow-2xl backdrop-blur-xl flex flex-col gap-1 min-w-[155px]"
              style={{
                backgroundColor: "var(--app-card)",
                borderColor: "var(--app-border)",
                color: "var(--app-fg)",
                boxShadow: `0 14px 34px -4px rgba(0,0,0,0.5), 0 0 16px ${color}20`,
              }}
            >
              {/* Tooltip Header: Month Label & Optional Peak Tag */}
              <div
                className="flex items-center justify-between gap-2 border-b pb-1.5"
                style={{ borderColor: "var(--app-border-subtle)" }}
              >
                <div className="flex items-center gap-1.5">
                  <Calendar size={11} className="opacity-60 text-[var(--app-accent)]" />
                  <span className="text-[10px] font-bold opacity-80 uppercase tracking-wider font-mono">
                    {activePoint.fullLabel || activePoint.label}
                  </span>
                </div>
                {peakPoint && activePoint.value === peakPoint.value && activePoint.value > 0 && (
                  <span
                    className="text-[8px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-tight flex items-center gap-1"
                    style={{ backgroundColor: `${color}25`, color }}
                  >
                    <Award size={9} />
                    Peak
                  </span>
                )}
              </div>

              {/* Tooltip Primary Currency Value */}
              <div
                className="text-base font-extrabold font-mono tracking-tight leading-tight mt-0.5"
                style={{ color }}
              >
                {formatter(activePoint.value)}
              </div>

              {/* Meta: % of Total & MoM Delta */}
              <div className="flex flex-col gap-1 pt-0.5 text-[10px] font-mono">
                {totalVal > 0 && activePoint.value > 0 && (
                  <div className="text-[9px] opacity-60 flex items-center justify-between">
                    <span>Share of 6M:</span>
                    <span className="font-bold">{activePercentOfTotal.toFixed(1)}%</span>
                  </div>
                )}

                {momGrowth !== null && (
                  <div className="flex items-center gap-1 font-bold pt-0.5">
                    {momGrowth > 0 ? (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px]"
                        style={{
                          backgroundColor:
                            type === "expense"
                              ? "rgba(244,63,94,0.12)"
                              : "rgba(16,185,129,0.12)",
                          color: type === "expense" ? "#f43f5e" : "#10b981",
                        }}
                      >
                        <TrendingUp size={10} /> +{momGrowth.toFixed(1)}% vs prev
                      </span>
                    ) : momGrowth < 0 ? (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px]"
                        style={{
                          backgroundColor:
                            type === "expense"
                              ? "rgba(16,185,129,0.12)"
                              : "rgba(244,63,94,0.12)",
                          color: type === "expense" ? "#10b981" : "#f43f5e",
                        }}
                      >
                        <TrendingDown size={10} /> {momGrowth.toFixed(1)}% vs prev
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 opacity-55 text-[9px]">
                        <Minus size={10} /> Flat (0.0%)
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Subtle Tooltip Pointer Down Arrow */}
            <div
              className="w-2.5 h-2.5 rotate-45 -mt-1.5 border-r border-b"
              style={{
                backgroundColor: "var(--app-card)",
                borderColor: "var(--app-border)",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
