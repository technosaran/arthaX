import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import type { User } from "@supabase/supabase-js";

vi.mock("@/utils/auth", () => ({
  getAuthenticatedUser: vi.fn(),
}));

vi.mock("@/utils/rateLimit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true, remaining: 59, reset: 12345 }),
  checkAndSetIdempotency: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/utils/supabase/admin", () => ({
  supabaseAdmin: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

vi.mock("@/lib/backend/cacheInvalidation", () => ({
  invalidateUserCaches: vi.fn().mockResolvedValue(undefined),
}));

import { getAuthenticatedUser } from "@/utils/auth";
import { rateLimit } from "@/utils/rateLimit";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { invalidateUserCaches } from "@/lib/backend/cacheInvalidation";
import { GET, DELETE } from "@/app/api/v1/accounts/[id]/route";
import {
  DEFAULT_CASH_ID,
  isCashAccount,
  isDematAccount,
  isZerodhaAccount,
  getProtectedAccountReason,
} from "@/utils/accountGuards";

const TEST_USER_ID = "a83a1889-30be-4c59-ad3d-ceaab076190b";
const ICICI_ID = "986a5559-51bd-4ab9-af92-9f38ca1265a4";

type FromResult = ReturnType<typeof supabaseAdmin.from>;
type RpcResult = Awaited<ReturnType<typeof supabaseAdmin.rpc>>;

describe("Account Card Protection & Deletion Suite", () => {
  const mockedAuth = vi.mocked(getAuthenticatedUser);
  const mockedRateLimit = vi.mocked(rateLimit);
  const mockedSupabase = vi.mocked(supabaseAdmin);
  const mockedInvalidate = vi.mocked(invalidateUserCaches);

  beforeEach(() => {
    vi.resetAllMocks();
    mockedRateLimit.mockResolvedValue({ success: true, remaining: 59, limit: 60, reset: 12345 });
    mockedInvalidate.mockResolvedValue(undefined);
    mockedAuth.mockResolvedValue({
      user: { id: TEST_USER_ID } as User,
      userId: TEST_USER_ID,
      error: null,
    });
  });

  describe("Account Guard Helpers", () => {
    it("identifies built-in Cash in Hand accounts regardless of UUID", () => {
      expect(isCashAccount({ id: DEFAULT_CASH_ID, name: "Other", type: "Other" })).toBe(true);
      expect(
        isCashAccount({
          id: "eb584152-ce43-413f-af4b-1357b22f1eaa",
          name: "Cash in Hand",
          type: "Liquid Cash",
          last_four: "CASH",
        })
      ).toBe(true);
      expect(getProtectedAccountReason({ name: "Cash in Hand", type: "Liquid Cash" })).toContain(
        "built-in card"
      );
    });

    it("identifies Zerodha and Demat accounts and protects Zerodha from deletion", () => {
      const zerodha = { name: "Zerodha Trading & Demat", type: "INVESTMENT", last_four: "HXH648" };
      expect(isDematAccount(zerodha)).toBe(true);
      expect(isZerodhaAccount(zerodha)).toBe(true);
      expect(getProtectedAccountReason(zerodha)).toContain("integrated account");
    });

    it("allows regular bank and credit card accounts to be deleted", () => {
      const icici = { id: ICICI_ID, name: "ICICI", type: "Savings Account", last_four: "1212" };
      expect(isCashAccount(icici)).toBe(false);
      expect(isZerodhaAccount(icici)).toBe(false);
      expect(getProtectedAccountReason(icici)).toBeNull();
    });
  });

  describe("GET /api/v1/accounts/[id] (Preflight Inspection)", () => {
    it("returns linked transfer and statement counts without mutating data", async () => {
      mockedSupabase.from.mockImplementation(((table: string) => {
        if (table === "accounts") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: ICICI_ID,
                      name: "ICICI",
                      type: "Savings Account",
                      balance: 1832,
                      last_four: "1212",
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "transfers") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                or: vi.fn().mockResolvedValue({ count: 2, error: null }),
              }),
            }),
          };
        }
        if (table === "bank_statements") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
              }),
            }),
          };
        }
        return {};
      }) as unknown as typeof supabaseAdmin.from);

      const req = new NextRequest(`http://localhost:3000/api/v1/accounts/${ICICI_ID}`, {
        method: "GET",
      });
      const res = await GET(req, { params: Promise.resolve({ id: ICICI_ID }) });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.accountId).toBe(ICICI_ID);
      expect(body.data.linkedTransfersCount).toBe(2);
      expect(body.data.linkedStatementsCount).toBe(0);
      expect(mockedSupabase.rpc).not.toHaveBeenCalled();
    });
  });

  describe("DELETE /api/v1/accounts/[id]", () => {
    it("rejects unauthenticated callers with 401", async () => {
      mockedAuth.mockResolvedValueOnce({ user: null, userId: null, error: "Unauthorized" });
      const req = new NextRequest(`http://localhost:3000/api/v1/accounts/${ICICI_ID}`, {
        method: "DELETE",
      });
      const res = await DELETE(req, { params: Promise.resolve({ id: ICICI_ID }) });
      expect(res.status).toBe(401);
    });

    it("rejects malformed UUID account IDs with 422", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/accounts/not-a-uuid", {
        method: "DELETE",
      });
      const res = await DELETE(req, { params: Promise.resolve({ id: "not-a-uuid" }) });
      expect(res.status).toBe(422);
    });

    it("returns 404 when the card does not exist or belongs to another user", async () => {
      mockedSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      } as unknown as FromResult);

      const req = new NextRequest(`http://localhost:3000/api/v1/accounts/${ICICI_ID}`, {
        method: "DELETE",
      });
      const res = await DELETE(req, { params: Promise.resolve({ id: ICICI_ID }) });
      expect(res.status).toBe(404);
    });

    it("returns 400 when attempting to delete Cash in Hand or Zerodha", async () => {
      mockedSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: DEFAULT_CASH_ID,
                  name: "Cash in Hand",
                  type: "Liquid Cash",
                  balance: 18009,
                  last_four: "CASH",
                },
                error: null,
              }),
            }),
          }),
        }),
      } as unknown as FromResult);

      const req = new NextRequest(`http://localhost:3000/api/v1/accounts/${DEFAULT_CASH_ID}`, {
        method: "DELETE",
      });
      const res = await DELETE(req, { params: Promise.resolve({ id: DEFAULT_CASH_ID }) });
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error.code).toBe("PROTECTED_ACCOUNT");
    });

    it("returns 409 LINKED_RECORDS_EXIST when linked transfers block deletion and force is not set", async () => {
      mockedSupabase.from.mockImplementation(((table: string) => {
        if (table === "accounts") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: ICICI_ID,
                      name: "ICICI",
                      type: "Savings Account",
                      balance: 1832,
                      last_four: "1212",
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "transfers") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                or: vi.fn().mockResolvedValue({ count: 2, error: null }),
              }),
            }),
          };
        }
        if (table === "bank_statements") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
              }),
            }),
          };
        }
        return {};
      }) as unknown as typeof supabaseAdmin.from);

      const req = new NextRequest(`http://localhost:3000/api/v1/accounts/${ICICI_ID}`, {
        method: "DELETE",
      });
      const res = await DELETE(req, { params: Promise.resolve({ id: ICICI_ID }) });
      const body = await res.json();

      expect(res.status).toBe(409);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("LINKED_RECORDS_EXIST");
      expect(body.error.details.linkedTransfersCount).toBe(2);
      expect(body.error.details.linkedStatementsCount).toBe(0);
      expect(mockedSupabase.rpc).not.toHaveBeenCalled();
    });

    it("deletes account and clears linked transfers cleanly via fallback when RPC is not yet installed", async () => {
      const mockTransfersDeleteOr = vi.fn().mockResolvedValue({ error: null });
      const mockAccountDeleteSingle = vi
        .fn()
        .mockResolvedValue({ data: { id: ICICI_ID }, error: null });
      const mockAuditInsert = vi.fn().mockResolvedValue({ error: null });

      mockedSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: {
          code: "PGRST202",
          message: "Could not find the function public.fn_delete_account_atomic",
        },
      } as unknown as RpcResult);

      mockedSupabase.from.mockImplementation(((table: string) => {
        if (table === "accounts") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: ICICI_ID,
                      name: "ICICI",
                      type: "Savings Account",
                      balance: 1832,
                      last_four: "1212",
                    },
                    error: null,
                  }),
                }),
              }),
            }),
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  select: vi.fn().mockReturnValue({
                    maybeSingle: mockAccountDeleteSingle,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "transfers") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                or: vi.fn().mockResolvedValue({ count: 2, error: null }),
              }),
            }),
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                or: mockTransfersDeleteOr,
              }),
            }),
          };
        }
        if (table === "bank_statements") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
              }),
            }),
          };
        }
        if (table === "financial_audit_logs") {
          return { insert: mockAuditInsert };
        }
        return {};
      }) as unknown as typeof supabaseAdmin.from);

      const req = new NextRequest(`http://localhost:3000/api/v1/accounts/${ICICI_ID}?force=true`, {
        method: "DELETE",
      });
      const res = await DELETE(req, { params: Promise.resolve({ id: ICICI_ID }) });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.deletedAccountId).toBe(ICICI_ID);
      expect(body.data.clearedTransfers).toBe(2);
      expect(mockTransfersDeleteOr).toHaveBeenCalledWith(
        `from_account_id.eq.${ICICI_ID},to_account_id.eq.${ICICI_ID}`
      );
      expect(mockAccountDeleteSingle).toHaveBeenCalledTimes(1);
      expect(mockedInvalidate).toHaveBeenCalledWith(
        TEST_USER_ID,
        expect.arrayContaining(["ACCOUNTS", "TRANSFERS", "PORTFOLIO", "LEDGER"])
      );
    });

    it("deletes account immediately via atomic RPC when force=true", async () => {
      mockedSupabase.rpc.mockResolvedValueOnce({
        data: {
          success: true,
          deleted_account_id: ICICI_ID,
          account_name: "ICICI",
          cleared_transfers: 2,
          cleared_statements: 0,
        },
        error: null,
      } as unknown as RpcResult);

      mockedSupabase.from.mockImplementation(((table: string) => {
        if (table === "accounts") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: ICICI_ID,
                      name: "ICICI",
                      type: "Savings Account",
                      balance: 1832,
                      last_four: "1212",
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "transfers") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                or: vi.fn().mockResolvedValue({ count: 2, error: null }),
              }),
            }),
          };
        }
        if (table === "bank_statements") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
              }),
            }),
          };
        }
        return {};
      }) as unknown as typeof supabaseAdmin.from);

      const req = new NextRequest(`http://localhost:3000/api/v1/accounts/${ICICI_ID}?force=true`, {
        method: "DELETE",
      });
      const res = await DELETE(req, { params: Promise.resolve({ id: ICICI_ID }) });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.clearedTransfers).toBe(2);
      expect(mockedSupabase.rpc).toHaveBeenCalledWith("fn_delete_account_atomic", {
        p_user_id: TEST_USER_ID,
        p_account_id: ICICI_ID,
        p_clear_transfers: true,
      });
    });
  });

  describe("SQL Migration Security Invariants", () => {
    it("enforces strict caller authorization, search_path, and least-privilege grants in fn_delete_account_atomic", () => {
      const migrationPath = path.join(
        process.cwd(),
        "supabase/migrations/20261128000000_atomic_account_deletion.sql"
      );
      const sql = fs.readFileSync(migrationPath, "utf8");

      expect(sql).toContain("SET search_path = public, pg_temp");
      expect(sql).toContain("public.fn_get_caller_role()");
      expect(sql).toContain(
        "v_caller_role != 'service_role' AND (v_caller_id IS NULL OR v_caller_id != p_user_id)"
      );
      expect(sql).toContain(
        "REVOKE ALL ON FUNCTION public.fn_delete_account_atomic(text, uuid, boolean) FROM PUBLIC, anon;"
      );
      expect(sql).toContain(
        "GRANT EXECUTE ON FUNCTION public.fn_delete_account_atomic(text, uuid, boolean) TO authenticated, service_role;"
      );
    });
  });
});
