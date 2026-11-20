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
 * from the environment master key or service key with domain separation.
 */
function getDerivedKey(salt: string = "arthax-credential-salt", info: string = "broker-credentials"): Buffer {
  if (process.env.NODE_ENV === "production" && !process.env.ENCRYPTION_MASTER_KEY) {
    console.warn(
      "[Crypto Security Warning] ENCRYPTION_MASTER_KEY is not defined in production. Falling back to service role credentials. Set ENCRYPTION_MASTER_KEY for zero-trust isolation."
    );
  }

  const masterSecret =
    process.env.ENCRYPTION_MASTER_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    (process.env.NODE_ENV === "test" || process.env.VITEST
      ? "test-master-encryption-key-32-chars-long!"
      : "");

  if (!masterSecret) {
    throw new Error(
      "[Crypto Security] Neither ENCRYPTION_MASTER_KEY nor SUPABASE_SERVICE_ROLE_KEY is set. Cannot perform authenticated encryption."
    );
  }

  return Buffer.from(
    crypto.hkdfSync(
      "sha256",
      Buffer.from(masterSecret),
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

/**
 * Decrypts AES-256-GCM ciphertext created by encryptSensitiveData.
 * Validates the 128-bit authentication tag. Gracefully passes through
 * unencrypted legacy values for seamless zero-downtime migration.
 */
export function decryptSensitiveData(
  ciphertext: string | null | undefined,
  context: string = "broker-credentials"
): string | null {
  if (ciphertext === null || ciphertext === undefined || ciphertext === "") {
    return null;
  }

  // Graceful fallback for unencrypted legacy records
  if (!ciphertext.startsWith("enc:v1:")) {
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

    const key = getDerivedKey("arthax-credential-salt", context);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (err) {
    throw new Error(
      `[Crypto Security] Decryption authentication verification failed: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
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
