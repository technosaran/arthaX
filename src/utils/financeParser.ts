import {
  parseExpenseMessage,
  matchAccount,
  AccountSummary,
  ParsedExpense,
  escapeRegExp,
  INDIAN_NUMBER_PATTERN,
  parseFormattedNumber,
  applyIndianMultiplier,
  extractAmountFromText,
} from "./expenseParser";

export type FinancialIntentType = "expense" | "income" | "transfer" | "unknown";

export type ParsedFinancialIntent =
  | { type: "expense"; data: ParsedExpense }
  | {
      type: "income";
      data: {
        amount: number;
        title: string;
        category: string;
        accountQuery?: string;
        rawText: string;
      };
    }
  | {
      type: "transfer";
      data: {
        amount: number;
        fromAccountQuery: string;
        toAccountQuery: string;
        rawText: string;
      };
    }
  | { type: "unknown"; rawText: string };

const INCOME_KEYWORDS = [
  "salary",
  "credited",
  "received",
  "earned",
  "income",
  "freelance",
  "payout",
  "dividend",
  "dividends",
  "bonus",
  "cashback",
  "refund",
  "deposited",
  "reimbursement",
  "stipend",
  "interest credited",
  "interest paid",
  "profit",
  "rental income",
  "got paid",
];

const TRANSFER_VERBS = /\b(?:transfer|transferred|move|moved|shift|shifted|send|sent)\b/i;

function matchesWordOrPhrase(text: string, phrase: string): boolean {
  return new RegExp(`\\b${escapeRegExp(phrase)}\\b`, "i").test(text);
}

function isConversationalQuestion(text: string): boolean {
  const lower = text.toLowerCase().trim();
  if (lower.endsWith("?")) return true;
  return /^(?:how|what|why|when|where|who|which|can\s+i|should\s+i|could\s+i|would\s+i|is\s+my|are\s+my|tell\s+me|show\s+me|explain|compare|suggest|advise|help)\b/i.test(
    lower
  );
}

function inferIncomeCategory(clean: string): { category: string; defaultTitle: string } {
  if (/\bsalary|payroll|stipend\b/i.test(clean)) return { category: "Salary", defaultTitle: "Monthly Salary" };
  if (/\bfreelance|consulting|client|payout|invoice\b/i.test(clean)) {
    return { category: "Freelance", defaultTitle: "Freelance Payout" };
  }
  if (/\bdividend|dividends|interest|yield|fd\s+interest\b/i.test(clean)) {
    return { category: "Investments & Dividends", defaultTitle: "Dividend / Interest" };
  }
  if (/\bbusiness|revenue|sales\b/i.test(clean)) return { category: "Business", defaultTitle: "Business Revenue" };
  if (/\brent|rental\b/i.test(clean)) return { category: "Rental Income", defaultTitle: "Rental Income" };
  if (/\brefund|reversal|cashback\b/i.test(clean)) return { category: "Refund & Cashback", defaultTitle: "Refund Credit" };
  if (/\bbonus|incentive|gift\b/i.test(clean)) return { category: "Bonus & Gifts", defaultTitle: "Bonus" };
  return { category: "Other Income", defaultTitle: "Income Credit" };
}

function resolveAccountHint(rawHint: string, userAccounts: AccountSummary[]): string | undefined {
  const trimmed = rawHint.trim().replace(/[.,;:]+$/, "");
  if (!trimmed) return undefined;
  const matched = matchAccount(trimmed, userAccounts);
  if (matched) {
    // Only return matched account name if rawHint actually points to this account (not default fallback)
    const lowerHint = trimmed.toLowerCase();
    const isDirect =
      matched.name.toLowerCase().includes(lowerHint) ||
      lowerHint.includes(matched.name.toLowerCase()) ||
      Boolean(matched.last_four && matched.last_four.toLowerCase() === lowerHint) ||
      matched.name
        .toLowerCase()
        .split(/\s+/)
        .some((w) => w.length >= 3 && new RegExp(`\\b${escapeRegExp(w)}\\b`, "i").test(lowerHint));
    if (isDirect) return matched.name;
  }
  return trimmed;
}

/**
 * Classifies a natural-language financial message or Indian bank SMS into Expense, Income, Transfer, or Unknown.
 */
export function classifyFinancialMessage(
  text: string,
  userAccounts: AccountSummary[] = []
): ParsedFinancialIntent {
  const clean = (text || "").trim().replace(/\s+/g, " ");
  if (!clean) return { type: "unknown", rawText: "" };

  // Never misclassify general conversational advice questions unless it looks like a bank SMS alert
  const looksLikeBankSms = /\b(?:a\/c|acct|account|credited|debited|spent|upi|neft|imps)\b/i.test(clean);
  if (isConversationalQuestion(clean) && !looksLikeBankSms) {
    return { type: "unknown", rawText: clean };
  }

  // 1. Transfer Intent Detection
  // Supports: "Transfer 5,000 from HDFC to Cash", "Moved 1.5k from SBI 5678 to HDFC",
  // "Pay HDFC Credit Card bill 15,000 from SBI"
  const amtPattern = `(?:₹|rs\\.?|inr)?\\s*(${INDIAN_NUMBER_PATTERN})\\s*(k|thousand|lac|lacs|lakh|lakhs|cr|crore|crores|l)?`;

  const ccBillTransferMatch = clean.match(
    new RegExp(
      `^(?:pay|paid|clear)\\s+(.+?(?:credit\\s*card|card))\\s*(?:bill)?\\s+${amtPattern}\\s+from\\s+(.+)$`,
      "i"
    )
  );
  if (ccBillTransferMatch) {
    const val = applyIndianMultiplier(
      parseFormattedNumber(ccBillTransferMatch[2]),
      ccBillTransferMatch[3]
    );
    if (val > 0) {
      return {
        type: "transfer",
        data: {
          amount: val,
          fromAccountQuery: ccBillTransferMatch[4].trim(),
          toAccountQuery: ccBillTransferMatch[1].trim(),
          rawText: clean,
        },
      };
    }
  }

  const isExplicitTransfer =
    TRANSFER_VERBS.test(clean) && /\bfrom\b/i.test(clean) && /(?:\bto\b|->|=>)/i.test(clean);

  if (isExplicitTransfer) {
    const transferRegex = new RegExp(
      `(?:transfer(?:red)?|move(?:d)?|shift(?:ed)?|send|sent)\\s+${amtPattern}\\s+from\\s+(.+?)\\s+(?:to|->|=>)\\s+(.+)$`,
      "i"
    );
    const arrowRegex = new RegExp(
      `(?:transfer(?:red)?|move(?:d)?|send|sent)\\s+${amtPattern}\\s+(.+?)\\s*(?:->|=>)\\s*(.+)$`,
      "i"
    );
    const tMatch = clean.match(transferRegex) || clean.match(arrowRegex);
    if (tMatch) {
      const amount = applyIndianMultiplier(parseFormattedNumber(tMatch[1]), tMatch[2]);
      if (amount > 0) {
        return {
          type: "transfer",
          data: {
            amount,
            fromAccountQuery: tMatch[3].trim(),
            toAccountQuery: tMatch[4].trim(),
            rawText: clean,
          },
        };
      }
    }
  }

  // Check if message has explicit debit SMS phrasing (never misclassify a debit alert as income)
  const isDebitSms =
    /\b(?:debited|spent|withdrawn|charged|purchase\s+of)\b/i.test(clean) &&
    !/\bcredited\b/i.test(clean);

  // 2. Income Intent Detection (Strict word/phrase boundary — prevents "learned" matching "earned")
  const hasIncomeKeyword =
    !isDebitSms && INCOME_KEYWORDS.some((kw) => matchesWordOrPhrase(clean, kw));

  if (hasIncomeKeyword) {
    const withoutBal = clean.replace(/\b(?:avl|available|clear|closing)?\s*bal(?:ance)?[:\s].*$/i, "");
    let amount = 0;

    // SMS/phrase specific income extraction: "credited with Rs. 25,000.00", "received ₹1,25,000", "Salary 85000"
    const creditAmtRe = new RegExp(
      `(?:credited(?:\\s+(?:with|by|for|of))?|received|deposited|earned|salary|payout|dividend|bonus|refund|cashback)\\s*(?:of|rs\\.?|inr|₹)?\\s*(${INDIAN_NUMBER_PATTERN})\\s*(k|thousand|lac|lacs|lakh|lakhs|cr|crore|crores|l)?\\b`,
      "i"
    );
    const cMatch = withoutBal.match(creditAmtRe);
    if (cMatch) {
      amount = applyIndianMultiplier(parseFormattedNumber(cMatch[1]), cMatch[2]);
    }
    if (amount <= 0) {
      amount = extractAmountFromText(withoutBal).amount;
    }

    if (amount > 0) {
      const { category, defaultTitle } = inferIncomeCategory(clean);

      // Account detection for income (check explicit digits, then "to/in/on ACCOUNT", then parseExpenseMessage)
      let accountQuery: string | undefined;
      const toAccountMatch = withoutBal.match(/(?:\b(?:to|in|into|on)\b)\s+(?:your\s+|my\s+)?([a-zA-Z0-9\s]{2,35}?)(?=\s+(?:on\s+\d|avl\b|bal\b|ref\b|$)|[.,]|$)/i);
      if (toAccountMatch && toAccountMatch[1]) {
        accountQuery = resolveAccountHint(toAccountMatch[1], userAccounts);
      }

      const fallbackParsed = parseExpenseMessage(clean, userAccounts);
      if (!accountQuery || !userAccounts.some((a) => a.name === accountQuery)) {
        accountQuery = fallbackParsed.accountQuery;
      }

      // Extract clean title without trailing account or date words
      let title = defaultTitle;
      const explicitSource = clean.match(
        /(?:from|by)\s+([A-Za-z0-9\s.&'-]{2,40}?)(?=\s+(?:credited|to|in|into|on|for|via|avl|bal|$)|[.,]|$)/i
      );
      if (
        explicitSource?.[1] &&
        !/^(?:your|my|a\/c|account|bank|neft|imps|upi)$/i.test(explicitSource[1].trim())
      ) {
        title = `${defaultTitle.split(" ")[0]} - ${explicitSource[1].trim()}`;
      } else {
        const stripped = withoutBal
          .replace(
            new RegExp(
              `(?:₹|rs\\.?|inr)?\\s*${INDIAN_NUMBER_PATTERN}\\s*(?:₹|rs\\.?|inr|rupees|/-|k|thousand|lac|lacs|lakh|lakhs|cr|crore|crores|l)?\\b`,
              "gi"
            ),
            " "
          )
          .replace(/\b(?:credited|received|deposited|with|your|dear|customer|has|been|a\/c|account|ending|on|to|in|into|from)\b/gi, " ")
          .replace(/\bending\s+\d{4}\b/gi, " ")
          .replace(/\b[xX*]*\d{4,}\b/g, " ")
          .replace(/\b\d{1,2}[/-](?:[a-zA-Z]{3,9}|\d{1,2})[/-]\d{2,4}\b/g, " ")
          .trim();

        const accNameRegex = accountQuery ? new RegExp(`\\b${escapeRegExp(accountQuery)}\\b`, "gi") : null;
        const cleanWords = (accNameRegex ? stripped.replace(accNameRegex, " ") : stripped)
          .replace(/[^\w\s&'-]/g, " ")
          .split(/\s+/)
          .filter((w) => w.length > 1 && !["the", "rs", "inr", "bank"].includes(w.toLowerCase()));

        if (cleanWords.length > 0 && cleanWords.length <= 5) {
          title = cleanWords
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ");
        }
      }

      return {
        type: "income",
        data: {
          amount,
          title,
          category,
          accountQuery,
          rawText: clean,
        },
      };
    }
  }

  // 3. Expense Parsing (Natural commands + Debit SMS)
  const expense = parseExpenseMessage(clean, userAccounts);
  if (expense.amount > 0) {
    return {
      type: "expense",
      data: expense,
    };
  }

  return { type: "unknown", rawText: clean };
}
