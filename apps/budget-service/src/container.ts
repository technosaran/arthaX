import { BudgetRepository } from "./budget-repository";
import { BudgetService } from "./budget-service";

export class BudgetServiceContainer {
  private static instance: BudgetServiceContainer | null = null;
  public budgetRepo: BudgetRepository;
  public budgetService: BudgetService;

  private constructor() {
    this.budgetRepo = new BudgetRepository();
    this.budgetService = new BudgetService(this.budgetRepo);
  }

  public static getInstance(): BudgetServiceContainer {
    if (!BudgetServiceContainer.instance) {
      BudgetServiceContainer.instance = new BudgetServiceContainer();
    }
    return BudgetServiceContainer.instance;
  }
}
