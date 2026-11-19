import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Crypto & Binance Database Schema", () => {
  const schemaPath = path.resolve(process.cwd(), "supabase_schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf-8");

  it("defines the binance_integrations table with all required columns", () => {
    expect(schemaSql).toContain("CREATE TABLE IF NOT EXISTS public.binance_integrations");
    expect(schemaSql).toMatch(/user_id\s+text\s+NOT NULL\s+UNIQUE/i);
    expect(schemaSql).toMatch(/api_key\s+text\s+NOT NULL/i);
    expect(schemaSql).toMatch(/api_secret\s+text\s+NOT NULL/i);
    expect(schemaSql).toMatch(/is_active\s+boolean\s+NOT NULL\s+DEFAULT\s+true/i);
    expect(schemaSql).toMatch(/last_synced_at\s+timestamptz/i);
  });

  it("defines the crypto_holdings table with financial precision columns", () => {
    expect(schemaSql).toContain("CREATE TABLE IF NOT EXISTS public.crypto_holdings");
    expect(schemaSql).toMatch(/asset\s+text\s+NOT NULL/i);
    expect(schemaSql).toMatch(/total_quantity\s+numeric\(28,\s*8\)/i);
    expect(schemaSql).toMatch(/current_price_usd\s+numeric\(18,\s*4\)/i);
    expect(schemaSql).toMatch(/total_value_usd\s+numeric\(18,\s*4\)/i);
    expect(schemaSql).toMatch(/change_24h\s+numeric\(8,\s*2\)/i);
  });

  it("enables RLS and defines access policies for binance_integrations and crypto_holdings", () => {
    expect(schemaSql).toContain("ALTER TABLE public.binance_integrations ENABLE ROW LEVEL SECURITY;");
    expect(schemaSql).toContain("ALTER TABLE public.crypto_holdings ENABLE ROW LEVEL SECURITY;");
    expect(schemaSql).toContain("Users can view own binance integration");
    expect(schemaSql).toContain("Users can view own crypto holdings");
  });

  it("defines the crypto_trades table with side, price, qty, commission, and unique trade_id", () => {
    expect(schemaSql).toContain("CREATE TABLE IF NOT EXISTS public.crypto_trades");
    expect(schemaSql).toMatch(/trade_id\s+bigint\s+NOT NULL/i);
    expect(schemaSql).toMatch(/symbol\s+text\s+NOT NULL/i);
    expect(schemaSql).toMatch(/side\s+text\s+NOT NULL\s+CHECK\s*\(side IN \('BUY',\s*'SELL'\)\)/i);
    expect(schemaSql).toMatch(/price\s+numeric\(28,\s*8\)/i);
    expect(schemaSql).toMatch(/qty\s+numeric\(28,\s*8\)/i);
    expect(schemaSql).toMatch(/quote_qty\s+numeric\(28,\s*8\)/i);
    expect(schemaSql).toMatch(/commission\s+numeric\(28,\s*8\)/i);
    expect(schemaSql).toMatch(/uq_crypto_user_trade UNIQUE \(user_id, trade_id\)/i);
    expect(schemaSql).toContain("ALTER TABLE public.crypto_trades ENABLE ROW LEVEL SECURITY;");
    expect(schemaSql).toContain("Users can view own crypto trades");
  });
});
