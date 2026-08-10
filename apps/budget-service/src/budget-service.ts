import { BudgetRepository, BudgetRecord } from "./budget-repository";
import { createServiceLogger } from "@finance-os/logger";

const logger = createServiceLogger("BudgetService");

export class BudgetService {
  constructor(private repo: BudgetRepository) {}

  public async getUserBudgets(userId: string): Promise<BudgetRecord[]> {
    logger.info({ userId }, "Fetching budgets for user");
    return this.repo.findByUserId(userId);
  }

  public async createBudget(userId: string, data: Partial<BudgetRecord>): Promise<BudgetRecord> {
    logger.info({ userId, category: data.category }, "Creating monthly budget");
    const now = new Date();
    return this.repo.create({
      userId,
      category: data.category || "General",
      amount: data.amount || 5000,
      periodMonth: data.periodMonth || now.getMonth() + 1,
      periodYear: data.periodYear || now.getFullYear(),
    });
  }
}
