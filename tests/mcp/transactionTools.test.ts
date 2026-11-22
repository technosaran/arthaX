import { describe, it, expect, vi } from "vitest";
import { handleQueryTransactions } from "../../src/mcp/tools/transactions";
import {
  handleRecordExpense,
  handleRecordIncome,
  handleRecordTransfer,
} from "../../src/mcp/tools/recordAction";

describe("MCP Transaction Tools", () => {
  it("rejects non-positive transaction amounts", async () => {
    const mockDb = {} as any;
    await expect(
      handleRecordExpense(mockDb, "user-test", {
        accountId: "acc-1",
        amount: -50,
        category: "Food",
        title: "Lunch",
        date: "2026-11-22",
      })
    ).rejects.toThrow(/Amount must be greater than zero/);

    await expect(
      handleRecordIncome(mockDb, "user-test", {
        accountId: "acc-1",
        amount: 0,
        category: "Salary",
        title: "Bonus",
        date: "2026-11-22",
      })
    ).rejects.toThrow(/Amount must be greater than zero/);

    await expect(
      handleRecordTransfer(mockDb, "user-test", {
        fromAccountId: "acc-1",
        toAccountId: "acc-2",
        amount: -10,
        date: "2026-11-22",
      })
    ).rejects.toThrow(/Amount must be greater than zero/);
  });

  it("calls atomic RPC fn_record_expense_atomic with correct parameters", async () => {
    const rpcMock = vi.fn().mockResolvedValue({
      data: "exp-123",
      error: null,
    });
    const mockDb = { rpc: rpcMock } as any;

    const res = await handleRecordExpense(mockDb, "user-test", {
      accountId: "acc-1",
      amount: 450,
      category: "Food & Dining",
      title: "Swiggy Order",
      notes: "Dinner delivery",
      date: "2026-11-22",
    });

    expect(rpcMock).toHaveBeenCalledWith("fn_record_expense_atomic", {
      p_user_id: "user-test",
      p_account_id: "acc-1",
      p_amount: 450,
      p_category: "Food & Dining",
      p_title: "Swiggy Order",
      p_notes: "Dinner delivery",
      p_expense_date: "2026-11-22",
      p_tags: [],
    });
    expect(res).toHaveProperty("success", true);
  });

  it("calls atomic RPC fn_record_income_atomic with correct parameters", async () => {
    const rpcMock = vi.fn().mockResolvedValue({
      data: "inc-123",
      error: null,
    });
    const mockDb = { rpc: rpcMock } as any;

    const res = await handleRecordIncome(mockDb, "user-test", {
      accountId: "acc-1",
      amount: 150000,
      category: "Salary",
      title: "Monthly Salary",
      notes: "Tech Corp",
      date: "2026-11-22",
    });

    expect(rpcMock).toHaveBeenCalledWith("fn_record_income_atomic", {
      p_user_id: "user-test",
      p_account_id: "acc-1",
      p_amount: 150000,
      p_category: "Salary",
      p_title: "Monthly Salary",
      p_received_date: "2026-11-22",
      p_frequency: "ONE_TIME",
      p_notes: "Tech Corp",
      p_tags: [],
    });
    expect(res).toHaveProperty("success", true);
  });

  it("calls atomic RPC fn_record_transfer_atomic with correct parameters", async () => {
    const rpcMock = vi.fn().mockResolvedValue({
      data: "xfer-123",
      error: null,
    });
    const mockDb = { rpc: rpcMock } as any;

    const res = await handleRecordTransfer(mockDb, "user-test", {
      fromAccountId: "acc-1",
      toAccountId: "acc-2",
      amount: 10000,
      notes: "Emergency Fund Topup",
      date: "2026-11-22",
    });

    expect(rpcMock).toHaveBeenCalledWith("fn_record_transfer_atomic", {
      p_user_id: "user-test",
      p_from_account_id: "acc-1",
      p_to_account_id: "acc-2",
      p_amount: 10000,
      p_transfer_date: "2026-11-22",
      p_notes: "Emergency Fund Topup",
    });
    expect(res).toHaveProperty("success", true);
  });

  it("queries transactions with filtering and pagination", async () => {
    const mockDb = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [
            { id: "e1", title: "Coffee", amount: 250, category: "Food", date: "2026-11-22", account_id: "acc-1" },
          ],
          error: null,
        }),
      })),
    } as any;

    const res: any = await handleQueryTransactions(mockDb, "user-test", {
      type: "expense",
      limit: 10,
    });

    expect(res).toBeDefined();
    expect(res.transactions).toHaveLength(1);
    expect(res.transactions[0].title).toBe("Coffee");
  });
});
