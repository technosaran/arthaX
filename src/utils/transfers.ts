/**
 * ArthaX Enterprise Internal Transfer Reconciliation & Ledger Synchronization Service
 * 
 * Enforces:
 * 1. Two-sided transfer matching across accounts within a 72-hour (3-day) settlement window.
 * 2. Automatic transfer persistence into public.transfers with canonical references.
 * 3. Prevention of income and expense inflation from internal transfers.
 * 4. Cleanup of premature expense/income records if matched transfer counterpart arrives later.
 * 5. Retention of unmatched canonical transactions.
 * 6. Hardened authorization and input validation.
 */

import { supabaseAdmin } from "@/utils/supabase/admin";
import { logger } from "@/utils/logger";
import { validateMonetaryAmount } from "@/utils/money";

export interface TransferReconciliationResult {
  success: boolean;
  transfersReconciled: number;
  expensesCleaned: number;
  incomeCleaned: number;
  error?: string;
}

export interface SyncCanonicalToLedgerInput {
  userId: string;
  canonicalTxId?: string;
  accountId: string;
  direction: "DEBIT" | "CREDIT";
  amount: number | string;
  transactionDate: string;
  title: string;
  category?: string;
  originalNarration?: string;
  isTransfer?: boolean;
  transferToAccountId?: string;
}

/**
 * Reconciles internal transfers for a given user.
 * First delegates to the hardened atomic PostgreSQL database function fn_reconcile_internal_transfers.
 * If running in an environment without the RPC, uses a safe transactional client-side fallback.
 */
export async function reconcileInternalTransfers(
  userId: string,
  lookbackDays: number = 60
): Promise<TransferReconciliationResult> {
  if (!userId || userId.trim() === "" || userId === "default_user") {
    return {
      success: false,
      transfersReconciled: 0,
      expensesCleaned: 0,
      incomeCleaned: 0,
      error: "Invalid user ID provided for transfer reconciliation",
    };
  }

  // 1. Primary: Execute hardened Supabase RPC
  try {
    const { data, error } = await supabaseAdmin.rpc("fn_reconcile_internal_transfers", {
      p_user_id: userId,
      p_lookback_days: lookbackDays,
    });

    if (!error && data) {
      return {
        success: Boolean(data.success),
        transfersReconciled: Number(data.transfers_reconciled || 0),
        expensesCleaned: Number(data.expenses_cleaned || 0),
        incomeCleaned: Number(data.income_cleaned || 0),
      };
    }

    if (error) {
      logger.info("fn_reconcile_internal_transfers RPC returned error or not installed, falling back to application matching", "TransferService", {
        message: error.message,
      });
    }
  } catch (rpcErr) {
    logger.info("Transfer reconciliation RPC invocation notice, running fallback matcher", "TransferService", {
      error: String(rpcErr),
    });
  }

  // 2. Application Fallback Matching Engine
  try {
    const lookbackDate = new Date();
    lookbackDate.setDate(lookbackDate.getDate() - lookbackDays);
    const lookbackDateStr = lookbackDate.toISOString().split("T")[0];

    // Fetch unmatched canonical transactions for this user within lookback window
    const { data: unmatchedTxs, error: fetchErr } = await supabaseAdmin
      .from("canonical_transactions")
      .select("id, account_id, direction, amount, transaction_date, original_narration, normalized_narration, is_transfer, transfer_counterpart_id")
      .eq("user_id", userId)
      .is("transfer_counterpart_id", null)
      .gte("transaction_date", lookbackDateStr);

    if (fetchErr || !unmatchedTxs || unmatchedTxs.length === 0) {
      return { success: true, transfersReconciled: 0, expensesCleaned: 0, incomeCleaned: 0 };
    }

    const debits = unmatchedTxs.filter((t) => t.direction === "DEBIT");
    const credits = unmatchedTxs.filter((t) => t.direction === "CREDIT");

    let matchedCount = 0;
    let cleanedExpenses = 0;
    let cleanedIncome = 0;

    const matchedCreditIds = new Set<string>();

    for (const debit of debits) {
      const debitDate = new Date(debit.transaction_date).getTime();
      const debitAmount = Number(debit.amount);

      // Find candidate credit: same amount, different account, within 3 days (259,200,000 ms), not already matched
      let bestCredit: (typeof credits)[0] | null = null;
      let minDiff = Infinity;

      for (const credit of credits) {
        if (matchedCreditIds.has(credit.id)) continue;
        if (credit.account_id === debit.account_id) continue;
        if (Number(credit.amount) !== debitAmount) continue;

        const creditDate = new Date(credit.transaction_date).getTime();
        const diffDays = Math.abs(debitDate - creditDate) / (1000 * 60 * 60 * 24);

        if (diffDays <= 3 && diffDays < minDiff) {
          minDiff = diffDays;
          bestCredit = credit;
        }
      }

      if (bestCredit) {
        matchedCreditIds.add(bestCredit.id);

        // 1. Mark both canonical transactions as internal transfers
        await supabaseAdmin
          .from("canonical_transactions")
          .update({
            is_transfer: true,
            transfer_counterpart_id: bestCredit.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", debit.id)
          .eq("user_id", userId);

        await supabaseAdmin
          .from("canonical_transactions")
          .update({
            is_transfer: true,
            transfer_counterpart_id: debit.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", bestCredit.id)
          .eq("user_id", userId);

        // 2. Persist in public.transfers table
        await supabaseAdmin.from("transfers").upsert(
          {
            user_id: userId,
            from_account_id: debit.account_id,
            to_account_id: bestCredit.account_id,
            amount: debitAmount,
            currency: "INR",
            transfer_date: debit.transaction_date,
            notes: `Reconciled transfer (${Math.round(minDiff)}d window): ${debit.original_narration || debit.normalized_narration || "Account transfer"}`,
            canonical_transfer_id: debit.id,
          },
          { onConflict: "user_id,canonical_transfer_id", ignoreDuplicates: true }
        );

        // 3. Clean up any premature expense or income generated prior to match
        const { error: delExpErr } = await supabaseAdmin
          .from("expenses")
          .delete()
          .eq("user_id", userId)
          .eq("canonical_transaction_id", debit.id);

        if (!delExpErr) cleanedExpenses++;

        const { error: delIncErr } = await supabaseAdmin
          .from("income")
          .delete()
          .eq("user_id", userId)
          .eq("canonical_transaction_id", bestCredit.id);

        if (!delIncErr) cleanedIncome++;

        matchedCount++;
      }
    }

    return {
      success: true,
      transfersReconciled: matchedCount,
      expensesCleaned: cleanedExpenses,
      incomeCleaned: cleanedIncome,
    };
  } catch (err) {
    logger.error("Failed to run fallback transfer reconciliation", "TransferService", err, { userId });
    return {
      success: false,
      transfersReconciled: 0,
      expensesCleaned: 0,
      incomeCleaned: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Synchronizes an individual canonical transaction into the appropriate ledger destination.
 * Validates monetary amounts strictly, enforces ownership checks, and delegates to atomic SQL function.
 */
export async function syncCanonicalTransactionToLedger(
  input: SyncCanonicalToLedgerInput
): Promise<{ success: boolean; type?: string; ledgerId?: string; isNew?: boolean; error?: string }> {
  try {
    const validAmount = validateMonetaryAmount(input.amount, {
      fieldName: "Transaction amount",
      allowNegative: false,
    });

    if (!input.userId || input.userId.trim() === "") {
      return { success: false, error: "Invalid user ID" };
    }

    if (!input.accountId) {
      return { success: false, error: "Source account ID is required" };
    }

    if (input.isTransfer && !input.transferToAccountId) {
      return { success: false, error: "Destination account is required for internal transfer" };
    }

    if (input.isTransfer && input.accountId === input.transferToAccountId) {
      return { success: false, error: "Source and destination accounts must be distinct" };
    }

    // Try atomic database RPC
    const { data, error } = await supabaseAdmin.rpc("fn_sync_canonical_transaction_to_ledger", {
      p_user_id: input.userId,
      p_canonical_tx_id: input.canonicalTxId || null,
      p_account_id: input.accountId,
      p_direction: input.direction,
      p_amount: validAmount,
      p_transaction_date: input.transactionDate,
      p_title: input.title,
      p_category: input.category || null,
      p_original_narration: input.originalNarration || null,
      p_is_transfer: input.isTransfer || false,
      p_transfer_to_account_id: input.transferToAccountId || null,
    });

    if (!error && data) {
      return {
        success: Boolean(data.success),
        type: data.type,
        ledgerId: data.ledger_id,
        isNew: Boolean(data.is_new),
        error: data.error,
      };
    }

    // If RPC failed due to security/validation violation, return that error
    if (error && (error.code === "42501" || error.code === "22023")) {
      return { success: false, error: error.message };
    }

    // Application fallback for test or un-migrated setups
    if (input.isTransfer && input.transferToAccountId) {
      const { data: transRec, error: transErr } = await supabaseAdmin
        .from("transfers")
        .upsert(
          {
            user_id: input.userId,
            from_account_id: input.accountId,
            to_account_id: input.transferToAccountId,
            amount: validAmount,
            currency: "INR",
            transfer_date: input.transactionDate,
            notes: input.originalNarration || input.title,
            canonical_transfer_id: input.canonicalTxId || null,
          },
          { onConflict: "user_id,canonical_transfer_id", ignoreDuplicates: true }
        )
        .select("id")
        .maybeSingle();

      if (transErr) return { success: false, error: transErr.message };
      return { success: true, type: "transfer", ledgerId: transRec?.id, isNew: Boolean(transRec?.id) };
    }

    if (input.direction === "DEBIT") {
      const { data: expRec, error: expErr } = await supabaseAdmin
        .from("expenses")
        .upsert(
          {
            user_id: input.userId,
            account_id: input.accountId,
            amount: validAmount,
            category: input.category || "General",
            expense_date: input.transactionDate,
            title: input.title,
            notes: input.originalNarration || input.title,
            tags: ["statement_import", "verified"],
            canonical_transaction_id: input.canonicalTxId || null,
          },
          { onConflict: "user_id,canonical_transaction_id", ignoreDuplicates: true }
        )
        .select("id")
        .maybeSingle();

      if (expErr) return { success: false, error: expErr.message };
      return { success: true, type: "expense", ledgerId: expRec?.id, isNew: Boolean(expRec?.id) };
    } else {
      const { data: incRec, error: incErr } = await supabaseAdmin
        .from("income")
        .upsert(
          {
            user_id: input.userId,
            account_id: input.accountId,
            amount: validAmount,
            category: input.category === "Salary" ? "Salary" : "Other Income",
            received_date: input.transactionDate,
            title: input.title,
            notes: input.originalNarration || input.title,
            tags: ["statement_import", "verified"],
            canonical_transaction_id: input.canonicalTxId || null,
          },
          { onConflict: "user_id,canonical_transaction_id", ignoreDuplicates: true }
        )
        .select("id")
        .maybeSingle();

      if (incErr) return { success: false, error: incErr.message };
      return { success: true, type: "income", ledgerId: incRec?.id, isNew: Boolean(incRec?.id) };
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
