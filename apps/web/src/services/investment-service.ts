/**
 * Investment Service Layer.
 * Implements requirement 2.6 & ADR 001: Separate investment & portfolio business logic from database.
 */

import { InvestmentRepository, Investment } from "@/repositories/investment-repository";
import { CacheService, CACHE_TTL } from "@/lib/cache-service";
import { DomainEventBus } from "@/lib/domain-event-bus";

export interface CreateInvestmentInput {
  symbol: string;
  name?: string;
  asset_type?: string;
  quantity: number | string;
  buy_price: number | string;
  current_price?: number | string;
  currency?: string;
}

export class InvestmentService {
  constructor(
    private readonly investmentRepo: InvestmentRepository,
    private readonly cacheService?: CacheService,
    private readonly eventBus?: DomainEventBus
  ) {}

  /**
   * Fetches an investment by ID. Uses Cache-aside.
   */
  public async getInvestment(id: string): Promise<Investment | null> {
    const cacheKey = `investment:${id}`;

    if (this.cacheService) {
      const cached = await this.cacheService.get<Investment>(cacheKey);
      if (cached) return cached;
    }

    const investment = await this.investmentRepo.findById(id);

    if (investment && this.cacheService) {
      await this.cacheService.set(cacheKey, investment, CACHE_TTL.accountSummary);
    }

    return investment;
  }

  /**
   * Fetches all investments for a user.
   */
  public async getUserInvestments(userId: string): Promise<Investment[]> {
    return this.investmentRepo.findByUserId(userId);
  }

  /**
   * Creates a new investment record and emits domain event. Invalidates portfolio cache.
   */
  public async createInvestment(userId: string, data: CreateInvestmentInput): Promise<Investment> {
    const parsedQty = typeof data.quantity === "number" ? data.quantity : parseFloat(data.quantity || "0");
    const parsedBuyPrice = typeof data.buy_price === "number" ? data.buy_price : parseFloat(data.buy_price || "0");
    const parsedCurrentPrice = data.current_price !== undefined
      ? (typeof data.current_price === "number" ? data.current_price : parseFloat(data.current_price))
      : parsedBuyPrice;

    const investment = await this.investmentRepo.create({
      ...data,
      quantity: isNaN(parsedQty) ? 0 : parsedQty,
      buy_price: isNaN(parsedBuyPrice) ? 0 : parsedBuyPrice,
      current_price: isNaN(parsedCurrentPrice) ? 0 : parsedCurrentPrice,
      user_id: userId,
    });

    await this.invalidateUserCache(userId);

    if (this.eventBus) {
      await this.eventBus.publish("INVESTMENT_RECORDED", investment, userId);
    }

    return investment;
  }

  /**
   * Updates an investment. Invalidates caches and emits event.
   */
  public async updateInvestment(id: string, userId: string, data: Partial<Investment>): Promise<Investment | null> {
    const updated = await this.investmentRepo.update(id, data);

    if (updated) {
      if (this.cacheService) {
        await this.cacheService.delete(`investment:${id}`);
      }
      await this.invalidateUserCache(userId);

      if (this.eventBus) {
        await this.eventBus.publish("INVESTMENT_UPDATED", updated, userId);
      }
    }

    return updated;
  }

  /**
   * Deletes an investment. Invalidates caches.
   */
  public async deleteInvestment(id: string, userId: string): Promise<boolean> {
    const deleted = await this.investmentRepo.delete(id);

    if (deleted) {
      if (this.cacheService) {
        await this.cacheService.delete(`investment:${id}`);
      }
      await this.invalidateUserCache(userId);
    }

    return deleted;
  }

  /**
   * Calculates total aggregated portfolio value. Uses Cache-aside.
   */
  public async getPortfolioValue(userId: string): Promise<number> {
    const cacheKey = `user:${userId}:portfolio-value`;

    if (this.cacheService) {
      const cached = await this.cacheService.get<number>(cacheKey);
      if (cached !== null) return cached;
    }

    const value = await this.investmentRepo.getPortfolioValue(userId);

    if (this.cacheService) {
      await this.cacheService.set(cacheKey, value, CACHE_TTL.accountSummary);
    }

    return value;
  }

  /**
   * Invalidates caches for user's portfolio.
   */
  private async invalidateUserCache(userId: string): Promise<void> {
    if (this.cacheService) {
      await this.cacheService.delete(`user:${userId}:portfolio-value`);
    }
  }
}
