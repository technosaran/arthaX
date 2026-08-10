import { InMemoryRepository } from "@finance-os/db";

export interface InvestmentRecord {
  id: string;
  userId: string;
  name: string;
  type: "STOCK" | "MUTUAL_FUND" | "CRYPTO" | "BOND";
  symbol?: string;
  quantity: number;
  buyPrice: number;
  currentPrice: number;
}

export class InvestmentRepository extends InMemoryRepository<InvestmentRecord> {
  public async findByUserId(userId: string): Promise<InvestmentRecord[]> {
    const all = await this.findAll();
    return all.filter((inv) => inv.userId === userId);
  }
}
