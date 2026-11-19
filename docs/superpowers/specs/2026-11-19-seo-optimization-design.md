# Design Specification: arthaX Next.js 16 Full-Stack SEO

- **Status**: Approved
- **Date**: 2026-11-19
- **Scope**: SEO, Social Share Cards, PWA Manifest, and Schema.org Structured Data

---

## 1. Intent & Purpose
arthaX is an enterprise-grade sovereign wealth intelligence and portfolio management platform. To maximize search engine visibility, achieve optimal indexing on Google, provide rich share previews on Twitter/LinkedIn/WhatsApp, and support PWA discoverability, this specification outlines complete native SEO optimization for Next.js 16 (App Router).

---

## 2. Goals, Non-Goals & Anti-Goals

### Goals
- Establish complete root and route-level Next.js 16 Metadata with `metadataBase`, canonical URLs, title templates, robots crawler directives, and keywords.
- Dynamic OpenGraph and Twitter preview generation using `src/app/opengraph-image.tsx` via Next.js `ImageResponse`.
- Add PWA Web App Manifest (`src/app/manifest.ts`) matching institutional fintech design.
- Implement Schema.org JSON-LD structured data (`WebApplication` / `FinanceApplication`) in `src/app/layout.tsx`.
- Standardize metadata across child routes (`/login`, `/privacy`, `/terms`).
- Ensure 0 build warnings, 0 typecheck errors, and full compliance with Next.js 16 App Router standards.

### Non-Goals
- Adding external bloated SEO libraries (e.g. `next-seo` is legacy and redundant in App Router).
- Modifying private authenticated dashboard functionality or database logic.

### Anti-Goals
- Leaking private user financial data or internal authenticated routes in crawler directives or sitemaps.
- Heavy unoptimized client-side metadata scripts.

---

## 3. Constraints
- **Framework**: Next.js 16.4.6 with Turbopack, React 19.
- **Node Environment**: Edge-compatible `ImageResponse` for OpenGraph rendering.
- **Base URL**: Dynamically resolved from `process.env.NEXT_PUBLIC_APP_URL` with fallback to `https://arthax.vercel.app`.

---

## 4. Evaluated Approaches

1. **Native Next.js 16 App Router Full-Stack SEO (Selected)**
   - Leverages built-in `Metadata`, `MetadataRoute.Manifest`, `MetadataRoute.Robots`, and `ImageResponse`.
   - Zero additional dependencies, high performance, fully typesafe.
2. **Static Tag Injection & Static Files (Rejected)**
   - Requires manual image editing for OG tags, lacks dynamic adaptability, easily goes stale.

---

## 5. Architectural Details

### 5.1 Root Metadata (`src/app/layout.tsx`)
- `metadataBase`: `new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://arthax.vercel.app')`
- `title`: `{ default: "arthaX — Sovereign Wealth & Portfolio Intelligence Platform", template: "%s | arthaX" }`
- `description`: Comprehensive summary of equities, mutual funds, gold/silver bullion, fixed income, F&O, and family ledger tracking.
- `keywords`: Curated financial intelligence keywords.
- `openGraph`:
  - `type: "website"`
  - `locale: "en_IN"`
  - `siteName: "arthaX"`
  - `title`, `description`, `url`
- `twitter`:
  - `card: "summary_large_image"`
  - `title`, `description`
- `robots`:
  - `index: true, follow: true, googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large', 'max-snippet': -1 }`
- `alternates`:
  - `canonical: "/"`
- `JSON-LD`: Structured Schema (`WebApplication`) injected cleanly in `<head>` via `<script type="application/ld+json">`.

### 5.2 Dynamic OpenGraph Card (`src/app/opengraph-image.tsx`)
- Generated dynamically with `ImageResponse` (1200x630).
- Deep slate background (`#07080c`) with emerald accent highlights, typography, arthaX branding emblem, and asset tags ("Equities • Mutual Funds • Bullion • Fixed Income • F&O • Family Ledger").

### 5.3 Web App Manifest (`src/app/manifest.ts`)
- Returns `MetadataRoute.Manifest` with `name: "arthaX — Sovereign Wealth Platform"`, `short_name: "arthaX"`, `display: "standalone"`, `theme_color: "#07080c"`, icons.

### 5.4 Route Segments
- `src/app/login/page.tsx`: Explicit `metadata` exported with title "Sign In & Security Access" and clear value proposition.
- `src/app/privacy/page.tsx` & `src/app/terms/page.tsx`: Clean titles aligned with `%s | arthaX` template.
- `src/app/robots.ts`: Ensure canonical host and clean crawl definitions.
