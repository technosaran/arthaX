import { supabaseAdmin } from "@/utils/supabase/admin";
import { apiError, apiSuccess } from "@/utils/apiResponse";
import { createApiRoute } from "@/lib/backend/routeHandler";
import { encryptSensitiveData, decryptSensitiveData } from "@/utils/crypto";
import { invalidateUserCaches } from "@/lib/backend/cacheInvalidation";
import { generateBankPasswordPermutations, BankingIdentityDetails } from "@/utils/bankPasswords";
import { z } from "zod";

const IdentitySchema = z.object({
  name: z.string().max(100).optional().nullable(),
  pan: z.string().max(20).optional().nullable(),
  dob: z.string().max(30).optional().nullable(),
  phone: z.string().max(25).optional().nullable(),
  accountNumber: z.string().max(50).optional().nullable(),
  bankPasswords: z.record(z.string(), z.string()).optional().nullable(),
});

/**
 * GET: Retrieve user's masked banking and personal identity
 */
export const GET = createApiRoute({
  auth: "required",
  rateLimit: { limit: 60, windowSeconds: 60 },
  handler: async ({ userId, req }) => {
    const { data: hints, error } = await supabaseAdmin
      .from("statement_password_hints")
      .select("id, bank_name, hint_pattern, encrypted_secret, updated_at")
      .eq("user_id", userId!);

    if (error) {
      return apiError(error.message, "DATABASE_ERROR", 500, undefined, req);
    }

    const identityHint = hints?.find((h) => h.hint_pattern === "BANKING_IDENTITY");
    const bankingIdentity = {
      hasPan: false,
      panMasked: null as string | null,
      hasDob: false,
      dobMasked: null as string | null,
      hasPhone: false,
      phoneMasked: null as string | null,
      hasAccountNumber: false,
      accountNumberMasked: null as string | null,
    };

    if (identityHint?.encrypted_secret) {
      try {
        const decrypted = decryptSensitiveData(identityHint.encrypted_secret, "statement-passwords");
        if (decrypted) {
          const parsed: BankingIdentityDetails = JSON.parse(decrypted);
          if (parsed.pan) {
            const cleanPan = parsed.pan.trim().toUpperCase();
            bankingIdentity.hasPan = true;
            bankingIdentity.panMasked = `${cleanPan.slice(0, 2)}****${cleanPan.slice(-2)}`;
          }
          if (parsed.dob) {
            bankingIdentity.hasDob = true;
            bankingIdentity.dobMasked = `****-**-${parsed.dob.trim().slice(-2)}`;
          }
          if (parsed.phone) {
            const cleanPhone = parsed.phone.replace(/\D/g, "");
            bankingIdentity.hasPhone = true;
            bankingIdentity.phoneMasked = `******${cleanPhone.slice(-4)}`;
          }
          if (parsed.accountNumber) {
            const cleanAcc = parsed.accountNumber.trim();
            bankingIdentity.hasAccountNumber = true;
            bankingIdentity.accountNumberMasked = cleanAcc.length > 4 ? `••••••••${cleanAcc.slice(-4)}` : "••••";
          }
        }
      } catch {
        // Safe decryption ignore
      }
    }

    const bankPasswordsList: Array<{ bank: string; configured: boolean; updatedAt?: string }> = [];
    if (hints && hints.length > 0) {
      for (const h of hints) {
        if (h.bank_name && h.bank_name !== "ALL" && h.encrypted_secret) {
          bankPasswordsList.push({
            bank: h.bank_name,
            configured: true,
            updatedAt: h.updated_at || undefined,
          });
        }
      }
    }

    return apiSuccess({ bankingIdentity, bankPasswords: bankPasswordsList }, undefined, 200, req);
  },
});

/**
 * POST: Save or update user's banking identity details (PAN, DOB, Phone, Account Number, Name)
 */
export const POST = createApiRoute({
  auth: "required",
  rateLimit: { limit: 20, windowSeconds: 60 },
  schema: IdentitySchema,
  handler: async ({ userId, body, req }) => {
    const { name, pan, dob, phone, accountNumber } = body;

    // Optional name update on user_settings
    if (name && name.trim()) {
      await supabaseAdmin.from("user_settings").upsert({
        id: userId!,
        name: name.trim(),
        updated_at: new Date().toISOString(),
      });
    }

    // Retrieve existing identity to allow partial updates
    let existingIdentity: BankingIdentityDetails = {};
    const hintsQuery = supabaseAdmin.from("statement_password_hints");
    if (hintsQuery && typeof hintsQuery.select === "function") {
      try {
        const { data: existingHint } = await hintsQuery
          .select("encrypted_secret")
          .eq("user_id", userId!)
          .eq("hint_pattern", "BANKING_IDENTITY")
          .maybeSingle();

        if (existingHint?.encrypted_secret) {
          const decrypted = decryptSensitiveData(existingHint.encrypted_secret, "statement-passwords");
          if (decrypted) existingIdentity = JSON.parse(decrypted);
        }
      } catch {
        // Safe ignore
      }
    }

    const hasNewInput =
      (pan && pan.trim()) ||
      (dob && dob.trim()) ||
      (phone && phone.trim()) ||
      (accountNumber && accountNumber.trim());

    if (hasNewInput || Object.keys(existingIdentity).length > 0) {
      const identityObj: BankingIdentityDetails = {
        pan: pan !== undefined ? (pan?.trim().toUpperCase() || null) : (existingIdentity.pan || null),
        dob: dob !== undefined ? (dob?.trim() || null) : (existingIdentity.dob || null),
        phone: phone !== undefined ? (phone?.trim() || null) : (existingIdentity.phone || null),
        accountNumber: accountNumber !== undefined ? (accountNumber?.trim() || null) : (existingIdentity.accountNumber || null),
      };

      const encryptedIdentity = encryptSensitiveData(JSON.stringify(identityObj), "statement-passwords");
      await supabaseAdmin.from("statement_password_hints").upsert(
        {
          user_id: userId!,
          bank_name: "ALL",
          hint_pattern: "BANKING_IDENTITY",
          encrypted_secret: encryptedIdentity,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,bank_name,account_id" }
      );

      // Store specific Account Number candidate for Indian Bank & Axis auto-decryption
      if (identityObj.accountNumber) {
        const encryptedAcc = encryptSensitiveData(identityObj.accountNumber, "statement-passwords");
        await supabaseAdmin.from("statement_password_hints").upsert(
          {
            user_id: userId!,
            bank_name: "INDIAN_BANK",
            hint_pattern: "ACCOUNT_NUMBER",
            encrypted_secret: encryptedAcc,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,bank_name,account_id" }
        );
      }

      // Auto-generate permutations for SBI, HDFC, ICICI, Axis, Kotak, Indian Bank, etc.
      const permutations = generateBankPasswordPermutations(identityObj);
      if (permutations.length > 0) {
        const primaryHint = permutations[0];
        const encryptedPrimary = encryptSensitiveData(primaryHint, "statement-passwords");
        await supabaseAdmin.from("statement_password_hints").upsert(
          {
            user_id: userId!,
            bank_name: "ALL",
            hint_pattern: "AUTO_PERMUTATION",
            encrypted_secret: encryptedPrimary,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,bank_name,account_id" }
        );
      }
    }

    // Save individual bank-specific passwords if provided
    if (body.bankPasswords && typeof body.bankPasswords === "object") {
      for (const [bank, pwd] of Object.entries(body.bankPasswords)) {
        if (!pwd || typeof pwd !== "string" || !pwd.trim()) continue;
        const normBank = bank.trim().toUpperCase();
        const encrypted = encryptSensitiveData(pwd.trim(), "statement-passwords");
        const { data: existing } = await supabaseAdmin
          .from("statement_password_hints")
          .select("id")
          .eq("user_id", userId!)
          .eq("bank_name", normBank)
          .maybeSingle();

        if (existing?.id) {
          await supabaseAdmin
            .from("statement_password_hints")
            .update({
              hint_pattern: "BANK_PASSWORD",
              encrypted_secret: encrypted,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);
        } else {
          await supabaseAdmin
            .from("statement_password_hints")
            .insert({
              user_id: userId!,
              bank_name: normBank,
              hint_pattern: "BANK_PASSWORD",
              encrypted_secret: encrypted,
              updated_at: new Date().toISOString(),
            });
        }
      }
    }

    await invalidateUserCaches(userId, ["ACCOUNTS", "PORTFOLIO", "LEDGER"]);

    return apiSuccess(
      {
        message: "Personal and banking identity details encrypted and saved successfully.",
      },
      undefined,
      200,
      req
    );
  },
});
