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

    // 1. Ensure Cash Reserve account
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
    }

    // 2. Ensure Zerodha Funds wallet account
    const { data: existingZerodha } = await supabase
      .from("accounts")
      .select("id")
      .eq("user_id", user.id)
      .ilike("name", "%zerodha%");

    if (!existingZerodha || existingZerodha.length === 0) {
      await supabase.rpc("create_account_atomic", {
        p_user_id: user.id,
        p_name: "Zerodha Funds",
        p_type: "investment",
        p_balance: 0,
        p_currency: "INR",
        p_bank_name: "Zerodha",
      });
    }

    revalidatePath("/dashboard", "layout");
  } catch (err) {
    console.error("Error ensuring built-in accounts:", err);
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
        (targetAccount as any).is_protected ||
        targetAccount.name.toLowerCase().includes("cash reserve") ||
        targetAccount.name.toLowerCase().includes("zerodha") ||
        targetAccount.name.toLowerCase() === "cash")
    ) {
      return { error: "Built-in accounts (Cash Reserve, Zerodha Funds) are permanent and cannot be deleted." };
    }

    // Check if the account has any transactions linked
    const { count: txnCount, error: countError } = await supabase
      .from("transactions")
      .select("*", { count: "exact", head: true })
      .eq("account_id", id);

    if (countError) {
      console.error("Failed to check for transactions:", countError);
      return { error: `Failed to check for active transactions: ${countError.message}` };
    }

    if (txnCount && txnCount > 0) {
      return { error: "Cannot delete this account because it has active transactions. Please empty and archive it instead." };
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
    const destAmount = isCrossCurrency ? data.converted_amount! : data.amount;

    if (isCrossCurrency) {
      if (data.converted_amount === undefined || data.converted_amount <= 0 || !Number.isFinite(data.converted_amount)) {
        return { error: "Converted amount is required and must be a positive number for cross-currency transfers" };
      }
    }

    // Try RPC first for same-currency transfers
    if (!isCrossCurrency) {
      const rpcPayload: Record<string, any> = {
        p_user_id: user.id,
        p_from_account_id: data.from_account_id,
        p_to_account_id: data.to_account_id,
        p_amount: data.amount,
      };
      if (data.note?.trim()) {
        rpcPayload.p_note = data.note.trim();
      }

      const { data: rpcData, error } = await supabase.rpc("process_transfer", rpcPayload as any);

      if (!error && rpcData) {
        const result = rpcData as { success: boolean; error?: string };
        if (result.success) {
          revalidatePath("/dashboard", "layout");
          return { success: true, message: "Transfer created successfully" };
        } else if (result.error && result.error !== "Currency mismatch") {
          return { error: result.error };
        }
      }
    }

    // Direct atomic transfer execution (for cross-currency or RPC fallback)
    const { data: fullFrom } = await supabase.from("accounts").select("*").eq("id", data.from_account_id).single();
    const { data: fullTo } = await supabase.from("accounts").select("*").eq("id", data.to_account_id).single();

    if (!fullFrom || !fullTo) return { error: "Failed to fetch accounts for transfer" };

    const fromBal = Number(fullFrom.balance || 0);
    if (fromBal < data.amount) {
      return { error: `Insufficient balance in ${fullFrom.name}` };
    }

    const newFromBal = fromBal - data.amount;
    const newToBal = Number(fullTo.balance || 0) + destAmount;

    // Update source account
    const { error: updateFromErr } = await supabase.from("accounts").update({ balance: newFromBal }).eq("id", data.from_account_id);
    if (updateFromErr) return { error: "Failed to update source account balance" };

    // Update destination account
    const { error: updateToErr } = await supabase.from("accounts").update({ balance: newToBal }).eq("id", data.to_account_id);
    if (updateToErr) {
      // Rollback source account balance
      await supabase.from("accounts").update({ balance: fromBal }).eq("id", data.from_account_id);
      return { error: "Failed to update destination account balance" };
    }

    // Log transactions & ledger history
    const transferNote = data.note?.trim() ? ` - ${data.note.trim()}` : "";
    const dateNow = new Date().toISOString();

    await supabase.from("transactions").insert([
      {
        user_id: user.id,
        account_id: data.from_account_id,
        type: "expense",
        amount: data.amount,
        category: "Transfer Out",
        description: `Transfer to ${fullTo.name}${transferNote}`,
        date: dateNow,
      },
      {
        user_id: user.id,
        account_id: data.to_account_id,
        type: "income",
        amount: destAmount,
        category: "Transfer In",
        description: `Transfer from ${fullFrom.name}${transferNote}`,
        date: dateNow,
      }
    ]);

    await supabase.from("ledger_logs").insert([
      {
        user_id: user.id,
        account_id: data.from_account_id,
        account_name: fullFrom.name,
        action_type: "TRANSFER_OUT",
        amount: Math.abs(data.amount),
        previous_balance: fromBal,
        new_balance: newFromBal,
        details: `Transferred ${data.amount} ${fullFrom.currency} to ${fullTo.name}${transferNote}`,
        source_type: "account_transfer",
      },
      {
        user_id: user.id,
        account_id: data.to_account_id,
        account_name: fullTo.name,
        action_type: "TRANSFER_IN",
        amount: Math.abs(destAmount),
        previous_balance: Number(fullTo.balance || 0),
        new_balance: newToBal,
        details: `Received ${destAmount} ${fullTo.currency} from ${fullFrom.name}${transferNote}`,
        source_type: "account_transfer",
      }
    ]);

    revalidatePath("/dashboard", "layout");
    return { success: true, message: "Cross-currency transfer executed successfully" };
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
      let sourceId: string | null = null;
      let sourceType: string = tx.type;

      if (tx.type === "expense") {
        currentBalance -= tx.amount;
        const { data: expData } = await supabase.from("expenses").insert({
          user_id: user.id,
          account_id: accountId,
          description: tx.description,
          amount: tx.amount,
          category: tx.category,
          date: safeDateStr,
        }).select("id").single();
        sourceId = expData?.id || null;
        sourceType = "expense";
      } else {
        currentBalance += tx.amount;
        const { data: incData } = await supabase.from("incomes").insert({
          user_id: user.id,
          account_id: accountId,
          description: tx.description,
          amount: tx.amount,
          category: tx.category,
          date: safeDateStr,
        }).select("id").single();
        sourceId = incData?.id || null;
        sourceType = "income";
      }

      await supabase.from("transactions").insert({
        user_id: user.id,
        account_id: accountId,
        type: tx.type,
        amount: tx.amount,
        description: tx.description,
        category: tx.category,
        date: safeDateStr,
        source_id: sourceId,
        source_type: sourceType,
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

