import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Crypto Navigation & Section Integration", () => {
  it("registers crypto in Sidebar NAV_ITEMS with finance group", () => {
    const sidebarPath = path.resolve(process.cwd(), "src/components/Sidebar.tsx");
    const sidebarContent = fs.readFileSync(sidebarPath, "utf-8");

    expect(sidebarContent).toContain('id: "crypto"');
    expect(sidebarContent).toMatch(/label:\s*"Crypto"/);
    expect(sidebarContent).toMatch(/group:\s*"finance"/);
  });

  it("mounts CryptoSection dynamically in HomeClient", () => {
    const homePath = path.resolve(process.cwd(), "src/app/HomeClient.tsx");
    const homeContent = fs.readFileSync(homePath, "utf-8");

    expect(homeContent).toContain("CryptoSection");
    expect(homeContent).toContain('activeTab === "crypto"');
  });

  it("formats USD currency values cleanly with proper decimals", () => {
    const formatUSD = (val: number) =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
      }).format(val);

    expect(formatUSD(1234.56)).toBe("$1,234.56");
    expect(formatUSD(0)).toBe("$0.00");
    expect(formatUSD(95420.5)).toBe("$95,420.50");
  });

  it("integrates Binance settings into SettingsSection under integrations tab", () => {
    const settingsPath = path.resolve(process.cwd(), "src/components/SettingsSection.tsx");
    const settingsContent = fs.readFileSync(settingsPath, "utf-8");

    expect(settingsContent).toContain("Binance Spot Integration");
    expect(settingsContent).toContain("binanceApiKey");
    expect(settingsContent).toContain("binanceApiSecret");
    expect(settingsContent).toContain("/api/v1/crypto/binance/connect");
    expect(settingsContent).toContain("/api/v1/crypto/binance/sync");
    expect(settingsContent).toContain("/api/v1/crypto/binance/disconnect");
  });

  it("ensures CryptoSection navigates to Settings Integrations and has no inline protection/disconnect card", () => {
    const cryptoSectionPath = path.resolve(process.cwd(), "src/components/CryptoSection.tsx");
    const cryptoSectionContent = fs.readFileSync(cryptoSectionPath, "utf-8");

    // Navigates to integrations
    expect(cryptoSectionContent).toContain("navigateToBinanceSettings");
    expect(cryptoSectionContent).toContain('section", "integrations"');
    // Ensure "Enterprise Binance Protection" card and form modal were removed from CryptoSection
    expect(cryptoSectionContent).not.toContain("Enterprise Binance Protection");
    expect(cryptoSectionContent).not.toContain("<Modal");
    expect(cryptoSectionContent).not.toContain('"API Settings"');
  });
});
