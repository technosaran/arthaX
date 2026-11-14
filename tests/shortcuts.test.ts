import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseExpenseMessage } from "@/utils/expenseParser";
import { classifyFinancialMessage } from "@/utils/financeParser";

describe("Siri Voice Shortcut & Expense Parser", () => {
  const dummyAccounts = [
    { id: "acc-1", name: "HDFC Salary", type: "bank", balance: 50000, last_four: "1234" },
    { id: "acc-2", name: "SBI Savings", type: "bank", balance: 15000, last_four: "5678" },
    { id: "acc-3", name: "Cash in Hand", type: "cash", balance: 2500, last_four: null },
    { id: "acc-4", name: "ICICI Credit Card", type: "card", balance: 10000, last_four: "9012" },
  ];

  it("parses conversational voice command with amount, merchant, and bank", () => {
    const input = "Spent 350 for lunch on HDFC";
    const parsed = parseExpenseMessage(input, dummyAccounts);

    expect(parsed.amount).toBe(350);
    expect(parsed.title.toLowerCase()).toContain("lunch");
    expect(parsed.category).toBe("Food & Dining");
    expect(parsed.accountQuery?.toLowerCase()).toBe("hdfc salary");
  });

  it("parses brief voice command like '250 chai on SBI'", () => {
    const input = "250 chai on SBI";
    const parsed = parseExpenseMessage(input, dummyAccounts);

    expect(parsed.amount).toBe(250);
    expect(parsed.title.toLowerCase()).toContain("chai");
    expect(parsed.category).toBe("Food & Dining");
    expect(parsed.accountQuery?.toLowerCase()).toBe("sbi savings");
  });

  it("parses multiplier amounts like '1.5k fuel on ICICI'", () => {
    const input = "1.5k fuel on ICICI";
    const parsed = parseExpenseMessage(input, dummyAccounts);

    expect(parsed.amount).toBe(1500);
    expect(parsed.category).toBe("Transport & Fuel");
    expect(parsed.accountQuery?.toLowerCase()).toBe("icici credit card");
  });

  it("parses incoming bank SMS forwarded by iOS Shortcuts", () => {
    const sms = "Dear Customer, your A/c ending 1234 debited by Rs. 420.00 on 14-Nov-26 for Swiggy. Bal Rs 49580.";
    const parsed = parseExpenseMessage(sms, dummyAccounts);

    expect(parsed.amount).toBe(420);
    expect(parsed.accountQuery).toBe("HDFC Salary");
    expect(parsed.category).toBe("Food & Dining");
    expect(parsed.title.toLowerCase()).toContain("swiggy");
  });

  it("classifies voice transfer commands between accounts", () => {
    const input = "Transfer 5000 from HDFC to Cash";
    const intent = classifyFinancialMessage(input, dummyAccounts);

    expect(intent.type).toBe("transfer");
    if (intent.type === "transfer") {
      expect(intent.data.amount).toBe(5000);
      expect(intent.data.fromAccountQuery.toLowerCase()).toContain("hdfc");
      expect(intent.data.toAccountQuery.toLowerCase()).toContain("cash");
    }
  });

  it("classifies voice income credit commands", () => {
    const input = "Salary 75000 credited to HDFC";
    const intent = classifyFinancialMessage(input, dummyAccounts);

    expect(intent.type).toBe("income");
    if (intent.type === "income") {
      expect(intent.data.amount).toBe(75000);
      expect(intent.data.accountQuery?.toLowerCase()).toContain("hdfc");
    }
  });
});

