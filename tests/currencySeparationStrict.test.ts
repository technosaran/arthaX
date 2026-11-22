import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Strict Currency Separation & Donut Pluralization", () => {
  const dashboardPath = path.resolve(__dirname, "../src/components/DashboardSection.tsx");
  const dashboard = fs.readFileSync(dashboardPath, "utf-8");
  const donutPath = path.resolve(__dirname, "../src/components/charts/InteractiveDonutChart.tsx");
  const donut = fs.readFileSync(donutPath, "utf-8");

  it("does not convert crypto to INR or include crypto in INR totalInvestments", () => {
    expect(dashboard).not.toMatch(/cryptoUsdTotal\s*\*\s*84\.5/);
    expect(dashboard).not.toMatch(/map\["Crypto"\]\s*=\s*\(map\["Crypto"\]/);
  });

  it("properly pluralizes 'Class' to 'Classes' rather than 'Classs'", () => {
    expect(donut).not.toMatch(/unitLabel\s*:\s*`\$\{unitLabel\}s`/);
    expect(donut).toMatch(/unitLabel\s*===\s*["']Class["']\s*\?\s*["']Classes["']/);
  });
});
