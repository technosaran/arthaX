import { AccountRepository, AccountRecord } from "./account-repository";
import { createServiceLogger } from "@finance-os/logger";

const logger = createServiceLogger("AccountService");

export class AccountService {
  constructor(private repo: AccountRepository) {}

  public async getUserAccounts(userId: string): Promise<AccountRecord[]> {
    logger.info({ userId }, "Fetching accounts for user");
    return this.repo.findByUserId(userId);
  }

  public async createAccount(userId: string, data: Partial<AccountRecord>): Promise<AccountRecord> {
    logger.info({ userId, name: data.name }, "Creating new account");
    return this.repo.create({
      userId,
      name: data.name || "Default Account",
      type: data.type || "CHECKING",
      balance: data.balance || 0,
      currency: data.currency || "INR",
    });
  }
}
