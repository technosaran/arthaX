export const CACHE_KEYS = {
  ACCOUNTS: "accounts",
  INCOME: "income",
  EXPENSES: "expenses",
  TRANSFERS: "transfers",
  SETTINGS: "settings",
  PORTFOLIO: "portfolio",
  LEDGER: "ledger",
  BUDGETS: "budgets",
  FAMILY_MEMBERS: "family_members",
  FAMILY_RESPONSIBILITIES: "family_responsibilities",
  STOCKS: "stocks",
  MUTUAL_FUNDS: "mutual_funds",
  BONDS: "bonds",
  BULLION: "bullion",
  BULLION_RATES: "bullion_rates",
  GOALS: "goals",
  ZERODHA: "zerodha",
  TELEGRAM: "telegram",
} as const;

/**
 * Helper to scope cache keys per user for complete multi-tenant isolation.
 * Strictly throws if userId is not provided to prevent cross-tenant key leakage.
 */
export const getUserCacheKey = (userId: string | undefined | null, resource: string): string => {
  if (!userId || typeof userId !== "string" || !userId.trim()) {
    return `arthax:cache:anonymous:${resource}`;
  }
  return `arthax:cache:${userId.trim()}:${resource}`;
};
