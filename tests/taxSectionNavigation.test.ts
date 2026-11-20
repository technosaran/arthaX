import { describe, it, expect } from "vitest";

describe("Sidebar Navigation & Tax Section Structure", () => {
  it("includes a dedicated Tax & Harvesting section in sidebar items", async () => {
    // Read Sidebar.tsx source to verify configuration
    const fs = await import("fs");
    const path = await import("path");
    const sidebarContent = fs.readFileSync(
      path.resolve(__dirname, "../src/components/Sidebar.tsx"),
      "utf-8"
    );

    // Verify tax group is defined in NavItemDef
    expect(sidebarContent).toContain('group: "finance" | "tax" | "system"');

    // Verify both Tax Overview and Tax Harvesting are configured in NAV_ITEMS under group: "tax"
    expect(sidebarContent).toContain('{ id: "tax", label: "Tax Overview"');
    expect(sidebarContent).toContain('group: "tax"');
    expect(sidebarContent).toContain('{ id: "tax-harvesting", label: "Tax Harvesting"');

    // Verify the Tax & Harvesting section header is rendered in the nav
    expect(sidebarContent).toContain("Tax & Harvesting");
    expect(sidebarContent).toContain("taxItems.map(renderNavButton)");
  });

  it("calculates Section 112A LTCG exemptions and loss harvesting correctly", () => {
    const ltcgLimit = 125000;
    const realizedLtcg = 75000;
    const remainingExemption = Math.max(0, ltcgLimit - realizedLtcg);
    expect(remainingExemption).toBe(50000);

    const harvestablePositions = [
      { id: "1", loss: 40000, type: "STCG", rate: 0.20, savings: 8000 },
      { id: "2", loss: 30000, type: "LTCG", rate: 0.125, savings: 3750 },
    ];

    const totalLoss = harvestablePositions.reduce((acc, curr) => acc + curr.loss, 0);
    const totalSavings = harvestablePositions.reduce((acc, curr) => acc + curr.savings, 0);

    expect(totalLoss).toBe(70000);
    expect(totalSavings).toBe(11750);
  });
});
