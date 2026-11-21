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

  describe("Adding Money & Net Worth Updates", () => {
    it("adding money directly to an asset account increases balance and net worth", () => {
      const initialAccounts: AccountItem[] = [
        { id: "1", name: "HDFC Bank", type: "Savings", balance: 50000, classification: "asset" },
        { id: "2", name: "Cash in Hand", type: "Liquid Cash", balance: 5000, classification: "asset" },
      ];
      const initialNetWorth = computeNetWorth(initialAccounts).netWorth;
      expect(initialNetWorth).toBe(55000);

      // Direct addition of ₹25,000 to HDFC Bank (e.g. Quick Add / Direct Deposit)
      const depositAmount = 25000;
      const updatedAccounts = initialAccounts.map((acc) =>
        acc.id === "1"
          ? { ...acc, balance: Number((acc.balance + depositAmount).toFixed(2)) }
          : acc
      );

      const updated = computeNetWorth(updatedAccounts);
      expect(updated.totalAssets).toBe(80000);
      expect(updated.netWorth).toBe(80000);
      expect(updated.netWorth - initialNetWorth).toBe(depositAmount);
    });

    it("adding money / paying down a liability account decreases debt and increases net worth", () => {
      const initialAccounts: AccountItem[] = [
        { id: "1", name: "HDFC Bank", type: "Savings", balance: 50000, classification: "asset" },
        { id: "2", name: "Credit Card", type: "Credit Card", balance: 20000, classification: "liability" },
      ];
      const initialNetWorth = computeNetWorth(initialAccounts).netWorth;
      expect(initialNetWorth).toBe(30000); // 50,000 - 20,000 = 30,000

      // Paying down ₹10,000 to Credit Card directly
      const depositAmount = 10000;
      const updatedAccounts = initialAccounts.map((acc) =>
        acc.id === "2"
          ? { ...acc, balance: Math.max(0, Number((acc.balance - depositAmount).toFixed(2))) }
          : acc
      );

      const updated = computeNetWorth(updatedAccounts);
      expect(updated.totalLiabilities).toBe(10000);
      expect(updated.netWorth).toBe(40000);
      expect(updated.netWorth - initialNetWorth).toBe(depositAmount);
    });

    it("internal transfer moves money between accounts without altering net worth", () => {
      const initialAccounts: AccountItem[] = [
        { id: "1", name: "HDFC Bank", type: "Savings", balance: 50000, classification: "asset" },
        { id: "2", name: "Cash in Hand", type: "Liquid Cash", balance: 10000, classification: "asset" },
      ];
      const initialNetWorth = computeNetWorth(initialAccounts).netWorth;

      // Transfer ₹5,000 from Cash to Bank
      const { fromBal, toBal } = executeTransfer(initialAccounts[1], initialAccounts[0], 5000);
      const updatedAccounts = [
        { ...initialAccounts[0], balance: toBal },
        { ...initialAccounts[1], balance: fromBal },
      ];

      const updated = computeNetWorth(updatedAccounts);
      expect(updated.netWorth).toBe(initialNetWorth);
    });
  });

  describe("Income Edit Reconciliation & Account Sync", () => {
    it("correctly reconciles account balance when income amount is edited", () => {
      let bankAccount: AccountItem = {
        id: "bank-1",
        name: "HDFC Bank",
        type: "Savings",
        balance: 50000,
        classification: "asset",
      };

      // User initially recorded salary of ₹50,000 (already in bankAccount.balance = 50,000)
      const oldAmount = 50000;
      const newAmount = 60000; // corrected salary to ₹60,000

      const diff = newAmount - oldAmount; // +10,000
      bankAccount = {
        ...bankAccount,
        balance: Math.round((bankAccount.balance + diff) * 100) / 100,
      };

      expect(bankAccount.balance).toBe(60000);
      const res = computeNetWorth([bankAccount]);
      expect(res.netWorth).toBe(60000);
    });

    it("correctly transfers credited funds when income account is changed", () => {
      let hdfc: AccountItem = {
        id: "hdfc-1",
        name: "HDFC Bank",
        type: "Savings",
        balance: 50000, // holds the initial ₹50,000 salary
        classification: "asset",
      };
      let icici: AccountItem = {
        id: "icici-2",
        name: "ICICI Bank",
        type: "Savings",
        balance: 20000,
        classification: "asset",
      };

      const oldAmount = 50000;
      const newAmount = 55000; // updated salary credited to ICICI instead of HDFC

      // Revert old account
      hdfc = {
        ...hdfc,
        balance: Math.round((hdfc.balance - oldAmount) * 100) / 100,
      };
      // Credit new account
      icici = {
        ...icici,
        balance: Math.round((icici.balance + newAmount) * 100) / 100,
      };

      expect(hdfc.balance).toBe(0);
      expect(icici.balance).toBe(75000);

      const res = computeNetWorth([hdfc, icici]);
      expect(res.netWorth).toBe(75000);
    });
  });

  describe("Ledger Portfolio Balance & Liability Segregation", () => {
    it("computes baseline and running balance subtracting liabilities", () => {
      const accounts: AccountItem[] = [
        { id: "1", name: "HDFC Bank", type: "Savings", balance: 100000, classification: "asset" },
        { id: "2", name: "Credit Card", type: "Credit Card", balance: 30000, classification: "liability" },
      ];

      // Total portfolio balance in Ledger
      const assets = accounts
        .filter((a) => a.classification !== "liability")
        .reduce((acc, curr) => acc + (Number(curr.balance) || 0), 0);
      const liabilities = accounts
        .filter((a) => a.classification === "liability")
        .reduce((acc, curr) => acc + Math.abs(Number(curr.balance) || 0), 0);
      const totalPortfolioBalance = assets - liabilities;

      expect(totalPortfolioBalance).toBe(70000); // 1,00,000 - 30,000 = 70,000, NOT 1,30,000!

      // Given ledger entries: Income 50k, Expense 20k
      const totalCredits = 50000;
      const totalDebits = 20000;
      const baseline = totalPortfolioBalance - (totalCredits - totalDebits);
      expect(baseline).toBe(40000);

      // Running balance after entries:
      let running = baseline;
      running += 50000; // Credit
      expect(running).toBe(90000);
      running -= 20000; // Debit
      expect(running).toBe(70000); // Concludes exactly at totalPortfolioBalance
    });
  });

  describe("Concurrency Pending Refetch Queueing", () => {
    it("ensures in-flight queries trigger a subsequent fetch when invalidated concurrently", async () => {
      let fetchCallCount = 0;
      const inFlightRef = { current: false };
      const pendingRefetchRef = { current: false };

      const fetchTelemetry = async () => {
        if (inFlightRef.current) {
          pendingRefetchRef.current = true;
          return;
        }
        inFlightRef.current = true;
        fetchCallCount += 1;

        // Simulate async network latency
        await new Promise((r) => setTimeout(r, 20));

        inFlightRef.current = false;
        if (pendingRefetchRef.current) {
          pendingRefetchRef.current = false;
          await fetchTelemetry();
        }
      };

      // Call 1: Starts execution
      const p1 = fetchTelemetry();
      // Call 2: Arrives while p1 is in-flight (e.g. from user adding money or realtime event)
      const p2 = fetchTelemetry();

      await Promise.all([p1, p2]);

      // Both initial and queued fetches must have executed
      expect(fetchCallCount).toBe(2);
      expect(pendingRefetchRef.current).toBe(false);
      expect(inFlightRef.current).toBe(false);
    });
  });
});
