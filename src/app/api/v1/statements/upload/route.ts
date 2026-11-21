import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/utils/auth";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { apiUnauthorized, apiError, extractRequestId } from "@/utils/apiResponse";
import { rateLimit } from "@/utils/rateLimit";
import { logger } from "@/utils/logger";
import { invalidateCachedData, getUserCacheKey, CACHE_KEYS } from "@/utils/redis";
import { reconcileInternalTransfers } from "@/utils/transfers";
import { validateMonetaryAmount } from "@/utils/money";
import crypto from "crypto";

const PYTHON_SERVICE_URL =
  process.env.PYTHON_BACKEND_URL ||
  process.env.PYTHON_SERVICE_URL ||
  "http://127.0.0.1:8000";

export async function POST(req: NextRequest) {
  const requestId = extractRequestId(req);
  const { user, userId, error: authError } = await getAuthenticatedUser(req);

  if (!user || !userId) {
    return apiUnauthorized(authError || "Unauthorized", req);
  }

  // Rate limit: 20 statement uploads per minute
  const rl = await rateLimit(`stmt_upload:${userId}`, 20, 60);
  if (!rl.success) {
    return apiError("Too many statement upload requests. Please wait a moment.", "RATE_LIMITED", 429, undefined, req);
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const accountId = formData.get("account_id") as string | null;
    const password = formData.get("password") as string | null;

    if (!file) {
      return apiError("No file provided for upload.", "BAD_REQUEST", 400, undefined, req);
    }

    // Limit statement size to 10MB
    if (file.size > 10 * 1024 * 1024) {
      return apiError("File exceeds maximum allowed size of 10MB.", "BAD_REQUEST", 400, undefined, req);
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileHash = crypto.createHash("sha256").update(buffer).digest("hex");

    // 1. Check for duplicate statement file
    const { data: existingStmt } = await supabaseAdmin
      .from("bank_statements")
      .select("id, file_name, created_at, reconciliation_status")
      .eq("user_id", userId)
      .eq("file_hash", fileHash)
      .maybeSingle();

    if (existingStmt) {
      return NextResponse.json({
        success: false,
        error: `Statement file '${file.name}' has already been imported on ${new Date(existingStmt.created_at).toLocaleDateString()}.`,
        duplicate: true,
        statementId: existingStmt.id,
      }, { status: 409 });
    }

    // 2. Send to Python Calculation & Parsing Engine
    const internalKey =
      process.env.INTERNAL_SERVICE_KEY ||
      process.env.CRON_SECRET ||
      "";

    const base64Content = buffer.toString("base64");
    const pyPayload = {
      user_id: userId,
      filename: file.name,
      content_base64: base64Content,
      passwords: password ? [password.trim()] : [],
      account_id: accountId || undefined,
    };

    const pyRes = await fetch(`${PYTHON_SERVICE_URL}/api/py/statements/parse`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Request-Id": requestId,
        "X-User-Id": userId,
        ...(internalKey ? { "X-Internal-Service-Key": internalKey } : {}),
      },
      body: JSON.stringify(pyPayload),
    });

    if (!pyRes.ok) {
      const errJson = await pyRes.json().catch(() => ({}));
      const detail = errJson.detail || errJson.message || "Failed to parse statement.";
      return NextResponse.json(
        { success: false, error: typeof detail === "string" ? detail : JSON.stringify(detail) },
        { status: pyRes.status }
      );
    }

    const pyData = await pyRes.json();
    const parseResult = pyData.result;
    const metadata = parseResult.metadata;
    const validation = parseResult.validation;
    const transactions = parseResult.transactions || [];

    // 3. Resolve Target Account ID (Use provided, or create / match bank account)
    let targetAccountId = accountId;
    if (!targetAccountId) {
      const { data: accounts } = await supabaseAdmin
        .from("accounts")
        .select("id, name, type")
        .eq("user_id", userId);

      const matchedAccount = (accounts || []).find((a) =>
        a.name.toLowerCase().includes(parseResult.bank_name.toLowerCase())
      );

      if (matchedAccount) {
        targetAccountId = matchedAccount.id;
      } else {
        // Create an account for this bank
        const { data: newAcc } = await supabaseAdmin
          .from("accounts")
          .insert({
            user_id: userId,
            name: `${parseResult.bank_name.toUpperCase()} Account`,
            type: "Savings Account",
            balance: Number(metadata.closing_balance),
            last_four: metadata.account_number_masked?.slice(-4) || "0000",
          })
          .select("id")
          .single();
        targetAccountId = newAcc?.id;
      }
    }

    // 4. Insert into bank_statements
    const { data: stmtRecord, error: stmtError } = await supabaseAdmin
      .from("bank_statements")
      .insert({
        user_id: userId,
        account_id: targetAccountId,
        bank_name: parseResult.bank_name,
        statement_source: "MANUAL_UPLOAD",
        file_name: file.name,
        file_hash: fileHash,
        period_start: metadata.statement_period_start,
        period_end: metadata.statement_period_end,
        opening_balance: Number(metadata.opening_balance),
        closing_balance: Number(metadata.closing_balance),
        total_credits: Number(validation.total_credits),
        total_debits: Number(validation.total_debits),
        transaction_count: transactions.length,
        reconciliation_status: validation.is_valid ? "RECONCILED" : "DISCREPANCY",
        reconciliation_error: validation.errors?.length > 0 ? validation.errors.join("; ") : null,
        parser_version: parseResult.parser_version,
      })
      .select()
      .single();

    if (stmtError) {
      logger.error("Database statement record insert failed", "StatementUpload", stmtError);
      return apiError(`Failed to record statement in database: ${stmtError.message}`, "INTERNAL_ERROR", 500, undefined, req);
    }

    // 5. Insert transactions into canonical_transactions with deduplication
    let importedCount = 0;
    let duplicateCount = 0;

    const rowsToInsert = transactions.map((t: any) => {
      const parsedAmount = validateMonetaryAmount(t.amount, {
        fieldName: "Statement transaction amount",
        allowNegative: false,
      });
      const dedupRaw = `${targetAccountId}:${t.transaction_date}:${parsedAmount}:${t.direction}:${t.transaction_reference || t.normalized_narration}`;
      const dedupHash = crypto.createHash("sha256").update(dedupRaw).digest("hex");

      return {
        user_id: userId,
        account_id: targetAccountId,
        statement_id: stmtRecord.id,
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
        classification_confidence: t.classification_confidence || 0.5000,
        classification_reason: t.classification_reason,
        is_transfer: t.is_transfer || false,
        raw_data: t.raw_metadata || {},
        dedup_hash: dedupHash,
      };
    });

    if (rowsToInsert.length > 0) {
      const { data: inserted, error: txError } = await supabaseAdmin
        .from("canonical_transactions")
        .upsert(rowsToInsert, { onConflict: "user_id,dedup_hash", ignoreDuplicates: true })
        .select("id, dedup_hash");

      if (txError) {
        logger.warn("Warning inserting canonical transactions", "StatementUpload", { error: txError.message });
      }

      // Track exact newly inserted records
      const insertedList = (inserted || []) as Array<{ id: string; dedup_hash: string }>;
      const newCanonicalMap = new Map(insertedList.map((r) => [r.dedup_hash, r.id]));
      importedCount = insertedList.length;
      duplicateCount = rowsToInsert.length - importedCount;

      // 5b. Synchronize ONLY newly inserted, non-transfer canonical records into expenses and income
      for (const row of rowsToInsert) {
        if (row.is_transfer) continue; // Exclude internal transfers from income/expenses
        const canonicalId = newCanonicalMap.get(row.dedup_hash);
        if (!canonicalId) {
          // Transaction already exists in database; skip to prevent duplicate insertion
          continue;
        }

        if (row.direction === "DEBIT") {
          await supabaseAdmin.from("expenses").upsert({
            user_id: userId,
            account_id: targetAccountId,
            amount: row.amount,
            category: row.category || "Food & Dining",
            expense_date: row.transaction_date,
            title: row.merchant_name || row.normalized_narration,
            notes: `Statement import: ${row.original_narration}`,
            tags: ["statement_import", "verified"],
            canonical_transaction_id: canonicalId,
          }, { onConflict: "user_id,canonical_transaction_id", ignoreDuplicates: true });
        } else if (row.direction === "CREDIT") {
          await supabaseAdmin.from("income").upsert({
            user_id: userId,
            account_id: targetAccountId,
            amount: row.amount,
            category: row.category === "Salary" ? "Salary" : "Other Income",
            received_date: row.transaction_date,
            title: row.counterparty_name || row.normalized_narration,
            notes: `Statement import: ${row.original_narration}`,
            tags: ["statement_import", "verified"],
            canonical_transaction_id: canonicalId,
          }, { onConflict: "user_id,canonical_transaction_id", ignoreDuplicates: true });
        }
      }
    }

    // 6. Update target account balance ONLY if this statement is the latest verified statement
    if (validation.is_valid && targetAccountId && metadata.closing_balance !== undefined) {
      const stmtPeriodEnd = metadata.statement_period_end;
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
          logger.info("Preserving newer account balance; uploaded statement is older than existing verified statement", "StatementUpload", {
            accountId: targetAccountId,
            statementPeriodEnd: stmtPeriodEnd,
            newerStatementPeriodEnd: newerStatements[0].period_end,
          });
        }
      }

      if (isLatestStatement) {
        const validClosingBalance = validateMonetaryAmount(metadata.closing_balance, {
          fieldName: "Account closing balance",
          allowNegative: true,
        });
        await supabaseAdmin
          .from("accounts")
          .update({ balance: validClosingBalance })
          .eq("id", targetAccountId)
          .eq("user_id", userId);
      }
    }

    // 6b. Automatically reconcile internal transfers across canonical transactions
    let transfersReconciledCount = 0;
    try {
      const recResult = await reconcileInternalTransfers(userId, 60);
      transfersReconciledCount = recResult.transfersReconciled;
    } catch (recErr) {
      logger.warn("Automated transfer reconciliation notice in StatementUpload", "StatementUpload", { error: String(recErr) });
    }

    // 7. Invalidate multi-tier caches to trigger immediate UI consistency
    try {
      await invalidateCachedData([
        getUserCacheKey(userId, CACHE_KEYS.ACCOUNTS),
        getUserCacheKey(userId, CACHE_KEYS.EXPENSES),
        getUserCacheKey(userId, CACHE_KEYS.INCOME),
        getUserCacheKey(userId, CACHE_KEYS.PORTFOLIO),
        getUserCacheKey(userId, CACHE_KEYS.LEDGER),
        getUserCacheKey(userId, CACHE_KEYS.TRANSFERS),
      ]);
    } catch {}

    return NextResponse.json({
      success: true,
      statement: stmtRecord,
      validation,
      importedCount,
      duplicateCount,
      transfersReconciledCount,
      totalExtracted: transactions.length,
      bankName: parseResult.bank_name,
    }, { headers: { "X-Request-Id": requestId } });

  } catch (err: unknown) {
    logger.error("Statement upload error", "StatementUpload", err);
    return apiError("Unexpected error during statement ingestion.", "INTERNAL_ERROR", 500, undefined, req);
  }
}
