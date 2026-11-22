/**
 * Accounts Tool for arthaX MCP Server
 * Lists active and archived bank accounts, credit cards, and cash wallets.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database.types";

export async function handleListAccounts(
  db: SupabaseClient<Database>,
  userId: string,
  includeArchived: boolean = false
) {
  let query = db
    .from("accounts")
    .select("id, name, type, classification, balance, currency, is_active, last_four, archived_at, created_at")
    .eq("user_id", userId);

  if (!includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list accounts: ${error.message}`);

  const accounts = (data || []).map((acc) => ({
    id: acc.id,
    name: acc.name,
    type: acc.type,
    classification: acc.classification,
    balance: Number(acc.balance),
    currency: acc.currency,
    isActive: acc.is_active,
    lastFour: acc.last_four,
    archivedAt: acc.archived_at,
  }));

  const totalAssets = accounts
    .filter((a) => a.classification === "asset")
    .reduce((sum, a) => sum + a.balance, 0);

  const totalLiabilities = accounts
    .filter((a) => a.classification === "liability")
    .reduce((sum, a) => sum + Math.abs(a.balance), 0);

  return {
    accounts,
    totalAccounts: accounts.length,
    summary: {
      totalAssets,
      totalLiabilities,
      netCash: totalAssets - totalLiabilities,
    },
  };
}
