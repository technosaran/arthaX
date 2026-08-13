import crypto from "crypto";
import logger from "@/lib/logger";

export interface BinanceBalance {
  asset: string;
  free: string;
  locked: string;
}

export interface BinanceAccountInfo {
  makerCommission?: number;
  takerCommission?: number;
  buyerCommission?: number;
  sellerCommission?: number;
  canTrade?: boolean;
  canWithdraw?: boolean;
  canDeposit?: boolean;
  accountType?: string;
  balances: BinanceBalance[];
}

export interface BinanceTicker24h {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  weightedAvgPrice: string;
  prevClosePrice: string;
  lastPrice: string;
  lastQty: string;
  bidPrice: string;
  askPrice: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
}

export class BinanceClient {
  private apiKey: string;
  private apiSecret: string;
  private baseUrl: string;

  constructor(apiKey: string, apiSecret: string, baseUrl = "https://api.binance.com") {
    this.apiKey = (apiKey || "").replace(/^["']|["']$/g, "").trim();
    this.apiSecret = (apiSecret || "").replace(/^["']|["']$/g, "").trim();
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  /**
   * Generates HMAC-SHA256 signature for Binance API query parameters.
   */
  private generateSignature(queryString: string): string {
    return crypto
      .createHmac("sha256", this.apiSecret)
      .update(queryString)
      .digest("hex");
  }

  /**
   * Fetches user's Binance spot account information (balances).
   */
  async getAccountInfo(recvWindow = 5000): Promise<BinanceAccountInfo> {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error("Binance API key or secret is missing. Please check your credentials.");
    }

    const timestamp = Date.now();
    const queryString = `recvWindow=${recvWindow}&timestamp=${timestamp}`;
    const signature = this.generateSignature(queryString);
    const requestUrl = `${this.baseUrl}/api/v3/account?${queryString}&signature=${signature}`;

    logger.info("Binance: Fetching account info", {
      apiKey: `${this.apiKey.substring(0, 4)}****`,
      timestamp,
    });

    const response = await fetch(requestUrl, {
      method: "GET",
      headers: {
        "X-MBX-APIKEY": this.apiKey,
        "Accept": "application/json",
      },
      cache: "no-store",
    });

    const result = await response.json();

    if (!response.ok) {
      const code = result?.code ?? response.status;
      const msg = result?.msg || "Failed to fetch Binance account information.";
      logger.error("Binance: Account fetch failed", { code, msg });

      if (code === -2014 || code === -2015 || msg.toLowerCase().includes("api-key")) {
        throw new Error("Invalid Binance API key or secret. Please check your Binance settings.");
      }
      if (code === -1021 || msg.toLowerCase().includes("timestamp")) {
        throw new Error("Timestamp for this request was outside of the recvWindow. Please try again.");
      }
      throw new Error(`Binance API Error (${code}): ${msg}`);
    }

    return result as BinanceAccountInfo;
  }

  /**
   * Fetches 24-hour ticker price change statistics for all or specified symbols.
   */
  async get24hrTickers(): Promise<BinanceTicker24h[]> {
    const requestUrl = `${this.baseUrl}/api/v3/ticker/24hr`;

    const response = await fetch(requestUrl, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
      next: { revalidate: 15 },
    });

    const result = await response.json();

    if (!response.ok) {
      const msg = result?.msg || "Failed to fetch Binance ticker prices.";
      throw new Error(`Binance Ticker Error: ${msg}`);
    }

    return result as BinanceTicker24h[];
  }
}
