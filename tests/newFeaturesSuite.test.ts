import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/utils/auth";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { GET as exportGet } from "@/app/api/v1/workspace/export/route";
import { GET as reconciliationGet, POST as reconciliationPost } from "@/app/api/v1/reconciliation/dashboard/route";
import { GET as forecastGet } from "@/app/api/v1/forecast/cashflow/route";
import { POST as rulesPost, DELETE as rulesDelete } from "@/app/api/v1/transactions/rules/route";

vi.mock("@/utils/auth", () => ({
  getAuthenticatedUser: vi.fn(),
}));

vi.mock("@/utils/supabase/admin", () => ({
  supabaseAdmin: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

vi.mock("@/utils/transfers", () => ({
  reconcileInternalTransfers: vi.fn().mockResolvedValue({
    transfersReconciled: 2,
    expensesCleaned: 2,
    incomeCleaned: 2,
  }),
}));

vi.mock("@/lib/backend/cacheInvalidation", () => ({
  invalidateUserCaches: vi.fn().mockResolvedValue(true),
}));

describe("ArthaX Production Re-Engineering: New Financial Features Suite", () => {
  const mockedAuth = vi.mocked(getAuthenticatedUser);
  const mockedSupabase = vi.mocked(supabaseAdmin);
  const testUserId = "user-finance-audit-123";

  beforeEach(() => {
    vi.clearAllMocks();
    mockedAuth.mockResolvedValue({
      user: { id: testUserId, email: "finance@arthax.test" } as any,
      userId: testUserId,
      error: null,
    });
  });

  // =========================================================================
  // 1. WORKSPACE EXPORT & RECOVERY
  // =========================================================================
  describe("Workspace Data Export & Recovery (/api/v1/workspace/export)", () => {
    it("exports complete JSON tenant data bundle scoped strictly to authenticated user", async () => {
      mockedSupabase.from.mockImplementation((table: string) => {
        const queryBuilder: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockImplementation((col: string, val: string) => {
            expect(col).toBe("user_id");
            expect(val).toBe(testUserId);
            return queryBuilder;
          }),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          then: vi.fn((resolve) => {
            if (table === "accounts") {
              resolve({
                data: [
                  { id: "acc-1", name: "HDFC Savings", type: "SAVINGS", balance: 50000 },
                ],
                error: null,
              });
            } else if (table === "expenses") {
              resolve({
                data: [
                  { id: "exp-1", expense_date: "2026-11-20", title: "Cloud Hosting", amount: 1200, category: "Tech" },
                ],
                error: null,
              });
            } else {
              resolve({ data: [], error: null });
            }
          }),
        };
        return queryBuilder;
      });

      const req = new NextRequest("https://arthax.vercel.app/api/v1/workspace/export?format=json");
      const res = await exportGet(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.metadata.user_id).toBe(testUserId);
      expect(json.data.accounts).toHaveLength(1);
      expect(json.data.accounts[0].name).toBe("HDFC Savings");
      expect(json.data.expenses[0].amount).toBe(1200);
    });

    it("exports standard CSV format with correct Content-Type and Disposition headers", async () => {
      mockedSupabase.from.mockImplementation((table: string) => {
        const queryBuilder: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          then: vi.fn((resolve) => {
            if (table === "expenses") {
              resolve({
                data: [
                  { id: "exp-1", expense_date: "2026-11-20", title: "Office Supplies", category: "Office", amount: 450, account_id: "acc-1", merchant: "Amazon", notes: "Stationery" },
                ],
                error: null,
              });
            } else {
              resolve({ data: [], error: null });
            }
          }),
        };
        return queryBuilder;
      });

      const req = new NextRequest("https://arthax.vercel.app/api/v1/workspace/export?format=csv&entity=expenses");
      const res = await exportGet(req);
      const text = await res.text();

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/csv");
      expect(res.headers.get("content-disposition")).toContain("attachment; filename=");
      expect(text).toContain("=== EXPENSES ===");
      expect(text).toContain("Office Supplies");
      expect(text).toContain("Amazon");
    });
  });

  // =========================================================================
  // 2. FINANCIAL RECONCILIATION DASHBOARD
  // =========================================================================
  describe("Financial Reconciliation Dashboard (/api/v1/reconciliation/dashboard)", () => {
    it("computes accounting balance invariants, duplicate detection, and reversal pairs", async () => {
      mockedSupabase.from.mockImplementation((table: string) => {
        const queryBuilder: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          then: vi.fn((resolve) => {
            if (table === "accounts") {
              resolve({
                data: [
                  { id: "acc-1", name: "HDFC Salary", type: "SAVINGS", balance: 100000, last_four: "1234", is_active: true },
                ],
                error: null,
              });
            } else if (table === "bank_statements") {
              resolve({
                data: [
                  {
                    id: "stmt-1",
                    account_id: "acc-1",
                    bank_name: "HDFC",
                    period_start: "2026-10-01",
                    period_end: "2026-10-31",
                    opening_balance: 50000,
                    closing_balance: 100000,
                    total_credits: 70000,
                    total_debits: 20000,
                    reconciliation_status: "RECONCILED",
                  },
                ],
                error: null,
              });
            } else if (table === "canonical_transactions") {
              resolve({
                data: [
                  {
                    id: "tx-1",
                    account_id: "acc-1",
                    transaction_date: "2026-10-15",
                    amount: 500,
                    direction: "DEBIT",
                    original_narration: "SWIGGY BANGALORE",
                    normalized_narration: "SWIGGY BANGALORE",
                    transaction_reference: "REF101",
                    category: "Food",
                    is_transfer: false,
                  },
                  {
                    id: "tx-2",
                    account_id: "acc-1",
                    transaction_date: "2026-10-15",
                    amount: 500,
                    direction: "DEBIT",
                    original_narration: "SWIGGY BANGALORE",
                    normalized_narration: "SWIGGY BANGALORE",
                    transaction_reference: "REF102",
                    category: "Food",
                    is_transfer: false,
                  },
                  {
                    id: "tx-rev-dr",
                    account_id: "acc-1",
                    transaction_date: "2026-10-20",
                    amount: 2500,
                    direction: "DEBIT",
                    original_narration: "AMAZON PURCHASE",
                    normalized_narration: "AMAZON PURCHASE",
                    transaction_reference: "AMZ1",
                    category: "Shopping",
                    is_transfer: false,
                  },
                  {
                    id: "tx-rev-cr",
                    account_id: "acc-1",
                    transaction_date: "2026-10-22",
                    amount: 2500,
                    direction: "CREDIT",
                    original_narration: "AMAZON REFUND",
                    normalized_narration: "AMAZON REFUND",
                    transaction_reference: "AMZ2",
                    category: "Refund",
                    is_transfer: false,
                  },
                ],
                error: null,
              });
            } else {
              resolve({ data: [], error: null });
            }
          }),
        };
        return queryBuilder;
      });

      const req = new NextRequest("https://arthax.vercel.app/api/v1/reconciliation/dashboard");
      const res = await reconciliationGet(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      // Math check: 50000 + 70000 - 20000 = 100000 => Statement invariant holds
      expect(json.data.summary.reconciled_statements).toBe(1);
      // Account balance matches closing balance (100000 === 100000) => Account invariant holds
      expect(json.data.summary.reconciled_accounts).toBe(1);
      // Duplicate detection flags tx-2 as suspected duplicate of tx-1
      expect(json.data.duplicates.length).toBeGreaterThanOrEqual(1);
      expect(json.data.duplicates[0].narration).toBe("SWIGGY BANGALORE");
      // Reversal pair matched for AMAZON PURCHASE and AMAZON REFUND
      expect(json.data.reversals.length).toBeGreaterThanOrEqual(1);
      expect(json.data.reversals[0].amount).toBe(2500);
    });

    it("triggers internal transfer reconciliation via POST", async () => {
      const req = new NextRequest("https://arthax.vercel.app/api/v1/reconciliation/dashboard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "TRIGGER_TRANSFER_RECONCILIATION",
        }),
      });

      const res = await reconciliationPost(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.transfers_matched).toBe(2);
    });
  });

  // =========================================================================
  // 3. CASH-FLOW FORECASTING & EMERGENCY RUNWAY
  // =========================================================================
  describe("Cash-Flow Forecasting & Runway (/api/v1/forecast/cashflow)", () => {
    it("calculates deterministic scenarios across 30, 60, 90, 180, and 365 day horizons", async () => {
      mockedSupabase.from.mockImplementation((table: string) => {
        const queryBuilder: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          then: vi.fn((resolve) => {
            if (table === "accounts") {
              resolve({
                data: [
                  { id: "acc-1", name: "Savings", type: "SAVINGS", classification: "ASSET", balance: 300000, is_active: true },
                  { id: "acc-2", name: "Credit Card", type: "CREDIT_CARD", classification: "LIABILITY", balance: 25000, is_active: true },
                ],
                error: null,
              });
            } else if (table === "expenses") {
              // 90 days total expenses = 150000 => monthly burn = 50000
              resolve({
                data: [
                  { amount: 50000, category: "Rent", expense_date: "2026-10-01" },
                  { amount: 50000, category: "Rent", expense_date: "2026-09-01" },
                  { amount: 50000, category: "Rent", expense_date: "2026-08-01" },
                ],
                error: null,
              });
            } else if (table === "income") {
              // 90 days total income = 240000 => monthly income = 80000
              resolve({
                data: [
                  { amount: 80000, category: "Salary", received_date: "2026-10-01" },
                  { amount: 80000, category: "Salary", received_date: "2026-09-01" },
                  { amount: 80000, category: "Salary", received_date: "2026-08-01" },
                ],
                error: null,
              });
            } else {
              resolve({ data: [], error: null });
            }
          }),
        };
        return queryBuilder;
      });

      const req = new NextRequest("https://arthax.vercel.app/api/v1/forecast/cashflow");
      const res = await forecastGet(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.current_liquidity.total_liquid_cash).toBe(300000);
      expect(json.data.current_liquidity.total_liabilities).toBe(25000);
      expect(json.data.current_liquidity.net_liquid_reserve).toBe(275000);

      // Monthly burn is 50,000 => Emergency runway with 300,000 liquid cash = 6.0 months
      expect(json.data.emergency_runway.months).toBe(6);
      expect(json.data.emergency_runway.status).toBe("HEALTHY");

      // Scenarios must cover 30, 60, 90, 180, 365 days
      expect(json.data.projections).toHaveLength(5);

      const thirtyDayBase = json.data.projections[0];
      expect(thirtyDayBase.days).toBe(30);
      // Net monthly savings is 80,000 - 50,000 = 30,000; for 30 days (30 / 30.4167 mo) => 329,589.69
      expect(thirtyDayBase.base_case_balance).toBeCloseTo(329589.69, 1);
    });
  });

  // =========================================================================
  // 4. TRANSACTION INTELLIGENCE FEEDBACK
  // =========================================================================
  describe("Transaction Intelligence Rules (/api/v1/transactions/rules)", () => {
    it("creates a new user classification rule and applies it retrospectively", async () => {
      mockedSupabase.from.mockImplementation(() => {
        const queryBuilder: any = {
          upsert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: "rule-1",
              user_id: testUserId,
              match_field: "NARATION_CONTAINS",
              match_pattern: "SWIGGY",
              assigned_category: "Dining",
              assigned_type: "EXPENSE",
            },
            error: null,
          }),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          ilike: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
        return queryBuilder;
      });

      const req = new NextRequest("https://arthax.vercel.app/api/v1/transactions/rules", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          match_field: "NARATION_CONTAINS",
          match_pattern: "SWIGGY",
          assigned_category: "Dining",
          assigned_type: "EXPENSE",
        }),
      });

      const res = await rulesPost(req);
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.success).toBe(true);
      expect(json.data.match_pattern).toBe("SWIGGY");
      expect(json.data.assigned_category).toBe("Dining");
    });

    it("deletes a user classification rule cleanly with user_id scoping", async () => {
      mockedSupabase.from.mockImplementation(() => {
        const queryBuilder: any = {
          delete: vi.fn().mockReturnThis(),
          eq: vi.fn().mockImplementation((col: string, val: string) => {
            if (col === "user_id") expect(val).toBe(testUserId);
            if (col === "id") expect(val).toBe("rule-1");
            return queryBuilder;
          }),
          then: vi.fn((resolve) => resolve({ error: null })),
        };
        return queryBuilder;
      });

      const req = new NextRequest("https://arthax.vercel.app/api/v1/transactions/rules?id=rule-1", {
        method: "DELETE",
      });

      const res = await rulesDelete(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.deleted).toBe(true);
    });
  });
});
