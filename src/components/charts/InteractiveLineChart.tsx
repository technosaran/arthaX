"use client";

import React, { useState, useMemo, useRef } from "react";
import { TrendingUp, TrendingDown, Minus, Calendar, Sparkles } from "lucide-react";

export interface LinePoint {
  key?: string;
  label: string; // e.g. "Jun", "Jul"
  fullLabel?: string; // e.g. "July 2026"
  value: number;
}

export interface InteractiveLineChartProps {
  data: LinePoint[];
  color?: string; // Default: Modern emerald "#10b981" or rose "#f43f5e"
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
  color = "#10b981",
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

  // Layout boundaries for SVG coordinate system (560 x 185)
  const svgWidth = 560;
  const svgHeight = 185;
  const paddingLeft = 56;
  const paddingRight = 28;
  const paddingTop = 26;
  const paddingBottom = 42;
  const plotWidth = svgWidth - paddingLeft - paddingRight;
  const plotHeight = svgHeight - paddingTop - paddingBottom;
  const baselineY = paddingTop + plotHeight;

  // Maximum value for dynamic scaling with comfortable headroom
  const rawMax = useMemo(() => {
    return Math.max(...data.map((d) => d.value), 0);
  }, [data]);

  const maxVal = useMemo(() => {
    return rawMax > 0 ? rawMax * 1.2 : 10000;
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

  // Identify index of peak point for pinned badge
  const peakPointIndex = useMemo(() => {
    if (!peakPoint || peakPoint.value <= 0) return -1;
    return points.findIndex((pt) => pt.value === peakPoint.value);
  }, [peakPoint, points]);

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
            {title && (
              <h3 className="text-sm font-extrabold tracking-tight flex items-center gap-2">
                <span>{title}</span>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
              </h3>
            )}
            {subtitle && (
              <p className="text-[11px] opacity-60 font-mono mt-0.5">{subtitle}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {peakPoint && peakPoint.value > 0 && (
              <div
                className="px-2.5 py-1 rounded-lg border text-[10px] font-mono font-bold flex items-center gap-1.5 shadow-xs"
                style={{
                  borderColor: "var(--app-border-subtle)",
                  backgroundColor: "var(--app-card)",
                  color: color,
                }}
              >
                <span className="opacity-60 text-[9px] uppercase tracking-wider">Peak:</span>
                <span>{formatter(peakPoint.value).replace(".00", "")}</span>
              </div>
            )}
            {averageVal > 0 && (
              <div
                className="hidden sm:flex px-2.5 py-1 rounded-lg border text-[10px] font-mono font-medium opacity-75 shadow-xs"
                style={{
                  borderColor: "var(--app-border-subtle)",
                  backgroundColor: "var(--app-card)",
                }}
              >
                <span className="opacity-60 uppercase text-[9px] mr-1">Avg:</span>
                <span>{formatter(averageVal).replace(".00", "")}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Interactive SVG Canvas with Volumetric Ambient Illumination */}
      <div className="relative w-full overflow-visible">
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
            {/* Rich multi-stop volumetric area gradient */}
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.38" />
              <stop offset="45%" stopColor={color} stopOpacity="0.14" />
              <stop offset="85%" stopColor={color} stopOpacity="0.03" />
              <stop offset="100%" stopColor={color} stopOpacity="0.0" />
            </linearGradient>

            {/* Glowing neon cathode cathode drop-shadow filter */}
            <filter id={`lineGlow-${gradientId}`} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="5" floodColor={color} floodOpacity="0.5" />
            </filter>

            {/* Vertical crosshair scanning beam gradient */}
            <linearGradient id={`crosshairBeam-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.1" />
              <stop offset="50%" stopColor={color} stopOpacity="0.85" />
              <stop offset="100%" stopColor={color} stopOpacity="0.15" />
            </linearGradient>
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
                strokeDasharray={idx === yTicks.length - 1 ? undefined : "3 4"}
                strokeWidth={idx === yTicks.length - 1 ? 1 : 0.75}
                opacity={idx === yTicks.length - 1 ? 0.8 : 0.5}
              />
              <text
                x={paddingLeft - 10}
                y={tick.y + 3.5}
                textAnchor="end"
                className="text-[9px] font-mono fill-current opacity-50 select-none font-semibold"
              >
                {tick.label}
              </text>
            </g>
          ))}

          {/* Volumetric Area Fill Under Curve */}
          {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}

          {/* Layer 1: Ambient Neon Glow Under-Path */}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke={color}
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.3"
              filter={`url(#lineGlow-${gradientId})`}
            />
          )}

          {/* Layer 2: Precision Foreground Trend Vector Path */}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke={color}
              strokeWidth="2.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Pinned Peak Callout Tag (When no hover is active) */}
          {hoveredIdx === null && peakPointIndex >= 0 && points[peakPointIndex] && (
            <g className="transition-opacity duration-200">
              {/* Outer pulsing ring at peak point */}
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

          {/* Data Points on Line with Polished Bezel */}
          {points.map((pt, idx) => {
            const isHovered = hoveredIdx === idx;
            const isPeak = idx === peakPointIndex;
            return (
              <g key={idx}>
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? 6 : isPeak ? 4.5 : pt.value > 0 ? 3.5 : 2}
                  fill={isHovered ? color : "var(--app-card)"}
                  stroke={color}
                  strokeWidth={isHovered ? 2.5 : 2}
                  className="transition-all duration-200"
                  style={{
                    filter: isHovered ? `drop-shadow(0 0 6px ${color})` : "none",
                  }}
                />
              </g>
            );
          })}

          {/* Active Hover Crosshair Guideline & Pulsing Scanning Beacon */}
          {activePoint && (
            <g className="transition-all duration-100 pointer-events-none">
              {/* Vertical Guide Crosshair Scanning Beam */}
              <line
                x1={activePoint.x}
                y1={paddingTop - 6}
                x2={activePoint.x}
                y2={baselineY}
                stroke={`url(#crosshairBeam-${gradientId})`}
                strokeWidth="1.5"
                strokeDasharray="2 3"
              />

              {/* Horizontal projection line to Y-axis */}
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

              {/* Glowing outer pulse ring */}
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="13"
                fill={color}
                opacity="0.25"
                className="animate-pulse"
              />
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="7"
                fill={color}
                opacity="0.5"
              />
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="4.5"
                fill="#ffffff"
                stroke={color}
                strokeWidth="2.5"
              />
            </g>
          )}
        </svg>

        {/* Dynamic Glassmorphic Floating HUD Tooltip Card */}
        {activePoint && (
          <div
            className="absolute pointer-events-none z-20 flex flex-col items-center transition-transform duration-75 ease-out"
            style={{
              left: `${(activePoint.x / svgWidth) * 100}%`,
              top: `${Math.max(10, (activePoint.y / svgHeight) * 100 - 32)}%`,
              transform: `translate(${
                activePoint.x > svgWidth * 0.75
                  ? "-90%"
                  : activePoint.x < svgWidth * 0.25
                  ? "-10%"
                  : "-50%"
              }, -100%)`,
            }}
          >
            <div
              className="px-3.5 py-2.5 rounded-2xl border shadow-2xl backdrop-blur-xl flex flex-col gap-1 min-w-[145px]"
              style={{
                backgroundColor: "var(--app-card)",
                borderColor: "var(--app-border)",
                color: "var(--app-fg)",
                boxShadow: `0 12px 32px -4px rgba(0,0,0,0.5), 0 0 16px ${color}20`,
              }}
            >
              {/* Tooltip Header: Month Label & Optional Peak Tag */}
              <div className="flex items-center justify-between gap-2 border-b pb-1" style={{ borderColor: "var(--app-border-subtle)" }}>
                <div className="flex items-center gap-1.5">
                  <Calendar size={11} className="opacity-60 text-[var(--app-accent)]" />
                  <span className="text-[10px] font-bold opacity-80 uppercase tracking-wider font-mono">
                    {activePoint.fullLabel || activePoint.label}
                  </span>
                </div>
                {peakPoint && activePoint.value === peakPoint.value && activePoint.value > 0 && (
                  <span
                    className="text-[8px] font-extrabold px-1.5 py-0.2 rounded-full uppercase tracking-tight"
                    style={{ backgroundColor: `${color}25`, color }}
                  >
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

              {/* Month-over-Month Delta / Growth Pill */}
              {momGrowth !== null && (
                <div className="flex items-center gap-1 text-[10px] font-mono font-bold pt-0.5">
                  {momGrowth > 0 ? (
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: type === "expense" ? "rgba(244,63,94,0.12)" : "rgba(16,185,129,0.12)",
                        color: type === "expense" ? "#f43f5e" : "#10b981",
                      }}
                    >
                      <TrendingUp size={11} /> +{momGrowth.toFixed(1)}% vs prev
                    </span>
                  ) : momGrowth < 0 ? (
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: type === "expense" ? "rgba(16,185,129,0.12)" : "rgba(244,63,94,0.12)",
                        color: type === "expense" ? "#10b981" : "#f43f5e",
                      }}
                    >
                      <TrendingDown size={11} /> {momGrowth.toFixed(1)}% vs prev
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 opacity-60 px-1.5 py-0.5">
                      <Minus size={11} /> Flat (0.0%)
                    </span>
                  )}
                </div>
              )}
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