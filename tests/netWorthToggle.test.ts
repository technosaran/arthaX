import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Dashboard Net Worth Currency Toggle", () => {
  const dashboardPath = path.resolve(process.cwd(), "src/components/DashboardSection.tsx");
  const dashboardContent = fs.readFileSync(dashboardPath, "utf-8");

  it("contains currency toggle state between INR and USD", () => {
    expect(dashboardContent).toMatch(/currencyView|netWorthCurrency/i);
    expect(dashboardContent).toContain('"INR"');
    expect(dashboardContent).toContain('"USD"');
  });

  it("defines formatUSD and formatCurrency independent formatters", () => {
    expect(dashboardContent).toMatch(/formatUSD|formatUsdCurrency/i);
    expect(dashboardContent).toContain('"en-US"');
    expect(dashboardContent).toContain('"USD"');
  });

  it("fetches crypto holdings valuation for the USD net worth calculation", () => {
    expect(dashboardContent).toMatch(/crypto_holdings|api\/v1\/crypto\/holdings/i);
    expect(dashboardContent).toMatch(/usdNetWorth|totalCryptoUsd/i);
  });

  it("renders a segmented toggle control in the Net Worth Card header", () => {
    expect(dashboardContent).toMatch(/INR/);
    expect(dashboardContent).toMatch(/USD/);
    expect(dashboardContent).toMatch(/button/i);
  });
});
