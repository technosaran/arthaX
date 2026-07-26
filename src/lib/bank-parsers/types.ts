export type BankType = "auto" | "hdfc" | "icici" | "sbi" | "axis" | "generic";

export interface ParsedTransaction {
  id: string;
  date: string;
  description: string;
  referenceNumber?: string;
  type: "expense" | "income";
  amount: number;
  category: string;
  balanceAfter?: number;
  selected: boolean;
}

export interface BankStatementParseResult {
  success: boolean;
  bankDetected: BankType;
  accountNumber?: string;
  statementPeriod?: { start?: string; end?: string };
  transactions: ParsedTransaction[];
  totalDeposits: number;
  totalWithdrawals: number;
  error?: string;
}
