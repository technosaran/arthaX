import { z } from "zod";

export const StockInvestmentSchema = z.object({
  name: z.string().min(1, "Stock name or symbol is required").trim(),
  symbol: z.string().optional().transform((val) => val?.trim() || ""),
  quantity: z.number().positive("Quantity must be a positive number"),
  buy_price: z.number().positive("Buy price must be a positive number"),
  current_price: z.number().positive("Current price must be a positive number").optional(),
  currency: z.string().default("INR"),
  notes: z.string().optional().nullable(),
  bought_at: z.string().optional(),
  deduct_account_id: z.string().uuid("Invalid account ID format").optional().nullable(),
  total_cost_with_charges: z.number().positive().optional(),
  trade_type: z.enum(["buy", "sell"]).default("buy"),
});

export const MutualFundInvestmentSchema = z.object({
  fund_name: z.string().min(1, "Fund name is required").trim(),
  scheme_code: z.string().min(1, "Scheme code is required").trim(),
  units: z.number().positive("Units must be a positive number"),
  nav: z.number().positive("NAV must be a positive number"),
  investment_type: z.string().default("SIP"),
  category: z.string().default("Equity"),
  amc_name: z.string().default("General"),
  date: z.string().optional(),
  account_id: z.string().optional().nullable(),
  stamp_duty: z.number().nonnegative().default(0),
  trade_type: z.enum(["buy", "sell"]).default("buy"),
});

export const AccountCreateSchema = z.object({
  name: z.string().min(1, "Account name is required").trim(),
  type: z.string().min(1, "Account type is required").trim(),
  balance: z.number().default(0),
  currency: z.string().default("INR"),
  bank_name: z.string().optional().nullable(),
});

export const TransferSchema = z.object({
  from_account_id: z.string().min(1, "Source account is required"),
  to_account_id: z.string().min(1, "Destination account is required"),
  amount: z.number().positive("Transfer amount must be positive"),
  note: z.string().optional().nullable(),
  converted_amount: z.number().positive().optional(),
}).refine(data => data.from_account_id !== data.to_account_id, {
  message: "Source and destination accounts must be different",
  path: ["to_account_id"],
});

export const BalanceAdjustmentSchema = z.object({
  id: z.string().min(1, "Account ID is required"),
  amount: z.number().refine(val => val !== 0 && Number.isFinite(val), "Adjustment amount must be a non-zero number"),
  note: z.string().min(1, "A note is required for balance adjustments").trim(),
});

export const BudgetUpsertSchema = z.object({
  category: z.string().min(1, "Category is required").trim(),
  amount: z.number().positive("Budget amount must be positive"),
  period_month: z.number().min(1).max(12),
  period_year: z.number().min(2000).max(2100),
});
