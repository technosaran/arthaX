import { InvestmentService } from "@/services/investment-service";

describe("InvestmentService", () => {
  let mockRepo: any;
  let mockCache: any;
  let mockEventBus: any;
  let service: InvestmentService;

  beforeEach(() => {
    mockRepo = {
      findById: jest.fn(),
      findByUserId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      getPortfolioValue: jest.fn(),
    };
    mockCache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn(),
      delete: jest.fn(),
    };
    mockEventBus = {
      publish: jest.fn(),
    };
    service = new InvestmentService(mockRepo, mockCache, mockEventBus);
  });

  it("should fetch investment from cache if available", async () => {
    const cachedInv = { id: "inv_1", symbol: "TSLA" };
    mockCache.get.mockResolvedValueOnce(cachedInv);

    const result = await service.getInvestment("inv_1");

    expect(result).toEqual(cachedInv);
    expect(mockRepo.findById).not.toHaveBeenCalled();
  });

  it("should create investment, invalidate cache, and publish domain event", async () => {
    const newInv = { id: "inv_2", symbol: "GOOGL", quantity: 2, buy_price: 150 };
    mockRepo.create.mockResolvedValueOnce(newInv);

    const result = await service.createInvestment("user_1", {
      symbol: "GOOGL",
      quantity: 2,
      buy_price: 150,
    });

    expect(result).toEqual(newInv);
    expect(mockCache.delete).toHaveBeenCalledWith("user:user_1:portfolio-value");
    expect(mockEventBus.publish).toHaveBeenCalledWith("INVESTMENT_RECORDED", newInv, "user_1");
  });
});
