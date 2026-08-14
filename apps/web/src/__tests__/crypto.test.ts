import { encryptSecret, decryptSecret } from "@/lib/crypto";

describe("AES-256-GCM Cryptographic Layer", () => {
  it("should encrypt plain text and produce enc:v1: formatted ciphertext", () => {
    const plain = "my_super_secret_zerodha_api_secret_123";
    const encrypted = encryptSecret(plain);

    expect(encrypted).not.toEqual(plain);
    expect(encrypted.startsWith("enc:v1:")).toBe(true);
  });

  it("should decrypt enc:v1: formatted ciphertext back to original plain text", () => {
    const plain = "my_super_secret_zerodha_api_secret_123";
    const encrypted = encryptSecret(plain);
    const decrypted = decryptSecret(encrypted);

    expect(decrypted).toEqual(plain);
  });

  it("should handle legacy unencrypted plain text transparently", () => {
    const legacyPlain = "unencrypted_legacy_api_secret";
    const decrypted = decryptSecret(legacyPlain);

    expect(decrypted).toEqual(legacyPlain);
  });

  it("should return empty string when input is empty or null", () => {
    expect(encryptSecret("")).toEqual("");
    expect(decryptSecret("")).toEqual("");
  });
});
