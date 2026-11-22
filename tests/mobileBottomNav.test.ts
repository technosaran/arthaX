import { describe, it, expect } from "vitest";
import { getMobileNavGroup, MOBILE_NAV_DESTINATIONS } from "@/components/MobileBottomNav";

describe("MobileBottomNav Navigation Mapping", () => {
  it("maps main financial tabs to appropriate primary dock categories", () => {
    expect(getMobileNavGroup("dashboard")).toBe("dashboard");
    expect(getMobileNavGroup("stocks")).toBe("portfolio");
    expect(getMobileNavGroup("mutual-funds")).toBe("portfolio");
    expect(getMobileNavGroup("bonds")).toBe("portfolio");
    expect(getMobileNavGroup("gold-silver")).toBe("portfolio");
    expect(getMobileNavGroup("fno")).toBe("portfolio");
    expect(getMobileNavGroup("crypto")).toBe("portfolio");
    expect(getMobileNavGroup("expenses")).toBe("cashflow");
    expect(getMobileNavGroup("income")).toBe("cashflow");
    expect(getMobileNavGroup("budgets")).toBe("cashflow");
    expect(getMobileNavGroup("ledger")).toBe("cashflow");
    expect(getMobileNavGroup("forecast")).toBe("cashflow");
    expect(getMobileNavGroup("reconciliation")).toBe("cashflow");
    expect(getMobileNavGroup("tax")).toBe("more");
    expect(getMobileNavGroup("tax-harvesting")).toBe("more");
    expect(getMobileNavGroup("goals")).toBe("more");
    expect(getMobileNavGroup("family")).toBe("more");
    expect(getMobileNavGroup("settings")).toBe("more");
    expect(getMobileNavGroup("profile")).toBe("more");
  });

  it("provides 4 distinct bottom dock navigation targets", () => {
    expect(MOBILE_NAV_DESTINATIONS).toHaveLength(4);
    expect(MOBILE_NAV_DESTINATIONS.map((d) => d.id)).toEqual(["dashboard", "portfolio", "cashflow", "more"]);
  });
});
