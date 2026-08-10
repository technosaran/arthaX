import { InvestmentRepository } from "./investment-repository";
import { InvestmentService } from "./investment-service";

export class InvestmentServiceContainer {
  private static instance: InvestmentServiceContainer | null = null;
  public investmentRepo: InvestmentRepository;
  public investmentService: InvestmentService;

  private constructor() {
    this.investmentRepo = new InvestmentRepository();
    this.investmentService = new InvestmentService(this.investmentRepo);
  }

  public static getInstance(): InvestmentServiceContainer {
    if (!InvestmentServiceContainer.instance) {
      InvestmentServiceContainer.instance = new InvestmentServiceContainer();
    }
    return InvestmentServiceContainer.instance;
  }
}
