/**
 * Edge-compatible Rate Limiter for Middleware.
 * Uses an in-memory map which works loosely across edge invocations.
 */

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  keyPrefix?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  limit: number;
}

const memoryStore = new Map<string, number[]>();

export class RateLimiter {
  private maxRequests: number;
  private windowMs: number;
  private keyPrefix: string;

  constructor(config: RateLimitConfig) {
    this.maxRequests = config.maxRequests;
    this.windowMs = config.windowMs;
    this.keyPrefix = config.keyPrefix || "rl";
  }

  public async check(key: string): Promise<RateLimitResult> {
    const fullKey = this.keyPrefix + ":" + key;
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const resetAt = new Date(now + this.windowMs);

    let timestamps = memoryStore.get(fullKey) || [];
    timestamps = timestamps.filter((t) => t > windowStart);
    timestamps.push(now);
    memoryStore.set(fullKey, timestamps);

    const count = timestamps.length;
    const allowed = count <= this.maxRequests;
    const remaining = Math.max(0, this.maxRequests - count);

    return { allowed, remaining, resetAt, limit: this.maxRequests };
  }
}

export const RATE_LIMIT_PRESETS = {
  sync: { maxRequests: 10, windowMs: 60 * 1000, keyPrefix: "rl:sync" },
  reports: { maxRequests: 30, windowMs: 60 * 1000, keyPrefix: "rl:reports" },
  general: { maxRequests: 100, windowMs: 60 * 1000, keyPrefix: "rl:general" },
  auth: { maxRequests: 5, windowMs: 60 * 1000, keyPrefix: "rl:auth" },
};
