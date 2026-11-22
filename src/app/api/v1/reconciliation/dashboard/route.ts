import { NextRequest, NextResponse } from "next/server";
import { createApiRoute } from "@/lib/backend/routeHandler";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { apiSuccess, apiError } from "@/utils/apiResponse";
import { validateMonetaryAmount, fromCents, toCentsStrict } from "@/utils/money";
import { reconcileInternalTransfers } from "@/utils/transfers";
import { invalidateUserCaches } from "@/lib/backend/cacheInvalidation";
import { z } from "zod";

const ResolveDiscrepancySchema = z.object({
  action: z.enum(["TRIGGER_TRANSFER_RECONCILIATION", "ACKNOWLEDGE_STATEMENT_DISCREPANCY", "FORCE_RECONCILE"]),
  statement_id: z.string().uuid().optional(),
  account_id: z.string().uuid().optional(),
  notes: z.string().max(500).optional(),
});

export const GET = createApiRoute({
  auth: "required",
  rateLimit: { limit: 60, windowSeconds: 60 },
  handler: async ({ userId, req }) => {
    try {
      // 1. Fetch user accounts
      const { data: accounts, error: accErr } = await supabaseAdmin
        .from("accounts")
        .select("id, name, type, classification, balance, last_four, is_active, updated_at")
        .eq("user_id", userId!);

      if (accErr) {
        return apiError(`Failed to load accounts: ${accErr.message}`, "DATABASE_ERROR", 500, undefined, req);
      }

      // 2. Fetch recent bank statements
      const { data: statements, error: stmtErr } = await supabaseAdmin
        .from("bank_statements")
        .select("*")
        .eq("user_id", userId!)
        .order("period_end", { ascending: false })
        .limit(25);

      if (stmtErr) {
        return apiError(`Failed to load statements: ${stmtErr.message}`, "DATABASE_ERROR", 500, undefined, req);
      }

      // 3. Fetch recent canonical transactions for duplicate and reversal analysis
      const { data: canonicalTxs, error: txErr } = await supabaseAdmin
        .from("canonical_transactions")
        .select("id, account_id, transaction_date, amount, direction, original_narration, normalized_narration, transaction_reference, category, is_transfer")
        .eq("user_id", userId!)
        .order("transaction_date", { ascending: false })
        .limit(500);

      if (txErr) {
        return apiError(`Failed to load transactions: ${txErr.message}`, "DATABASE_ERROR", 500, undefined, req);
      }

      // 4. Statement Invariant Analysis (Opening + Credits - Debits == Closing)
      const statementAudits = (statements || []).map((stmt) => {
        const opCents = Math.round(Number(stmt.opening_balance || 0) * 100);
        const crCents = Math.round(Number(stmt.total_credits || 0) * 100);
        const drCents = Math.round(Number(stmt.total_debits || 0) * 100);
        const clCents = Math.round(Number(stmt.closing_balance || 0) * 100);

        const expectedClosingCents = opCents + crCents - drCents;
        const discrepancyCents = clCents - expectedClosingCents;
        const hasDiscrepancy = Math.abs(discrepancyCents) > 1; // 1 paisa tolerance

        return {
          id: stmt.id,
          account_id: stmt.account_id,
          bank_name: stmt.bank_name,
          file_name: stmt.file_name,
          period_start: stmt.period_start,
          period_end: stmt.period_end,
          opening_balance: Number(stmt.opening_balance),
          closing_balance: Number(stmt.closing_balance),
          total_credits: Number(stmt.total_credits),
          total_debits: Number(stmt.total_debits),
          transaction_count: stmt.transaction_count,
          expected_closing_balance: fromCents(expectedClosingCents),
          discrepancy_amount: fromCents(Math.abs(discrepancyCents)),
          reconciliation_status: hasDiscrepancy ? "DISCREPANCY" : stmt.reconciliation_status,
          reconciliation_error: stmt.reconciliation_error,
          parser_version: stmt.parser_version,
          created_at: stmt.created_at,
        };
      });

      // 5. Account Balance Reconciliation against Statements
      const accountAudits = (accounts || []).map((acc) => {
        const latestStmt = statementAudits.find((s) => s.account_id === acc.id);
        const accBal = Number(acc.balance || 0);

        let discrepancy = 0;
        let auditStatus: "RECONCILED" | "DISCREPANCY" | "NO_STATEMENTS" = "NO_STATEMENTS";

        if (latestStmt) {
          discrepancy = Math.abs(accBal - latestStmt.closing_balance);
          auditStatus = discrepancy <= 0.05 ? "RECONCILED" : "DISCREPANCY";
        }

        return {
          id: acc.id,
          name: acc.name,
          type: acc.type,
          last_four: acc.last_four,
          current_balance: accBal,
          latest_statement_date: latestStmt ? latestStmt.period_end : null,
          latest_statement_closing_balance: latestStmt ? latestStmt.closing_balance : null,
          discrepancy_amount: Number(discrepancy.toFixed(2)),
          status: auditStatus,
        };
      });

      // 6. Suspected Duplicate Detection
      const duplicates: Array<{
        transaction_a_id: string;
        transaction_b_id: string;
        date: string;
        amount: number;
        narration: string;
        reason: string;
      }> = [];

      const txList = canonicalTxs || [];
      const seenMap = new Map<string, typeof txList[0]>();

      for (const tx of txList) {
        // Group by account, amount, direction, and normalized narration prefix
        const key = `${tx.account_id}:${tx.amount}:${tx.direction}:${(tx.normalized_narration || "").slice(0, 15).toUpperCase()}:${tx.transaction_date}`;
        if (seenMap.has(key)) {
          const prev = seenMap.get(key)!;
          duplicates.push({
            transaction_a_id: prev.id,
            transaction_b_id: tx.id,
            date: tx.transaction_date,
            amount: Number(tx.amount),
            narration: tx.normalized_narration || tx.original_narration,
            reason: "Identical amount, direction, date, and narration found on same account",
          });
        } else {
          seenMap.set(key, tx);
        }
      }

      // 7. Reversed Transaction Detection (e.g. UPI failure refunded or POS reversal)
      const reversals: Array<{
        original_id: string;
        reversal_id: string;
        amount: number;
        date: string;
        narration: string;
      }> = [];

      for (let i = 0; i < txList.length; i++) {
        const debit = txList[i];
        if (debit.direction !== "DEBIT") continue;

        for (let j = 0; j < txList.length; j++) {
          const credit = txList[j];
          if (credit.direction !== "CREDIT" || credit.account_id !== debit.account_id) continue;
          if (Number(credit.amount) === Number(debit.amount)) {
            const cNarr = (credit.original_narration || "").toUpperCase();
            if (cNarr.includes("REFUND") || cNarr.includes("REV") || cNarr.includes("REVERSAL") || cNarr.includes("FAIL")) {
              reversals.push({
                original_id: debit.id,
                reversal_id: credit.id,
                amount: Number(debit.amount),
                date: credit.transaction_date,
                narration: credit.original_narration,
              });
              break;
            }
          }
        }
      }

      // 8. Overall Reconciliation Health Score
      const totalStatements = statementAudits.length;
      const reconciledStatements = statementAudits.filter((s) => s.reconciliation_status === "RECONCILED").length;
      const reconciledAccounts = accountAudits.filter((a) => a.status === "RECONCILED").length;
      const totalAccounts = accountAudits.length;

      const healthScore = totalStatements > 0
        ? Math.round(((reconciledStatements / totalStatements) * 0.6 + (totalAccounts > 0 ? (reconciledAccounts / totalAccounts) * 0.4 : 0.4)) * 100)
        : 100;

      return apiSuccess(
        {
          health_score: healthScore,
          summary: {
            total_accounts: totalAccounts,
            reconciled_accounts: reconciledAccounts,
            total_statements: totalStatements,
            reconciled_statements: reconciledStatements,
            discrepant_statements: totalStatements - reconciledStatements,
            detected_duplicates_count: duplicates.length,
            detected_reversals_count: reversals.length,
          },
          accounts: accountAudits,
          statements: statementAudits,
          duplicates: duplicates.slice(0, 20),
          reversals: reversals.slice(0, 20),
        },
        undefined,
        200,
        req
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Reconciliation dashboard failure";
      return apiError(msg, "INTERNAL_SERVER_ERROR", 500, undefined, req);
    }
  },
});

export const POST = createApiRoute({
  auth: "required",
  rateLimit: { limit: 15, windowSeconds: 60 },
  schema: ResolveDiscrepancySchema,
  handler: async ({ userId, body, req }) => {
    const { action, statement_id, account_id, notes } = body;

    if (action === "TRIGGER_TRANSFER_RECONCILIATION") {
      const result = await reconcileInternalTransfers(userId!, 90);
      await invalidateUserCaches(userId!, ["ACCOUNTS", "TRANSFERS", "LEDGER"]);
      return apiSuccess({
        action: "TRIGGER_TRANSFER_RECONCILIATION",
        transfers_matched: result.transfersReconciled,
        expenses_cleaned: result.expensesCleaned,
        income_cleaned: result.incomeCleaned,
        message: `Transfer reconciliation completed: ${result.transfersReconciled} cross-account transfers matched.`,
      }, undefined, 200, req);
    }

    if (action === "ACKNOWLEDGE_STATEMENT_DISCREPANCY" && statement_id) {
      const { error } = await supabaseAdmin
        .from("bank_statements")
        .update({
          reconciliation_status: "ACKNOWLEDGED",
          reconciliation_error: notes || "User acknowledged discrepancy manually",
          updated_at: new Date().toISOString(),
        })
        .eq("id", statement_id)
        .eq("user_id", userId!);

      if (error) {
        return apiError(error.message, "DATABASE_ERROR", 500, undefined, req);
      }

      await invalidateUserCaches(userId!, ["ACCOUNTS", "LEDGER"]);
      return apiSuccess({ success: true, message: "Statement discrepancy acknowledged." }, undefined, 200, req);
    }

    return apiError("Invalid reconciliation action or missing required IDs", "BAD_REQUEST", 400, undefined, req);
  },
});
