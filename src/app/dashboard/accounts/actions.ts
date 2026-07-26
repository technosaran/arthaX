"use server";

import { createClient } from "@/lib/supabase-server";
import { getFriendlyErrorMessage } from "@/lib/action-utils";
import { revalidatePath } from "next/cache";
import { parseToISODate } from "@/lib/utils";

export async function createAccount(data: {
  name: string;
  type: string;
  balance?: number;
  currency?: string;
  bank_name?: string | null;
}) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { data: rpcData, error } = await supabase.rpc("create_account_atomic", {
      p_user_id: user.id,
      p_name: data.name,
      p_type: data.type,
      p_balance: data.balance ?? 0,
      p_currency: data.currency || 'INR',
      p_bank_name: data.bank_name || null
    });

    if (error) return { error: getFriendlyErrorMessage(error) };
    const result = rpcData as { success: boolean, error?: string } | null;
    if (!result) return { error: "Failed to communicate with database" };
    if (!result.success) return { error: result.error || "Failed to create account" };

    revalidatePath("/dashboard", "layout");
    return { success: true, message: "Account created successfully" };
  } catch (err) {
    console.error("Error in createAccount:", err);
    return { error: getFriendlyErrorMessage(err) };
  }
}

export async function updateAccount(id: string, data: Record<string, unknown>) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    // SECURITY: Prevent direct balance manipulation via generic update
    const blockedFields = new Set(["balance", "user_id", "id", "created_at"]);
    const safeData = Object.fromEntries(
      Object.entries(data).filter(([key]) => !blockedFields.has(key))
    );

    const { error } = await supabase
      .from("accounts")
      .update(safeData as any)
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return { error: getFriendlyErrorMessage(error) };

    // Get account name for logging
    const { data: account } = await supabase
      .from("accounts")
      .select("name")
      .eq("id", id)
      .single();

    // Log update - awaited for integrity
    const allowedLogKeys = ["name", "type", "currency", "bank_name", "institution", "color", "account_number"];
    const changedFields = Object.keys(safeData).filter(k => allowedLogKeys.includes(k));
    const { error: logError } = await supabase.from("ledger_logs").insert({
      user_id: user.id,
      account_id: id,
      account_name: account?.name || "Account",
      action_type: "UPDATE",
      details: `Updated settings for ${account?.name || 'account'}: ${changedFields.join(", ") || "metadata"}`,
    });
    if (logError) console.error("Failed to log account update:", logError);

    revalidatePath("/dashboard", "layout");
    return { success: true, message: "Account updated successfully" };
  } catch (err) {
    console.error("Error in updateAccount:", err);
    return { error: getFriendlyErrorMessage(err) };
  }
}

export async function ensureCashReserveAccount() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: existingCash } = await supabase
      .from("accounts")
      .select("id")
      .eq("user_id", user.id)
      .or("type.eq.cash,name.ilike.%cash%");

    if (!existingCash || existingCash.length === 0) {
      await supabase.rpc("create_account_atomic", {
        p_user_id: user.id,
        p_name: "Cash Reserve",
        p_type: "cash",
        p_balance: 0,
        p_currency: "INR",
        p_bank_name: "Cash",
      });
      revalidatePath("/dashboard", "layout");
    }
  } catch (err) {
    console.error("Error ensuring Cash Reserve account:", err);
  }
}

export async function deleteAccount(id: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { data: targetAccount } = await supabase
      .from("accounts")
      .select("name, type")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (
      targetAccount &&
      (targetAccount.type === "cash" ||
        targetAccount.name.toLowerCase().includes("cash reserve") ||
        targetAccount.name.toLowerCase() === "cash")
    ) {
      return { error: "The built-in Cash Reserve account is permanent and cannot be deleted." };
    }

    // Unlink any transactions that reference this account to prevent foreign key constraint violations
    const unlinkResults = await Promise.all([
      supabase.from("forex_transactions").update({ bank_account_id: null }).eq("bank_account_id", id),
      supabase.from("bond_transactions").update({ account_id: null }).eq("account_id", id),
      supabase.from("mutual_fund_trades").update({ account_id: null }).eq("account_id", id),
    ]);
    const unlinkError = unlinkResults.find(r => r.error);
    if (unlinkError?.error) {
      console.error("Failed to unlink references:", unlinkError.error);
      return { error: `Failed to unlink references: ${unlinkError.error.message}` };
    }

    const { data: rpcData, error } = await supabase.rpc("delete_account_atomic_v2", {
      p_user_id: user.id,
      p_account_id: id
    });

    if (error) return { error: getFriendlyErrorMessage(error) };
    const result = rpcData as { success: boolean, error?: string } | null;
    if (!result) return { error: "Failed to communicate with database" };
    if (!result.success) return { error: result.error || "Failed to delete account" };

    revalidatePath("/dashboard", "layout");
    return { success: true, message: "Account deleted successfully" };
  } catch (err) {
    console.error("Error in deleteAccount:", err);
    return { error: getFriendlyErrorMessage(err) };
  }
}



type TransferData = {
  from_account_id: string;
  to_account_id: string;
  amount: number;
  note: string | null;
  converted_amount?: number;
};

export async function createTransfer(data: TransferData) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    // Input validation
    if (!data.from_account_id || !data.to_account_id) {
      return { error: "Both source and destination accounts are required" };
    }
    if (data.from_account_id === data.to_account_id) {
      return { error: "Source and destination accounts must be different" };
    }
    if (!data.amount || data.amount <= 0 || !Number.isFinite(data.amount)) {
      return { error: "Transfer amount must be a positive number" };
    }

    // Fetch accounts to check currencies
    const { data: fromAccount, error: fromErr } = await supabase
      .from("accounts")
      .select("currency")
      .eq("id", data.from_account_id)
      .eq("user_id", user.id)
      .single();

    const { data: toAccount, error: toErr } = await supabase
      .from("accounts")
      .select("currency")
      .eq("id", data.to_account_id)
      .eq("user_id", user.id)
      .single();

    if (fromErr || toErr || !fromAccount || !toAccount) {
      return { error: "Failed to retrieve account details for verification" };
    }

    const isCrossCurrency = fromAccount.currency !== toAccount.currency;
    if (isCrossCurrency) {
      if (data.converted_amount === undefined || data.converted_amount <= 0 || !Number.isFinite(data.converted_amount)) {
        return { error: "Converted amount is required and must be a positive number for cross-currency transfers" };
      }
    }

    const rpcPayload: Record<string, any> = {
      p_user_id: user.id,
      p_from_account_id: data.from_account_id,
      p_to_account_id: data.to_account_id,
      p_amount: data.amount,
    };
    if (data.note?.trim()) {
      rpcPayload.p_note = data.note.trim();
    }
    if (isCrossCurrency && data.converted_amount) {
      rpcPayload.p_converted_amount = data.converted_amount;
    }

    let { data: rpcData, error } = await supabase.rpc("process_transfer", rpcPayload as any);

    // Fallback: If 6-parameter signature is not in schema cache, try 5-parameter version
    if (error && (error.message?.includes("schema cache") || error.code === "PGRST202") && rpcPayload.p_converted_amount !== undefined) {
      delete rpcPayload.p_converted_amount;
      const fallback = await supabase.rpc("process_transfer", rpcPayload as any);
      rpcData = fallback.data;
      error = fallback.error;
    }

    if (error) return { error: getFriendlyErrorMessage(error) };
    const result = rpcData as { success: boolean, error?: string } | null;
    if (!result) return { error: "Failed to execute transfer" };
    if (!result.success) return { error: result.error || "Transfer failed" };

    revalidatePath("/dashboard", "layout");
    return { success: true, message: "Transfer created successfully" };
  } catch (err) {
    console.error("Error in createTransfer:", err);
    return { error: getFriendlyErrorMessage(err) };
  }
}

export async function adjustBalance(id: string, amount: number, note: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    // Input validation
    if (!id) return { error: "Account ID is required" };
    if (!Number.isFinite(amount) || amount === 0) {
      return { error: "Adjustment amount must be a non-zero finite number" };
    }
    if (!note || note.trim().length === 0) {
      return { error: "A note is required for balance adjustments" };
    }

    const { data: rpcData, error } = await supabase.rpc("adjust_account_balance", {
      p_user_id: user.id,
      p_account_id: id,
      p_amount: amount,
      p_note: note
    });

    if (error) return { error: getFriendlyErrorMessage(error) };
    const result = rpcData as { success: boolean, error?: string } | null;
    if (!result) return { error: "Failed to adjust balance" };
    if (!result.success) return { error: result.error || "Adjustment failed" };

    revalidatePath("/dashboard", "layout");
    return { success: true, message: "Balance adjusted successfully" };
  } catch (err) {
    console.error("Error in adjustBalance:", err);
    return { error: getFriendlyErrorMessage(err) };
  }
}

export async function importParsedTransactions(
  accountId: string,
  transactions: Array<{
    date: string;
    description: string;
    type: "expense" | "income";
    amount: number;
    category: string;
  }>
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    if (!accountId) return { error: "Target account ID is required" };
    if (!transactions || transactions.length === 0) return { error: "No transactions selected for import" };

    const { data: account, error: accErr } = await supabase
      .from("accounts")
      .select("*")
      .eq("id", accountId)
      .eq("user_id", user.id)
      .single();

    if (accErr || !account) return { error: "Account not found" };

    let currentBalance = Number(account.balance || 0);
    const oldBalance = currentBalance;

    let importedCount = 0;

    for (const tx of transactions) {
      const safeDateStr = parseToISODate(tx.date);
      if (tx.type === "expense") {
        currentBalance -= tx.amount;
        await supabase.from("expenses").insert({
          user_id: user.id,
          account_id: accountId,
          description: tx.description,
          amount: tx.amount,
          category: tx.category,
          date: safeDateStr,
        });
      } else {
        currentBalance += tx.amount;
        await supabase.from("incomes").insert({
          user_id: user.id,
          account_id: accountId,
          description: tx.description,
          amount: tx.amount,
          category: tx.category,
          date: safeDateStr,
        });
      }

      await supabase.from("transactions").insert({
        user_id: user.id,
        account_id: accountId,
        type: tx.type,
        amount: tx.amount,
        description: tx.description,
        category: tx.category,
        date: safeDateStr,
      });

      importedCount++;
    }

    // Update final account balance
    await supabase.from("accounts").update({ balance: currentBalance }).eq("id", accountId);

    // Audit log
    await supabase.from("ledger_logs").insert({
      user_id: user.id,
      account_id: accountId,
      account_name: account.name,
      action_type: "STATEMENT_IMPORT",
      amount: Math.abs(currentBalance - oldBalance),
      previous_balance: oldBalance,
      new_balance: currentBalance,
      details: `Bank Statement Import: ${importedCount} transactions imported`,
      source_type: "statement_import",
    });

    revalidatePath("/dashboard", "layout");
    return { success: true, count: importedCount, message: `Successfully imported ${importedCount} transactions!` };
  } catch (err) {
    console.error("Error in importParsedTransactions:", err);
    return { error: getFriendlyErrorMessage(err) };
  }
}

