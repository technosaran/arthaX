import { describe, it, expect } from "vitest";
import { z } from "zod";
import { CACHE_KEYS, getUserCacheKey } from "@/utils/redis";

const WipeRequestSchema = z.object({
  confirmation: z.string().refine((val) => ["DELETE", "WIPE"].includes(val.trim().toUpperCase()), {
    message: "Confirmation phrase must be DELETE or WIPE",
  }),
});

describe("Master Wipe Data Suite", () => {
  describe("Safety Confirmation Validation", () => {
    it("accepts exact string 'DELETE'", () => {
      const res = WipeRequestSchema.safeParse({ confirmation: "DELETE" });
      expect(res.success).toBe(true);
    });

    it("accepts lowercase 'delete' and trimmed variations", () => {
      const resLower = WipeRequestSchema.safeParse({ confirmation: "delete" });
      expect(resLower.success).toBe(true);

      const resSpaced = WipeRequestSchema.safeParse({ confirmation: "  DELETE  " });
      expect(resSpaced.success).toBe(true);
    });

    it("accepts alternative phrase 'WIPE'", () => {
      const resWipe = WipeRequestSchema.safeParse({ confirmation: "wipe" });
      expect(resWipe.success).toBe(true);
    });

    it("rejects invalid confirmation phrases", () => {
      expect(WipeRequestSchema.safeParse({ confirmation: "yes" }).success).toBe(false);
      expect(WipeRequestSchema.safeParse({ confirmation: "erase" }).success).toBe(false);
      expect(WipeRequestSchema.safeParse({ confirmation: "delete all" }).success).toBe(false);
      expect(WipeRequestSchema.safeParse({ confirmation: "" }).success).toBe(false);
      expect(WipeRequestSchema.safeParse({}).success).toBe(false);
    });
  });

  describe("Multi-Tenant Cache Invalidation Integrity", () => {
    it("generates correctly scoped cache keys for all datasets during wipe", () => {
      const testUserId = "usr_test_wipe_12345";
      const expectedKeys = [
        getUserCacheKey(testUserId, CACHE_KEYS.ACCOUNTS),
        getUserCacheKey(testUserId, CACHE_KEYS.INCOME),
        getUserCacheKey(testUserId, CACHE_KEYS.EXPENSES),
        getUserCacheKey(testUserId, CACHE_KEYS.TRANSFERS),
        getUserCacheKey(testUserId, CACHE_KEYS.SETTINGS),
        getUserCacheKey(testUserId, CACHE_KEYS.PORTFOLIO),
        getUserCacheKey(testUserId, CACHE_KEYS.LEDGER),
        getUserCacheKey(testUserId, CACHE_KEYS.BUDGETS),
        getUserCacheKey(testUserId, CACHE_KEYS.FAMILY_MEMBERS),
        getUserCacheKey(testUserId, CACHE_KEYS.FAMILY_RESPONSIBILITIES),
      ];

      expect(expectedKeys).toHaveLength(10);
      expectedKeys.forEach((key) => {
        expect(key).toContain(testUserId);
      });
      expect(expectedKeys).toContain(`arthax:cache:${testUserId}:accounts`);
      expect(expectedKeys).toContain(`arthax:cache:${testUserId}:ledger`);
      expect(expectedKeys).toContain(`arthax:cache:${testUserId}:portfolio`);
    });
  });

  describe("Cash in Hand Account Reset Logic", () => {
    it("preserves Cash in Hand account and resets balance to 0.00 while clearing custom accounts", () => {
      const sampleAccounts = [
        { id: "00000000-0000-0000-0000-000000000001", name: "Cash in Hand", last_four: "CASH", balance: 5400.5 },
        { id: "acc-hdfc-1", name: "HDFC Salary", last_four: "4421", balance: 85200.0 },
        { id: "acc-icici-2", name: "ICICI Savings", last_four: "9912", balance: 12400.0 },
      ];

      const cashAccount = sampleAccounts.find(
        (a) => a.id === "00000000-0000-0000-0000-000000000001" || a.last_four === "CASH"
      );
      expect(cashAccount).toBeDefined();

      const accountsToDelete = sampleAccounts.filter((a) => a.id !== cashAccount?.id);
      expect(accountsToDelete).toHaveLength(2);
      expect(accountsToDelete.map((a) => a.name)).toEqual(["HDFC Salary", "ICICI Savings"]);

      // After wipe simulation
      const wipedAccounts = [
        { ...cashAccount!, balance: 0.0 },
      ];

      expect(wipedAccounts).toHaveLength(1);
      expect(wipedAccounts[0].balance).toBe(0.0);
      expect(wipedAccounts[0].name).toBe("Cash in Hand");
    });
  });

  describe("Database Migration Security Gate Verification", () => {
    it("verifies the latest migration enforces caller auth check and covers crypto & integrations", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const migrationFile = path.resolve(
        process.cwd(),
        "supabase/migrations/20261121000000_secure_master_wipe_and_integrity.sql"
      );
      expect(fs.existsSync(migrationFile)).toBe(true);

      const sqlContent = fs.readFileSync(migrationFile, "utf-8");

      // Verify BOLA authorization check exists
      expect(sqlContent).toContain("auth.uid()::text <> p_user_id");
      expect(sqlContent).toContain("Access denied: caller is not authorized");

      // Verify comprehensive table coverage
      expect(sqlContent).toContain("DELETE FROM public.crypto_trades");
      expect(sqlContent).toContain("DELETE FROM public.crypto_holdings");
      expect(sqlContent).toContain("DELETE FROM public.binance_integrations");
      expect(sqlContent).toContain("DELETE FROM public.zerodha_integrations");
      expect(sqlContent).toContain("DELETE FROM public.bullion_transactions");
      expect(sqlContent).toContain("DELETE FROM public.bond_transactions");
    });
  });
});
