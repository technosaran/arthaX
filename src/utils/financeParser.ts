import { parseExpenseMessage, matchAccount, AccountSummary, ParsedExpense } from "./expenseParser";

export interface ParsedIncome {
  amount: number;
  title: string;
  category: string;
  accountQuery?: string;
  rawText: string;
}

export interface ParsedTransfer {
  amount: number;
  fromAccountQuery: string;
  toAccountQuery: string;
  rawText: string;
}

export type FinancialIntent =
  | { type: "transfer"; data: ParsedTransfer }
  | { type: "income"; data: ParsedIncome }
  | { type: "expense"; data: ParsedExpense }
  | { type: "unknown"; rawText: string };

const INCOME_KEYWORDS = [
  "salary", "freelance", "stipend", "bonus", "dividend", "interest",
  "credited", "earned", "revenue", "consulting", "refund", "cashback",
  "received from", "received", "payout", "profit"
];

function extractAmountValue(str: string): number {
  const clean = str.replace(/,/g, "").trim().toLowerCase();
  if (clean.endsWith("k")) {
    const val = parseFloat(clean.slice(0, -1));
    return isNaN(val) ? 0 : val * 1000;
  }
  const val = parseFloat(clean);
  return isNaN(val) ? 0 : val;
}

/**
 * Intelligent Intent Classifier for financial chat messages:
 * Distinguishes between Transfer, Income, and Expense messages.
 */
export function classifyFinancialMessage(
  text: string,
  userAccounts: AccountSummary[] = []
): FinancialIntent {
  const clean = text.trim();
  if (!clean) return { type: "unknown", rawText: text };

  // -------------------------------------------------------------
  // 1. Detect Inter-Account Transfer
  // Examples:
  // "Transfer 5000 from HDFC to Cash"
  // "Moved 2000 SBI to ICICI"
  // "Transfer 1500 Cash to HDFC"
  // "/transfer 5000 HDFC to Cash"
  // -------------------------------------------------------------
  const transferRegex = /(?:^\/transfer\s+|transfer(?:red)?\s+|move(?:d)?\s+|shift(?:ed)?\s+)(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d+)?k?)\s+(?:from\s+)?([a-z0-9\s]+?)\s+(?:to|into)\s+([a-z0-9\s]+)$/i;
  const transferMatch = clean.match(transferRegex);

  if (transferMatch) {
    const amount = extractAmountValue(transferMatch[1]);
    const fromQuery = transferMatch[2].trim();
    const toQuery = transferMatch[3].trim();

    if (amount > 0 && fromQuery && toQuery) {
      return {
        type: "transfer",
        data: {
          amount: Number(amount.toFixed(2)),
          fromAccountQuery: fromQuery,
          toAccountQuery: toQuery,
          rawText: clean,
        },
      };
    }
  }

  // -------------------------------------------------------------
  // 2. Detect Income (Credits / Salary / Freelance / Received Money)
  // Examples:
  // "Salary 85000 HDFC"
  // "Freelance 15000 SBI"
  // "Received 12000 from Client into HDFC"
  // "Dividend 450 Cash"
  // "Your a/c ending 1234 credited by Rs. 50,000 on 14-Nov-2026"
  // -------------------------------------------------------------
  const isCreditSMS = /(?:credited|credited with|received|deposited)/i.test(clean) && /(?:a\/c|account|card|upi|rs\.?|inr|₹)/i.test(clean);
  const lowerClean = clean.toLowerCase();
  const hasIncomeKeyword = INCOME_KEYWORDS.some((kw) => lowerClean.includes(kw));

  // Ensure it's not a debit (which is an expense)
  const isDebit = /(?:debited|spent|paid|withdrawn)/i.test(clean);

  if (!isDebit && (isCreditSMS || hasIncomeKeyword)) {
    let amount = 0;

    // Priority 1: Credited with / by / for pattern
    const creditAmtMatch = clean.match(
      /(?:credited(?:\s+(?:with|by|for))?|deposited|received)\s+(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d+)?k?)/i
    );
    if (creditAmtMatch) {
      amount = extractAmountValue(creditAmtMatch[1]);
    }

    // Priority 2: Explicit currency prefix (Rs. / INR / ₹)
    if (!amount) {
      const currencyPrefixMatch = clean.match(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d+)?k?)/i);
      if (currencyPrefixMatch) {
        amount = extractAmountValue(currencyPrefixMatch[1]);
      }
    }

    // Priority 3: Currency postfix (e.g. 50000 INR)
    if (!amount) {
      const currencyPostfixMatch = clean.match(/([\d,]+(?:\.\d+)?k?)\s*(?:rs\.?|inr|₹)/i);
      if (currencyPostfixMatch) {
        amount = extractAmountValue(currencyPostfixMatch[1]);
      }
    }

    // Priority 4: Keyword + amount (e.g. Salary 85000, Freelance 15k)
    if (!amount) {
      const kwMatch = clean.match(
        /(?:salary|freelance|stipend|bonus|dividend|interest|cashback|refund|profit)\s+(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d+)?k?)/i
      );
      if (kwMatch) {
        amount = extractAmountValue(kwMatch[1]);
      }
    }

    // Priority 5: Fallback standalone number not preceded by account/date indicators
    if (!amount) {
      const tokens = clean.split(/\s+/);
      for (let i = 0; i < tokens.length; i++) {
        const prev = (tokens[i - 1] || "").toLowerCase();
        if (/(?:a\/c|ac|ending|card|xx|\*\*|no\.?|code|pin|date|on|at)/i.test(prev)) continue;
        const rawNum = tokens[i].replace(/[^0-9.kK]/g, "");
        const val = extractAmountValue(rawNum);
        if (val > 0 && !(val >= 2020 && val <= 2035 && rawNum.length === 4)) {
          amount = val;
          break;
        }
      }
    }

    if (amount > 0) {
      // Determine Income Category
      let category = "Other Income";
      if (/salary|payroll/i.test(clean)) category = "Salary";
      else if (/freelance|consulting|client/i.test(clean)) category = "Freelance & Consulting";
      else if (/dividend|interest|yield|stock|mf/i.test(clean)) category = "Investment Returns";
      else if (/bonus|incentive/i.test(clean)) category = "Bonus & Incentives";
      else if (/refund|cashback/i.test(clean)) category = "Refunds & Cashbacks";
      else if (/gift/i.test(clean)) category = "Gifts & Grants";

      // Match target account
      let matchedAcc: string | undefined;

      // 1. Check last four of accounts
      for (const acc of userAccounts) {
        if (acc.last_four && new RegExp(`\\b${acc.last_four}\\b`, "i").test(clean)) {
          matchedAcc = acc.name;
          break;
        }
      }

      // 2. Check full account name
      if (!matchedAcc) {
        for (const acc of userAccounts) {
          if (new RegExp(`\\b${acc.name}\\b`, "i").test(clean)) {
            matchedAcc = acc.name;
            break;
          }
        }
      }

      // 3. Check distinctive brand words from account name (e.g. "HDFC", "SBI", "ICICI")
      if (!matchedAcc) {
        for (const acc of userAccounts) {
          const distinctWords = acc.name
            .toLowerCase()
            .split(/\s+/)
            .map((w) => w.replace(/[^a-z0-9]/g, ""))
            .filter((w) => w.length >= 3 && !["bank", "account", "card", "salary"].includes(w));

          for (const word of distinctWords) {
            if (new RegExp(`\\b${word}\\b`, "i").test(clean)) {
              matchedAcc = acc.name;
              break;
            }
          }
          if (matchedAcc) break;
        }
      }

      // 4. Try matching tokens via matchAccount
      if (!matchedAcc && userAccounts.length > 0) {
        const tokens = clean.split(/\s+/).map((t) => t.replace(/[^a-zA-Z0-9]/g, "").trim()).filter(Boolean);
        for (const token of tokens) {
          if (/^(?:salary|income|credited|received|on|at|for|from|into|rs|inr)$/i.test(token)) continue;
          const found = matchAccount(token, userAccounts);
          if (found && (found.name.toLowerCase().includes(token.toLowerCase()) || token.toLowerCase().includes(found.name.toLowerCase()))) {
            matchedAcc = found.name;
            break;
          }
        }
      }

      // Extract title
      let title = clean
        .replace(/(?:rs\.?|inr|₹)\s*[\d,]+(?:\.\d+)?k?/gi, "")
        .replace(/\b(?:into|in|to)\s+[a-z0-9]+\b/gi, "")
        .replace(/\b(?:from|for)\b/gi, "")
        .replace(/\s+/g, " ")
        .trim();

      if (!title || title.length < 2) {
        title = category;
      } else {
        title = title.charAt(0).toUpperCase() + title.slice(1);
      }

      return {
        type: "income",
        data: {
          amount: Number(amount.toFixed(2)),
          title,
          category,
          accountQuery: matchedAcc,
          rawText: clean,
        },
      };
    }
  }

  // -------------------------------------------------------------
  // 3. Fallback to Expense Parser
  // -------------------------------------------------------------
  const expense = parseExpenseMessage(clean, userAccounts);
  if (expense.amount > 0) {
    return {
      type: "expense",
      data: expense,
    };
  }

  return { type: "unknown", rawText: clean };
}
