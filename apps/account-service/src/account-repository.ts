import { InMemoryRepository } from "@finance-os/db";

export interface AccountRecord {
  id: string;
  userId: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
}

export class AccountRepository extends InMemoryRepository<AccountRecord> {
  public async findByUserId(userId: string): Promise<AccountRecord[]> {
    const all = await this.findAll();
    return all.filter((acc) => acc.userId === userId);
  }
}
