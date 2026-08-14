import { isZerodhaEnabled, getZerodhaCredentialsForUser } from "@/lib/zerodha/zerodha-config";
import { KiteClient } from "@/lib/zerodha/kite-client";
import { ZerodhaSyncService } from "@/lib/zerodha/zerodha-service";

describe("Zerodha Integration Unit Tests", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("zerodha-config", () => {
    it("should return true for isZerodhaEnabled by default", () => {
      delete process.env.NEXT_PUBLIC_ENABLE_ZERODHA;
      expect(isZerodhaEnabled()).toBe(true);
    });

    it("should respect NEXT_PUBLIC_ENABLE_ZERODHA env flag", () => {
      process.env.NEXT_PUBLIC_ENABLE_ZERODHA = "false";
      expect(isZerodhaEnabled()).toBe(false);

      process.env.NEXT_PUBLIC_ENABLE_ZERODHA = "true";
      expect(isZerodhaEnabled()).toBe(true);
    });

    it("should resolve global credentials with trim", async () => {
      process.env.ZERODHA_API_KEY = "  key123  ";
      process.env.ZERODHA_API_SECRET = "  secret456  ";

      const creds = await getZerodhaCredentialsForUser(null, null);
      expect(creds.apiKey).toBe("key123");
      expect(creds.apiSecret).toBe("secret456");
      expect(creds.source).toBe("global");
    });
  });

  describe("KiteClient", () => {
    it("should construct valid login URL without redirect_params", () => {
      const client = new KiteClient("test_key", "test_secret");
      const url = client.getLoginUrl();
      expect(url).toBe("https://kite.zerodha.com/connect/login?v=3&api_key=test_key");
      expect(url).not.toContain("redirect_params");
    });

    it("should trim whitespace from API key and secret in constructor", () => {
      const client = new KiteClient("  test_key  ", "  test_secret  ");
      const url = client.getLoginUrl();
      expect(url).toContain("api_key=test_key");
      expect(url).not.toContain("api_key=+");
      expect(url).not.toContain("api_key=%20");
    });

    it("should throw error for empty request token", async () => {
      const client = new KiteClient("test_key", "test_secret");
      await expect(client.generateSession("")).rejects.toThrow("Request token is empty");
      await expect(client.generateSession("   ")).rejects.toThrow("Request token is empty");
    });

    it("should throw error when API key/secret is missing", async () => {
      const client = new KiteClient("", "test_secret");
      await expect(client.generateSession("some_token")).rejects.toThrow("API key or secret is missing");
    });
  });

  describe("ZerodhaSyncService", () => {
    it("should route INF holdings to mutual_funds and INE to investments", async () => {
      const mockSupabase: any = {
        from: jest.fn((table: string) => {
          if (table === "investments") {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
              insert: jest.fn().mockResolvedValue({ data: null, error: null }),
              update: jest.fn().mockResolvedValue({ data: null, error: null }),
            };
          }
          if (table === "mutual_funds") {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
              insert: jest.fn().mockResolvedValue({ data: null, error: null }),
              update: jest.fn().mockResolvedValue({ data: null, error: null }),
            };
          }
          return {};
        }),
      };

      const service = new ZerodhaSyncService(mockSupabase);

      const mockHoldings = [
        {
          tradingsymbol: "RELIANCE",
          exchange: "NSE",
          isin: "INE002A01018",
          quantity: 10,
          average_price: 2500,
          last_price: 2600,
          price: 2500,
        },
        {
          tradingsymbol: "NIPPON_INDIA_LARGE_CAP",
          exchange: "MF",
          isin: "INF209K01157",
          quantity: 100,
          average_price: 50,
          last_price: 55,
          price: 50,
        },
      ];

      const result = await service.syncHoldings("user-123", mockHoldings);

      expect(result.syncedHoldingsCount).toBe(2);
      expect(result.stocksSynced).toBe(1);
      expect(result.mutualFundsSynced).toBe(1);
      expect(result.createdCount).toBe(2);
      expect(result.errors.length).toBe(0);
    });
  });
});
