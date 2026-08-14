import { InvestmentRepository } from "@/repositories/investment-repository";
import { DatabaseError } from "@/lib/errors";

describe("InvestmentRepository", () => {
  let mockSupabase: any;
  let repository: InvestmentRepository;

  beforeEach(() => {
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      maybeSingle: jest.fn(),
    };
    repository = new InvestmentRepository(mockSupabase);
  });

  it("should find investment by user_id and symbol", async () => {
    const mockInvestment = { id: "inv_1", user_id: "user_1", symbol: "AAPL", quantity: 10, current_price: 150 };
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: mockInvestment, error: null });

    const result = await repository.findBySymbol("user_1", "AAPL");

    expect(mockSupabase.from).toHaveBeenCalledWith("investments");
    expect(mockSupabase.eq).toHaveBeenCalledWith("user_id", "user_1");
    expect(mockSupabase.eq).toHaveBeenCalledWith("symbol", "AAPL");
    expect(result).toEqual(mockInvestment);
  });

  it("should calculate total portfolio value (quantity * current_price)", async () => {
    const mockHoldings = [
      { quantity: 10, current_price: 150 }, // 1500
      { quantity: 5, current_price: 200 },  // 1000
    ];
    mockSupabase.eq.mockResolvedValueOnce({ data: mockHoldings, error: null });

    const portfolioValue = await repository.getPortfolioValue("user_1");

    expect(portfolioValue).toBe(2500);
  });

  it("should throw DatabaseError if supabase queries fail", async () => {
    mockSupabase.eq.mockResolvedValueOnce({ data: null, error: { message: "DB Error" } });

    await expect(repository.getPortfolioValue("user_1")).rejects.toThrow(DatabaseError);
  });
});
