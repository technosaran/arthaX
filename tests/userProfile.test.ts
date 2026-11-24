import { describe, it, expect } from "vitest";
import {
  isGoogleAccount,
  resolveDisplayName,
  resolveAvatarUrl,
  computeInitials,
} from "../src/utils/userProfile";

describe("User Profile & Gmail Avatar Utilities", () => {
  describe("isGoogleAccount", () => {
    it("identifies Google OAuth provider in app_metadata", () => {
      expect(
        isGoogleAccount({
          app_metadata: { provider: "google", providers: ["google"] },
        })
      ).toBe(true);
    });

    it("identifies Google OAuth provider in identities array", () => {
      expect(
        isGoogleAccount({
          identities: [{ provider: "google" }],
        })
      ).toBe(true);
    });

    it("identifies Google OAuth from iss accounts.google.com in user_metadata", () => {
      expect(
        isGoogleAccount({
          user_metadata: { iss: "https://accounts.google.com" },
        })
      ).toBe(true);
    });

    it("identifies Google user from googleusercontent avatar URL", () => {
      expect(
        isGoogleAccount({
          user_metadata: {
            avatar_url: "https://lh3.googleusercontent.com/a/ACg8ocIzm7hpqJeADhk=s96-c",
          },
        })
      ).toBe(true);
    });

    it("returns false for email & password accounts without Google provider", () => {
      expect(
        isGoogleAccount({
          email: "testuser@example.com",
          app_metadata: { provider: "email" },
        })
      ).toBe(false);
      expect(isGoogleAccount(null)).toBe(false);
      expect(isGoogleAccount(undefined)).toBe(false);
    });
  });

  describe("resolveDisplayName", () => {
    it("prioritizes custom non-placeholder profile name", () => {
      const name = resolveDisplayName("Alex Tech", { full_name: "ALEX R" }, "developer@example.com");
      expect(name).toBe("Alex Tech");
    });

    it("ignores placeholder 'User' and picks Google full_name", () => {
      const name = resolveDisplayName("User", { full_name: "ALEX R" }, "developer@example.com");
      expect(name).toBe("ALEX R");
    });

    it("ignores placeholder 'user' (case-insensitive) and picks Google metadata name", () => {
      const name = resolveDisplayName("user", { name: "ALEX R" }, "developer@example.com");
      expect(name).toBe("ALEX R");
    });

    it("falls back to email username when no other name exists", () => {
      const name = resolveDisplayName(null, null, "developer@example.com");
      expect(name).toBe("developer");
    });

    it("returns 'User' when all sources are missing", () => {
      expect(resolveDisplayName(null, null, null)).toBe("User");
    });
  });

  describe("resolveAvatarUrl", () => {
    it("extracts avatar_url from user_metadata for Google user", () => {
      const url = resolveAvatarUrl({
        app_metadata: { provider: "google" },
        user_metadata: {
          avatar_url: "https://lh3.googleusercontent.com/a/ACg8ocIzm7hpqJeADhk=s96-c",
        },
      });
      expect(url).toBe("https://lh3.googleusercontent.com/a/ACg8ocIzm7hpqJeADhk=s96-c");
    });

    it("extracts picture from user_metadata if avatar_url is missing", () => {
      const url = resolveAvatarUrl({
        app_metadata: { provider: "google" },
        user_metadata: {
          picture: "https://lh3.googleusercontent.com/a/picture-id=s96-c",
        },
      });
      expect(url).toBe("https://lh3.googleusercontent.com/a/picture-id=s96-c");
    });

    it("extracts avatar_url from identities array if user_metadata is missing", () => {
      const url = resolveAvatarUrl({
        identities: [
          {
            provider: "google",
            identity_data: {
              avatar_url: "https://lh3.googleusercontent.com/a/from-identities=s96-c",
            },
          },
        ],
      });
      expect(url).toBe("https://lh3.googleusercontent.com/a/from-identities=s96-c");
    });

    it("falls back to unavatar for non-Google email users", () => {
      const url = resolveAvatarUrl({
        email: "testuser@example.com",
        app_metadata: { provider: "email" },
      });
      expect(url).toBe("https://unavatar.io/testuser%40example.com?fallback=false");
    });

    it("returns null when user is null or undefined", () => {
      expect(resolveAvatarUrl(null)).toBeNull();
      expect(resolveAvatarUrl(undefined)).toBeNull();
    });
  });

  describe("computeInitials", () => {
    it("computes 2-letter uppercase initials for multiple words", () => {
      expect(computeInitials("ALEX R")).toBe("AR");
      expect(computeInitials("John Doe")).toBe("JD");
      expect(computeInitials("Elon Reeve Musk")).toBe("ER");
    });

    it("computes first 2 characters for single word names", () => {
      expect(computeInitials("Alex")).toBe("AL");
      expect(computeInitials("arthaX")).toBe("AR");
    });

    it("returns 'U' for empty or whitespace strings", () => {
      expect(computeInitials("")).toBe("U");
      expect(computeInitials("   ")).toBe("U");
    });
  });
});
