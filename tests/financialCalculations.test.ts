import { describe, it, expect } from "vitest";

interface AccountItem {
  id: string;
  name: string;
  type: string;
  balance: number;
  classification?: "asset" | "liability";
}

// Net Worth logic matching upgraded Dashboard & Accounts sections
function computeNetWorth(accounts: AccountItem[]): {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
} {
  const totalAssets = accounts
    .filter((a) => a.classification !== "liability")
    .reduce((acc, curr) => acc + curr.balance, 0);

  const totalLiabilities = accounts
    .filter((a) => a.classification === "liability")
    .reduce((acc, curr) => acc + curr.balance, 0);

  return {
    totalAssets: Math.round(totalAssets * 100) / 100,
    totalLiabilities: Math.round(totalLiabilities * 100) / 100,
    netWorth: Math.round((totalAssets - totalLiabilities) * 100) / 100,
  };
}

// Cash flow logic: Unclamped so real deficits are visible
function computeMonthlyNetCashFlow(income: number, expenses: number): number {
  return Math.round((income - expenses) * 100) / 100;
}

// Transfer simulation: Debit source, credit destination, zero net leak
function executeTransfer(
  fromAccount: AccountItem,
  toAccount: AccountItem,
  amount: number
): { fromBal: number; toBal: number } {
  if (amount <= 0) throw new Error("Transfer amount must be positive");
  if (fromAccount.id === toAccount.id) throw new Error("Accounts must be distinct");

  // Debit fromAccount
  const fromBal =
    fromAccount.classification === "liability"
      ? fromAccount.balance + amount // cash advance increases liability
      : fromAccount.balance - amount;

  // Credit toAccount
  const toBal =
    toAccount.classification === "liability"
      ? toAccount.balance - amount // credit card payment reduces debt
      : toAccount.balance + amount;

  return {
    fromBal: Math.round(fromBal * 100) / 100,
    toBal: Math.round(toBal * 100) / 100,
  };
}

describe("ArthaX Financial Calculations Suite", () => {
  describe("Net Worth & Asset/Liability Segregation", () => {
    it("correctly calculates net worth when user has only assets", () => {
      const accounts: AccountItem[] = [
        { id: "1", name: "HDFC Bank", type: "Savings", balance: 50000, classification: "asset" },
        { id: "2", name: "Cash in Hand", type: "Liquid Cash", balance: 5000, classification: "asset" },
      ];

      const res = computeNetWorth(accounts);
      expect(res.totalAssets).toBe(55000);
      expect(res.totalLiabilities).toBe(0);
      expect(res.netWorth).toBe(55000);
    });

    it("correctly subtracts credit cards and debt liabilities from net worth", () => {
      const accounts: AccountItem[] = [
        { id: "1", name: "SBI Bank", type: "Savings", balance: 120000, classification: "asset" },
        { id: "2", name: "Cash in Hand", type: "Liquid Cash", balance: 10000, classification: "asset" },
        { id: "3", name: "HDFC Regalia", type: "Credit Card", balance: 35000, classification: "liability" },
        { id: "4", name: "Personal Loan", type: "Loan", balance: 50000, classification: "liability" },
      ];

      const res = computeNetWorth(accounts);
      expect(res.totalAssets).toBe(130000);
      expect(res.totalLiabilities).toBe(85000);
      expect(res.netWorth).toBe(45000); // 1,30,000 - 85,000 = 45,000
    });

    it("correctly reflects negative net worth when liabilities exceed assets", () => {
      const accounts: AccountItem[] = [
        { id: "1", name: "Bank", type: "Savings", balance: 20000, classification: "asset" },
        { id: "2", name: "Credit Card Debt", type: "Credit Card", balance: 75000, classification: "liability" },
      ];

      const res = computeNetWorth(accounts);
      expect(res.netWorth).toBe(-55000);
    });
  });

  describe("Monthly Cash Flow Unclamped Accuracy", () => {
    it("preserves positive savings accurately", () => {
      const net = computeMonthlyNetCashFlow(85000, 42000);
      expect(net).toBe(43000);
    });

    it("preserves negative deficit months instead of artificially clamping to zero", () => {
      // Historical flaw: Math.max(0, income - expenses) hid deficits
      const net = computeMonthlyNetCashFlow(50000, 72500);
      expect(net).toBe(-22500);
      expect(net).toBeLessThan(0);
    });
  });

  describe("Account-to-Account Internal Transfers", () => {
    it("debits source bank and credits cash in hand with zero total portfolio change", () => {
      const bank: AccountItem = { id: "acc-1", name: "SBI Bank", type: "Savings", balance: 25000, classification: "asset" };
      const cash: AccountItem = { id: "acc-2", name: "Cash in Hand", type: "Liquid Cash", balance: 2000, classification: "asset" };

      const initialNetWorth = computeNetWorth([bank, cash]).netWorth;
      const { fromBal, toBal } = executeTransfer(bank, cash, 5000);

      expect(fromBal).toBe(20000);
      expect(toBal).toBe(7000);

      const updatedNetWorth = computeNetWorth([
        { ...bank, balance: fromBal },
        { ...cash, balance: toBal },
      ]).netWorth;

      expect(updatedNetWorth).toBe(initialNetWorth); // 27,000 == 27,000
    });

    it("reduces credit card liability when paying bill from bank account", () => {
      const bank: AccountItem = { id: "acc-1", name: "HDFC Bank", type: "Savings", balance: 60000, classification: "asset" };
      const card: AccountItem = { id: "acc-2", name: "ICICI Card", type: "Credit Card", balance: 15000, classification: "liability" };

      const { fromBal, toBal } = executeTransfer(bank, card, 15000);

      expect(fromBal).toBe(45000); // Bank decreased by 15k
      expect(toBal).toBe(0);      // Credit card debt reduced to 0
    });

    it("rejects transfer with same source and destination", () => {
      const bank: AccountItem = { id: "acc-1", name: "HDFC Bank", type: "Savings", balance: 60000, classification: "asset" };
      expect(() => executeTransfer(bank, bank, 1000)).toThrow("Accounts must be distinct");
    });
  });
});
