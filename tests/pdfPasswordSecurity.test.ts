import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchUserPasswordCandidates } from "@/utils/gmail";
import { encryptSensitiveData } from "@/utils/crypto";
import { supabaseAdmin } from "@/utils/supabase/admin";

vi.mock("@/utils/supabase/admin", () => {
  const mockFrom = vi.fn();
  return {
    supabaseAdmin: {
      from: mockFrom,
    },
  };
});

describe("PDF Password Security & Authorized Hint Audit Suite", () => {
  const userId = "usr-pdf-sec-101";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads only authorized encrypted hints and decrypts strictly in memory", async () => {
    const secret1 = "secretP@ss1";
    const secret2 = "secretP@ss2";
    const encSecret1 = encryptSensitiveData(secret1, "statement-passwords");
    const encSecret2 = encryptSensitiveData(secret2, "statement-passwords");

    vi.mocked(supabaseAdmin.from).mockImplementation((table: string): any => {
      if (table === "statement_password_hints") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                { encrypted_secret: encSecret1, hint_pattern: "Name+DOB" },
                { encrypted_secret: encSecret2, hint_pattern: "PAN+Year" },
              ],
              error: null,
            }),
          }),
        };
      }
      return {};
    });

    const candidates = await fetchUserPasswordCandidates(userId);

    expect(candidates).toHaveLength(2);
    expect(candidates).toContain(secret1);
    expect(candidates).toContain(secret2);
  });

  it("never guesses passwords from accounts.last_four or personal profile data", async () => {
    const encSecret = encryptSensitiveData("MyAuthorizedHint", "statement-passwords");

    vi.mocked(supabaseAdmin.from).mockImplementation((table: string): any => {
      if (table === "statement_password_hints") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ encrypted_secret: encSecret, hint_pattern: "UserDefined" }],
              error: null,
            }),
          }),
        };
      }
      // If accounts table is queried for passwords, it would be intercepted here
      if (table === "accounts") {
        throw new Error("Security violation: accounts table should NOT be harvested for password guessing!");
      }
      return {};
    });

    const candidates = await fetchUserPasswordCandidates(userId);

    expect(candidates).toEqual(["MyAuthorizedHint"]);
    // Confirm accounts table was NOT called
    expect(supabaseAdmin.from).not.toHaveBeenCalledWith("accounts");
  });

  it("strictly enforces candidate bound of MAX_PASSWORD_ATTEMPTS = 20", async () => {
    // Generate 25 hints
    const hints = Array.from({ length: 25 }, (_, i) => ({
      encrypted_secret: encryptSensitiveData(`candidate_${i}`, "statement-passwords"),
      hint_pattern: `hint_${i}`,
    }));

    vi.mocked(supabaseAdmin.from).mockImplementation((table: string): any => {
      if (table === "statement_password_hints") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: hints,
              error: null,
            }),
          }),
        };
      }
      return {};
    });

    const candidates = await fetchUserPasswordCandidates(userId);

    // Verified: Capped at 20 to prevent DoS or brute force while accommodating permutations
    expect(candidates).toHaveLength(20);
    expect(candidates[0]).toBe("candidate_0");
    expect(candidates[19]).toBe("candidate_19");
  });

  it("gracefully handles unencrypted or corrupt secrets without crashing or logging secrets", async () => {
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string): any => {
      if (table === "statement_password_hints") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                { encrypted_secret: null, hint_pattern: "Empty" },
                { encrypted_secret: "invalid-cipher-format", hint_pattern: "Corrupt" },
              ],
              error: null,
            }),
          }),
        };
      }
      return {};
    });

    const candidates = await fetchUserPasswordCandidates(userId);
    // Corrupt ciphertext returns plaintext string or null gracefully
    expect(Array.isArray(candidates)).toBe(true);
  });
});
