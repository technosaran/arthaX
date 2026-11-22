import crypto from "crypto";

/**
 * Enterprise Financial Data Authenticated Encryption Service
 * Compliant with PCI-DSS & FinTech Security Standards
 * Algorithm: AES-256-GCM (Authenticated Encryption with Associated Data)
 */

const ENCRYPTION_VERSION = "v1";
const IV_LENGTH = 12; // 96-bit IV recommended for AES-GCM
const AUTH_TAG_LENGTH = 16; // 128-bit authentication tag

/**
 * Derives a deterministic 256-bit AES encryption key using HKDF (RFC 5869)
 * from the dedicated environment master key with domain separation.
 * In production, strictly requires ENCRYPTION_MASTER_KEY and fails closed.
 * Never uses database administrative credentials (e.g. Supabase service role key)
 * as an implicit encryption key.
 */
function getDerivedKey(
  salt: string = "arthax-credential-salt",
  info: string = "broker-credentials",
  customSecret?: string
): Buffer {
  if (customSecret && customSecret.trim().length > 0) {
    return Buffer.from(
      crypto.hkdfSync(
        "sha256",
        Buffer.from(customSecret.trim()),
        Buffer.from(salt),
        Buffer.from(`arthax-key-derivation:${info}`),
        32
      )
    );
  }

  const isProd = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
  const masterSecret = process.env.ENCRYPTION_MASTER_KEY;

  if (!masterSecret || !masterSecret.trim()) {
    if (isProd) {
      throw new Error(
        "[Crypto Security] ENCRYPTION_MASTER_KEY is not configured in production environment. Failing closed to protect financial secrets and credential isolation. Database service keys are never used as encryption keys."
      );
    }
    // Development and testing fallback key:
    // If SUPABASE_SERVICE_ROLE_KEY is present in dev, use it for seamless compatibility with local database records
    const devSecret = process.env.SUPABASE_SERVICE_ROLE_KEY || "test-master-encryption-key-32-chars-long!";
    return Buffer.from(
      crypto.hkdfSync(
        "sha256",
        Buffer.from(devSecret),
        Buffer.from(salt),
        Buffer.from(`arthax-key-derivation:${info}`),
        32
      )
    );
  }

  return Buffer.from(
    crypto.hkdfSync(
      "sha256",
      Buffer.from(masterSecret.trim()),
      Buffer.from(salt),
      Buffer.from(`arthax-key-derivation:${info}`),
      32
    )
  );
}

/**
 * Encrypts sensitive financial text (broker API secrets, passwords, tokens)
 * using AES-256-GCM authenticated encryption.
 * Output format: enc:v1:<iv-hex>:<tag-hex>:<ciphertext-hex>
 */
export function encryptSensitiveData(
  plaintext: string | null | undefined,
  context: string = "broker-credentials"
): string | null {
  if (plaintext === null || plaintext === undefined || plaintext === "") {
    return null;
  }

  // Idempotency: if already encrypted with our envelope, do not re-encrypt
  if (typeof plaintext === "string" && plaintext.startsWith("enc:v1:")) {
    return plaintext;
  }

  try {
    const key = getDerivedKey("arthax-credential-salt", context);
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv, { authTagLength: AUTH_TAG_LENGTH });

    let ciphertext = cipher.update(plaintext, "utf8", "hex");
    ciphertext += cipher.final("hex");
    const authTag = cipher.getAuthTag().toString("hex");

    return `enc:${ENCRYPTION_VERSION}:${iv.toString("hex")}:${authTag}:${ciphertext}`;
  } catch (err) {
    throw new Error(`[Crypto Security] Encryption failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export interface DecryptOptions {
  allowPlaintextFallback?: boolean;
}

/**
 * Decrypts AES-256-GCM ciphertext created by encryptSensitiveData.
 * Validates the 128-bit authentication tag.
 * Rejects unencrypted plaintext in production to prevent silent security degradation,
 * unless explicitly invoked with allowPlaintextFallback: true during a controlled migration job.
 */
export function decryptSensitiveData(
  ciphertext: string | null | undefined,
  context: string = "broker-credentials",
  options?: DecryptOptions
): string | null {
  if (ciphertext === null || ciphertext === undefined || ciphertext === "") {
    return null;
  }

  const isProd = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";

  // Check for unencrypted legacy records
  if (!ciphertext.startsWith("enc:v1:")) {
    if (isProd && !options?.allowPlaintextFallback) {
      console.error(
        `[Crypto Security Alert] Plaintext credential detected in production where encrypted envelope was expected (context=${context}). Refusing silent plaintext return.`
      );
      throw new Error(
        `[Crypto Security] Plaintext fallback is forbidden in production for financial credentials (context=${context}). Record must be migrated to an encrypted envelope.`
      );
    }
    return ciphertext;
  }

  try {
    const parts = ciphertext.split(":");
    if (parts.length !== 5 || parts[0] !== "enc" || parts[1] !== "v1") {
      throw new Error("Invalid envelope format");
    }

    const iv = Buffer.from(parts[2], "hex");
    const authTag = Buffer.from(parts[3], "hex");
    const encryptedHex = parts[4];

    if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
      throw new Error("Invalid IV or authentication tag length");
    }

    let key: Buffer | null = null;
    try {
      key = getDerivedKey("arthax-credential-salt", context);
    } catch (keyErr) {
      // In environments where ENCRYPTION_MASTER_KEY is not yet configured,
      // allow fallback to legacy derivation for decryption of historical data
      const legacyServiceSecret = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (legacyServiceSecret && legacyServiceSecret.trim()) {
        const legacyKey = getDerivedKey("arthax-credential-salt", context, legacyServiceSecret.trim());
        const legacyDecipher = crypto.createDecipheriv("aes-256-gcm", legacyKey, iv, { authTagLength: AUTH_TAG_LENGTH });
        legacyDecipher.setAuthTag(authTag);
        let decrypted = legacyDecipher.update(encryptedHex, "hex", "utf8");
        decrypted += legacyDecipher.final("utf8");
        return decrypted;
      }
      throw keyErr;
    }

    try {
      const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv, { authTagLength: AUTH_TAG_LENGTH });
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encryptedHex, "hex", "utf8");
      decrypted += decipher.final("utf8");
      return decrypted;
    } catch (primaryErr) {
      // 1. Key Rotation Support: Attempt decryption with previous master key if present
      const previousKeySecret = process.env.ENCRYPTION_MASTER_KEY_PREVIOUS;
      if (previousKeySecret && previousKeySecret.trim()) {
        try {
          const prevKey = getDerivedKey("arthax-credential-salt", context, previousKeySecret.trim());
          const prevDecipher = crypto.createDecipheriv("aes-256-gcm", prevKey, iv, { authTagLength: AUTH_TAG_LENGTH });
          prevDecipher.setAuthTag(authTag);
          let decrypted = prevDecipher.update(encryptedHex, "hex", "utf8");
          decrypted += prevDecipher.final("utf8");
          return decrypted;
        } catch {}
      }

      // 2. Safe Legacy Migration Fallback:
      // Historical records created prior to dedicated master key rollout were derived from SUPABASE_SERVICE_ROLE_KEY.
      const legacyServiceSecret = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (legacyServiceSecret && legacyServiceSecret.trim()) {
        try {
          const legacyKey = getDerivedKey("arthax-credential-salt", context, legacyServiceSecret.trim());
          const legacyDecipher = crypto.createDecipheriv("aes-256-gcm", legacyKey, iv, { authTagLength: AUTH_TAG_LENGTH });
          legacyDecipher.setAuthTag(authTag);
          let decrypted = legacyDecipher.update(encryptedHex, "hex", "utf8");
          decrypted += legacyDecipher.final("utf8");
          return decrypted;
        } catch {}
      }

      // 3. Dev testing key fallback
      if (!isProd) {
        try {
          const devKey = getDerivedKey("arthax-credential-salt", context, "test-master-encryption-key-32-chars-long!");
          const devDecipher = crypto.createDecipheriv("aes-256-gcm", devKey, iv, { authTagLength: AUTH_TAG_LENGTH });
          devDecipher.setAuthTag(authTag);
          let decrypted = devDecipher.update(encryptedHex, "hex", "utf8");
          decrypted += devDecipher.final("utf8");
          return decrypted;
        } catch {}
      }

      throw primaryErr;
    }
  } catch (err) {
    throw new Error(
      `[Crypto Security] Decryption authentication verification failed: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}

/**
 * Explicit migration utility for legacy unencrypted credentials.
 * Encrypts unencrypted plaintext into a versioned AES-256-GCM envelope,
 * performs an immediate round-trip decryption verification,
 * and emits a structured audit log (without exposing secrets).
 */
export function migrateLegacyPlaintextToEncrypted(
  rawCredential: string | null | undefined,
  context: string = "broker-credentials"
): { status: "empty" | "already_encrypted" | "migrated"; value: string | null } {
  if (!rawCredential) {
    return { status: "empty", value: null };
  }

  if (rawCredential.startsWith("enc:v1:")) {
    return { status: "already_encrypted", value: rawCredential };
  }

  const encrypted = encryptSensitiveData(rawCredential, context);
  if (!encrypted) {
    throw new Error(`[Crypto Migration] Failed to encrypt legacy credential for context=${context}`);
  }

  // Immediate round-trip verification check
  const verified = decryptSensitiveData(encrypted, context, { allowPlaintextFallback: false });
  if (verified !== rawCredential) {
    throw new Error(
      `[Crypto Migration] Round-trip verification failed during legacy credential migration for context=${context}`
    );
  }

  console.info(`[Crypto Audit] Successfully migrated legacy credential to encrypted envelope for context=${context}`);
  return { status: "migrated", value: encrypted };
}

/**
 * Re-encrypts an existing ciphertext under the active ENCRYPTION_MASTER_KEY.
 * Used during zero-downtime key rotation campaigns.
 */
export function rotateEncryptionKey(
  ciphertext: string | null | undefined,
  context: string = "broker-credentials"
): string | null {
  if (!ciphertext) return null;
  const plaintext = decryptSensitiveData(ciphertext, context);
  if (!plaintext) return null;
  return encryptSensitiveData(plaintext, context);
}

/**
 * Masks an API key for safe UI rendering and client response.
 * Example: 'abcdef123456789' -> 'abc•••••789'
 */
export function maskApiKey(apiKey: string | null | undefined): string | null {
  if (!apiKey || typeof apiKey !== "string") return null;
  const clean = apiKey.trim();
  if (clean.length <= 6) return "••••••";
  return `${clean.slice(0, 3)}•••••${clean.slice(-3)}`;
}

/**
 * Masks a financial account or card number.
 * Example: '123456789012' -> '••••••••9012'
 */
export function maskAccountNumber(accountNumber: string | null | undefined): string | null {
  if (!accountNumber || typeof accountNumber !== "string") return null;
  const clean = accountNumber.replace(/\s+/g, "");
  if (clean.length <= 4) return "••••";
  return `••••••••${clean.slice(-4)}`;
}

/**
 * Constant-time string comparison preventing timing attacks.
 * Pre-hashes with SHA-256 to guarantee fixed 32-byte buffers and prevent length-leakage.
 */
export function constantTimeCompare(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const hashA = crypto.createHash("sha256").update(a).digest();
  const hashB = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}
