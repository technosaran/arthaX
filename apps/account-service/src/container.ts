import { AccountRepository } from "./account-repository";
import { AccountService } from "./account-service";

export class AccountServiceContainer {
  private static instance: AccountServiceContainer | null = null;
  public accountRepo: AccountRepository;
  public accountService: AccountService;

  private constructor() {
    this.accountRepo = new AccountRepository();
    this.accountService = new AccountService(this.accountRepo);
  }

  public static getInstance(): AccountServiceContainer {
    if (!AccountServiceContainer.instance) {
      AccountServiceContainer.instance = new AccountServiceContainer();
    }
    return AccountServiceContainer.instance;
  }
}
