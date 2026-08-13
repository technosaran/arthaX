import { SupabaseClient } from "@supabase/supabase-js";
import { AADiscoveredAccount } from "./aa-client";
import { logLedgerEntry } from "@/lib/action-utils";
import logger from "@/lib/logger";

export interface AASyncResult {
  syncedCount: number;
  createdCount: number;
  updatedCount: number;
  errors: string[];
}

export class AccountAggregatorSyncService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Syncs bank accounts authorized via RBI Account Aggregator into user's database.
   */
  async syncAccounts(userId: string, accounts: AADiscoveredAccount[]): Promise<AASyncResult> {
    let createdCount = 0;
    let updatedCount = 0;
    const errors: string[] = [];

    if (!accounts || accounts.length === 0) {
      return { syncedCount: 0, createdCount: 0, updatedCount: 0, errors: [] };
    }

    // Fetch existing user accounts
    const { data: existingAccounts } = await this.supabase
      .from("accounts")
      .select("*")
      .eq("user_id", userId);

    const existingMap = new Map<string, any>();
    if (existingAccounts) {
      for (const acc of existingAccounts) {
        const key = `${acc.bank_name || ""}_${acc.name || ""}`.toLowerCase();
        existingMap.set(key, acc);
      }
    }

    const now = new Date().toISOString();

    for (const accData of accounts) {
      try {
        const bankName = accData.bankName;
        const accountName = `${bankName} (${accData.maskedAccountNumber})`;
        const key = `${bankName}_${accountName}`.toLowerCase();

        const existingAcc = existingMap.get(key) || existingAccounts?.find((a) => a.bank_name === bankName);

        if (existingAcc) {
          // Update balance and sync timestamp
          const oldBalance = parseFloat(existingAcc.balance || "0");
          const newBalance = accData.balance;

          const { error: updateErr } = await this.supabase
            .from("accounts")
            .update({
              balance: newBalance.toString(),
              bank_name: bankName,
              is_active: true,
              updated_at: now,
            })
            .eq("id", existingAcc.id);

          if (updateErr) {
            errors.push(`Failed to update ${accountName}: ${updateErr.message}`);
          } else {
            updatedCount++;

            // If balance changed, log ledger adjustment
            const diff = newBalance - oldBalance;
            if (Math.abs(diff) > 0.01) {
              await logLedgerEntry(this.supabase, {
                user_id: userId,
                action_type: diff > 0 ? "ADJUST_UP" : "ADJUST_DOWN",
                account_id: existingAcc.id,
                account_name: accountName,
                amount: Math.abs(diff),
                previous_balance: oldBalance,
                new_balance: newBalance,
                details: `RBI Account Aggregator Live Sync Adjustment`,
              });
            }
          }
        } else {
          // Create new bank account
          const { data: insertedAcc, error: insertErr } = await this.supabase
            .from("accounts")
            .insert({
              user_id: userId,
              name: accountName,
              bank_name: bankName,
              type: accData.accountType === "checking" ? "checking" : "savings",
              balance: accData.balance.toString(),
              currency: "INR",
              is_active: true,
              color: bankName.toLowerCase().includes("hdfc")
                ? "#1D4ED8"
                : bankName.toLowerCase().includes("icici")
                ? "#D97706"
                : bankName.toLowerCase().includes("sbi")
                ? "#0284C7"
                : "#059669",
            })
            .select()
            .single();

          if (insertErr) {
            errors.push(`Failed to create ${accountName}: ${insertErr.message}`);
          } else {
            createdCount++;

            // Log initial balance in ledger
            if (insertedAcc && accData.balance > 0) {
              await logLedgerEntry(this.supabase, {
                user_id: userId,
                action_type: "CREATE",
                account_id: insertedAcc.id,
                account_name: accountName,
                amount: accData.balance,
                new_balance: accData.balance,
                details: `Linked via RBI Account Aggregator`,
              });
            }
          }
        }
      } catch (err: any) {
        errors.push(`Error processing ${accData.bankName}: ${err.message || String(err)}`);
      }
    }

    logger.info("AA Sync: Complete", { createdCount, updatedCount, errors });

    return {
      syncedCount: accounts.length,
      createdCount,
      updatedCount,
      errors,
    };
  }
}
