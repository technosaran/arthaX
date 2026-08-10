/**
 * User Profile & Preferences Service Layer.
 * Implements requirement 4.A of ARCHITECTURE.md: Strict USD/INR currency isolation enforcement
 * and user profile settings abstraction.
 */

import { ProfileRepository, Profile } from "@/repositories/profile-repository";
import { CacheService, CACHE_TTL } from "@/lib/cache-service";
import { ValidationError } from "@/lib/errors";

export class ProfileService {
  constructor(
    private readonly profileRepo: ProfileRepository,
    private readonly cacheService?: CacheService
  ) {}

  /**
   * Retrieves profile for user ID. Uses Cache-aside.
   */
  public async getProfile(userId: string): Promise<Profile | null> {
    const cacheKey = `user:${userId}:profile`;

    if (this.cacheService) {
      const cached = await this.cacheService.get<Profile>(cacheKey);
      if (cached) return cached;
    }

    const profile = await this.profileRepo.findByUserId(userId);

    if (profile && this.cacheService) {
      await this.cacheService.set(cacheKey, profile, CACHE_TTL.profile);
    }

    return profile;
  }

  /**
   * Updates user's base currency setting (INR or USD).
   * Enforces strict validation without illegal currency mixing.
   */
  public async updateBaseCurrency(userId: string, currency: "INR" | "USD"): Promise<Profile | null> {
    if (currency !== "INR" && currency !== "USD") {
      throw new ValidationError("Invalid base currency mode. Supported options are 'INR' and 'USD'.", {
        base_currency: "Currency must be either INR or USD.",
      });
    }

    const updated = await this.profileRepo.updateBaseCurrency(userId, currency);

    if (updated && this.cacheService) {
      await this.cacheService.delete(`user:${userId}:profile`);
    }

    return updated;
  }
}
