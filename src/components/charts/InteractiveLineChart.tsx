"use client";

import React, { useState, useMemo, useRef } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export interface LinePoint {
  key?: string;
  label: string; // e.g. "Jun", "Jul"
  fullLabel?: string; // e.g. "July 2026"
  value: number;
}

export interface InteractiveLineChartProps {
  data: LinePoint[];
  color?: string; // Default: Zerodha green "#4bb473" or red "#df514c"
  gradientId?: string;
  title?: string;
  subtitle?: string;
  formatter?: (val: number) => string;
  emptyMessage?: string;
  className?: string;
  type?: "expense" | "income" | "networth";
}

// Abbreviate large numbers for clean Y-axis ticks
function abbreviateINR(val: number): string {
  if (val <= 0) return "₹0";
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
  if (val >= 1000) return `₹${(val / 1000).toFixed(0)}k`;
  return `₹${Math.round(val)}`;
}

export default function InteractiveLineChart({
  data,
  color = "#4bb473",
  gradientId = "interactiveChartGradient",
  title,
  subtitle,
  formatter = (val: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(val),
  emptyMessage = "No historical trajectory data available yet.",
  className = "",
  type = "income",
}: InteractiveLineChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Layout boundaries for SVG coordinate system (520 x 170)
  const svgWidth = 520;
  const svgHeight = 170;
  const paddingLeft = 52;
  const paddingRight = 24;
  const paddingTop = 22;
  const paddingBottom = 38;
  const plotWidth = svgWidth - paddingLeft - paddingRight;
  const plotHeight = svgHeight - paddingTop - paddingBottom;
  const baselineY = paddingTop + plotHeight;

  // Maximum value for dynamic scaling with comfortable headroom
  const rawMax = useMemo(() => {
    return Math.max(...data.map((d) => d.value), 0);
  }, [data]);

  const maxVal = useMemo(() => {
    return rawMax > 0 ? rawMax * 1.18 : 10000;
  }, [rawMax]);

  // Peak and average calculations for telemetry badges
  const peakPoint = useMemo(() => {
    if (data.length === 0) return null;
    return [...data].sort((a, b) => b.value - a.value)[0];
  }, [data]);

  const averageVal = useMemo(() => {
    if (data.length === 0) return 0;
    const total = data.reduce((sum, d) => sum + d.value, 0);
    return total / data.length;
  }, [data]);

  // Compute (x, y) coordinates for each data point
  const points = useMemo(() => {
    const count = data.length;
    if (count === 0) return [];

    return data.map((item, idx) => {
      const x = paddingLeft + (count > 1 ? (idx / (count - 1)) * plotWidth : plotWidth / 2);
      const y = paddingTop + plotHeight - (item.value / maxVal) * plotHeight;
      return {
        ...item,
        x,
        y,
        index: idx,
      };
    });
  }, [data, maxVal, plotWidth, plotHeight, paddingLeft, paddingTop]);

  // Generate smooth cubic bezier path through all data points
  const linePath = useMemo(() => {
    if (points.length === 0) return "";
    if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;

    let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? i : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  }, [points]);

  // Area fill path closing along bottom baseline
  const areaPath = useMemo(() => {
    if (points.length === 0 || !linePath) return "";
    const firstX = points[0].x.toFixed(1);
    const lastX = points[points.length - 1].x.toFixed(1);
    return `${linePath} L ${lastX} ${baselineY} L ${firstX} ${baselineY} Z`;
  }, [linePath, points, baselineY]);

  // 4 Y-axis horizontal grid lines with abbreviated currency labels
  const yTicks = useMemo(() => {
    return [1.0, 0.66, 0.33, 0].map((ratio) => {
      const val = ratio * maxVal;
      const y = paddingTop + plotHeight - ratio * plotHeight;
      return { val, y, label: abbreviateINR(val) };
    });
  }, [maxVal, paddingTop, plotHeight]);

  // Mouse / Touch hover tracking to snap to nearest data point
  const handlePointerMove = (clientX: number) => {
    if (!svgRef.current || points.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relativeX = (clientX - rect.left) * (svgWidth / rect.width);

    // Find closest point by x coordinate
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

  const activePoint = hoveredIdx !== null && points[hoveredIdx] ? points[hoveredIdx] : null;

  // Month-over-Month Growth Calculation for Tooltip
  const momGrowth = useMemo(() => {
    if (!activePoint || activePoint.index === 0) return null;
    const prev = points[activePoint.index - 1].value;
    const curr = activePoint.value;
    if (prev === 0) return curr > 0 ? 100 : 0;
    return ((curr - prev) / prev) * 100;
  }, [activePoint, points]);

  return (
    <div className={`w-full flex flex-col justify-between select-none ${className}`}>
      {/* Top Chart Header & Telemetry Badges */}
      {(title || peakPoint) && (
        <div
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-2 border-b"
          style={{ borderColor: "var(--app-border-subtle)" }}
        >
          <div>
            {title && <h3 className="text-sm font-bold tracking-tight">{title}</h3>}
            {subtitle && (
              <p className="text-[11px] opacity-60 font-mono mt-0.5">{subtitle}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {peakPoint && peakPoint.value > 0 && (
              <div
                className="px-2.5 py-1 rounded-md border text-[10px] font-mono font-bold flex items-center gap-1.5"
                style={{
                  borderColor: "var(--app-border-subtle)",
                  backgroundColor: "var(--app-bg)",
                  color: color,
                }}
              >
                <span className="opacity-60 text-[9px] uppercase">Peak:</span>
                <span>{formatter(peakPoint.value).replace(".00", "")}</span>
              </div>
            )}
            {averageVal > 0 && (
              <div
                className="hidden sm:flex px-2 py-1 rounded-md border text-[10px] font-mono font-medium opacity-70"
                style={{
                  borderColor: "var(--app-border-subtle)",
                  backgroundColor: "var(--app-bg)",
                }}
              >
                <span>Avg: {formatter(averageVal).replace(".00", "")}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Interactive SVG Canvas */}
      <div className="relative w-full overflow-visible">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-44 sm:h-48 overflow-visible cursor-crosshair touch-none"
          onMouseMove={(e) => handlePointerMove(e.clientX)}
          onMouseLeave={() => setHoveredIdx(null)}
          onTouchMove={(e) => {
            if (e.touches[0]) handlePointerMove(e.touches[0].clientX);
          }}
          onTouchEnd={() => setHoveredIdx(null)}
        >
          <defs>
            {/* Soft Ambient Area Gradient */}
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.28" />
              <stop offset="85%" stopColor={color} stopOpacity="0.02" />
              <stop offset="100%" stopColor={color} stopOpacity="0.0" />
            </linearGradient>

            {/* Subtle glow filter for the main stroke */}
            <filter id={`lineGlow-${gradientId}`} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor={color} floodOpacity="0.3" />
            </filter>
          </defs>

          {/* Horizontal Reference Grid Lines & Y-Axis Abbreviated Ticks */}
          {yTicks.map((tick, idx) => (
            <g key={idx}>
              <line
                x1={paddingLeft}
                y1={tick.y}
                x2={svgWidth - paddingRight}
                y2={tick.y}
                stroke="var(--app-border-subtle)"
                strokeDasharray={idx === yTicks.length - 1 ? undefined : "3 3"}
                strokeWidth={idx === yTicks.length - 1 ? 1 : 0.75}
              />
              <text
                x={paddingLeft - 8}
                y={tick.y + 3}
                textAnchor="end"
                className="text-[9px] font-mono fill-current opacity-45 select-none"
              >
                {tick.label}
              </text>
            </g>
          ))}

          {/* Area Fill Under Curve */}
          {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}

          {/* Smooth Trend Spline Line */}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke={color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter={`url(#lineGlow-${gradientId})`}
            />
          )}

          {/* Static Month Labels along the X-Axis */}
          {points.map((pt, idx) => (
            <text
              key={idx}
              x={pt.x}
              y={svgHeight - 14}
              textAnchor="middle"
              className={`text-[10px] font-mono transition-all duration-150 select-none ${
                hoveredIdx === idx ? "font-bold fill-current opacity-100" : "fill-current opacity-55"
              }`}
            >
              {pt.label}
            </text>
          ))}

          {/* Data Points on Line */}
          {points.map((pt, idx) => {
            const isHovered = hoveredIdx === idx;
            return (
              <g key={idx}>
                {/* Subtle base dot */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? 5.5 : pt.value > 0 ? 3.5 : 2}
                  fill={color}
                  stroke="var(--app-card)"
                  strokeWidth={isHovered ? 2.5 : 1.5}
                  className="transition-all duration-200"
                />
              </g>
            );
          })}

          {/* Active Hover Crosshair Guideline & Pulsing Ring */}
          {activePoint && (
            <g className="transition-all duration-100 pointer-events-none">
              {/* Vertical Guide Crosshair Line */}
              <line
                x1={activePoint.x}
                y1={paddingTop}
                x2={activePoint.x}
                y2={baselineY}
                stroke={color}
                strokeWidth="1.2"
                strokeDasharray="2 2"
                opacity="0.6"
              />

              {/* Glowing outer pulse ring */}
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="11"
                fill={color}
                opacity="0.25"
                className="animate-pulse"
              />
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="6"
                fill={color}
                stroke="var(--app-card)"
                strokeWidth="2.5"
              />
            </g>
          )}
        </svg>

        {/* Dynamic Glassmorphic Floating Tooltip Card */}
        {activePoint && (
          <div
            className="absolute pointer-events-none z-20 flex flex-col items-center transition-transform duration-75 ease-out"
            style={{
              left: `${(activePoint.x / svgWidth) * 100}%`,
              top: `${Math.max(10, (activePoint.y / svgHeight) * 100 - 35)}%`,
              transform: `translate(${
                activePoint.x > svgWidth * 0.75 ? "-90%" : activePoint.x < svgWidth * 0.25 ? "-10%" : "-50%"
              }, -100%)`,
            }}
          >
            <div
              className="px-3 py-2 rounded-xl border shadow-xl backdrop-blur-md flex flex-col gap-1 min-w-[130px]"
              style={{
                backgroundColor: "var(--app-card)",
                borderColor: "var(--app-border)",
                color: "var(--app-fg)",
              }}
            >
              {/* Tooltip Header: Month Label & Optional Peak Tag */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold opacity-70 uppercase tracking-wider font-mono">
                  {activePoint.fullLabel || activePoint.label}
                </span>
                {peakPoint && activePoint.value === peakPoint.value && activePoint.value > 0 && (
                  <span
                    className="text-[8px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-tight"
                    style={{ backgroundColor: `${color}25`, color }}
                  >
                    Peak
                  </span>
                )}
              </div>

              {/* Tooltip Primary Currency Value */}
              <div className="text-sm font-extrabold font-mono tracking-tight" style={{ color }}>
                {formatter(activePoint.value)}
              </div>

              {/* Month-over-Month Delta / Growth Pill */}
              {momGrowth !== null && (
                <div className="flex items-center gap-1 text-[9px] font-mono font-bold mt-0.5">
                  {momGrowth > 0 ? (
                    <span
                      className="inline-flex items-center gap-0.5"
                      style={{ color: type === "expense" ? "#df514c" : "#4bb473" }}
                    >
                      <TrendingUp size={10} /> +{momGrowth.toFixed(1)}% vs prev
                    </span>
                  ) : momGrowth < 0 ? (
                    <span
                      className="inline-flex items-center gap-0.5"
                      style={{ color: type === "expense" ? "#4bb473" : "#df514c" }}
                    >
                      <TrendingDown size={10} /> {momGrowth.toFixed(1)}% vs prev
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 opacity-60">
                      <Minus size={10} /> Flat (0.0%)
                    </span>
                  )}
                </div>
              )}
            </div>
            {/* Subtle Tooltip Pointer Down Arrow */}
            <div
              className="w-2 h-2 rotate-45 -mt-1 border-r border-b"
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
