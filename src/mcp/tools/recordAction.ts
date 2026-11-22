/**
 * Atomic Transaction Record Tools for arthaX MCP Server
 * Invokes PostgreSQL atomic stored procedures to safely log expenses, income, and transfers.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database.types";

export interface RecordExpenseParams {
  accountId: string;
  amount: number;
  category: string;
  title: string;
  date?: string;
  notes?: string;
  tags?: string[];
}

export interface RecordIncomeParams {
  accountId: string;
  amount: number;
  category: string;
  title: string;
  date?: string;
  frequency?: string;
  notes?: string;
  tags?: string[];
}

export interface RecordTransferParams {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date?: string;
  notes?: string;
}

export async function handleRecordExpense(
  db: SupabaseClient<Database>,
  userId: string,
  params: RecordExpenseParams
) {
  if (!params.amount || params.amount <= 0) {
    throw new Error("Amount must be greater than zero.");
  }
  if (!params.accountId) {
    throw new Error("accountId is required.");
  }

  const expenseDate = params.date || new Date().toISOString().slice(0, 10);

  const { data, error } = await db.rpc("fn_record_expense_atomic", {
    p_user_id: userId,
    p_account_id: params.accountId,
    p_amount: params.amount,
    p_category: params.category,
    p_title: params.title,
    p_notes: params.notes,
    p_expense_date: expenseDate,
    p_tags: params.tags || [],
  });

  if (error) {
    throw new Error(`Failed to record expense: ${error.message}`);
  }

  return {
    success: true,
    message: `Recorded expense of ₹${params.amount} under ${params.category} successfully.`,
    expenseId: data,
  };
}

export async function handleRecordIncome(
  db: SupabaseClient<Database>,
  userId: string,
  params: RecordIncomeParams
) {
  if (!params.amount || params.amount <= 0) {
    throw new Error("Amount must be greater than zero.");
  }
  if (!params.accountId) {
    throw new Error("accountId is required.");
  }

  const receivedDate = params.date || new Date().toISOString().slice(0, 10);

  const { data, error } = await db.rpc("fn_record_income_atomic", {
    p_user_id: userId,
    p_account_id: params.accountId,
    p_amount: params.amount,
    p_category: params.category,
    p_title: params.title,
    p_received_date: receivedDate,
    p_frequency: params.frequency || "ONE_TIME",
    p_notes: params.notes,
    p_tags: params.tags || [],
  });

  if (error) {
    throw new Error(`Failed to record income: ${error.message}`);
  }

  return {
    success: true,
    message: `Recorded income of ₹${params.amount} from ${params.title} successfully.`,
    incomeId: data,
  };
}

export async function handleRecordTransfer(
  db: SupabaseClient<Database>,
  userId: string,
  params: RecordTransferParams
) {
  if (!params.amount || params.amount <= 0) {
    throw new Error("Amount must be greater than zero.");
  }
  if (!params.fromAccountId || !params.toAccountId) {
    throw new Error("fromAccountId and toAccountId are required.");
  }

  const transferDate = params.date || new Date().toISOString().slice(0, 10);

  const { data, error } = await db.rpc("fn_record_transfer_atomic", {
    p_user_id: userId,
    p_from_account_id: params.fromAccountId,
    p_to_account_id: params.toAccountId,
    p_amount: params.amount,
    p_transfer_date: transferDate,
    p_notes: params.notes,
  });

  if (error) {
    throw new Error(`Failed to record transfer: ${error.message}`);
  }

  return {
    success: true,
    message: `Transferred ₹${params.amount} from account ${params.fromAccountId} to ${params.toAccountId} successfully.`,
    transferId: data,
  };
}
