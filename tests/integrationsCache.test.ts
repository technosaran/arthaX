import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import {
  saveToLocalCache,
  getFromLocalCache,
  clearLocalFinancialCache,
  invalidateCacheKeys,
} from "../src/utils/cacheClient";
import { CACHE_KEYS, getUserCacheKey } from "../src/utils/redis";

describe("Integrations State Hydration & Caching (Zero-Flash)", () => {
  const testUserId = "user_test_integrations_123";
  let storageMap: Map<string, string>;

  beforeAll(() => {
    storageMap = new Map();
    const mockLocalStorage = {
      getItem: (key: string) => storageMap.get(key) ?? null,
      setItem: (key: string, val: string) => storageMap.set(key, val),
      removeItem: (key: string) => storageMap.delete(key),
      clear: () => storageMap.clear(),
      get length() {
        return storageMap.size;
      },
      key: (i: number) => Array.from(storageMap.keys())[i] ?? null,
    };

    (globalThis as any).window = {
      localStorage: mockLocalStorage,
      dispatchEvent: () => true,
    };
  });

  afterAll(() => {
    delete (globalThis as any).window;
  });

  beforeEach(() => {
    storageMap.clear();
    clearLocalFinancialCache();
  });

  it("has dedicated cache keys for Zerodha and Telegram in CACHE_KEYS", () => {
    expect(CACHE_KEYS.ZERODHA).toBe("zerodha");
    expect(CACHE_KEYS.TELEGRAM).toBe("telegram");
  });

  it("generates isolated user cache keys for integrations", () => {
    const zerodhaKey = getUserCacheKey(testUserId, CACHE_KEYS.ZERODHA);
    const telegramKey = getUserCacheKey(testUserId, CACHE_KEYS.TELEGRAM);

    expect(zerodhaKey).toBe(`arthax:cache:${testUserId}:zerodha`);
    expect(telegramKey).toBe(`arthax:cache:${testUserId}:telegram`);
  });

  it("instantly hydrates Zerodha connected status from local cache without delay", () => {
    const zerodhaKey = getUserCacheKey(testUserId, CACHE_KEYS.ZERODHA);
    const mockZerodhaStatus = {
      configured: true,
      connected: true,
      isTokenExpired: false,
      apiKeyMasked: "xyz••••789",
      userProfile: { client_id: "ZD9999", user_name: "Test User" },
      lastSyncAt: new Date().toISOString(),
      lastSyncStatus: "SUCCESS",
      lastSyncSummary: { stocks_synced: 12, fno_synced: 2, mf_synced: 5 },
      lastSyncError: null,
      loginUrl: null,
    };

    saveToLocalCache(zerodhaKey, mockZerodhaStatus, 86400);

    const cached = getFromLocalCache<typeof mockZerodhaStatus>(zerodhaKey);
    expect(cached).not.toBeNull();
    expect(cached?.connected).toBe(true);
    expect(cached?.userProfile?.client_id).toBe("ZD9999");
  });

  it("instantly hydrates Telegram linked status from local cache without delay", () => {
    const telegramKey = getUserCacheKey(testUserId, CACHE_KEYS.TELEGRAM);
    const mockTelegramData = {
      is_linked: true,
      telegram_username: "arthax_user",
      telegram_chat_id: "12345678",
      link_token: "AX-TEST99",
      bot_username: "Artha_X_bot",
      loading: false,
    };

    saveToLocalCache(telegramKey, mockTelegramData, 86400);

    const cached = getFromLocalCache<typeof mockTelegramData>(telegramKey);
    expect(cached).not.toBeNull();
    expect(cached?.is_linked).toBe(true);
    expect(cached?.telegram_username).toBe("arthax_user");
  });

  it("purges integrations cache on disconnect via invalidateCacheKeys", async () => {
    const zerodhaKey = getUserCacheKey(testUserId, CACHE_KEYS.ZERODHA);
    saveToLocalCache(zerodhaKey, { connected: true, configured: true }, 86400);

    expect(getFromLocalCache(zerodhaKey)).not.toBeNull();

    await invalidateCacheKeys([zerodhaKey]);
    expect(getFromLocalCache(zerodhaKey)).toBeNull();
  });

  it("purges all integration caches when clearLocalFinancialCache is triggered", () => {
    const zerodhaKey = getUserCacheKey(testUserId, CACHE_KEYS.ZERODHA);
    const telegramKey = getUserCacheKey(testUserId, CACHE_KEYS.TELEGRAM);

    saveToLocalCache(zerodhaKey, { connected: true }, 86400);
    saveToLocalCache(telegramKey, { is_linked: true }, 86400);

    expect(getFromLocalCache(zerodhaKey)).not.toBeNull();
    expect(getFromLocalCache(telegramKey)).not.toBeNull();

    clearLocalFinancialCache();

    expect(getFromLocalCache(zerodhaKey)).toBeNull();
    expect(getFromLocalCache(telegramKey)).toBeNull();
  });
});
