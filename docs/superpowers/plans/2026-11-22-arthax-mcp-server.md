# arthaX MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-grade Model Context Protocol (MCP) server for arthaX exposing financial intelligence tools, URI resources, and analytical prompts to autonomous AI agents over stdio.

**Architecture:** A standalone TypeScript MCP service using `@modelcontextprotocol/sdk` and `zod`. It interfaces with arthaX's Supabase PostgreSQL database and `executeNetWorthTS` embedded calculation engine, providing scoped multi-tenant isolation, atomic ledger writes via PostgreSQL stored procedures, and standard MCP protocol compatibility.

**Tech Stack:** TypeScript, `@modelcontextprotocol/sdk`, `@supabase/supabase-js`, `zod`, Vitest, Node.js (`tsx`).

**Spec:** [docs/superpowers/specs/2026-11-22-arthax-mcp-server-design.md](file:///c:/Users/saran/Desktop/arthaX/docs/superpowers/specs/2026-11-22-arthax-mcp-server-design.md)

## Global Constraints
- Node.js >= 20.x, TypeScript strict mode compliance with no type errors (`npm run typecheck`).
- Zero float-drift: Net worth and asset calculations must reuse arthaX's integer-paise mathematical functions (`executeNetWorthTS` and `roundMoney`).
- Write operations (expenses, incomes, transfers) must invoke PostgreSQL atomic functions (`fn_record_expense_atomic`, etc.) with validated positive amounts.
- Do not log sensitive secrets or unencrypted keys to stdout (which would corrupt stdio MCP communication). All diagnostic logs must go to stderr.
- Fully compatible with Vitest test suite (`npm test`).

## Review Focus
1. Non-existent or missing user ID: Graceful error response guiding user to configure `ARTHAX_USER_ID`.
2. Negative or zero transaction amounts: Schema rejection before hitting database procedures.
3. Insufficient balance or invalid account UUID: Friendly descriptive error message returned to the agent.
4. Currency formatting: Consistent INR default with support for USD conversion where rates are present.
5. Stdio stream cleanliness: Ensure no `console.log` pollutes stdout; only MCP JSON-RPC messages traverse stdout.

---

### Task 1: Package Dependencies & Core MCP Configuration

**Files:**
- Modify: `package.json`
- Create: `src/mcp/config.ts`
- Create: `src/mcp/db.ts`
- Test: `tests/mcp/config.test.ts`

**Interfaces:**
- Consumes: Environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ARTHAX_USER_ID`).
- Produces:
  - `getMcpConfig(): { supabaseUrl: string; supabaseKey: string; userId: string }`
  - `getMcpDb(config?: McpConfig): SupabaseClient<Database>`

- [ ] **Step 1: Write the failing test for configuration and DB resolver**

```typescript
// tests/mcp/config.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getMcpConfig } from "../../src/mcp/config";

describe("MCP Configuration", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws descriptive error when Supabase URL or Key is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(() => getMcpConfig()).toThrow(/Supabase configuration missing/);
  });

  it("loads configuration successfully when environment variables exist", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-key");
    vi.stubEnv("ARTHAX_USER_ID", "user-123");

    const config = getMcpConfig();
    expect(config.supabaseUrl).toBe("https://example.supabase.co");
    expect(config.supabaseKey).toBe("test-key");
    expect(config.userId).toBe("user-123");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/mcp/config.test.ts`  
Expected: FAIL ("Cannot find module '../../src/mcp/config'")

- [ ] **Step 3: Install `@modelcontextprotocol/sdk` and implement `src/mcp/config.ts` & `src/mcp/db.ts`**

Run: `npm install @modelcontextprotocol/sdk`  
Implement `src/mcp/config.ts` with environment variable loading and validation.  
Implement `src/mcp/db.ts` instantiating typed Supabase client with persistSession: false.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/mcp/config.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/mcp/config.ts src/mcp/db.ts tests/mcp/config.test.ts
git commit -m "feat(mcp): add @modelcontextprotocol/sdk dependency, config loader, and db client"
```

---

### Task 2: Read Tools (Net Worth, Accounts, Holdings, Budgets, Forecast)

**Files:**
- Create: `src/mcp/tools/netWorth.ts`
- Create: `src/mcp/tools/accounts.ts`
- Create: `src/mcp/tools/holdings.ts`
- Create: `src/mcp/tools/budgets.ts`
- Create: `src/mcp/tools/forecast.ts`
- Test: `tests/mcp/readTools.test.ts`

**Interfaces:**
- Consumes: `getMcpDb`, `executeNetWorthTS` from `@/lib/engine/embeddedEngine`
- Produces:
  - `handleGetNetWorth(db: SupabaseClient, userId: string, currency?: string): Promise<object>`
  - `handleListAccounts(db: SupabaseClient, userId: string, includeArchived?: boolean): Promise<object>`
  - `handleGetHoldings(db: SupabaseClient, userId: string, assetClass?: string): Promise<object>`
  - `handleGetBudgets(db: SupabaseClient, userId: string, month?: string): Promise<object>`
  - `handleGetForecast(db: SupabaseClient, userId: string, monthsAhead?: number): Promise<object>`

- [ ] **Step 1: Write the failing tests for read tools**

```typescript
// tests/mcp/readTools.test.ts
import { describe, it, expect, vi } from "vitest";
import { handleGetNetWorth } from "../../src/mcp/tools/netWorth";
import { handleListAccounts } from "../../src/mcp/tools/accounts";
import { handleGetHoldings } from "../../src/mcp/tools/holdings";

describe("MCP Read Tools", () => {
  it("calculates net worth using embedded engine and database records", async () => {
    const mockDb = {
      from: vi.fn((table: string) => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: table === "accounts" ? [{ id: "acc1", balance: 50000, type: "SAVINGS", classification: "asset" }] : [],
          error: null,
        }),
      })),
    } as any;

    const result = await handleGetNetWorth(mockDb, "user-test", "INR");
    expect(result).toHaveProperty("totalNetWorth");
    expect(result).toHaveProperty("liquidCash");
  });

  it("lists accounts with active filter", async () => {
    const mockAccounts = [
      { id: "1", name: "HDFC Bank", balance: 25000, is_active: true },
      { id: "2", name: "Old Bank", balance: 0, is_active: false },
    ];
    const mockDb = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [mockAccounts[0]], error: null }),
      })),
    } as any;

    const res = await handleListAccounts(mockDb, "user-test", false);
    expect(res).toBeDefined();
    expect(Array.isArray((res as any).accounts)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/mcp/readTools.test.ts`  
Expected: FAIL ("Cannot find module '../../src/mcp/tools/netWorth'")

- [ ] **Step 3: Implement read tools**

Implement `src/mcp/tools/netWorth.ts`, `accounts.ts`, `holdings.ts`, `budgets.ts`, `forecast.ts`.  
Ensure all tools fetch user-scoped data (`.eq("user_id", userId)`), handle empty datasets gracefully, and return clean structured JSON.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/mcp/readTools.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/mcp/tools/netWorth.ts src/mcp/tools/accounts.ts src/mcp/tools/holdings.ts src/mcp/tools/budgets.ts src/mcp/tools/forecast.ts tests/mcp/readTools.test.ts
git commit -m "feat(mcp): implement financial read tools (net worth, accounts, holdings, budgets, forecast)"
```

---

### Task 3: Transaction Query & Atomic Record Tools

**Files:**
- Create: `src/mcp/tools/transactions.ts`
- Create: `src/mcp/tools/recordAction.ts`
- Test: `tests/mcp/transactionTools.test.ts`

**Interfaces:**
- Consumes: Supabase RPC procedures (`fn_record_expense_atomic`, `fn_record_income_atomic`, `fn_record_transfer_atomic`)
- Produces:
  - `handleQueryTransactions(db: SupabaseClient, userId: string, filters: TransactionFilters): Promise<object>`
  - `handleRecordExpense(db: SupabaseClient, userId: string, params: RecordExpenseParams): Promise<object>`
  - `handleRecordIncome(db: SupabaseClient, userId: string, params: RecordIncomeParams): Promise<object>`
  - `handleRecordTransfer(db: SupabaseClient, userId: string, params: RecordTransferParams): Promise<object>`

- [ ] **Step 1: Write the failing tests for transaction tools**

```typescript
// tests/mcp/transactionTools.test.ts
import { describe, it, expect, vi } from "vitest";
import { handleRecordExpense, handleRecordTransfer } from "../../src/mcp/tools/recordAction";

describe("MCP Transaction Tools", () => {
  it("rejects non-positive transaction amounts", async () => {
    const mockDb = {} as any;
    await expect(handleRecordExpense(mockDb, "user-test", {
      accountId: "acc-1",
      amount: -50,
      category: "Food",
      description: "Invalid",
      date: "2026-11-22"
    })).rejects.toThrow(/Amount must be greater than zero/);
  });

  it("calls atomic RPC fn_record_expense_atomic with correct parameters", async () => {
    const rpcMock = vi.fn().mockResolvedValue({ data: { success: true, expense_id: "exp-1" }, error: null });
    const mockDb = { rpc: rpcMock } as any;

    const res = await handleRecordExpense(mockDb, "user-test", {
      accountId: "acc-1",
      amount: 450,
      category: "Food",
      description: "Dinner",
      date: "2026-11-22"
    });

    expect(rpcMock).toHaveBeenCalledWith("fn_record_expense_atomic", expect.objectContaining({
      p_user_id: "user-test",
      p_account_id: "acc-1",
      p_amount: 450,
    }));
    expect(res).toHaveProperty("success", true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/mcp/transactionTools.test.ts`  
Expected: FAIL ("Cannot find module '../../src/mcp/tools/recordAction'")

- [ ] **Step 3: Implement `src/mcp/tools/transactions.ts` and `src/mcp/tools/recordAction.ts`**

Implement transaction querying with date, category, and limit filters.  
Implement atomic write tools invoking Supabase RPCs, validating input bounds with `zod`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/mcp/transactionTools.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/mcp/tools/transactions.ts src/mcp/tools/recordAction.ts tests/mcp/transactionTools.test.ts
git commit -m "feat(mcp): implement transaction query and atomic write tools"
```

---

### Task 4: Resources, Prompts & Server Assembly

**Files:**
- Create: `src/mcp/resources/index.ts`
- Create: `src/mcp/prompts/index.ts`
- Create: `src/mcp/tools/index.ts`
- Create: `src/mcp/server.ts`
- Modify: `package.json` (add `"mcp": "tsx src/mcp/server.ts"`)
- Test: `tests/mcp/server.test.ts`

**Interfaces:**
- Consumes: `@modelcontextprotocol/sdk/server/mcp.js`, `StdioServerTransport`
- Produces:
  - `createMcpServer(config?: McpConfig): McpServer`
  - `startStdioServer(): Promise<void>`

- [ ] **Step 1: Write the failing test for server factory and registration**

```typescript
// tests/mcp/server.test.ts
import { describe, it, expect } from "vitest";
import { createMcpServer } from "../../src/mcp/server";

describe("ArthaX MCP Server Assembly", () => {
  it("initializes McpServer with server name and tools", () => {
    const server = createMcpServer({
      supabaseUrl: "https://example.supabase.co",
      supabaseKey: "test-key",
      userId: "user-test",
    });
    expect(server).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/mcp/server.test.ts`  
Expected: FAIL ("Cannot find module '../../src/mcp/server'")

- [ ] **Step 3: Implement resources, prompts, tool registry, and `server.ts`**

Implement:
- `src/mcp/resources/index.ts`: register resources `arthax://portfolio/summary`, `arthax://accounts`, `arthax://budgets`.
- `src/mcp/prompts/index.ts`: register prompts `financial_health_audit` and `portfolio_risk_rebalance`.
- `src/mcp/tools/index.ts`: register all tools with `server.tool(...)` using zod parameter schemas.
- `src/mcp/server.ts`: factory function `createMcpServer` and CLI execution guard via `StdioServerTransport`.
- In `package.json`, add `"mcp": "npx tsx src/mcp/server.ts"`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/mcp/server.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/mcp/resources/index.ts src/mcp/prompts/index.ts src/mcp/tools/index.ts src/mcp/server.ts package.json tests/mcp/server.test.ts
git commit -m "feat(mcp): assemble McpServer with resources, prompts, tools, and stdio transport"
```

---

### Task 5: End-to-End Integration Verification & Documentation

**Files:**
- Create: `tests/mcp/e2e.test.ts`
- Create: `docs/MCP_SERVER.md`
- Test: Full test suite verification (`npm test`, `npm run typecheck`)

- [ ] **Step 1: Write end-to-end protocol verification test**

Verify client-server handshake, tool enumeration, and tool execution using in-memory / mock transports.

- [ ] **Step 2: Run end-to-end tests**

Run: `npx vitest run tests/mcp/e2e.test.ts`  
Expected: PASS

- [ ] **Step 3: Create documentation in `docs/MCP_SERVER.md`**

Document server architecture, available tools/resources/prompts, environment variable setup, and sample configurations for Claude Desktop, Antigravity, and Cursor.

- [ ] **Step 4: Run full project verification**

Run: `npm test && npm run typecheck`  
Expected: PASS with 0 errors.

- [ ] **Step 5: Final Commit**

```bash
git add tests/mcp/e2e.test.ts docs/MCP_SERVER.md
git commit -m "feat(mcp): complete MCP server integration with tests and documentation"
```
