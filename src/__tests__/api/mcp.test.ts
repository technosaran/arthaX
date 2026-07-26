import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/mcp/route";

vi.mock("@supabase/supabase-js", () => {
  return {
    createClient: vi.fn(() => ({
      from: vi.fn((table: string) => {
        if (table === "accounts") {
          return {
            select: vi.fn().mockResolvedValue({
              data: [
                { id: "acc-1", name: "HDFC Bank", balance: "25000", currency: "INR", user_id: "u-1" },
              ],
              error: null,
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          };
        }
        if (table === "expenses" || table === "incomes" || table === "liabilities") {
          return {
            select: vi.fn().mockResolvedValue({ data: [], error: null }),
            insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        if (table === "transactions") {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: "tx-1", description: "Coffee", amount: "100", category: "Food" },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "ledger_logs") {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
            insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        return {
          select: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }),
    })),
  };
});

describe("MCP API Route", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mock.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "mock_key";
  });

  it("handles GET request to list tools", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.server).toContain("FinanceOS MCP");
    expect(body.tools).toContain("get_financial_overview");
  });

  it("executes get_financial_overview tool via POST", async () => {
    const req = new Request("http://localhost/api/mcp", {
      method: "POST",
      body: JSON.stringify({ name: "get_financial_overview" }),
    });

    const response = await POST(req);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.result.total_bank_balance).toBe(25000);
  });

  it("executes add_transaction tool via POST", async () => {
    const req = new Request("http://localhost/api/mcp", {
      method: "POST",
      body: JSON.stringify({
        name: "add_transaction",
        arguments: {
          type: "expense",
          amount: 150,
          description: "Coffee",
          category: "Food",
          account_name_or_id: "HDFC Bank",
        },
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.result.account_updated).toBe("HDFC Bank");
  });
});
