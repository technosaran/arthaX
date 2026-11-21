import { supabaseAdmin } from "@/utils/supabase/admin";
import { encryptSensitiveData, decryptSensitiveData } from "@/utils/crypto";
import { logger } from "@/utils/logger";
import { invalidateCachedData, getUserCacheKey, CACHE_KEYS } from "@/utils/redis";
import { reconcileInternalTransfers } from "@/utils/transfers";
import { validateMonetaryAmount } from "@/utils/money";
import crypto from "crypto";

export interface GoogleTokenRefreshResult {
  accessToken: string;
  expiresIn: number;
}

/**
 * Refreshes an expired Google OAuth access token using the stored encrypted refresh token.
 */
export async function refreshGoogleAccessToken(
  encryptedRefreshToken: string
): Promise<GoogleTokenRefreshResult | null> {
  const refreshToken = decryptSensitiveData(encryptedRefreshToken, "gmail-tokens");
  if (!refreshToken) {
    logger.warn("No refresh token available to refresh Google access token", "GmailService");
    return null;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    logger.warn("GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not configured", "GmailService");
    return null;
  }

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      logger.error("Failed to refresh Google OAuth token", "GmailService", undefined, { status: res.status, error: errText });
      return null;
    }

    const data = await res.json();
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in || 3600,
    };
  } catch (err: unknown) {
    logger.error("Exception during Google OAuth token refresh", "GmailService", err);
    return null;
  }
}

/**
 * Resolves password candidates for a user strictly from user-authorized hints.
 * Enforces zero guessing from personal info or account numbers, in-memory decryption,
 * and bounds candidates to MAX_PASSWORD_ATTEMPTS = 10.
 * Secrets are decrypted securely in memory and never logged or exposed.
 */
export async function fetchUserPasswordCandidates(userId: string): Promise<string[]> {
  const candidates: string[] = [];

  try {
    // 1. Fetch encrypted hints strictly from statement_password_hints
    const { data: hints } = await supabaseAdmin
      .from("statement_password_hints")
      .select("encrypted_secret, hint_pattern")
      .eq("user_id", userId);

    if (hints && hints.length > 0) {
      for (const h of hints) {
        if (h.encrypted_secret) {
          const decrypted = decryptSensitiveData(h.encrypted_secret, "statement-passwords");
          if (decrypted && typeof decrypted === "string") {
            const trimmed = decrypted.trim();
            if (trimmed && !candidates.includes(trimmed)) {
              candidates.push(trimmed);
            }
          }
        }
      }
    }
  } catch (err) {
    logger.warn("Could not load authorized password hints for user", "GmailService", { userId });
  }

  // Bound to MAX_PASSWORD_ATTEMPTS = 10
  return candidates.slice(0, 10);
}

export interface GmailSyncOptions {
  maxMessages?: number;
  afterDate?: string;
  customQuery?: string;
}

/**
 * Executes statement sync and financial ingestion pipeline for a given user.
 */
export async function syncUserGmailStatements(
  userId: string,
  options?: GmailSyncOptions
): Promise<{
  success: boolean;
  statementsCount: number;
  transactionsImported: number;
  duplicatesSkipped: number;
  transfersMatched?: number;
  failedCount?: number;
  status?: "COMPLETED" | "PARTIAL" | "FAILED";
  error?: string;
}> {
  // 1. Fetch user's Gmail integration
  const { data: integration, error: intErr } = await supabaseAdmin
    .from("gmail_integrations")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (intErr || !integration) {
    return {
      success: false,
      statementsCount: 0,
      transactionsImported: 0,
      duplicatesSkipped: 0,
      transfersMatched: 0,
      failedCount: 0,
      status: "FAILED",
      error: "Gmail integration not configured",
    };
  }

  if (integration.sync_status === "DISCONNECTED") {
    return {
      success: false,
      statementsCount: 0,
      transactionsImported: 0,
      duplicatesSkipped: 0,
      transfersMatched: 0,
      failedCount: 0,
      status: "FAILED",
      error: "Gmail integration is disconnected",
    };
  }

  // 2. Token refresh check
  let accessToken: string | null = null;
  const isExpired = !integration.token_expiry || new Date(integration.token_expiry) <= new Date(Date.now() + 60000);

  if (isExpired && integration.refresh_token_encrypted) {
    const refreshed = await refreshGoogleAccessToken(integration.refresh_token_encrypted);
    if (refreshed) {
      accessToken = refreshed.accessToken;
      const newExpiry = new Date(Date.now() + refreshed.expiresIn * 1000).toISOString();
      const encAccess = encryptSensitiveData(accessToken, "gmail-tokens");

      await supabaseAdmin
        .from("gmail_integrations")
        .update({
          access_token_encrypted: encAccess,
          token_expiry: newExpiry,
          sync_status: "ACTIVE",
          error_details: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", integration.id);
    } else {
      await supabaseAdmin
        .from("gmail_integrations")
        .update({ sync_status: "EXPIRED", error_details: "OAuth token expired and refresh failed", updated_at: new Date().toISOString() })
        .eq("id", integration.id);
      return {
        success: false,
        statementsCount: 0,
        transactionsImported: 0,
        duplicatesSkipped: 0,
        transfersMatched: 0,
        failedCount: 0,
        status: "FAILED",
        error: "Google OAuth token expired",
      };
    }
  } else if (integration.access_token_encrypted) {
    accessToken = decryptSensitiveData(integration.access_token_encrypted, "gmail-tokens");
  }

  if (!accessToken) {
    return {
      success: false,
      statementsCount: 0,
      transactionsImported: 0,
      duplicatesSkipped: 0,
      transfersMatched: 0,
      failedCount: 0,
      status: "FAILED",
      error: "No valid access token available",
    };
  }

  // 3. Password candidates
  const passwordCandidates = await fetchUserPasswordCandidates(userId);

  // 4. Create running automation_jobs record
  const { data: jobRecord } = await supabaseAdmin
    .from("automation_jobs")
    .insert({
      user_id: userId,
      job_type: "GMAIL_SYNC",
      status: "RUNNING",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  const pythonServiceUrl =
    process.env.PYTHON_BACKEND_URL ||
    process.env.PYTHON_SERVICE_URL ||
    "http://127.0.0.1:8000";

  const internalKey =
    process.env.INTERNAL_SERVICE_KEY ||
    process.env.CRON_SECRET ||
    "";

  // Determine bounded batch size (min 5, max 100, default 25)
  const batchLimit = Math.min(Math.max(options?.maxMessages ?? 25, 5), 100);

  // Determine checkpoint after_date with safety margin to avoid reprocessing entire mailbox
  let afterDateStr: string | undefined = options?.afterDate;
  if (!afterDateStr && integration.last_sync_at) {
    const lastSync = new Date(integration.last_sync_at);
    lastSync.setDate(lastSync.getDate() - 1); // 1-day safety buffer
    const yyyy = lastSync.getFullYear();
    const mm = String(lastSync.getMonth() + 1).padStart(2, "0");
    const dd = String(lastSync.getDate()).padStart(2, "0");
    afterDateStr = `${yyyy}/${mm}/${dd}`;
  }

  try {
    const pyRes = await fetch(`${pythonServiceUrl}/api/py/statements/gmail/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-User-Id": userId,
        ...(internalKey ? { "X-Internal-Service-Key": internalKey } : {}),
      },
      body: JSON.stringify({
        user_id: userId,
        access_token: accessToken,
        password_candidates: passwordCandidates,
        after_date: afterDateStr,
        max_messages: batchLimit,
        custom_query: options?.customQuery,
      }),
    });

    if (!pyRes.ok) {
      const errText = await pyRes.text();
      throw new Error(`Calculation engine Gmail sync returned ${pyRes.status}: ${errText}`);
    }

    const pyData = await pyRes.json();
    const statements = pyData.statements || [];
    let totalImported = 0;
    let totalDuplicates = 0;

    for (const stmt of statements) {
      const messageId = stmt.email_metadata?.message_id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const attachmentId = stmt.file_hash || `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const fileName = stmt.file_name || "gmail_statement.pdf";
      const bankName = stmt.bank_name || stmt.detected_bank || "BANK";

      // If statement failed in extraction or decryption, record failed attachment job
      if (!stmt.success) {
        try {
          await supabaseAdmin.from("statement_attachment_jobs").upsert(
            {
              user_id: userId,
              message_id: messageId,
              attachment_id: attachmentId,
              filename: fileName,
              file_hash: stmt.file_hash || null,
              bank_name: bankName,
              status: "FAILED",
              error_message: (stmt.errors || []).join("; ") || "Statement ingestion failed",
              retry_count: 1,
              metadata: stmt.email_metadata || {},
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,message_id,attachment_id" }
          );
        } catch {}
        continue;
      }

      const meta = stmt.metadata || {};
      const validation = stmt.validation || {};
      const txs = stmt.transactions || [];
      const fileHash = stmt.file_hash;

      // Match or resolve user account
      const { data: accounts } = await supabaseAdmin
        .from("accounts")
        .select("id, name, type")
        .eq("user_id", userId);

      let targetAccountId = (accounts || []).find((a) =>
        a.name.toLowerCase().includes(bankName.toLowerCase())
      )?.id;

      if (!targetAccountId) {
        const { data: newAcc } = await supabaseAdmin
          .from("accounts")
          .insert({
            user_id: userId,
            name: `${bankName.toUpperCase()} Account`,
            type: "Savings Account",
            balance: Number(meta.closing_balance || 0),
            last_four: meta.account_number_masked?.slice(-4) || "0000",
          })
          .select("id")
          .single();
        targetAccountId = newAcc?.id;
      }

      // Insert statement record
      const { data: stmtRecord } = await supabaseAdmin
        .from("bank_statements")
        .upsert(
          {
            user_id: userId,
            account_id: targetAccountId,
            bank_name: bankName,
            statement_source: "GMAIL_AUTO",
            file_name: fileName,
            file_hash: fileHash,
            period_start: meta.statement_period_start || new Date().toISOString().split("T")[0],
            period_end: meta.statement_period_end || new Date().toISOString().split("T")[0],
            opening_balance: Number(meta.opening_balance || 0),
            closing_balance: Number(meta.closing_balance || 0),
            total_credits: Number(validation.total_credits || 0),
            total_debits: Number(validation.total_debits || 0),
            transaction_count: txs.length,
            reconciliation_status: validation.is_valid ? "RECONCILED" : "DISCREPANCY",
            reconciliation_error: validation.errors?.length ? validation.errors.join("; ") : null,
            parser_version: stmt.parser_version || "2.0.0",
            raw_metadata: stmt.email_metadata || {},
          },
          { onConflict: "user_id,file_hash" }
        )
        .select("id")
        .single();

      const stmtId = stmtRecord?.id;

      // Record attachment job state
      try {
        await supabaseAdmin.from("statement_attachment_jobs").upsert(
          {
            user_id: userId,
            message_id: messageId,
            attachment_id: attachmentId,
            filename: fileName,
            file_hash: fileHash,
            bank_name: bankName,
            status: validation.is_valid ? "RECONCILED" : "IMPORTED",
            statement_id: stmtId,
            metadata: stmt.email_metadata || {},
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,message_id,attachment_id" }
        );
      } catch {}

      // Prepare canonical transactions with strict monetary validation
      const canonicalRows = txs.map((t: any) => {
        const parsedAmount = validateMonetaryAmount(t.amount, {
          fieldName: "Gmail transaction amount",
          allowNegative: false,
        });
        const dedupRaw = `${targetAccountId}:${t.transaction_date}:${parsedAmount}:${t.direction}:${t.transaction_reference || t.normalized_narration}`;
        const dedupHash = crypto.createHash("sha256").update(dedupRaw).digest("hex");

        return {
          user_id: userId,
          account_id: targetAccountId,
          statement_id: stmtId,
          transaction_date: t.transaction_date,
          value_date: t.value_date || t.transaction_date,
          amount: parsedAmount,
          currency: "INR",
          direction: t.direction,
          original_narration: t.original_narration,
          normalized_narration: t.normalized_narration,
          transaction_reference: t.transaction_reference,
          counterparty_name: t.counterparty_name,
          counterparty_identifier: t.counterparty_identifier,
          merchant_name: t.merchant_name,
          merchant_category: t.merchant_category,
          channel: t.channel || "OTHER",
          category: t.category || "Unknown",
          transaction_type: t.transaction_type || "UNKNOWN",
          classification_confidence: t.classification_confidence || 0.8500,
          classification_reason: t.classification_reason,
          is_transfer: t.is_transfer || false,
          raw_data: t.raw_metadata || {},
          dedup_hash: dedupHash,
        };
      });

      if (canonicalRows.length > 0) {
        const { data: inserted } = await supabaseAdmin
          .from("canonical_transactions")
          .upsert(canonicalRows, { onConflict: "user_id,dedup_hash", ignoreDuplicates: true })
          .select("id, dedup_hash");

        const insertedList = (inserted || []) as Array<{ id: string; dedup_hash: string }>;
        const newCanonicalMap = new Map(insertedList.map((r) => [r.dedup_hash, r.id]));
        const insertedCount = insertedList.length;
        totalImported += insertedCount;
        totalDuplicates += canonicalRows.length - insertedCount;

        // Synchronize ONLY newly inserted non-transfer canonical records into expenses and income
        for (const row of canonicalRows) {
          if (row.is_transfer) continue; // Transfers are reconciled separately
          const canonicalId = newCanonicalMap.get(row.dedup_hash);
          if (!canonicalId) {
            // Already imported in a previous statement run; skip to prevent duplication
            continue;
          }

          if (row.direction === "DEBIT") {
            await supabaseAdmin
              .from("expenses")
              .upsert({
                user_id: userId,
                account_id: targetAccountId,
                amount: row.amount,
                category: row.category,
                expense_date: row.transaction_date,
                title: row.merchant_name || row.normalized_narration,
                notes: `Bank statement import: ${row.original_narration}`,
                tags: ["statement_import", "verified"],
                canonical_transaction_id: canonicalId,
              }, { onConflict: "user_id,canonical_transaction_id", ignoreDuplicates: true });
          } else if (row.direction === "CREDIT") {
            await supabaseAdmin
              .from("income")
              .upsert({
                user_id: userId,
                account_id: targetAccountId,
                amount: row.amount,
                category: row.category === "Salary" ? "Salary" : "Other Income",
                received_date: row.transaction_date,
                title: row.counterparty_name || row.normalized_narration,
                notes: `Bank statement import: ${row.original_narration}`,
                tags: ["statement_import", "verified"],
                canonical_transaction_id: canonicalId,
              }, { onConflict: "user_id,canonical_transaction_id", ignoreDuplicates: true });
          }
        }
      }

      // Update account balance only if this statement represents the latest verified period
      if (validation.is_valid && targetAccountId && meta.closing_balance !== undefined) {
        const stmtPeriodEnd = meta.statement_period_end;
        let isLatestStatement = true;

        if (stmtPeriodEnd) {
          const { data: newerStatements } = await supabaseAdmin
            .from("bank_statements")
            .select("id, period_end")
            .eq("user_id", userId)
            .eq("account_id", targetAccountId)
            .eq("reconciliation_status", "RECONCILED")
            .gt("period_end", stmtPeriodEnd)
            .limit(1);

          if (newerStatements && newerStatements.length > 0) {
            isLatestStatement = false;
            logger.info("Preserving newer account balance; gmail statement is older than existing verified statement", "GmailService", {
              accountId: targetAccountId,
              statementPeriodEnd: stmtPeriodEnd,
              newerPeriodEnd: newerStatements[0].period_end,
            });
          }
        }

        if (isLatestStatement) {
          const validClosingBalance = validateMonetaryAmount(meta.closing_balance, {
            fieldName: "Closing balance",
            allowNegative: true,
          });
          await supabaseAdmin
            .from("accounts")
            .update({ balance: validClosingBalance })
            .eq("id", targetAccountId)
            .eq("user_id", userId);
        }
      }
    }

    // Reconcile internal transfers across accounts
    let transfersMatchedCount = 0;
    try {
      const recResult = await reconcileInternalTransfers(userId, 60);
      transfersMatchedCount = recResult.transfersReconciled;
    } catch (recErr) {
      logger.warn("Transfer reconciliation notice during Gmail sync", "GmailService", { error: String(recErr) });
    }

    const failedStatements = statements.filter((s: any) => !s.success);
    const hasFailures = failedStatements.length > 0;
    const finalJobStatus: "COMPLETED" | "PARTIAL" | "FAILED" = hasFailures
      ? (failedStatements.length === statements.length ? "FAILED" : "PARTIAL")
      : "COMPLETED";

    const failureSummary = hasFailures
      ? failedStatements.map((f: any) => `${f.file_name || 'attachment'}: ${(f.errors || []).join(', ')}`).join("; ")
      : null;

    // Durable Checkpoint Determination:
    // If statements failed, do not advance last_sync_at past that failed message's date
    let nextSyncTimestamp: string;
    if (!hasFailures) {
      nextSyncTimestamp = new Date().toISOString();
    } else if (failedStatements.length === statements.length) {
      nextSyncTimestamp = integration.last_sync_at || new Date(0).toISOString();
    } else {
      let earliestFailedDate: Date | null = null;
      for (const f of failedStatements) {
        const dateStr = f.email_metadata?.date;
        if (dateStr) {
          const parsedD = new Date(dateStr);
          if (!isNaN(parsedD.getTime())) {
            if (!earliestFailedDate || parsedD < earliestFailedDate) {
              earliestFailedDate = parsedD;
            }
          }
        }
      }

      if (earliestFailedDate) {
        earliestFailedDate.setDate(earliestFailedDate.getDate() - 1);
        nextSyncTimestamp = earliestFailedDate.toISOString();
      } else {
        nextSyncTimestamp = integration.last_sync_at || new Date(0).toISOString();
      }
    }

    // Invalidate affected caches
    await invalidateCachedData([
      getUserCacheKey(userId, CACHE_KEYS.ACCOUNTS),
      getUserCacheKey(userId, CACHE_KEYS.EXPENSES),
      getUserCacheKey(userId, CACHE_KEYS.INCOME),
      getUserCacheKey(userId, CACHE_KEYS.PORTFOLIO),
      getUserCacheKey(userId, CACHE_KEYS.LEDGER),
      getUserCacheKey(userId, CACHE_KEYS.TRANSFERS),
    ]);

    // Update job record
    if (jobRecord) {
      await supabaseAdmin
        .from("automation_jobs")
        .update({
          status: finalJobStatus,
          completed_at: new Date().toISOString(),
          error_message: failureSummary,
          stats: {
            statementsCount: statements.length,
            failedCount: failedStatements.length,
            transactionsImported: totalImported,
            duplicatesSkipped: totalDuplicates,
            transfersMatched: transfersMatchedCount,
          },
        })
        .eq("id", jobRecord.id);
    }

    // Update integration last sync timestamp with durable checkpoint
    await supabaseAdmin
      .from("gmail_integrations")
      .update({
        last_sync_at: nextSyncTimestamp,
        sync_status: hasFailures && failedStatements.length === statements.length ? "FAILED" : "ACTIVE",
        error_details: failureSummary,
      })
      .eq("id", integration.id);

    return {
      success: !hasFailures,
      statementsCount: statements.length,
      transactionsImported: totalImported,
      duplicatesSkipped: totalDuplicates,
      transfersMatched: transfersMatchedCount,
      failedCount: failedStatements.length,
      status: finalJobStatus,
      error: failureSummary || undefined,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error("Error during Gmail statement ingestion", "GmailService", err, { userId });

    if (jobRecord) {
      await supabaseAdmin
        .from("automation_jobs")
        .update({
          status: "FAILED",
          completed_at: new Date().toISOString(),
          error_message: errorMsg,
          retry_count: 1,
        })
        .eq("id", jobRecord.id);
    }

    return {
      success: false,
      statementsCount: 0,
      transactionsImported: 0,
      duplicatesSkipped: 0,
      transfersMatched: 0,
      failedCount: 0,
      status: "FAILED",
      error: errorMsg,
    };
  }
}
