import {
  parseBankStatementText,
  detectBankType,
  categorizeTransaction,
} from "@/lib/bank-parsers/parser-engine";

describe("Bank Statement Parser Engine", () => {
  it("detects bank type correctly from header text", () => {
    expect(detectBankType("Statement of Account - HDFC Bank Ltd")).toBe("hdfc");
    expect(detectBankType("ICICI Bank Net Banking Transaction Log")).toBe("icici");
    expect(detectBankType("State Bank of India Account Summary")).toBe("sbi");
    expect(detectBankType("Axis Bank Statement")).toBe("axis");
    expect(detectBankType("Random Bank Statement")).toBe("generic");
  });

  it("auto-categorizes transactions based on keywords", () => {
    expect(categorizeTransaction("UPI-SWIGGY-123456", "expense")).toBe("Food & Dining");
    expect(categorizeTransaction("BLINKIT GROCERIES", "expense")).toBe("Groceries");
    expect(categorizeTransaction("AMAZON INDIA PAY", "expense")).toBe("Shopping");
    expect(categorizeTransaction("UBER TRIP", "expense")).toBe("Transport");
    expect(categorizeTransaction("NETFLIX SUBSCRIPTION", "expense")).toBe("Entertainment");
    expect(categorizeTransaction("ACME CORP SALARY CREDIT", "income")).toBe("Salary");
    expect(categorizeTransaction("FD INTEREST CREDIT", "income")).toBe("Interest Income");
  });

  it("parses ICICI bank statement text correctly", () => {
    const mockText = `
      ICICI Bank Account Statement
      05-04-2026 UPI-ZOMATO-FOOD 450.00 Dr 14500.00
      12-04-2026 SALARY CREDIT 65000.00 Cr 79500.00
    `;

    const result = parseBankStatementText(mockText, "icici");
    expect(result.success).toBe(true);
    expect(result.bankDetected).toBe("icici");
    expect(result.transactions.length).toBe(2);

    const expenseTx = result.transactions.find((t) => t.type === "expense");
    expect(expenseTx).toBeDefined();
    expect(expenseTx?.amount).toBe(450);
    expect(expenseTx?.category).toBe("Food & Dining");

    const incomeTx = result.transactions.find((t) => t.type === "income");
    expect(incomeTx).toBeDefined();
    expect(incomeTx?.amount).toBe(65000);
    expect(incomeTx?.category).toBe("Salary");
  });

  it("parses HDFC statement text correctly", () => {
    const mockText = `
      HDFC BANK STATEMENT
      10/05/2026 UPI-UBER-RIDE 320.00 Dr 5000.00
    `;

    const result = parseBankStatementText(mockText, "hdfc");
    expect(result.success).toBe(true);
    expect(result.transactions.length).toBe(1);
    expect(result.transactions[0].category).toBe("Transport");
    expect(result.transactions[0].amount).toBe(320);
  });
});
