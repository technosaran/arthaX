import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { parseExpenseMessage, matchAccount, AccountSummary } from "@/utils/expenseParser";
import { classifyFinancialMessage } from "@/utils/financeParser";

describe("Financial Parser & Automation Overhaul Suite", () => {
  const accounts: AccountSummary[] = [
    { id: "acc-hdfc-bank", name: "HDFC Salary", type: "Savings", balance: 150000, last_four: "1234" },
    { id: "acc-hdfc-card", name: "HDFC Regalia Card", type: "Credit Card", balance: 25000, last_four: "9988" },
    { id: "acc-sbi-bank", name: "SBI Savings", type: "Savings", balance: 85000, last_four: "5678" },
    { id: "acc-cash", name: "Cash in Hand", type: "Liquid Cash", balance: 3000, last_four: null },
  ];

  describe("Indian Number Grouping & Shorthand Parsing", () => {
    it("parses Indian lakh and crore comma-grouped INR amounts accurately", () => {
      const lakhRes = parseExpenseMessage("Paid ₹1,25,000.50 for Macbook on HDFC Regalia Card", accounts);
      expect(lakhRes.amount).toBe(125000.5);
      expect(lakhRes.accountQuery).toBe("HDFC Regalia Card");

      const croreRes = parseExpenseMessage("Spent Rs. 12,34,567 on HDFC Salary", accounts);
      expect(croreRes.amount).toBe(1234567);
    });

    it("handles lakh shorthand like 1.5L and 2.5 lakh", () => {
      const res = parseExpenseMessage("Paid 1.5L for furniture on SBI", accounts);
      expect(res.amount).toBe(150000);
      expect(res.accountQuery).toBe("SBI Savings");
    });
  });

  describe("Keyword Collision Fixes & Indian Bank SMS Parsing", () => {
    it("does not misclassify 'learned' as income keyword 'earned'", () => {
      const res = classifyFinancialMessage("Learned a great budgeting trick today?", accounts);
      expect(res.type).toBe("unknown");
    });

    it("separates mobile recharge utility bills from smartphone hardware purchases", () => {
      const bill = parseExpenseMessage("Airtel mobile recharge 799 on HDFC", accounts);
      expect(bill.category).toBe("Utilities & Bills");

      const phone = parseExpenseMessage("Bought new smartphone 45,000 Croma on HDFC Card", accounts);
      expect(phone.category).toBe("Electronics & Gadgets");
      expect(phone.accountQuery).toBe("HDFC Regalia Card");
    });

    it("does not mistake SIP auto debit for Transport & Fuel", () => {
      const sip = parseExpenseMessage("Auto debit Mutual Fund SIP Rs. 5,000 on HDFC", accounts);
      expect(sip.category).toBe("Investments & Wealth");
    });

    it("extracts HDFC Card SMS metadata including amount, merchant, RRN, date, and card disambiguation", () => {
      const sms =
        "INR 2,450.00 spent on HDFC Bank Card XX9988 at ZEPTO MARKET on 18-Nov-26. Ref 631982736122. Avl Bal Rs 22,550.";
      const parsed = parseExpenseMessage(sms, accounts);

      expect(parsed.amount).toBe(2450);
      expect(parsed.accountQuery).toBe("HDFC Regalia Card");
      expect(parsed.category).toBe("Groceries & Essentials");
      expect(parsed.title).toBe("Zepto Market");
      expect(parsed.reference).toBe("631982736122");
      expect(parsed.parsedDate).toBe("2026-11-18");
      expect(parsed.channel).toBe("CARD");
    });

    it("classifies credit card bill payments between accounts as transfers", () => {
      const intent = classifyFinancialMessage(
        "Pay HDFC Regalia Card bill 18,500 from SBI Savings",
        accounts
      );
      expect(intent.type).toBe("transfer");
      if (intent.type === "transfer") {
        expect(intent.data.amount).toBe(18500);
        expect(matchAccount(intent.data.fromAccountQuery, accounts)?.id).toBe("acc-sbi-bank");
        expect(matchAccount(intent.data.toAccountQuery, accounts)?.id).toBe("acc-hdfc-card");
      }
    });
  });

  describe("Recurring Automation Idempotency & Status Telemetry", () => {
    beforeEach(() => {
      vi.resetModules();
      vi.clearAllMocks();
    });

    it("skips duplicate recurring rule execution within the same idempotency cycle", async () => {
      const rpcMock = vi.fn().mockResolvedValue({ error: null });
      const checkIdempMock = vi
        .fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      vi.doMock("@/utils/supabase/admin", () => ({
        supabaseAdmin: {
          from: vi.fn().mockImplementation((table: string) => {
            if (table === "recurring_rules") {
              return {
                select: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    lte: vi.fn().mockResolvedValue({
                      data: [
                        {
                          id: "rule-1",
                          user_id: "user-1",
                          title: "Netflix",
                          flow_type: "expense",
                          amount: 649,
                          category: "Subscriptions & Software",
                          frequency: "monthly",
                          next_run_date: "2026-11-01",
                          is_active: true,
                        },
                      ],
                      error: null,
                    }),
                  }),
                }),
                update: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({ error: null }),
                  }),
                }),
              };
            }
            return {
              insert: vi.fn().mockResolvedValue({ error: null }),
            };
          }),
          rpc: rpcMock,
        },
      }));

      vi.doMock("@/utils/rateLimit", () => ({
        checkAndSetIdempotency: checkIdempMock,
        releaseIdempotency: vi.fn().mockResolvedValue(undefined),
      }));

      vi.doMock("@/lib/backend/cacheInvalidation", () => ({
        invalidateUserCaches: vi.fn().mockResolvedValue(undefined),
      }));

      const { runRecurringJobs } = await import("@/utils/recurringJobs");

      const first = await runRecurringJobs();
      const second = await runRecurringJobs();

      expect(first.processed).toBe(1);
      expect(second.processed).toBe(0);
      expect(second.skippedIdempotent).toBe(1);
      expect(rpcMock).toHaveBeenCalledTimes(1);
    });

    it("returns full dynamic bank list and recurring/pending queue telemetry in /api/v1/automation/status", async () => {
      vi.doMock("@/utils/auth", () => ({
        getAuthenticatedUser: vi.fn().mockResolvedValue({
          user: { id: "user-1" },
          userId: "user-1",
          error: null,
        }),
      }));

      vi.doMock("@/utils/rateLimit", () => ({
        rateLimit: vi.fn().mockResolvedValue({ success: true }),
      }));

      vi.doMock("@/utils/supabase/admin", () => ({
        supabaseAdmin: {
          from: vi.fn().mockImplementation((table: string) => ({
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data:
                      table === "recurring_rules"
                        ? [{ id: "r1", title: "Rent", amount: 25000, frequency: "monthly", next_run_date: "2026-12-01", is_active: true }]
                        : table === "statement_attachment_jobs"
                        ? [{ id: "j1", file_name: "hdfc.pdf", detected_bank: "HDFC", status: "FAILED", error_code: "PASSWORD_REQUIRED" }]
                        : [],
                    count: 0,
                    error: null,
                  }),
                }),
                then: (resolve: (v: { data: never[]; error: null }) => void) =>
                  resolve({ data: [], error: null }),
              }),
            }),
          })),
        },
      }));

      const { GET } = await import("@/app/api/v1/automation/status/route");
      const req = new NextRequest("http://localhost:3000/api/v1/automation/status");
      const res = await GET(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.automation.statements.supportedBanks).toContain("HDFC Bank");
      expect(json.automation.statements.supportedBanks).toContain("Kotak Mahindra Bank");
      expect(json.automation.recurring.activeCount).toBe(1);
      expect(json.automation.pendingAttachments.passwordRequiredCount).toBe(1);
      expect(json.automation.pendingAttachments.banksRequiringPassword).toContain("HDFC");
    });
  });
});
