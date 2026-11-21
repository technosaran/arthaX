import { invalidateCachedData, getUserCacheKey, CACHE_KEYS } from "@/utils/redis";
import { logger } from "@/utils/logger";

export type CacheTarget =
  | "PORTFOLIO"
  | "STOCKS"
  | "MUTUAL_FUNDS"
  | "BONDS"
  | "BULLION"
  | "CRYPTO"
  | "ACCOUNTS"
  | "EXPENSES"
  | "INCOME"
  | "LEDGER"
  | "BUDGETS"
  | "TRANSFERS"
  | "ANALYTICS";

/**
 * Universal Cache Invalidator for Backend API Mutations.
 * Automatically purges Redis cache keys scoped by user ID with graceful error handling.
 */
export async function invalidateUserCaches(
  userId: string | null | undefined,
  targets: CacheTarget[],
  options?: { monthPrefix?: string }
): Promise<void> {
  if (!userId) return;

  const keysToPurge: string[] = [];

  for (const target of targets) {
    switch (target) {
      case "PORTFOLIO":
        keysToPurge.push(getUserCacheKey(userId, CACHE_KEYS.PORTFOLIO));
        break;
      case "STOCKS":
        keysToPurge.push(getUserCacheKey(userId, CACHE_KEYS.STOCKS));
        break;
      case "MUTUAL_FUNDS":
        keysToPurge.push(getUserCacheKey(userId, CACHE_KEYS.MUTUAL_FUNDS));
        break;
      case "BONDS":
        keysToPurge.push(getUserCacheKey(userId, CACHE_KEYS.BONDS));
        break;
      case "BULLION":
        keysToPurge.push(getUserCacheKey(userId, CACHE_KEYS.BULLION));
        keysToPurge.push(getUserCacheKey(userId, CACHE_KEYS.BULLION_RATES));
        break;
      case "CRYPTO":
        keysToPurge.push(`arthax:cache:${userId}:crypto`);
        keysToPurge.push(`crypto:holdings:${userId}`);
        break;
      case "ACCOUNTS":
        keysToPurge.push(getUserCacheKey(userId, CACHE_KEYS.ACCOUNTS));
        break;
      case "EXPENSES":
        keysToPurge.push(getUserCacheKey(userId, CACHE_KEYS.EXPENSES));
        break;
      case "INCOME":
        keysToPurge.push(getUserCacheKey(userId, CACHE_KEYS.INCOME));
        break;
      case "LEDGER":
        keysToPurge.push(getUserCacheKey(userId, CACHE_KEYS.LEDGER));
        break;
      case "BUDGETS":
        keysToPurge.push(getUserCacheKey(userId, CACHE_KEYS.BUDGETS));
        break;
      case "TRANSFERS":
        keysToPurge.push(getUserCacheKey(userId, CACHE_KEYS.TRANSFERS));
        break;
      case "ANALYTICS":
        if (options?.monthPrefix) {
          keysToPurge.push(getUserCacheKey(userId, `analytics:${options.monthPrefix}`));
        }
        // Purge current and previous month analytics cache
        const now = new Date();
        const curMonth = now.toISOString().slice(0, 7);
        keysToPurge.push(getUserCacheKey(userId, `analytics:${curMonth}`));
        break;
    }
  }

  if (keysToPurge.length > 0) {
    try {
      await invalidateCachedData(keysToPurge);
    } catch (err: unknown) {
      logger.warn("Cache invalidation failed (non-blocking)", "CacheInvalidator", {
        userId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
