import { supabaseAdmin } from "@/utils/supabase/admin";
import { apiError, apiSuccess } from "@/utils/apiResponse";
import { createApiRoute } from "@/lib/backend/routeHandler";
import { encryptSensitiveData } from "@/utils/crypto";
import { invalidateUserCaches } from "@/lib/backend/cacheInvalidation";
import { getBankPasswordFormatDescription } from "@/utils/bankPasswords";
import { z } from "zod";

const SaveBankPasswordSchema = z.object({
  bank: z.string().min(1).max(50).optional(),
  password: z.string().min(1).max(100).optional(),
  bankPasswords: z.record(z.string(), z.string()).optional(),
});

/**
 * GET: Retrieve list of configured bank statement passwords for the authenticated user.
 * Plaintext passwords are never returned or logged; only configuration status and hints are provided.
 */
export const GET = createApiRoute({
  auth: "required",
  rateLimit: { limit: 60, windowSeconds: 60 },
  handler: async ({ userId, req }) => {
    const { data: hints, error } = await supabaseAdmin
      .from("statement_password_hints")
      .select("id, bank_name, hint_pattern, created_at, updated_at")
      .eq("user_id", userId!);

    if (error) {
      return apiError(error.message, "DATABASE_ERROR", 500, undefined, req);
    }

    const bankPasswords = (hints || [])
      .filter((h) => h.bank_name && h.bank_name !== "ALL" && h.hint_pattern !== "BANKING_IDENTITY" && h.hint_pattern !== "AUTO_PERMUTATION")
      .map((h) => ({
        id: h.id,
        bank: h.bank_name,
        hintPattern: h.hint_pattern,
        configured: true,
        formatHint: getBankPasswordFormatDescription(h.bank_name),
        updatedAt: h.updated_at,
      }));

    return apiSuccess({ bankPasswords }, undefined, 200, req);
  },
});

/**
 * POST: Encrypt and store one or more bank statement decryption passwords for future automated statements.
 */
export const POST = createApiRoute({
  auth: "required",
  rateLimit: { limit: 20, windowSeconds: 60 },
  schema: SaveBankPasswordSchema,
  handler: async ({ userId, body, req }) => {
    const pairs: Array<{ bank: string; password: string }> = [];

    if (body.bank && body.password) {
      pairs.push({ bank: body.bank.trim().toUpperCase(), password: body.password.trim() });
    }

    if (body.bankPasswords) {
      for (const [b, p] of Object.entries(body.bankPasswords)) {
        if (p && typeof p === "string" && p.trim()) {
          pairs.push({ bank: b.trim().toUpperCase(), password: p.trim() });
        }
      }
    }

    if (pairs.length === 0) {
      return apiError("Please provide a bank name and password to store.", "BAD_REQUEST", 400, undefined, req);
    }

    const savedBanks: string[] = [];

    for (const { bank, password } of pairs) {
      const encryptedSecret = encryptSensitiveData(password, "statement-passwords");

      const { data: existing } = await supabaseAdmin
        .from("statement_password_hints")
        .select("id")
        .eq("user_id", userId!)
        .eq("bank_name", bank)
        .maybeSingle();

      if (existing?.id) {
        await supabaseAdmin
          .from("statement_password_hints")
          .update({
            hint_pattern: "BANK_PASSWORD",
            encrypted_secret: encryptedSecret,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .eq("user_id", userId!);
      } else {
        await supabaseAdmin
          .from("statement_password_hints")
          .insert({
            user_id: userId!,
            bank_name: bank,
            hint_pattern: "BANK_PASSWORD",
            encrypted_secret: encryptedSecret,
            updated_at: new Date().toISOString(),
          });
      }

      savedBanks.push(bank);
    }

    await invalidateUserCaches(userId, ["ACCOUNTS", "PORTFOLIO", "LEDGER"]);

    return apiSuccess(
      {
        message: `Successfully encrypted and stored statement password(s) for ${savedBanks.join(", ")}.`,
        savedBanks,
      },
      undefined,
      200,
      req
    );
  },
});

/**
 * DELETE: Remove a stored bank statement password hint.
 */
export const DELETE = createApiRoute({
  auth: "required",
  rateLimit: { limit: 20, windowSeconds: 60 },
  handler: async ({ userId, req }) => {
    const url = new URL(req.url);
    const bank = url.searchParams.get("bank")?.trim().toUpperCase();

    if (!bank) {
      return apiError("Query parameter 'bank' is required.", "BAD_REQUEST", 400, undefined, req);
    }

    const { error } = await supabaseAdmin
      .from("statement_password_hints")
      .delete()
      .eq("user_id", userId!)
      .eq("bank_name", bank);

    if (error) {
      return apiError(error.message, "DATABASE_ERROR", 500, undefined, req);
    }

    await invalidateUserCaches(userId, ["ACCOUNTS", "PORTFOLIO", "LEDGER"]);

    return apiSuccess({ message: `Removed statement password for ${bank}.` }, undefined, 200, req);
  },
});
