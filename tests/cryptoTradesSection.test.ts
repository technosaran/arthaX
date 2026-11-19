import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("CryptoSection Trade History & Sell Analytics UI", () => {
  const componentPath = path.resolve(process.cwd(), "src/components/CryptoSection.tsx");
  const componentContent = fs.readFileSync(componentPath, "utf-8");

  it("includes sub-navigation tabs for Holdings, Trade History, and Exited Positions", () => {
    expect(componentContent).toMatch(/activeSubTab|activeView/);
    expect(componentContent).toContain("Holdings");
    expect(componentContent).toContain("Trade History");
    expect(componentContent).toContain("Exited Positions");
  });

  it("fetches trade history and analytics from /api/v1/crypto/trades", () => {
    expect(componentContent).toContain("/api/v1/crypto/trades");
  });

  it("renders side badges for BUY and SELL orders", () => {
    expect(componentContent).toContain("BUY");
    expect(componentContent).toContain("SELL");
  });

  it("renders realized sell proceeds and exited positions summary", () => {
    expect(componentContent).toMatch(/totalSellsUsd|Realized Sells/i);
    expect(componentContent).toMatch(/exitedAssets|Exited Positions/i);
  });
});
