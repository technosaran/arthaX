import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Responsive App Shell & Tab Animation", () => {
  const homeClientPath = path.resolve(__dirname, "../src/app/HomeClient.tsx");
  const homeClient = fs.readFileSync(homeClientPath, "utf-8");

  it("wraps tab view containers in smooth transition styling", () => {
    expect(homeClient).toContain("tab-content-enter");
  });

  it("renders MobileBottomNav for mobile viewports", () => {
    expect(homeClient).toContain("<MobileBottomNav");
  });
});
