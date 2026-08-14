import { AccountRepository } from "@/repositories/account-repository";
import { DatabaseError } from "@/lib/errors";

describe("AccountRepository", () => {
  let mockSupabase: any;
  let repository: AccountRepository;

  function createQueryBuilder(result: { data: any; error: any }) {
    const builder: any = {
      select: jest.fn(() => builder),
      eq: jest.fn(() => builder),
      order: jest.fn(() => builder),
      range: jest.fn(() => builder),
      limit: jest.fn(() => builder),
      then: (onfulfilled: any) => Promise.resolve(result).then(onfulfilled),
    };
    return builder;
  }

  beforeEach(() => {
    mockSupabase = {
      from: jest.fn(),
    };
    repository = new AccountRepository(mockSupabase);
  });

  it("should query accounts by user_id", async () => {
    const mockAccounts = [
      { id: "acc_1", user_id: "user_1", name: "Savings", balance: 5000 },
      { id: "acc_2", user_id: "user_1", name: "Checking", balance: 2000 },
    ];
    const builder = createQueryBuilder({ data: mockAccounts, error: null });
    mockSupabase.from.mockReturnValue(builder);

    const results = await repository.findByUserId("user_1");

    expect(mockSupabase.from).toHaveBeenCalledWith("accounts");
    expect(builder.eq).toHaveBeenCalledWith("user_id", "user_1");
    expect(results).toEqual(mockAccounts);
  });

  it("should compute aggregate total balance across all active accounts", async () => {
    const mockAccounts = [
      { balance: "5000.50" },
      { balance: "2500.25" },
    ];
    const builder = createQueryBuilder({ data: mockAccounts, error: null });
    mockSupabase.from.mockReturnValue(builder);

    const total = await repository.getTotalBalance("user_1");

    expect(total).toBe(7500.75);
  });

  it("should throw DatabaseError on query failure", async () => {
    const builder = createQueryBuilder({ data: null, error: { message: "Connection error" } });
    mockSupabase.from.mockReturnValue(builder);

    await expect(repository.findByUserId("user_1")).rejects.toThrow(DatabaseError);
  });
});
