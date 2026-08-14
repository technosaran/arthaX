import { GET } from "@/app/api/sync/route";
import { getDb } from "@/lib/db";

process.env.CRON_SECRET = "mock_secret";

// Mock drizzle and db
jest.mock("@/lib/db", () => {
  const mockDb: any = {
    selectDistinct: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    then: (onfulfilled: any) => Promise.resolve([]).then(onfulfilled),
    [Symbol.iterator]: [][Symbol.iterator],
    transaction: jest.fn().mockImplementation(async (callback) => {
      const tx = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        for: jest.fn().mockResolvedValue([
          { id: "acc-123", name: "Salary Account", balance: "5000", currency: "INR" }
        ]),
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        values: jest.fn().mockResolvedValue({}),
      };
      return callback(tx);
    }),
  };
  return {
    getDb: jest.fn().mockReturnValue(mockDb),
  };
});

jest.mock("@/app/dashboard/mutual-funds/actions", () => ({
  fetchLiveMFNAV: jest.fn().mockResolvedValue({ nav: 100, previousNav: 98 }),
}));

jest.mock("@/app/dashboard/stocks/actions", () => ({
  fetchLiveStockPrice: jest.fn().mockResolvedValue({ price: 1500, previousClose: 1480 }),
}));

describe("Sync API Route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("successfully parses GET request and processes recurring transactions", async () => {
    const db = getDb() as any;

    // Mock query chains for stocks, mutual funds, expenses, and incomes
    db.selectDistinct.mockReturnValue(db);
    db.select.mockReturnValue(db);
    db.from.mockReturnValue(db);
    db.where.mockImplementation((expr: any) => {
      // Return simulated active templates
      if (expr && expr.toString().includes("is_recurring = true")) {
        return [
          {
            id: "inc-123",
            user_id: "user-123",
            account_id: "acc-123",
            description: "Monthly Salary",
            amount: "1000",
            category: "Salary",
            is_recurring: true,
            recurrence_frequency: "daily",
            last_generated_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
          }
        ];
      }
      return []; // Return empty for other filters
    });

    const request = new Request("http://localhost/api/sync", {
      headers: {
        Authorization: "Bearer mock_secret"
      }
    });

    const response = await GET(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.incomes_generated).toBeGreaterThanOrEqual(0);
  });
});
