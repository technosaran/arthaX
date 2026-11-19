# arthaX Next.js 16 Full-Stack SEO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement comprehensive native SEO, dynamic OpenGraph/Twitter social cards, PWA Web App Manifest, Schema.org JSON-LD structured data, and route-level metadata for arthaX on Next.js 16 App Router.

**Architecture:** Use Next.js 16 built-in `Metadata`, `MetadataRoute.Manifest`, `MetadataRoute.Robots`, and `ImageResponse` from `next/og` alongside a centralized `src/config/seo.ts` configuration and Schema.org JSON-LD generator. Ensure zero new dependencies, edge readiness, and complete type safety.

**Tech Stack:** Next.js 16.4.6, React 19, TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-19-seo-optimization-design.md`

## Global Constraints
- Next.js 16 App Router conventions (`metadataBase`, `ImageResponse`, `MetadataRoute`).
- Do not introduce external SEO packages (use Next.js native APIs).
- Maintain 100% test pass rate across all Vitest suites and zero TypeScript errors (`tsc --noEmit`).
- Dynamic base URL resolution using `process.env.NEXT_PUBLIC_APP_URL || "https://arthax.vercel.app"`.

## Review Focus
- Absolute URL resolution: `metadataBase` must be a valid URL instance to avoid Next.js build warnings.
- OpenGraph image dimensions: must strictly adhere to 1200x630 format.
- Schema.org validation: JSON-LD must contain valid syntax for `@context: "https://schema.org"` and `@type: "WebApplication"`.
- Title template formatting: Child pages must format as `<Page Title> | arthaX` without duplicate branding.
- Edge compatibility: OG image route handler must execute cleanly in Edge/Node runtimes without DOM dependencies.

---

### Task 1: Centralized SEO Configuration & Schema.org JSON-LD Generator

**Files:**
- Create: `src/config/seo.ts`
- Create: `tests/seo.test.ts`

**Interfaces:**
- Produces:
  - `siteConfig`: `{ name: string, title: string, titleTemplate: string, description: string, url: string, keywords: string[], author: string, creator: string }`
  - `getBaseUrl(): string`
  - `generateStructuredData(): Record<string, unknown>`

- [ ] **Step 1: Write the failing unit tests for SEO config and JSON-LD generation**

Write tests in `tests/seo.test.ts` verifying:
1. `getBaseUrl()` returns the configured URL or fallback `https://arthax.vercel.app`.
2. `siteConfig` contains valid properties (name, title, description, keywords).
3. `generateStructuredData()` outputs valid Schema.org structure with `@context`, `@type: "WebApplication"`, `applicationCategory: "FinanceApplication"`, and feature lists.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/seo.test.ts`
Expected: FAIL with "Cannot find module '@/config/seo'"

- [ ] **Step 3: Implement `src/config/seo.ts`**

Define `getBaseUrl()`, `siteConfig`, and `generateStructuredData()`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/seo.test.ts`
Expected: PASS

---

### Task 2: Root Layout & Metadata Enhancement

**Files:**
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: `siteConfig`, `generateStructuredData` from `src/config/seo.ts`
- Produces: Enhanced `metadata: Metadata` with `metadataBase`, `openGraph`, `twitter`, `alternates`, `robots`, and `<script type="application/ld+json">`.

- [ ] **Step 1: Update metadata export in `src/app/layout.tsx`**

Configure:
- `metadataBase: new URL(siteConfig.url)`
- `title: { default: siteConfig.title, template: siteConfig.titleTemplate }`
- `description: siteConfig.description`
- `keywords: siteConfig.keywords`
- `authors: [{ name: siteConfig.author, url: siteConfig.url }]`
- `creator: siteConfig.creator`
- `publisher: siteConfig.name`
- `alternates: { canonical: "/" }`
- `openGraph`: title, description, url, siteName, locale (`en_IN`), type (`website`)
- `twitter`: card (`summary_large_image`), title, description, creator
- `robots`: index, follow, googleBot options

- [ ] **Step 2: Inject Schema.org JSON-LD in `src/app/layout.tsx` `<head>`**

Add:
```tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify(generateStructuredData()),
  }}
/>
```

- [ ] **Step 3: Run static typecheck**

Run: `npm run typecheck`
Expected: PASS with 0 errors.

---

### Task 3: Dynamic OpenGraph & Twitter Social Cards

**Files:**
- Create: `src/app/opengraph-image.tsx`
- Create: `src/app/opengraph-image.alt.txt`
- Create: `src/app/twitter-image.tsx`
- Create: `src/app/twitter-image.alt.txt`

**Interfaces:**
- Produces: Dynamic image response (1200x630) using `ImageResponse` from `next/og`.

- [ ] **Step 1: Create `src/app/opengraph-image.tsx`**

Implement `ImageResponse` with runtime `'edge'`, dimensions 1200x630, dark theme `#07080c`, emerald accents, arthaX branding, and capability badges ("Equities", "Mutual Funds", "Bullion", "Fixed Income", "F&O", "Zero-Knowledge Encryption").

- [ ] **Step 2: Create `src/app/opengraph-image.alt.txt`**

Write descriptive alt text: "arthaX — Sovereign Wealth & Portfolio Intelligence Platform".

- [ ] **Step 3: Create `src/app/twitter-image.tsx` & alt file**

Export identical image response for Twitter card compatibility.

- [ ] **Step 4: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS with 0 errors.

---

### Task 4: Web App Manifest for Mobile & PWA Discoverability

**Files:**
- Create: `src/app/manifest.ts`

**Interfaces:**
- Produces: `export default function manifest(): MetadataRoute.Manifest`

- [ ] **Step 1: Implement `src/app/manifest.ts`**

Define manifest returning:
- `name: "arthaX — Sovereign Wealth & Portfolio Intelligence"`
- `short_name: "arthaX"`
- `description: "Personal finance, multi-asset portfolio intelligence, and family ledger"`
- `start_url: "/"`
- `display: "standalone"`
- `background_color: "#07080c"`
- `theme_color: "#07080c"`
- `icons`: standard favicon and icon definitions matching `public/` assets.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS with 0 errors.

---

### Task 5: Child Routes Metadata Standardization & Robots Optimization

**Files:**
- Modify: `src/app/login/page.tsx`
- Modify: `src/app/privacy/page.tsx`
- Modify: `src/app/terms/page.tsx`
- Modify: `src/app/robots.ts`

**Interfaces:**
- Produces: Route-specific metadata matching the title template and host in robots.

- [ ] **Step 1: Export metadata in `src/app/login/page.tsx`**

Add `metadata: Metadata` with:
- `title: "Sign In & Security Access"`
- `description: "Sign in to your arthaX account. Securely manage stocks, mutual funds, gold, bonds, and bank accounts."`

- [ ] **Step 2: Standardize `src/app/privacy/page.tsx` and `src/app/terms/page.tsx` metadata**

Update titles to "Privacy Policy" and "Terms of Service" to leverage `%s | arthaX` template seamlessly.

- [ ] **Step 3: Update `src/app/robots.ts`**

Include `host: baseUrl` in the returned robots configuration.

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS with 0 errors.

---

### Task 6: Full Verification & Production Build

**Files:** None (testing and build validation)

- [ ] **Step 1: Run complete test suite**

Run: `npm test`
Expected: PASS (all tests passing).

- [ ] **Step 2: Run ESLint validation**

Run: `npm run lint`
Expected: PASS with 0 lint errors.

- [ ] **Step 3: Run production build**

Run: `npm run build`
Expected: PASS with successful compilation of all static and dynamic metadata routes (`/robots.txt`, `/sitemap.xml`, `/manifest.webmanifest`, `/opengraph-image`, `/twitter-image`).
