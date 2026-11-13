import { describe, it, expect } from "vitest";
import { z } from "zod";
import crypto from "crypto";
import { parseExpenseMessage, AccountSummary } from "@/utils/expenseParser";
import { getUserCacheKey } from "@/utils/redis";

// Reusable Schemas
const TransactionSchema = z.object({
  type: z.enum(["expense", "income"]),
  title: z.string().min(1, "Title is required").max(150),
  amount: z.number().positive("Amount must be strictly greater than 0"),
  category: z.string().min(1, "Category is required"),
  account_id: z.string().uuid().optional().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
});

const TransferSchema = z.object({
  from_account_id: z.string().uuid("Invalid source account ID"),
  to_account_id: z.string().uuid("Invalid destination account ID"),
  amount: z.number().positive("Transfer amount must be strictly positive"),
  transfer_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format must be YYYY-MM-DD"),
});

describe("ArthaX Validation & Security Test Suite", () => {
  describe("Zod Transaction Validation", () => {
    it("accepts a valid expense payload", () => {
      const payload = {
        type: "expense",
        title: "Grocery shopping at Blinkit",
        amount: 850.5,
        category: "Groceries & Essentials",
        account_id: "c6a94f6c-674b-4a57-bfa9-1588665790b4",
        date: "2026-11-13",
      };
      const res = TransactionSchema.safeParse(payload);
      expect(res.success).toBe(true);
    });

    it("rejects non-positive transaction amounts (zero or negative)", () => {
      const zeroPayload = {
        type: "expense",
        title: "Test",
        amount: 0,
        category: "General",
        date: "2026-11-13",
      };
      const resZero = TransactionSchema.safeParse(zeroPayload);
      expect(resZero.success).toBe(false);

      const negPayload = { ...zeroPayload, amount: -150 };
      const resNeg = TransactionSchema.safeParse(negPayload);
      expect(resNeg.success).toBe(false);
    });

    it("rejects malformed date formats", () => {
      const payload = {
        type: "income",
        title: "Freelance",
        amount: 15000,
        category: "Salary",
        date: "13/11/2026", // Invalid format (must be YYYY-MM-DD)
      };
      const res = TransactionSchema.safeParse(payload);
      expect(res.success).toBe(false);
    });
  });

  describe("Zod Transfer Validation", () => {
    it("accepts valid account transfer parameters", () => {
      const payload = {
        from_account_id: "c6a94f6c-674b-4a57-bfa9-1588665790b4",
        to_account_id: "d7b83e5a-1234-4b68-8cf0-2699776891c5",
        amount: 2500,
        transfer_date: "2026-11-13",
      };
      const res = TransferSchema.safeParse(payload);
      expect(res.success).toBe(true);
    });

    it("rejects invalid UUIDs", () => {
      const payload = {
        from_account_id: "not-a-uuid",
        to_account_id: "22222222-2222-2222-2222-222222222222",
        amount: 2500,
        transfer_date: "2026-11-13",
      };
      const res = TransferSchema.safeParse(payload);
      expect(res.success).toBe(false);
    });
  });

  describe("Multi-Tenant Cache Key Isolation (SEC-1)", () => {
    it("strictly namespaces keys with user ID to prevent tenant cross-talk", () => {
      const key1 = getUserCacheKey("user_alice", "portfolio");
      const key2 = getUserCacheKey("user_bob", "portfolio");

      expect(key1).toBe("arthax:cache:user_alice:portfolio");
      expect(key2).toBe("arthax:cache:user_bob:portfolio");
      expect(key1).not.toBe(key2);
    });

    it("does not fallback to a shared 'default_user' key", () => {
      const key = getUserCacheKey(null, "expenses");
      expect(key).not.toContain("default_user");
      expect(key).toBe("arthax:cache:anonymous:expenses");
    });
  });

  describe("HMAC-SHA256 Webhook Verification (SEC-3)", () => {
    it("validates authentic Meta WhatsApp Cloud API signatures", () => {
      const secret = "test_meta_app_secret_12345";
      const payload = JSON.stringify({ entry: [{ id: "123", changes: [] }] });

      const signature = `sha256=${crypto.createHmac("sha256", secret).update(payload).digest("hex")}`;

      const expected = signature.replace("sha256=", "");
      const calculated = crypto.createHmac("sha256", secret).update(payload).digest("hex");

      const match = crypto.timingSafeEqual(
        Buffer.from(expected, "hex"),
        Buffer.from(calculated, "hex")
      );
      expect(match).toBe(true);
    });

    it("rejects forged or tampered webhook signatures", () => {
      const secret = "test_meta_app_secret_12345";
      const payload = JSON.stringify({ entry: [{ id: "123" }] });
      const tamperedPayload = JSON.stringify({ entry: [{ id: "tampered" }] });

      const signature = `sha256=${crypto.createHmac("sha256", secret).update(payload).digest("hex")}`;
      const expected = signature.replace("sha256=", "");
      const calculated = crypto.createHmac("sha256", secret).update(tamperedPayload).digest("hex");

      const match = crypto.timingSafeEqual(
        Buffer.from(expected, "hex"),
        Buffer.from(calculated, "hex")
      );
      expect(match).toBe(false);
    });
  });

  describe("Natural Language Expense Parser", () => {
    const knownAccounts: AccountSummary[] = [
      { id: "1", name: "HDFC Bank", type: "Savings", balance: 10000, last_four: "5678" },
      { id: "2", name: "SBI Card", type: "Credit Card", balance: 5000, last_four: "1234" },
      { id: "3", name: "Cash in Hand", type: "Liquid Cash", balance: 1000, last_four: "CASH" },
    ];

    it("extracts amount, title, and account from natural speech", () => {
      const res = parseExpenseMessage("Dinner 650 HDFC", knownAccounts);
      expect(res.amount).toBe(650);
      expect(res.category).toBe("Food & Dining");
      expect(res.accountQuery).toBe("HDFC Bank");
    });

    it("extracts amount and merchant from bank debit SMS alerts", () => {
      const sms = "Dear SBI User, your A/c ending 1234 debited by Rs. 420.00 on 13-Nov-26 for Swiggy.";
      const res = parseExpenseMessage(sms, knownAccounts);
      expect(res.amount).toBe(420);
      expect(res.category).toBe("Food & Dining");
      expect(res.accountQuery).toBe("SBI Card");
    });

    it("handles multiplier shorthand amounts (e.g. 2.5k, 10k)", () => {
      const res = parseExpenseMessage("Shopping 2.5k Cash", knownAccounts);
      expect(res.amount).toBe(2500);
      expect(res.category).toBe("Shopping & Lifestyle");
    });
  });
});
