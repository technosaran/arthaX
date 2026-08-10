import { InvestmentRepository, InvestmentRecord } from "./investment-repository";
import { createServiceLogger } from "@finance-os/logger";

const logger = createServiceLogger("InvestmentService");

export class InvestmentService {
  constructor(private repo: InvestmentRepository) {}

  public async getUserInvestments(userId: string): Promise<InvestmentRecord[]> {
    logger.info({ userId }, "Fetching investments for user");
    return this.repo.findByUserId(userId);
  }

  public async addInvestment(userId: string, data: Partial<InvestmentRecord>): Promise<InvestmentRecord> {
    logger.info({ userId, symbol: data.symbol }, "Adding investment asset");
    return this.repo.create({
      userId,
      name: data.name || "Asset",
      type: data.type || "STOCK",
      symbol: data.symbol || "UNKNOWN",
      quantity: data.quantity || 1,
      buyPrice: data.buyPrice || 100,
      currentPrice: data.currentPrice || 105,
    });
  }
}
