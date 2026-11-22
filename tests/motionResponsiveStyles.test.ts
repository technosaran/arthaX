import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Motion & Responsive CSS Foundation", () => {
  const cssPath = path.resolve(__dirname, "../src/app/globals.css");
  const css = fs.readFileSync(cssPath, "utf-8");

  it("defines tab-content-enter keyframes and class for smooth view transitions", () => {
    expect(css).toContain("@keyframes tabEnter");
    expect(css).toContain(".tab-content-enter");
  });

  it("defines mobile safe-area utilities and touch optimization", () => {
    expect(css).toContain("safe-area-inset-bottom");
    expect(css).toContain(".touch-smooth-scroll");
  });

  it("includes dynamic card hover and sheet slide-up animation", () => {
    expect(css).toContain("@keyframes sheetSlideUp");
    expect(css).toContain(".sheet-slide-up");
  });
});
