import { describe, it, expect, vi } from "vitest";
import { handleGetNetWorth } from "../../src/mcp/tools/netWorth";
import { handleListAccounts } from "../../src/mcp/tools/accounts";
import { handleGetHoldings } from "../../src/mcp/tools/holdings";
import { handleGetBudgets } from "../../src/mcp/tools/budgets";
import { handleGetForecast } from "../../src/mcp/tools/forecast";

describe("MCP Read Tools", () => {
  it("calculates net worth using embedded calculation engine", async () => {
    const mockDb = {
      from: vi.fn((table: string) => {
        const queryBuilder: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockImplementation(() => {
            if (table === "accounts") {
              return Promise.resolve({
                data: [
                  { id: "acc-1", name: "HDFC Savings", balance: 100000, type: "SAVINGS", classification: "asset" },
                  { id: "acc-2", name: "ICICI Credit Card", balance: 25000, type: "CREDIT", classification: "liability" },
                ],
                error: null,
              });
            }
            if (table === "stock_holdings") {
              return Promise.resolve({
                data: [{ symbol: "RELIANCE", quantity: 10, current_price: 2500, avg_buy_price: 2400 }],
                error: null,
              });
            }
            if (table === "mutual_fund_holdings") {
              return Promise.resolve({
                data: [{ scheme_name: "Parag Parikh Flexi Cap", units: 100, current_nav: 75, avg_nav: 60, invested_amount: 6000 }],
                error: null,
              });
            }
            return Promise.resolve({ data: [], error: null });
          }),
        };
        return queryBuilder;
      }),
    } as any;

    const result = await handleGetNetWorth(mockDb, "user-test", "INR");
    expect(result).toHaveProperty("totalNetWorth");
    expect(result).toHaveProperty("liquidCash", 100000);
    expect(result).toHaveProperty("totalLiabilities", 25000);
    expect(result).toHaveProperty("stocksValuation", 25000);
    expect(result).toHaveProperty("mutualFundsValuation", 7500);
    expect(result.totalNetWorth).toBe(107500);
  });

  it("lists accounts respecting archived filter", async () => {
    const mockDb = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({
          data: [
            { id: "acc-1", name: "Axis Bank", balance: 50000, type: "SAVINGS", is_active: true, archived_at: null },
          ],
          error: null,
        }),
      })),
    } as any;

    const res: any = await handleListAccounts(mockDb, "user-test", false);
    expect(res).toBeDefined();
    expect(res.accounts).toHaveLength(1);
    expect(res.accounts[0].name).toBe("Axis Bank");
  });

  it("retrieves holdings across multiple asset classes", async () => {
    const mockDb = {
      from: vi.fn((table: string) => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: table === "stock_holdings"
            ? [{ symbol: "TCS", quantity: 5, current_price: 3500 }]
            : [],
          error: null,
        }),
      })),
    } as any;

    const res: any = await handleGetHoldings(mockDb, "user-test", "stocks");
    expect(res).toBeDefined();
    expect(res.stocks).toHaveLength(1);
    expect(res.stocks[0].symbol).toBe("TCS");
  });

  it("retrieves budgets with spending calculations", async () => {
    const mockDb = {
      from: vi.fn((table: string) => {
        if (table === "budgets") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: [{ id: "b1", category: "Dining", monthly_limit: 15000 }],
              error: null,
            }),
          };
        }
        if (table === "expenses") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            lte: vi.fn().mockResolvedValue({
              data: [{ id: "e1", category: "Dining", amount: 6500 }],
              error: null,
            }),
          };
        }
        return {} as any;
      }),
    } as any;

    const res: any = await handleGetBudgets(mockDb, "user-test", "2026-11");
    expect(res).toBeDefined();
    expect(res.budgets).toHaveLength(1);
    expect(res.budgets[0].spent).toBe(6500);
    expect(res.budgets[0].remaining).toBe(8500);
  });

  it("calculates runway and cash flow forecast", async () => {
    const mockDb = {
      from: vi.fn((table: string) => {
        if (table === "accounts") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockResolvedValue({
              data: [{ id: "a1", balance: 200000, classification: "asset" }],
              error: null,
            }),
          };
        }
        if (table === "expenses") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gte: vi.fn().mockResolvedValue({
              data: [{ amount: 40000 }, { amount: 10000 }],
              error: null,
            }),
          };
        }
        if (table === "recurring_rules") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: [{ type: "EXPENSE", amount: 15000, is_active: true }],
              error: null,
            }),
          };
        }
        return {} as any;
      }),
    } as any;

    const res: any = await handleGetForecast(mockDb, "user-test", 3);
    expect(res).toHaveProperty("currentLiquidCash", 200000);
    expect(res).toHaveProperty("estimatedMonthlyBurn");
    expect(res).toHaveProperty("runwayMonths");
  });
});
