/**
 * Centralized SEO Configuration & Schema.org Structured Data Generator for arthaX
 */

export function getBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envUrl) {
    return envUrl.endsWith("/") ? envUrl.slice(0, -1) : envUrl;
  }
  return "https://arthax.vercel.app";
}

export const siteConfig = {
  name: "arthaX",
  title: "arthaX — Sovereign Wealth & Portfolio Intelligence Platform",
  titleTemplate: "%s | arthaX",
  description:
    "Institutional-grade personal wealth intelligence, multi-asset portfolio tracking (Equities, AMFI Mutual Funds, Fixed Income Bonds, Gold & Silver Bullion, F&O), Zerodha Kite auto-sync, dynamic budgets, and family office ledger.",
  url: getBaseUrl(),
  author: "arthaX Sovereign Finance",
  creator: "arthaX",
  publisher: "arthaX",
  themeColor: "#07080c",
  keywords: [
    "personal finance",
    "portfolio tracker",
    "wealth intelligence",
    "Zerodha Kite sync",
    "AMFI mutual funds",
    "Indian stock market",
    "fixed income bonds",
    "SGB sovereign gold bonds",
    "bullion gold silver tracker",
    "F&O derivatives positioning",
    "family office ledger",
    "cashflow management",
    "multi-asset ledger",
    "sovereign wealth platform",
    "arthaX",
  ],
  links: {
    terms: "/terms",
    privacy: "/privacy",
    login: "/login",
    supportEmail: "support@arthax.app",
  },
};

/**
 * Generates Schema.org compliant JSON-LD for WebApplication / FinancialProduct
 */
export function generateStructuredData(): Record<string, unknown> {
  const baseUrl = getBaseUrl();

  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: siteConfig.name,
    alternateName: "arthaX Wealth Management",
    url: baseUrl,
    description: siteConfig.description,
    applicationCategory: "FinanceApplication",
    operatingSystem: "All",
    browserRequirements: "Requires JavaScript. Requires modern HTML5 browser.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "INR",
    },
    creator: {
      "@type": "Organization",
      name: siteConfig.author,
      url: baseUrl,
    },
    featureList: [
      "Equities Real-Time Portfolio Tracking & Zerodha Kite Automated Sync",
      "AMFI Mutual Funds Scheme NAV Tracking & Capital Gains Accounting",
      "Fixed Income, Sovereign Gold Bonds (SGB) & Corporate Bonds Yields",
      "Physical Bullion (24K/22K Gold & 999 Silver) Live Market Rates",
      "Futures & Options (F&O) Greeks & Exposure Ledger",
      "Multi-Bank Accounts & Liquid Cash Runway Analytics",
      "Dynamic Budgets, Expense Velocity & Family Office Ledger",
      "Zero-Knowledge Row-Level Security (RLS) & AES-256 Authenticated Encryption",
    ],
  };
}
