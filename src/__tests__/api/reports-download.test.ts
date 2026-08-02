import { Readable } from "stream";

// Hoisted mocks for dependencies
jest.mock("@/lib/supabase-server", () => ({
  createClient: jest.fn(),
}));

jest.mock("@react-pdf/renderer", () => ({
  renderToStream: jest.fn().mockImplementation(() => Promise.resolve(Readable.from("mock-pdf-stream"))),
}));

jest.mock("@/components/reports/FinancialStatementPDF", () => ({
  default: () => "MockPDFComponent",
}));

// Mock Repositories resolved from DI Container
const mockAccountRepo = {
  findAll: jest.fn().mockResolvedValue([
    { id: "acc-1", name: "Savings", balance: 15000, type: "savings", currency: "INR" }
  ])
};
const mockTransactionRepo = {
  findByDateRange: jest.fn().mockResolvedValue([
    { id: "tx-1", date: "2026-07-01", description: "Salary", amount: 10000, type: "income", category: "Salary", account_id: "acc-1" }
  ])
};

const mockContainer = {
  resolve: (key: string) => {
    if (key === "accountRepo") return mockAccountRepo;
    if (key === "transactionRepo") return mockTransactionRepo;
    return null;
  }
};

jest.mock("@/lib/container", () => ({
  createAppContainer: () => mockContainer
}));

import { GET } from "@/app/api/reports/download/route";
import { createClient } from "@/lib/supabase-server";

describe("Reports Download API Route", () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase = {
      auth: {
        getUser: jest.fn(),
      },
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
    };

    (createClient as jest.Mock).mockResolvedValue(mockSupabase as any);
  });

  it("returns 401 if user is not authenticated", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });

    const request = new Request("http://localhost/api/reports/download?month=7&year=2026");
    const response = await GET(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("successfully retrieves user statement report and returns PDF response", async () => {
    // Mock authenticated user
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "test@example.com" } }
    });

    // Mock profiles select query
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: { username: "john_doe" } })
            })
          })
        };
      }
      if (table === "liabilities") {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: [{ remaining_amount: "5000" }] })
          })
        };
      }
      // For fallback or other tables
      return {
        select: () => ({
          eq: () => Promise.resolve({ data: [] })
        })
      };
    });

    const request = new Request("http://localhost/api/reports/download?month=7&year=2026");
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toContain("Financial-Statement-July-2026.pdf");
  });

  it("returns FY CSV export with India tax summary pack", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "test@example.com" } }
    });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: { username: "john_doe" } })
            })
          })
        };
      }
      if (table === "liabilities") {
        return { select: () => ({ eq: () => Promise.resolve({ data: [{ remaining_amount: "5000", monthly_payment: "500" }] }) }) };
      }
      if (table === "incomes") {
        return { select: () => ({ eq: () => Promise.resolve({ data: [{ id: "i1", amount: "100000", category: "Salary", date: "2025-06-10" }] }) }) };
      }
      if (table === "expenses") {
        return { select: () => ({ eq: () => Promise.resolve({ data: [{ id: "e1", amount: "1000", category: "EPF", date: "2025-06-11" }] }) }) };
      }
      return {
        select: () => ({
          eq: () => Promise.resolve({ data: [] })
        })
      };
    });

    const request = new Request("http://localhost/api/reports/download?format=csv&fyStartYear=2025&modules=fy_tax_summary,ca_ready_bundle");
    const response = await GET(request);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/csv");
    expect(body).toContain("INDIA FY TAX SUMMARY");
    expect(body).toContain("CA READY AUDIT TRACE");
    expect(body).toContain("FY 2025-26");
  });
});
