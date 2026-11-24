import { getUserCacheKey, CACHE_KEYS } from "@/utils/cacheKeys";

/**
 * Ultra-Fast Multi-Tier Hybrid Cache for arthaX
 * Tier 1: In-Memory Map (0.001 ms)
 * Tier 2: LocalStorage (0.1 ms - short warm cache to prevent stale figures)
 * Tier 3: Upstash Redis via /api/cache (background asynchronous cloud sync)
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // in milliseconds
}

const memoryCache = new Map<string, CacheEntry<unknown>>();

// Default max freshness for financial data in local storage: 120 seconds (2 mins)
export const DEFAULT_MAX_STALENESS_MS = 120 * 1000;

/**
 * Synchronous instant retrieval from Tier 1 (Memory) or Tier 2 (LocalStorage).
 * If the cached entry is older than maxAgeMs, it is treated as expired to prevent
 * showing stale/old financial figures on cold loads.
 */
export function getFromLocalCache<T>(key: string, maxAgeMs: number = DEFAULT_MAX_STALENESS_MS): T | null {
  if (typeof window === "undefined" || !key) return null;

  const now = Date.now();

  // Tier 1: Check in-memory cache (0.001ms) - optimal for instant tab switching in same session
  const mem = memoryCache.get(key);
  if (mem) {
    const age = now - mem.timestamp;
    if (age < mem.ttl && age < maxAgeMs) {
      return mem.data as T;
    }
    memoryCache.delete(key);
  }

  // Tier 2: Check localStorage (0.1ms)
  try {
    const raw = window.localStorage.getItem(`arthax_c_${key}`);
    if (raw) {
      const parsed: CacheEntry<T> = JSON.parse(raw);
      const age = now - parsed.timestamp;
      if (age < parsed.ttl && age < maxAgeMs) {
        // Hydrate memory cache for fast subsequent reads
        memoryCache.set(key, parsed);
        return parsed.data;
      }
      // Expired or stale entry: purge to prevent flashing outdated data
      window.localStorage.removeItem(`arthax_c_${key}`);
    }
  } catch {
    // Non-blocking quota or private mode fallback
  }

  return null;
}

/**
 * Save to Tier 1 and Tier 2 synchronously (0ms)
 * Default TTL is 120 seconds to prevent long-lived stale financial data in browser storage.
 */
export function saveToLocalCache<T>(key: string, value: T, ttlSeconds: number = 120): void {
  if (typeof window === "undefined" || !key || value === undefined) return;

  const entry: CacheEntry<T> = {
    data: value,
    timestamp: Date.now(),
    ttl: ttlSeconds * 1000,
  };

  // Tier 1: Memory
  memoryCache.set(key, entry);

  // Tier 2: LocalStorage
  try {
    window.localStorage.setItem(`arthax_c_${key}`, JSON.stringify(entry));
  } catch {
    // Non-blocking quota fallback
  }
}

/**
 * Async fetch helper: checks Tier 1/2 first, falls back to /api/cache with a fast timeout (800ms)
 */
export async function fetchFromCache<T>(key: string, maxAgeMs: number = DEFAULT_MAX_STALENESS_MS): Promise<T | null> {
  if (!key) return null;

  // 1. Instant local check
  const local = getFromLocalCache<T>(key, maxAgeMs);
  if (local !== null) {
    return local;
  }

  // 2. Fallback to API cache with 800ms timeout so it NEVER delays the app
  if (typeof window !== "undefined") {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 800);

      const res = await fetch(`/api/cache?key=${encodeURIComponent(key)}`, {
        method: "GET",
        signal: controller.signal,
        headers: {
          "Cache-Control": "no-cache",
        },
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json();
        if (json.hit && json.data !== null && json.data !== undefined) {
          saveToLocalCache(key, json.data, 120);
          return json.data as T;
        }
      }
    } catch {
      // Non-blocking timeout or error
    }
  }

  return null;
}

/**
 * Save data: Immediately writes to local memory + localStorage (0ms),
 * and syncs to Upstash Redis in the background without blocking the UI.
 */
export async function saveToCache<T>(
  key: string,
  value: T,
  ttl: number = 120
): Promise<void> {
  if (!key || value === undefined) return;

  // Instant local save
  saveToLocalCache(key, value, ttl);

  // Asynchronous background cloud sync (fire & forget)
  if (typeof window !== "undefined") {
    fetch("/api/cache", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ key, value, ttl }),
    }).catch(() => {});
  }
}

let broadcastTimeout: ReturnType<typeof setTimeout> | null = null;
const pendingBroadcastKeys = new Set<string>();

function debouncedBroadcastDataUpdated(keys: string[]) {
  if (typeof window === "undefined") return;
  keys.forEach((k) => pendingBroadcastKeys.add(k));
  if (broadcastTimeout) clearTimeout(broadcastTimeout);
  broadcastTimeout = setTimeout(() => {
    if (typeof window !== "undefined") {
      const distinctKeys = Array.from(pendingBroadcastKeys);
      pendingBroadcastKeys.clear();
      window.dispatchEvent(new CustomEvent("arthax:financial_data_updated", { detail: { keys: distinctKeys } }));
    }
    broadcastTimeout = null;
  }, 50);
}

/**
 * Invalidate cache keys across Tier 1, Tier 2, and cloud Redis.
 * Also broadcasts an internal browser event to trigger real-time UI synchronization across mounted tabs.
 */
export async function invalidateCacheKeys(keys: string | string[]): Promise<void> {
  const list = (Array.isArray(keys) ? keys : [keys]).filter(Boolean);
  if (list.length === 0) return;

  // Instant local purge
  if (typeof window !== "undefined") {
    for (const key of list) {
      memoryCache.delete(key);
      try {
        window.localStorage.removeItem(`arthax_c_${key}`);
      } catch {}
    }

    // Debounced broadcast event so active tabs refresh in a single coordinated pass
    debouncedBroadcastDataUpdated(list);

    // Async background purge in Redis
    fetch(`/api/cache?keys=${encodeURIComponent(list.join(","))}`, {
      method: "DELETE",
    }).catch(() => {});
  }
}

/**
 * Comprehensive financial cache invalidator.
 * Atomically purges portfolio, accounts, expenses, income, ledger, budgets, and transfers
 * across all tiers so that modifying data in one section immediately updates all other views.
 */
export async function invalidateAllFinancialCache(userId: string | undefined | null): Promise<void> {
  if (!userId || typeof userId !== "string" || !userId.trim()) return;

  const cleanId = userId.trim();
  const keys = [
    getUserCacheKey(cleanId, CACHE_KEYS.PORTFOLIO),
    getUserCacheKey(cleanId, CACHE_KEYS.ACCOUNTS),
    getUserCacheKey(cleanId, CACHE_KEYS.EXPENSES),
    getUserCacheKey(cleanId, CACHE_KEYS.INCOME),
    getUserCacheKey(cleanId, CACHE_KEYS.LEDGER),
    getUserCacheKey(cleanId, CACHE_KEYS.BUDGETS),
    getUserCacheKey(cleanId, CACHE_KEYS.TRANSFERS),
  ];

  await invalidateCacheKeys(keys);
}

/**
 * Completely purges all local financial cache items from Memory and LocalStorage.
 * Mandatory on user logout or session termination to prevent data leakage.
 */
export function clearLocalFinancialCache(): void {
  // 1. Purge in-memory cache
  memoryCache.clear();

  // 2. Purge all localStorage entries starting with 'arthax_c_' or 'arthax_cached_'
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && (key.startsWith("arthax_c_") || key.startsWith("arthax_cached_"))) {
          keysToRemove.push(key);
        }
      }
      for (const k of keysToRemove) {
        window.localStorage.removeItem(k);
      }
    } catch {
      // Ignore fallback errors
    }
  }
}
