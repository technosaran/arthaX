import { supabaseAdmin } from "@/utils/supabase/admin";
import { apiError, apiSuccess } from "@/utils/apiResponse";
import { createApiRoute } from "@/lib/backend/routeHandler";
import { encryptSensitiveData, decryptSensitiveData } from "@/utils/crypto";
import { invalidateUserCaches } from "@/lib/backend/cacheInvalidation";
import { generateBankPasswordPermutations, BankingIdentityDetails } from "@/utils/bankPasswords";
import { z } from "zod";

const ConnectGmailSchema = z.object({
  email: z.string().email("Please provide a valid Gmail address").max(255).optional().nullable(),
  password_hint: z.string().max(100).optional().nullable(),
  bank_name: z.string().default("ALL"),
  pan: z.string().max(20).optional().nullable(),
  dob: z.string().max(30).optional().nullable(),
  phone: z.string().max(25).optional().nullable(),
});

/**
 * GET: Retrieve Gmail integration status and connection telemetry
 */
export const GET = createApiRoute({
  auth: "required",
  rateLimit: { limit: 60, windowSeconds: 60 },
  handler: async ({ userId, req }) => {
    const [intRes, hintsRes, latestJobRes] = await Promise.all([
      supabaseAdmin
        .from("gmail_integrations")
        .select("id, email_address, sync_status, last_sync_at, error_details, created_at, updated_at")
        .eq("user_id", userId!)
        .maybeSingle(),
      supabaseAdmin
        .from("statement_password_hints")
        .select("id, bank_name, hint_pattern, encrypted_secret")
        .eq("user_id", userId!),
      supabaseAdmin
        .from("automation_jobs")
        .select("*")
        .eq("user_id", userId!)
        .eq("job_type", "GMAIL_SYNC")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (intRes.error) {
      return apiError(intRes.error.message, "DATABASE_ERROR", 500, undefined, req);
    }

    const integration = intRes.data;
    const hints = hintsRes.data || [];

    // Extract stored banking identity if available
    const bankingIdentity: {
      hasPan: boolean;
      panMasked: string | null;
      hasDob: boolean;
      dobMasked: string | null;
      hasPhone: boolean;
      phoneMasked: string | null;
    } = {
      hasPan: false,
      panMasked: null,
      hasDob: false,
      dobMasked: null,
      hasPhone: false,
      phoneMasked: null,
    };

    const identityHint = hints.find((h) => h.hint_pattern === "BANKING_IDENTITY");
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
        }
      } catch {
        // Safe decryption ignore
      }
    }

    return apiSuccess(
      {
        connected: Boolean(
          integration &&
            integration.sync_status !== "DISCONNECTED" &&
            integration.sync_status !== "PENDING_AUTH"
        ),
        email: integration?.email_address || null,
        syncStatus: integration?.sync_status || "DISCONNECTED",
        lastSyncAt: integration?.last_sync_at || null,
        errorDetails: integration?.error_details || null,
        passwordHintsCount: hints.length,
        bankingIdentity,
        latestJob: latestJobRes.data || null,
      },
      undefined,
      200,
      req
    );
  },
});

/**
 * POST: Connect or update Gmail integration with email address and optional PDF password hints / Banking Identity
 */
export const POST = createApiRoute({
  auth: "required",
  rateLimit: { limit: 20, windowSeconds: 60 },
  schema: ConnectGmailSchema,
  handler: async ({ userId, body, req }) => {
    const { email, password_hint, bank_name, pan, dob, phone } = body;
    const cleanEmail = email?.trim().toLowerCase();

    // 1. Fetch existing integration to check for real OAuth tokens
    const { data: existingInt, error: fetchIntErr } = await supabaseAdmin
      .from("gmail_integrations")
      .select("id, email_address, access_token_encrypted, refresh_token_encrypted, sync_status")
      .eq("user_id", userId!)
      .maybeSingle();

    if (fetchIntErr) {
      return apiError(fetchIntErr.message, "DATABASE_ERROR", 500, undefined, req);
    }

    let hasRealTokens = false;
    if (existingInt?.access_token_encrypted || existingInt?.refresh_token_encrypted) {
      const accToken = existingInt.access_token_encrypted
        ? decryptSensitiveData(existingInt.access_token_encrypted, "gmail-tokens")
        : null;
      const refToken = existingInt.refresh_token_encrypted
        ? decryptSensitiveData(existingInt.refresh_token_encrypted, "gmail-tokens")
        : null;

      const isRealAcc = Boolean(accToken && !accToken.startsWith("token_"));
      const isRealRef = Boolean(refToken && !refToken.startsWith("token_"));
      hasRealTokens = isRealAcc || isRealRef;
    }

    let updatedIntegration: any = null;
    let syncStatus: string = existingInt?.sync_status || "PENDING_AUTH";
    let isConnected = Boolean(hasRealTokens && syncStatus === "ACTIVE");

    if (cleanEmail) {
      if (existingInt && hasRealTokens) {
        // Real tokens exist; preserve tokens and update email address
        syncStatus = existingInt.sync_status || "ACTIVE";
        isConnected = syncStatus === "ACTIVE";

        const { data, error: updateErr } = await supabaseAdmin
          .from("gmail_integrations")
          .update({
            email_address: cleanEmail,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingInt.id)
          .select()
          .single();

        if (updateErr) {
          return apiError(updateErr.message, "DATABASE_ERROR", 500, undefined, req);
        }
        updatedIntegration = data;
      } else {
        // No integration exists or no real tokens in DB; save email with PENDING_AUTH (no dummy tokens)
        syncStatus = "PENDING_AUTH";
        isConnected = false;

        const { data, error: upsertErr } = await supabaseAdmin
          .from("gmail_integrations")
          .upsert(
            {
              user_id: userId!,
              email_address: cleanEmail,
              access_token_encrypted: null,
              refresh_token_encrypted: null,
              sync_status: "PENDING_AUTH",
              error_details: "OAuth authentication required to grant statement read access",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" }
          )
          .select()
          .single();

        if (upsertErr) {
          return apiError(upsertErr.message, "DATABASE_ERROR", 500, undefined, req);
        }
        updatedIntegration = data;
      }
    } else if (existingInt) {
      updatedIntegration = existingInt;
      syncStatus = existingInt.sync_status;
      isConnected = Boolean(hasRealTokens && syncStatus === "ACTIVE");
    }

    // 2. If banking identity provided (PAN, DOB, Phone), store encrypted identity and auto-generate permutations
    if ((pan && pan.trim()) || (dob && dob.trim()) || (phone && phone.trim())) {
      const identityObj: BankingIdentityDetails = {
        pan: pan?.trim().toUpperCase() || null,
        dob: dob?.trim() || null,
        phone: phone?.trim() || null,
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

      // Generate individual candidates and save primary SBI hint
      const permutations = generateBankPasswordPermutations(identityObj);
      if (permutations.length > 0) {
        const primaryHint = permutations[0];
        const encryptedPrimary = encryptSensitiveData(primaryHint, "statement-passwords");
        await supabaseAdmin.from("statement_password_hints").upsert(
          {
            user_id: userId!,
            bank_name: "SBI",
            hint_pattern: "AUTO_PERMUTATION",
            encrypted_secret: encryptedPrimary,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,bank_name,account_id" }
        );
      }
    }

    // 3. If explicit statement password hint provided, encrypt and store
    if (password_hint && password_hint.trim()) {
      const encryptedSecret = encryptSensitiveData(password_hint.trim(), "statement-passwords");
      await supabaseAdmin.from("statement_password_hints").upsert(
        {
          user_id: userId!,
          bank_name: bank_name || "ALL",
          hint_pattern: "USER_PROVIDED_HINT",
          encrypted_secret: encryptedSecret,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,bank_name,account_id" }
      );
    }

    await invalidateUserCaches(userId, ["ACCOUNTS", "PORTFOLIO", "LEDGER"]);

    const message = isConnected
      ? "Banking identity and password configuration saved. Bank statements will now decrypt and auto-create accounts automatically."
      : "Email and banking configuration saved. Please complete Google OAuth authentication to grant statement read access.";

    return apiSuccess(
      {
        connected: isConnected,
        email: cleanEmail || updatedIntegration?.email_address || existingInt?.email_address || null,
        syncStatus,
        requiresAuth: !isConnected,
        message,
        integration: updatedIntegration,
      },
      undefined,
      200,
      req
    );
  },
});

/**
 * DELETE: Disconnect Gmail statement reader integration and revoke tokens
 */
export const DELETE = createApiRoute({
  auth: "required",
  rateLimit: { limit: 20, windowSeconds: 60 },
  handler: async ({ userId, req }) => {
    // 1. Revoke tokens with Google OAuth revocation endpoint
    try {
      const { data: currentInt } = await supabaseAdmin
        .from("gmail_integrations")
        .select("access_token_encrypted, refresh_token_encrypted")
        .eq("user_id", userId!)
        .maybeSingle();

      const tokenToRevoke =
        (currentInt?.refresh_token_encrypted ? decryptSensitiveData(currentInt.refresh_token_encrypted, "gmail-tokens") : null) ||
        (currentInt?.access_token_encrypted ? decryptSensitiveData(currentInt.access_token_encrypted, "gmail-tokens") : null);

      if (tokenToRevoke && !tokenToRevoke.startsWith("token_")) {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(tokenToRevoke)}`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        }).catch(() => {});
      }
    } catch {
      // Best-effort revocation
    }

    const { error: delErr } = await supabaseAdmin
      .from("gmail_integrations")
      .update({
        sync_status: "DISCONNECTED",
        access_token_encrypted: null,
        refresh_token_encrypted: null,
        error_details: "Disconnected by user",
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId!);

    if (delErr) {
      return apiError(delErr.message, "DATABASE_ERROR", 500, undefined, req);
    }

    await invalidateUserCaches(userId, ["ACCOUNTS", "PORTFOLIO", "LEDGER"]);

    return apiSuccess(
      {
        connected: false,
        message: "Gmail statement reader has been disconnected and tokens revoked.",
      },
      undefined,
      200,
      req
    );
  },
});
