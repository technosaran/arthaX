import { describe, it, expect } from "vitest";
import {
  verifyTelegramSecret,
  escapeTelegramHtml,
  formatCurrencyINR,
  formatExpenseConfirmation,
  formatBalanceSummary,
  formatRecentExpenses,
  formatSpendingSummary,
  formatWelcomeMessage,
  formatHelpMessage,
} from "@/utils/telegram";
import { parseExpenseMessage, AccountSummary } from "@/utils/expenseParser";

describe("Telegram Integration Suite", () => {
  describe("Security & Secret Verification", () => {
    it("validates authentic secret token using timingSafeEqual", () => {
      const configured = "arthax_secure_token_secret_12345";
      expect(verifyTelegramSecret(configured, configured)).toBe(true);
    });

    it("rejects invalid or tampered secret token", () => {
      const configured = "arthax_secure_token_secret_12345";
      const incoming = "tampered_token_value_99999";
      expect(verifyTelegramSecret(incoming, configured)).toBe(false);
    });

    it("rejects empty or null incoming header when secret is configured", () => {
      const configured = "arthax_secure_token_secret_12345";
      expect(verifyTelegramSecret(null, configured)).toBe(false);
      expect(verifyTelegramSecret("", configured)).toBe(false);
    });

    it("accepts incoming header if no secret is configured in environment", () => {
      expect(verifyTelegramSecret("any_token", "")).toBe(true);
    });
  });

  describe("HTML Escaping & Content Sanitization", () => {
    it("escapes special HTML characters for Telegram HTML mode", () => {
      const input = "Swiggy <order #123> & Zomato > Uber";
      const escaped = escapeTelegramHtml(input);
      expect(escaped).toBe("Swiggy &lt;order #123&gt; &amp; Zomato &gt; Uber");
    });

    it("leaves safe strings unchanged", () => {
      const input = "Dinner at Taj 1500 HDFC";
      expect(escapeTelegramHtml(input)).toBe(input);
    });

    it("formats Indian Rupee currency correctly", () => {
      const res = formatCurrencyINR(15000);
      expect(res).toContain("15,000");
    });
  });

  describe("Message Formatting Templates", () => {
    it("formats expense confirmation message with all required details", () => {
      const msg = formatExpenseConfirmation({
        amount: 850,
        category: "Food & Dining",
        title: "Swiggy Dinner",
        accountName: "HDFC Salary",
        newBalance: 42150,
      });

      expect(msg).toContain("Expense Logged!");
      expect(msg).toContain("850");
      expect(msg).toContain("Food &amp; Dining");
      expect(msg).toContain("Swiggy Dinner");
      expect(msg).toContain("HDFC Salary");
      expect(msg).toContain("42,150");
      expect(msg).toContain("arthaX");
    });

    it("formats balance summary with total portfolio calculations", () => {
      const accounts = [
        { name: "HDFC Bank", type: "Savings", balance: 50000, last_four: "1234" },
        { name: "SBI Card", type: "Credit Card", balance: 15000, last_four: "5678" },
        { name: "Cash Reserve", type: "Liquid Cash", balance: 5000, last_four: null },
      ];

      const res = formatBalanceSummary(accounts);
      expect(res).toContain("Your Accounts &amp; Balances");
      expect(res).toContain("HDFC Bank (••1234)");
      expect(res).toContain("SBI Card (••5678)");
      expect(res).toContain("Cash Reserve");
      expect(res).toContain("70,000"); // 50000 + 15000 + 5000
    });

    it("handles empty accounts list gracefully", () => {
      const res = formatBalanceSummary([]);
      expect(res).toContain("No active accounts found");
    });

    it("formats recent expenses list", () => {
      const expenses = [
        { title: "Swiggy", amount: 450, category: "Food & Dining", expense_date: "2026-11-14", account_name: "HDFC" },
        { title: "Petrol", amount: 1200, category: "Transport & Fuel", expense_date: "2026-11-13", account_name: "Cash" },
      ];

      const res = formatRecentExpenses(expenses);
      expect(res).toContain("Recent Expenses");
      expect(res).toContain("1. <b>Swiggy</b>");
      expect(res).toContain("2. <b>Petrol</b>");
      expect(res).toContain("Food &amp; Dining");
      expect(res).toContain("Transport &amp; Fuel");
    });

    it("formats spending summary with today and monthly totals", () => {
      const summary = formatSpendingSummary({
        todayTotal: 1650,
        monthTotal: 24500,
        expenseCount: 18,
        topCategory: "Food & Dining",
      });

      expect(summary).toContain("Spending Summary");
      expect(summary).toContain("1,650");
      expect(summary).toContain("24,500");
      expect(summary).toContain("18");
      expect(summary).toContain("Food &amp; Dining");
    });

    it("formats welcome message for linked user", () => {
      const welcome = formatWelcomeMessage({
        isLinked: true,
        userName: "Saran",
      });

      expect(welcome).toContain("Welcome back, Saran!");
      expect(welcome).toContain("/balance");
      expect(welcome).toContain("/recent");
      expect(welcome).toContain("/summary");
    });

    it("formats welcome message for unlinked user with link token instructions", () => {
      const welcome = formatWelcomeMessage({
        isLinked: false,
        linkToken: "AX-8F92A1",
      });

      expect(welcome).toContain("Welcome to arthaX on Telegram!");
      expect(welcome).toContain("/link AX-8F92A1");
    });

    it("formats comprehensive command help guide", () => {
      const help = formatHelpMessage("ArthaXBot");
      expect(help).toContain("arthaX Telegram Bot Guide");
      expect(help).toContain("Dinner 650 HDFC");
      expect(help).toContain("Bank Debit SMS Forwarding");
      expect(help).toContain("/balance");
      expect(help).toContain("/recent");
      expect(help).toContain("/summary");
      expect(help).toContain("/unlink");
    });
  });

  describe("Telegram Command & Expense Parsing Integration", () => {
    const knownAccounts: AccountSummary[] = [
      { id: "acc-1", name: "HDFC Salary", type: "Savings", balance: 45000, last_four: "9876" },
      { id: "acc-2", name: "Cash in Hand", type: "Liquid Cash", balance: 3500, last_four: "CASH" },
    ];

    it("parses Telegram chat message into structured expense", () => {
      const msg = "Dinner 750 HDFC";
      const parsed = parseExpenseMessage(msg, knownAccounts);

      expect(parsed.amount).toBe(750);
      expect(parsed.category).toBe("Food & Dining");
      expect(parsed.accountQuery).toBe("HDFC Salary");
    });

    it("parses bank debit SMS forwarded via Telegram", () => {
      const sms = "Alert: HDFC Bank A/c ending 9876 debited for INR 1,250.00 at SHELL PETROL on 14-Nov-2026.";
      const parsed = parseExpenseMessage(sms, knownAccounts);

      expect(parsed.amount).toBe(1250);
      expect(parsed.category).toBe("Transport & Fuel");
      expect(parsed.accountQuery).toBe("HDFC Salary");
    });

    it("identifies slash commands correctly", () => {
      const isCmd = (text: string) => text.trim().startsWith("/");
      expect(isCmd("/balance")).toBe(true);
      expect(isCmd("/recent")).toBe(true);
      expect(isCmd("/summary")).toBe(true);
      expect(isCmd("/link AX-992144")).toBe(true);
      expect(isCmd("Dinner 500 HDFC")).toBe(false);
    });

    it("extracts link code from /link and /start deep links", () => {
      const extractLinkToken = (text: string) => {
        const parts = text.trim().split(/\s+/);
        if (parts[0] === "/link" || parts[0] === "/start") {
          return parts[1] || null;
        }
        return null;
      };

      expect(extractLinkToken("/link AX-7K9P2X")).toBe("AX-7K9P2X");
      expect(extractLinkToken("/start AX-7K9P2X")).toBe("AX-7K9P2X");
      expect(extractLinkToken("/start")).toBeNull();
      expect(extractLinkToken("/balance")).toBeNull();
    });
  });
});
