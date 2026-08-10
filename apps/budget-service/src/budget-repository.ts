import { InMemoryRepository } from "@finance-os/db";

export interface BudgetRecord {
  id: string;
  userId: string;
  category: string;
  amount: number;
  periodMonth: number;
  periodYear: number;
}

export class BudgetRepository extends InMemoryRepository<BudgetRecord> {
  public async findByUserId(userId: string): Promise<BudgetRecord[]> {
    const all = await this.findAll();
    return all.filter((b) => b.userId === userId);
  }
}
