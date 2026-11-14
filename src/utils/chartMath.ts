export interface Point2D {
  x: number;
  y: number;
}

/**
 * Abbreviate large numbers into clean Indian Rupee units (₹0, ₹500, ₹1k, ₹2.5k, ₹1L, ₹1Cr).
 */
export function abbreviateINR(val: number): string {
  if (val <= 0) return "₹0";
  if (val >= 10000000) {
    const cr = val / 10000000;
    return `₹${cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(1)}Cr`;
  }
  if (val >= 100000) {
    const lk = val / 100000;
    return `₹${lk % 1 === 0 ? lk.toFixed(0) : lk.toFixed(1)}L`;
  }
  if (val >= 1000) {
    const k = val / 1000;
    return `₹${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}k`;
  }
  return `₹${Math.round(val)}`;
}

export interface NiceScaleResult {
  max: number;
  step: number;
  ticks: number[];
}

/**
 * Computes human-friendly round tick intervals (e.g., 0, 1000, 2000, 3000, 4000)
 * rather than arbitrary or unevenly rounded values.
 */
export function getNiceScale(rawMax: number, targetTicks: number = 4): NiceScaleResult {
  if (rawMax <= 0) {
    return {
      max: 10000,
      step: 2500,
      ticks: [0, 2500, 5000, 7500, 10000],
    };
  }

  // Provide comfortable headroom so the peak doesn't touch the top edge
  const headroomRange = rawMax * 1.15;
  const roughStep = headroomRange / targetTicks;
  const power = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const fraction = roughStep / power;

  let niceFraction = 1;
  if (fraction <= 1.2) niceFraction = 1;
  else if (fraction <= 2.2) niceFraction = 2;
  else if (fraction <= 3.5) niceFraction = 2.5;
  else if (fraction <= 7.0) niceFraction = 5;
  else niceFraction = 10;

  const step = niceFraction * power;
  const max = Math.ceil(headroomRange / step) * step;

  const ticks: number[] = [];
  for (let val = 0; val <= max + step * 0.0001; val += step) {
    ticks.push(Math.round(val));
  }

  return { max, step, ticks };
}

/**
 * Builds a Monotone Cubic Hermite Spline (Fritsch-Carlson algorithm) converted to SVG Bézier curves.
 * This guarantees:
 * 1. Monotonicity: Curve never dips below zero/baseline or overshoots local extremes.
 * 2. Flat segments stay strictly flat (horizontal).
 * 3. Smooth, organic continuity without Catmull-Rom sagging or loops.
 */
export function buildMonotoneCubicPath(
  points: Point2D[],
  baselineY?: number,
  minY?: number
): string {
  const n = points.length;
  if (n === 0) return "";
  if (n === 1) return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  if (n === 2) {
    return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)} L ${points[1].x.toFixed(2)} ${points[1].y.toFixed(2)}`;
  }

  // Step 1: Secant slopes between consecutive points
  const dx: number[] = [];
  const dy: number[] = [];
  const slopes: number[] = [];

  for (let i = 0; i < n - 1; i++) {
    const deltaX = points[i + 1].x - points[i].x;
    const deltaY = points[i + 1].y - points[i].y;
    dx.push(deltaX);
    dy.push(deltaY);
    slopes.push(deltaX === 0 ? 0 : deltaY / deltaX);
  }

  // Step 2: Initialize tangents
  const m: number[] = new Array(n).fill(0);
  m[0] = slopes[0];
  m[n - 1] = slopes[n - 2];

  for (let i = 1; i < n - 1; i++) {
    // If adjacent slopes have opposite signs or one is flat, set tangent to 0 (extremum)
    if (slopes[i - 1] * slopes[i] <= 0) {
      m[i] = 0;
    } else {
      // Standard harmonic or arithmetic mean
      m[i] = (slopes[i - 1] + slopes[i]) / 2;
    }
  }

  // Step 3: Fritsch-Carlson monotonicity check & correction
  for (let i = 0; i < n - 1; i++) {
    if (slopes[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
    } else {
      const alpha = m[i] / slopes[i];
      const beta = m[i + 1] / slopes[i];

      if (alpha < 0) m[i] = 0;
      if (beta < 0) m[i + 1] = 0;

      const mag = alpha * alpha + beta * beta;
      if (mag > 9) {
        const tau = 3 / Math.sqrt(mag);
        m[i] = tau * alpha * slopes[i];
        m[i + 1] = tau * beta * slopes[i];
      }
    }
  }

  // Step 4: Convert tangents to cubic Bézier control points
  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

  for (let i = 0; i < n - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const segmentDx = dx[i];

    const cp1x = p1.x + segmentDx / 3;
    let cp1y = p1.y + (m[i] * segmentDx) / 3;
    const cp2x = p2.x - segmentDx / 3;
    let cp2y = p2.y - (m[i + 1] * segmentDx) / 3;

    // Safety clamping against chart bounds
    if (baselineY !== undefined) {
      cp1y = Math.min(cp1y, baselineY);
      cp2y = Math.min(cp2y, baselineY);
    }
    if (minY !== undefined) {
      cp1y = Math.max(cp1y, minY);
      cp2y = Math.max(cp2y, minY);
    }

    path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }

  return path;
}
