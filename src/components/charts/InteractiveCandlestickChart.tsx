"use client";

import React, { useState, useMemo } from "react";
import { BinanceKline } from "@/utils/binance";

interface CandlestickChartProps {
  klines: BinanceKline[];
  height?: number;
  symbol?: string;
}

export default function InteractiveCandlestickChart({
  klines,
  height = 300,
  symbol = "BTCUSDT",
}: CandlestickChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const { minPrice, maxPrice, maxVolume, padding, chartWidth, chartHeight, volumeHeight } =
    useMemo(() => {
      const padding = { top: 20, right: 60, bottom: 40, left: 10 };
      const chartWidth = 700;
      const chartHeight = height;
      const volumeHeight = 55;

      if (!klines || klines.length === 0) {
        return {
          minPrice: 0,
          maxPrice: 100,
          maxVolume: 100,
          padding,
          chartWidth,
          chartHeight,
          volumeHeight,
        };
      }

      let minP = Infinity;
      let maxP = -Infinity;
      let maxV = 0;

      for (const k of klines) {
        if (k.low < minP) minP = k.low;
        if (k.high > maxP) maxP = k.high;
        if (k.volume > maxV) maxV = k.volume;
      }

      const pRange = maxP - minP;
      const minPrice = Math.max(0, minP - pRange * 0.05);
      const maxPrice = maxP + pRange * 0.05;

      return {
        minPrice,
        maxPrice,
        maxVolume: maxV || 1,
        padding,
        chartWidth,
        chartHeight,
        volumeHeight,
      };
    }, [klines, height]);

  const candleData = useMemo(() => {
    if (!klines || klines.length === 0) return [];

    const drawableWidth = chartWidth - padding.left - padding.right;
    const drawablePriceHeight = chartHeight - padding.top - padding.bottom - volumeHeight;
    const step = drawableWidth / klines.length;
    const candleWidth = Math.max(2, Math.min(step * 0.7, 14));
    const priceRange = maxPrice - minPrice || 1;

    return klines.map((k, i) => {
      const x = padding.left + i * step + step / 2;
      const yHigh =
        padding.top + ((maxPrice - k.high) / priceRange) * drawablePriceHeight;
      const yLow =
        padding.top + ((maxPrice - k.low) / priceRange) * drawablePriceHeight;
      const yOpen =
        padding.top + ((maxPrice - k.open) / priceRange) * drawablePriceHeight;
      const yClose =
        padding.top + ((maxPrice - k.close) / priceRange) * drawablePriceHeight;

      const isBullish = k.close >= k.open;
      const bodyTop = Math.min(yOpen, yClose);
      const bodyHeight = Math.max(2, Math.abs(yClose - yOpen));

      // Volume bar
      const volRatio = Math.min(1, k.volume / maxVolume);
      const volBarHeight = volRatio * volumeHeight;
      const volBarY = chartHeight - padding.bottom - volBarHeight;

      return {
        ...k,
        x,
        yHigh,
        yLow,
        yOpen,
        yClose,
        bodyTop,
        bodyHeight,
        candleWidth,
        isBullish,
        volBarY,
        volBarHeight,
      };
    });
  }, [klines, chartWidth, chartHeight, padding, minPrice, maxPrice, maxVolume, volumeHeight]);

  const activeCandle = hoveredIdx !== null && candleData[hoveredIdx] ? candleData[hoveredIdx] : null;

  const priceGridLines = useMemo(() => {
    const lines: number[] = [];
    const count = 4;
    const step = (maxPrice - minPrice) / count;
    for (let i = 0; i <= count; i++) {
      lines.push(minPrice + i * step);
    }
    return lines;
  }, [minPrice, maxPrice]);

  const formatPrice = (val: number) => {
    if (val >= 1000) return val.toLocaleString("en-US", { maximumFractionDigits: 2 });
    if (val >= 1) return val.toFixed(2);
    return val.toFixed(4);
  };

  const formatDate = (ms: number) => {
    const d = new Date(ms);
    return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  };

  return (
    <div className="relative w-full rounded-2xl bg-[var(--app-card-subtle)] border border-[var(--app-border)] p-3 sm:p-4 overflow-hidden select-none">
      {/* Tooltip Header / Active Candle Stats */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs mb-2 border-b border-[var(--app-border-subtle)] pb-2">
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-[var(--app-fg)]">{symbol}</span>
          {activeCandle ? (
            <span className="text-[11px] text-[var(--app-muted)]">
              {formatDate(activeCandle.openTime)}
            </span>
          ) : (
            <span className="text-[11px] text-[var(--app-muted)]">Hover for OHLCV</span>
          )}
        </div>

        {activeCandle ? (
          <div className="flex items-center gap-3 text-[11px] font-mono tabular-nums">
            <span>
              <span className="text-[var(--app-muted)] mr-1">O:</span>
              <span className="text-[var(--app-fg)]">{formatPrice(activeCandle.open)}</span>
            </span>
            <span>
              <span className="text-[var(--app-muted)] mr-1">H:</span>
              <span className="text-emerald-400">{formatPrice(activeCandle.high)}</span>
            </span>
            <span>
              <span className="text-[var(--app-muted)] mr-1">L:</span>
              <span className="text-rose-400">{formatPrice(activeCandle.low)}</span>
            </span>
            <span>
              <span className="text-[var(--app-muted)] mr-1">C:</span>
              <span className={activeCandle.isBullish ? "text-emerald-400" : "text-rose-400"}>
                {formatPrice(activeCandle.close)}
              </span>
            </span>
            <span className="hidden sm:inline">
              <span className="text-[var(--app-muted)] mr-1">Vol:</span>
              <span className="text-[var(--app-fg)]">{Math.round(activeCandle.volume).toLocaleString()}</span>
            </span>
          </div>
        ) : candleData.length > 0 ? (
          <div className="flex items-center gap-3 text-[11px] font-mono tabular-nums text-[var(--app-muted)]">
            <span>High: <span className="text-emerald-400 font-semibold">{formatPrice(maxPrice)}</span></span>
            <span>Low: <span className="text-rose-400 font-semibold">{formatPrice(minPrice)}</span></span>
          </div>
        ) : null}
      </div>

      {/* SVG Canvas */}
      <div className="relative w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-auto block"
          style={{ minHeight: `${height}px`, maxHeight: `${height + 50}px` }}
          onMouseLeave={() => setHoveredIdx(null)}
        >
          <defs>
            <linearGradient id="volBullish" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0.1" />
            </linearGradient>
            <linearGradient id="volBearish" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#EF4444" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#EF4444" stopOpacity="0.1" />
            </linearGradient>
          </defs>

          {/* Grid lines & price labels on right */}
          {priceGridLines.map((p, idx) => {
            const priceRange = maxPrice - minPrice || 1;
            const drawablePriceHeight = chartHeight - padding.top - padding.bottom - volumeHeight;
            const y = padding.top + ((maxPrice - p) / priceRange) * drawablePriceHeight;
            return (
              <g key={idx}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={chartWidth - padding.right}
                  y2={y}
                  stroke="var(--app-border)"
                  strokeDasharray="3 3"
                  strokeWidth="0.8"
                />
                <text
                  x={chartWidth - padding.right + 8}
                  y={y + 3.5}
                  fill="var(--app-muted)"
                  fontSize="9.5"
                  fontFamily="monospace"
                >
                  {formatPrice(p)}
                </text>
              </g>
            );
          })}

          {/* Volume baseline */}
          <line
            x1={padding.left}
            y1={chartHeight - padding.bottom}
            x2={chartWidth - padding.right}
            y2={chartHeight - padding.bottom}
            stroke="var(--app-border)"
            strokeWidth="1"
          />

          {/* Render Volume Bars */}
          {candleData.map((c, idx) => (
            <rect
              key={`vol-${idx}`}
              x={c.x - c.candleWidth / 2}
              y={c.volBarY}
              width={c.candleWidth}
              height={Math.max(1, c.volBarHeight)}
              fill={c.isBullish ? "url(#volBullish)" : "url(#volBearish)"}
              rx={1}
            />
          ))}

          {/* Render Candlesticks (Wicks + Bodies) */}
          {candleData.map((c, idx) => {
            const color = c.isBullish ? "#10B981" : "#EF4444";
            return (
              <g key={`candle-${idx}`}>
                {/* Wick line */}
                <line
                  x1={c.x}
                  y1={c.yHigh}
                  x2={c.x}
                  y2={c.yLow}
                  stroke={color}
                  strokeWidth="1.2"
                />
                {/* Body rect */}
                <rect
                  x={c.x - c.candleWidth / 2}
                  y={c.bodyTop}
                  width={c.candleWidth}
                  height={c.bodyHeight}
                  fill={color}
                  rx={1}
                />
              </g>
            );
          })}

          {/* Active Hover Crosshair */}
          {activeCandle && (
            <g>
              {/* Vertical line */}
              <line
                x1={activeCandle.x}
                y1={padding.top}
                x2={activeCandle.x}
                y2={chartHeight - padding.bottom}
                stroke="var(--app-fg)"
                strokeDasharray="4 4"
                strokeWidth="1"
                opacity="0.4"
              />
              {/* Horizontal line */}
              <line
                x1={padding.left}
                y1={activeCandle.yClose}
                x2={chartWidth - padding.right}
                y2={activeCandle.yClose}
                stroke={activeCandle.isBullish ? "#10B981" : "#EF4444"}
                strokeDasharray="4 4"
                strokeWidth="1"
                opacity="0.5"
              />
              {/* Price badge on axis */}
              <rect
                x={chartWidth - padding.right + 2}
                y={activeCandle.yClose - 8}
                width={52}
                height={16}
                fill={activeCandle.isBullish ? "#10B981" : "#EF4444"}
                rx={3}
              />
              <text
                x={chartWidth - padding.right + 5}
                y={activeCandle.yClose + 3.5}
                fill="#FFFFFF"
                fontSize="9"
                fontWeight="bold"
                fontFamily="monospace"
              >
                {formatPrice(activeCandle.close)}
              </text>
            </g>
          )}

          {/* Transparent Hover Hitboxes */}
          {candleData.map((c, idx) => {
            const step = (chartWidth - padding.left - padding.right) / candleData.length;
            return (
              <rect
                key={`hit-${idx}`}
                x={c.x - step / 2}
                y={padding.top}
                width={step}
                height={chartHeight - padding.top - padding.bottom}
                fill="transparent"
                className="cursor-crosshair"
                onMouseEnter={() => setHoveredIdx(idx)}
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
}
