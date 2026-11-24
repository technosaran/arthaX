# Smooth Dynamic & Responsive Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver an institutional-grade, ultra-smooth 60fps dynamic, and mobile-first responsive experience across both the Public Landing Page and the Authenticated Wealth Dashboard, with strict currency separation between INR and USD (Crypto).

**Architecture:** 
1. Strict Currency Separation in `DashboardSection.tsx` so the INR view contains ONLY pure INR assets (no crypto converted to INR), and the USD view contains USD Crypto holdings. Fix donut pluralization ("3 Classes").
2. Build hardware-accelerated fluid CSS motion foundations in `globals.css` with smooth tab-enter transitions, ambient glows, and mobile viewport safe-area ergonomics.
3. Implement an ergonomic `MobileBottomNav` component with a slide-up "More Modules" sheet for seamless single-thumb mobile navigation.
4. Upgrade `HomeClient.tsx`, `Sidebar.tsx`, and `TopNav.tsx` with fluid tab-switching transitions, responsive padding, and unified header controls.
5. Elevate `PublicLandingView.tsx` with a responsive mobile drawer menu, interactive hero ledger simulation card, and smooth micro-interactions.
6. Enhance UI primitives (`Modal.tsx`, `StatCard.tsx`) with smooth keyframe animations, touch-manipulation optimizations, and responsive typography.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS 4, Lucide React, TypeScript, Vitest.

**Spec:** [docs/superpowers/specs/2026-11-22-smooth-responsive-spec.md](../specs/2026-11-22-smooth-responsive-spec.md)

## Global Constraints

- Zero degradation of existing 443 unit and integration tests.
- Maintain strict TypeScript type-checking (`npm run typecheck` zero errors).
- Zero external heavy runtime dependencies; use native CSS animations, hardware-accelerated transforms (`translate3d`, `opacity`, `scale`), and standard Tailwind 4.
- Full compliance with WCAG 2.2 accessibility standards and `prefers-reduced-motion` media queries.
- Support responsive breakpoints: xs (<400px), sm (640px), md (768px), lg (1024px), xl (1280px).

## Review Focus

1. Crypto appearing in INR Net Worth or Donut Segments — pinned by `currencySeparationStrict.test.ts`.
2. Donut chart pluralization displaying "Classs" — pinned by `interactiveDonutPlural.test.ts`.
3. Mobile bottom navigation overlapping bottom content — pinned by container padding tests.
4. Mobile navigation drawer closing properly on route/tab change and backdrop tap.
5. Tab transitions playing smoothly without re-mounting or losing scroll position of visited tabs.

---

### Task 1: Strict Currency Separation (INR vs USD) & Pluralization Fix

**Files:**
- Modify: `src/components/DashboardSection.tsx`
- Modify: `src/components/charts/InteractiveDonutChart.tsx`
- Test: `tests/currencySeparationStrict.test.ts`

**Interfaces:**
- Consumes: `currencyView` ("INR" | "USD"), `cryptoHoldings`, `accounts`, `investmentsBreakdown`.
- Produces: Strictly separated INR portfolio values (0 crypto in INR net worth or donut chart) and grammatically correct pluralization ("Classes", "Coins").

- [ ] **Step 1: Write the failing test**

```typescript
// tests/currencySeparationStrict.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/currencySeparationStrict.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement strict currency separation in `DashboardSection.tsx` and pluralization fix in `InteractiveDonutChart.tsx`**

1. Remove `cryptoInr` from `totalInvestments` and `typeMap`.
2. Fix pluralization in `InteractiveDonutChart.tsx` so `Class` becomes `Classes`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/currencySeparationStrict.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/DashboardSection.tsx src/components/charts/InteractiveDonutChart.tsx tests/currencySeparationStrict.test.ts
git commit -m "fix(dashboard): enforce strict currency separation for INR/USD and fix donut pluralization"
```

---

### Task 2: Motion & Responsive CSS Foundation

**Files:**
- Modify: `src/app/globals.css`
- Test: `tests/motionResponsiveStyles.test.ts`

**Interfaces:**
- Consumes: Tailwind 4 theme variables, CSS custom properties.
- Produces: Utility classes `.tab-content-enter`, `.sheet-slide-up`, `.card-hover-dynamic`, `.safe-bottom-nav`, `.touch-smooth-scroll`.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/motionResponsiveStyles.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/motionResponsiveStyles.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement CSS motion & responsive foundation in `src/app/globals.css`**

Add `@keyframes tabEnter`, `@keyframes sheetSlideUp`, smooth scroll utilities, safe-area-inset helpers, and dynamic card hover states with reduced-motion overrides.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/motionResponsiveStyles.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css tests/motionResponsiveStyles.test.ts
git commit -m "feat(ui): add hardware-accelerated motion and responsive CSS foundations"
```

---

### Task 3: Mobile Bottom Navigation & Quick Module Launcher Sheet

**Files:**
- Create: `src/components/MobileBottomNav.tsx`
- Modify: `src/app/HomeClient.tsx`
- Test: `tests/mobileBottomNav.test.ts`

**Interfaces:**
- Consumes: `activeTab: string`, `onSelectTab: (tab: string) => void`.
- Produces: `MobileBottomNav` component with 4 primary docked destinations (Dashboard, Portfolio, Cashflow, More) and dynamic modal sheet for secondary modules.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/mobileBottomNav.test.ts
import { describe, it, expect } from "vitest";
import { getMobileNavGroup, MOBILE_NAV_DESTINATIONS } from "@/components/MobileBottomNav";

describe("MobileBottomNav Navigation Mapping", () => {
  it("maps main financial tabs to appropriate primary dock categories", () => {
    expect(getMobileNavGroup("dashboard")).toBe("dashboard");
    expect(getMobileNavGroup("stocks")).toBe("portfolio");
    expect(getMobileNavGroup("mutual-funds")).toBe("portfolio");
    expect(getMobileNavGroup("expenses")).toBe("cashflow");
    expect(getMobileNavGroup("income")).toBe("cashflow");
    expect(getMobileNavGroup("tax")).toBe("more");
    expect(getMobileNavGroup("settings")).toBe("more");
  });

  it("provides 4 distinct bottom dock navigation targets", () => {
    expect(MOBILE_NAV_DESTINATIONS).toHaveLength(4);
    expect(MOBILE_NAV_DESTINATIONS.map(d => d.id)).toEqual(["dashboard", "portfolio", "cashflow", "more"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/mobileBottomNav.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `MobileBottomNav.tsx` and integrate into `HomeClient.tsx`**

1. Create `src/components/MobileBottomNav.tsx` with touch-optimized thumb navigation, active indicator pill, and slide-up "More Modules" sheet.
2. Integrate into `src/app/HomeClient.tsx` with responsive padding (`pb-20 md:pb-0`) so content flows smoothly above the dock.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/mobileBottomNav.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/MobileBottomNav.tsx src/app/HomeClient.tsx tests/mobileBottomNav.test.ts
git commit -m "feat(mobile): add thumb-friendly MobileBottomNav with module drawer"
```

---

### Task 4: Smooth Tab Switching Engine & Responsive App Shell

**Files:**
- Modify: `src/app/HomeClient.tsx`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/TopNav.tsx`
- Test: `tests/responsiveAppShell.test.ts`

**Interfaces:**
- Consumes: `activeTab`, `visitedTabs`, theme & auth context.
- Produces: Fluid animated tab containers (`.tab-content-enter`), smoother desktop/mobile sidebar transitions, and responsive header actions.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/responsiveAppShell.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/responsiveAppShell.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement tab animation wrappers and responsive shell updates**

1. In `HomeClient.tsx`: Apply `tab-content-enter` to active tab views, smooth scrolling wrappers, and responsive viewport sizing.
2. In `Sidebar.tsx`: Smooth out tooltip hover cards, improve mobile drawer touch backdrop, and add keyboard shortcuts.
3. In `TopNav.tsx`: Ensure clean responsive breakpoint handling and quick action buttons.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/responsiveAppShell.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/HomeClient.tsx src/components/Sidebar.tsx src/components/TopNav.tsx tests/responsiveAppShell.test.ts
git commit -m "feat(ui): implement smooth tab transition engine and responsive shell polish"
```

---

### Task 5: Public Landing Page Modernization & Interactive Hero Card

**Files:**
- Modify: `src/components/PublicLandingView.tsx`
- Test: `tests/publicLandingResponsive.test.ts`

**Interfaces:**
- Consumes: Logo, UI Button, Card, Lucide icons.
- Produces: Responsive mobile navigation drawer, interactive live-simulation Hero Preview Card, smooth scroll targets, and dynamic micro-interactions.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/publicLandingResponsive.test.ts
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Public Landing Responsive & Dynamic Features", () => {
  const landingPath = path.resolve(__dirname, "../src/components/PublicLandingView.tsx");
  const landing = fs.readFileSync(landingPath, "utf-8");

  it("includes responsive mobile menu toggle in landing header", () => {
    expect(landing).toContain("mobileMenuOpen");
    expect(landing).toContain("aria-label=\"Toggle menu\"");
  });

  it("renders interactive hero ledger preview showcase", () => {
    expect(landing).toContain("InteractiveHeroPreview");
  });

  it("applies smooth dynamic card hover effects", () => {
    expect(landing).toContain("card-hover-dynamic");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/publicLandingResponsive.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement responsive mobile navigation and interactive hero preview in `PublicLandingView.tsx`**

1. Add mobile hamburger menu drawer with smooth slide-in animation.
2. Add `InteractiveHeroPreview` component showcasing a live simulated portfolio with dynamic asset breakdown, live tickers, and interactive tabs.
3. Apply `card-hover-dynamic` and smooth scroll navigation.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/publicLandingResponsive.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/PublicLandingView.tsx tests/publicLandingResponsive.test.ts
git commit -m "feat(landing): modernize public view with mobile drawer and interactive hero ledger"
```

---

### Task 6: Core UI Primitives Micro-Interactions & Full Verification

**Files:**
- Modify: `src/components/ui/StatCard.tsx`
- Modify: `src/components/ui/Modal.tsx`
- Run: Full test suite & typecheck

**Interfaces:**
- Consumes: Component props.
- Produces: Fluid modal entrance/exit animations, touch tap feedback, auto-scaling typography on stat cards.

- [ ] **Step 1: Update `Modal.tsx` and `StatCard.tsx` with smooth animations and responsive auto-scaling**

Add keyframe entrance animations, backdrop blur, active scale feedback, and responsive text clamping.

- [ ] **Step 2: Run full test suite and typecheck**

Run: `npm run typecheck && npm test`
Expected: PASS (all tests pass, 0 type errors)

- [ ] **Step 3: Build verification**

Run: `npm run build`
Expected: Production build succeeds with 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/StatCard.tsx src/components/ui/Modal.tsx
git commit -m "feat(ui): add micro-interactions to Modal and StatCard components"
```
