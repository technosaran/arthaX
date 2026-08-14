import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128-bit authentication tag

function getEncryptionKey(): Buffer {
  const secret =
    process.env.ENCRYPTION_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret) {
    throw new Error(
      "Missing encryption secret. Set ENCRYPTION_SECRET, NEXTAUTH_SECRET, or SUPABASE_SERVICE_ROLE_KEY environment variable."
    );
  }

  // Derive a deterministic 32-byte (256-bit) key using PBKDF2
  // 600,000 iterations per OWASP/NIST minimum for HMAC-SHA256
  return crypto.pbkdf2Sync(secret, "arthaX_salt_v1", 600000, 32, "sha256");
}

/**
 * Encrypts a plain-text secret string using AES-256-GCM.
 * Output format: "enc:v1:<iv_hex>:<auth_tag_hex>:<ciphertext_hex>"
 */
export function encryptSecret(plainText: string): string {
  if (!plainText || typeof plainText !== "string" || plainText.trim().length === 0) {
    return "";
  }

  // If already encrypted, return as is
  if (plainText.startsWith("enc:v1:")) {
    return plainText;
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  return `enc:v1:${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypts a cipher-text string formatted as "enc:v1:<iv_hex>:<auth_tag_hex>:<ciphertext_hex>".
 * Transparently handles legacy unencrypted strings by returning them as-is.
 */
export function decryptSecret(cipherText: string): string {
  if (!cipherText || typeof cipherText !== "string" || cipherText.trim().length === 0) {
    return "";
  }

  // Transparent backward compatibility for unencrypted legacy plain text
  if (!cipherText.startsWith("enc:v1:")) {
    return cipherText;
  }

  try {
    const parts = cipherText.split(":");
    if (parts.length !== 5) {
      return cipherText; // Invalid format fallback
    }

    const iv = Buffer.from(parts[2], "hex");
    const authTag = Buffer.from(parts[3], "hex");
    const encryptedText = parts[4];

    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch {
    // If decryption fails (e.g. key changed), return empty or original safely
    return cipherText;
  }
}
