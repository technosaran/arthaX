import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import {
  fetchBinanceMyTrades,
  parseBinanceRawTrades,
  calculateTradeStats,
  getExitedAssets,
} from "../src/utils/binance";

const TradeRecordSchema = z.object({
  user_id: z.string(),
  trade_id: z.number(),
  order_id: z.number(),
  symbol: z.string(),
  side: z.enum(["BUY", "SELL"]),
  price: z.number().nonnegative(),
  qty: z.number().nonnegative(),
  quote_qty: z.number().nonnegative(),
  commission: z.number(),
  commission_asset: z.string(),
  is_buyer: z.boolean(),
  is_maker: z.boolean(),
  executed_at: z.string(),
});

describe("Crypto Trades API & Sync Logic", () => {
  it("validates trade record structure for public.crypto_trades upsert", () => {
    const raw = {
      id: 99881,
      orderId: 77662,
      symbol: "ETHUSDT",
      price: "3400.50",
      qty: "1.5",
      quoteQty: "5100.75",
      commission: "5.10",
      commissionAsset: "USDT",
      time: 1710000000000,
      isBuyer: false,
      isMaker: true,
    };

    const [trade] = parseBinanceRawTrades([raw]);
    const record = {
      user_id: "user-123",
      trade_id: trade.tradeId,
      order_id: trade.orderId,
      symbol: trade.symbol,
      side: trade.side,
      price: trade.price,
      qty: trade.qty,
      quote_qty: trade.quoteQty,
      commission: trade.commission,
      commission_asset: trade.commissionAsset,
      is_buyer: trade.isBuyer,
      is_maker: trade.isMaker,
      executed_at: trade.executedAt,
    };

    const parseRes = TradeRecordSchema.safeParse(record);
    expect(parseRes.success).toBe(true);
    if (parseRes.success) {
      expect(parseRes.data.side).toBe("SELL");
      expect(parseRes.data.price).toBe(3400.5);
      expect(parseRes.data.quote_qty).toBe(5100.75);
    }
  });

  it("handles fetchBinanceMyTrades with mock Binance response", async () => {
    const mockTrades = [
      {
        id: 1,
        orderId: 10,
        symbol: "BTCUSDT",
        price: "95000",
        qty: "0.05",
        quoteQty: "4750",
        commission: "4.75",
        commissionAsset: "USDT",
        time: 1715000000000,
        isBuyer: true,
        isMaker: false,
      },
    ];

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockTrades,
    } as unknown as Response);

    try {
      const res = await fetchBinanceMyTrades("fake_key", "fake_secret", "BTCUSDT");
      expect(res.success).toBe(true);
      expect(res.data).toHaveLength(1);
      expect(res.data?.[0].id).toBe(1);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("handles Binance API errors safely in fetchBinanceMyTrades", async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ code: -1121, msg: "Invalid symbol." }),
    } as unknown as Response);

    try {
      const res = await fetchBinanceMyTrades("fake_key", "fake_secret", "BADSYM");
      expect(res.success).toBe(false);
      expect(res.error).toBe("Invalid symbol.");
    } finally {
      global.fetch = originalFetch;
    }
  });
});
