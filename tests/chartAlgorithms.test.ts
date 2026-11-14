import { describe, it, expect } from "vitest";
import {
  abbreviateINR,
  getNiceScale,
  buildMonotoneCubicPath,
  Point2D,
} from "../src/utils/chartMath";

describe("Chart Math - abbreviateINR", () => {
  it("formats 0 and negatives", () => {
    expect(abbreviateINR(0)).toBe("₹0");
    expect(abbreviateINR(-100)).toBe("₹0");
  });

  it("formats sub-thousands without suffix", () => {
    expect(abbreviateINR(450)).toBe("₹450");
    expect(abbreviateINR(999)).toBe("₹999");
  });

  it("formats thousands (k)", () => {
    expect(abbreviateINR(1000)).toBe("₹1k");
    expect(abbreviateINR(2500)).toBe("₹2.5k");
    expect(abbreviateINR(10000)).toBe("₹10k");
  });

  it("formats lakhs (L)", () => {
    expect(abbreviateINR(100000)).toBe("₹1L");
    expect(abbreviateINR(250000)).toBe("₹2.5L");
  });

  it("formats crores (Cr)", () => {
    expect(abbreviateINR(10000000)).toBe("₹1Cr");
    expect(abbreviateINR(15000000)).toBe("₹1.5Cr");
  });
});

describe("Chart Math - getNiceScale", () => {
  it("generates clean round ticks for ₹3,500 (scenario from screenshot)", () => {
    const scale = getNiceScale(3500, 4);
    expect(scale.max).toBeGreaterThanOrEqual(3500);
    expect(scale.ticks[0]).toBe(0);
    // Step should be round, e.g., 1000
    expect(scale.step).toBe(1000);
    expect(scale.ticks).toContain(0);
    expect(scale.ticks).toContain(1000);
    expect(scale.ticks).toContain(2000);
    expect(scale.ticks).toContain(3000);
    // Every tick step difference is strictly equal
    for (let i = 1; i < scale.ticks.length; i++) {
      expect(scale.ticks[i] - scale.ticks[i - 1]).toBe(scale.step);
    }
  });

  it("handles 0 correctly with sensible defaults", () => {
    const scale = getNiceScale(0);
    expect(scale.max).toBe(10000);
    expect(scale.ticks.length).toBeGreaterThan(1);
    expect(scale.ticks[0]).toBe(0);
  });

  it("handles large numbers (1.5 Lakhs)", () => {
    const scale = getNiceScale(150000, 4);
    expect(scale.max).toBeGreaterThanOrEqual(150000);
    for (let i = 1; i < scale.ticks.length; i++) {
      expect(scale.ticks[i] - scale.ticks[i - 1]).toBe(scale.step);
    }
  });
});

describe("Chart Math - buildMonotoneCubicPath", () => {
  it("prevents undershoot on consecutive zeroes (scenario from screenshot)", () => {
    // 6 months: Jun=0, Jul=0, Aug=0, Sept=0, Oct=0, Nov=3500
    // In SVG coordinates, baseline is y=180, peak is y=40
    const baselineY = 180;
    const points: Point2D[] = [
      { x: 50, y: 180 },  // Jun (0)
      { x: 130, y: 180 }, // Jul (0)
      { x: 210, y: 180 }, // Aug (0)
      { x: 290, y: 180 }, // Sept (0)
      { x: 370, y: 180 }, // Oct (0)
      { x: 450, y: 40 },  // Nov (3500)
    ];

    const path = buildMonotoneCubicPath(points, baselineY, 40);

    // Extract all numbers from the path
    const regex = /C\s+([\d.-]+)\s+([\d.-]+),\s+([\d.-]+)\s+([\d.-]+),\s+([\d.-]+)\s+([\d.-]+)/g;
    let match;
    let segmentIndex = 0;
    while ((match = regex.exec(path)) !== null) {
      const cp1y = parseFloat(match[2]);
      const cp2y = parseFloat(match[4]);
      const targetY = parseFloat(match[6]);

      // Control points and target MUST NEVER exceed baseline (y > 180 means dipping below 0!)
      expect(cp1y).toBeLessThanOrEqual(baselineY);
      expect(cp2y).toBeLessThanOrEqual(baselineY);
      expect(targetY).toBeLessThanOrEqual(baselineY);

      // On flat 0 segments (0, 1, 2, 3), control points must be exactly on the baseline
      if (segmentIndex < 4) {
        expect(cp1y).toBe(baselineY);
        expect(cp2y).toBe(baselineY);
        expect(targetY).toBe(baselineY);
      }
      segmentIndex++;
    }

    expect(segmentIndex).toBe(5);
  });

  it("handles edge cases gracefully", () => {
    expect(buildMonotoneCubicPath([])).toBe("");
    expect(buildMonotoneCubicPath([{ x: 10, y: 20 }])).toBe("M 10.00 20.00");
    expect(
      buildMonotoneCubicPath([
        { x: 10, y: 20 },
        { x: 30, y: 40 },
      ])
    ).toBe("M 10.00 20.00 L 30.00 40.00");
  });
});
