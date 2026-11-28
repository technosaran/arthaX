import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const rootDir = path.resolve(__dirname, "..");

function readRel(relPath: string): string {
  return fs.readFileSync(path.join(rootDir, relPath), "utf8");
}

function pngDimensions(relPath: string): { width: number; height: number; bytes: number } {
  const buf = fs.readFileSync(path.join(rootDir, relPath));
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    bytes: buf.byteLength,
  };
}

describe("Site-wide UX, Navigation, SEO & Mobile Audit Fixes", () => {
  it("provides a custom 404 page with metadata and shared public navigation", () => {
    const src = readRel("src/app/not-found.tsx");
    expect(src).toContain("export const metadata");
    expect(src).toContain("Page Not Found");
    expect(src).toContain("PublicHeader");
    expect(src).toContain("PublicFooter");
    expect(src).toContain('href="/"');
    expect(src).toContain('href="/login"');
    expect(src).toContain("mailto:");
  });

  it("provides explicit page metadata and descriptions across public routes and offline page", () => {
    const homePage = readRel("src/app/page.tsx");
    const settingsPage = readRel("src/app/settings/page.tsx");
    const privacyPage = readRel("src/app/privacy/page.tsx");
    const termsPage = readRel("src/app/terms/page.tsx");
    const offlineHtml = readRel("public/offline.html");
    const homeClient = readRel("src/app/HomeClient.tsx");

    expect(homePage).toContain("export const metadata");
    expect(homePage).toContain("description:");
    expect(settingsPage).toContain("export const metadata");
    expect(privacyPage).toContain("openGraph:");
    expect(termsPage).toContain("openGraph:");
    expect(offlineHtml).toContain('<meta name="description"');
    expect(offlineHtml).toContain('rel="icon"');
    expect(homeClient).toContain("document.title =");
  });

  it("uses dynamic copyright year, mobile hamburger menu, clickable logo, and working links in PublicChrome", () => {
    const chrome = readRel("src/components/PublicChrome.tsx");
    expect(chrome).toContain("new Date().getFullYear()");
    expect(chrome).not.toMatch(/©\s*202\d/);
    expect(chrome).toContain('aria-controls="public-mobile-menu"');
    expect(chrome).toContain('id="public-mobile-menu"');
    expect(chrome).toContain('href="/"');
    expect(chrome).toContain("<Logo");
    expect(chrome).toContain("mailto:");
  });

  it("makes all contact emails and phone numbers clickable across legal and family views", () => {
    const privacy = readRel("src/app/privacy/page.tsx");
    const terms = readRel("src/app/terms/page.tsx");
    const family = readRel("src/components/FamilySection.tsx");

    expect(privacy).toContain("mailto:");
    expect(terms).toContain("mailto:");
    expect(family).toContain("href={`tel:");
    expect(family).toContain("href={`mailto:");
  });

  it("keeps shell logos clickable and wires PWA install actions cleanly", () => {
    const sidebar = readRel("src/components/Sidebar.tsx");
    const topNav = readRel("src/components/TopNav.tsx");
    const mobileNav = readRel("src/components/MobileBottomNav.tsx");
    const pwaPrompt = readRel("src/components/pwa/PwaInstallPrompt.tsx");

    expect(sidebar).toContain('handleTabSelect("dashboard")');
    expect(topNav).toContain('<button');
    expect(topNav).toContain('aria-label="Go to Dashboard"');
    expect(mobileNav).toContain("arthax:open-pwa-install");
    expect(pwaPrompt).toContain("arthax:open-pwa-install");
  });

  it("prevents horizontal overflow in globals CSS, SegmentedControl, and BondsSection", () => {
    const css = readRel("src/app/globals.css");
    const segmented = readRel("src/components/ui/SegmentedControl.tsx");
    const bonds = readRel("src/components/BondsSection.tsx");

    expect(css).toContain("overflow-x: clip");
    expect(segmented).toContain("max-w-full overflow-x-auto");
    expect(bonds).toContain("overflow-x-auto");
  });

  it("removes hardcoded dummy telemetry and placeholder text", () => {
    const crypto = readRel("src/components/CryptoSection.tsx");
    const wallet = readRel("src/components/AppleWalletCard.tsx");
    const login = readRel("src/app/login/LoginClient.tsx");
    const settings = readRel("src/components/SettingsSection.tsx");
    const seo = readRel("src/config/seo.ts");

    expect(crypto).not.toContain("canTrade: Active");
    expect(crypto).not.toContain("25% Enabled");
    expect(crypto).not.toContain("preview all features");
    expect(wallet).not.toContain("HXH648");
    expect(wallet).not.toContain("8821");
    expect(login).not.toContain("Alex Morgan");
    expect(login).not.toContain("name@example.com");
    expect(settings).not.toContain("e.g. Alex");
    expect(seo).not.toContain('"https://github.com"');
  });

  it("keeps compressed PNG icons at exact required dimensions and compact byte sizes", () => {
    const icon512 = pngDimensions("public/icon-512x512.png");
    const maskable512 = pngDimensions("public/icon-maskable-512x512.png");
    const appIcon = pngDimensions("src/app/icon.png");
    const icon192 = pngDimensions("public/icon-192x192.png");
    const appleIcon = pngDimensions("src/app/apple-icon.png");

    expect(icon512).toMatchObject({ width: 512, height: 512 });
    expect(maskable512).toMatchObject({ width: 512, height: 512 });
    expect(appIcon).toMatchObject({ width: 512, height: 512 });
    expect(icon192).toMatchObject({ width: 192, height: 192 });
    expect(appleIcon).toMatchObject({ width: 180, height: 180 });

    expect(icon512.bytes).toBeLessThan(120_000);
    expect(maskable512.bytes).toBeLessThan(100_000);
    expect(icon192.bytes).toBeLessThan(25_000);
    expect(appleIcon.bytes).toBeLessThan(20_000);
  });
});
