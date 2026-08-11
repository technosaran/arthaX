import crypto from "crypto";

export interface ZerodhaHolding {
  tradingsymbol: string;
  exchange: string;
  isin?: string;
  quantity: number;
  t1_quantity?: number;
  realised_quantity?: number;
  authorised_quantity?: number;
  opening_quantity?: number;
  price: number;
  average_price: number;
  last_price: number;
  close_price?: number;
  pnl?: number;
  day_change?: number;
  day_change_percentage?: number;
}

export interface ZerodhaPosition {
  tradingsymbol: string;
  exchange: string;
  instrument_token?: number;
  product: string;
  quantity: number;
  overnight_quantity?: number;
  multiplier?: number;
  average_price: number;
  close_price?: number;
  last_price: number;
  value?: number;
  pnl?: number;
  m2m?: number;
  unrealised?: number;
  realised?: number;
  buy_quantity?: number;
  buy_price?: number;
  sell_quantity?: number;
  sell_price?: number;
}

export interface ZerodhaSession {
  access_token: string;
  public_token?: string;
  user_id: string;
  user_name?: string;
  email?: string;
}

export class KiteClient {
  private apiKey: string;
  private apiSecret: string;
  private baseUrl = "https://api.kite.trade";

  constructor(apiKey: string, apiSecret: string) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
  }

  /**
   * Generates the Zerodha Kite OAuth login URL
   */
  getLoginUrl(redirectUrl?: string): string {
    let url = `https://kite.zerodha.com/connect/login?v=3&api_key=${encodeURIComponent(this.apiKey)}`;
    if (redirectUrl) {
      url += `&redirect_params=${encodeURIComponent(redirectUrl)}`;
    }
    return url;
  }

  /**
   * Computes SHA-256 checksum: sha256(api_key + request_token + api_secret)
   */
  private generateChecksum(requestToken: string): string {
    const cleanApiKey = (this.apiKey || "").trim();
    const cleanToken = (requestToken || "").trim();
    const cleanSecret = (this.apiSecret || "").trim();
    const data = cleanApiKey + cleanToken + cleanSecret;
    return crypto.createHash("sha256").update(data).digest("hex");
  }

  /**
   * Exchanges a request_token for a session access_token
   */
  async generateSession(requestToken: string): Promise<ZerodhaSession> {
    const checksum = this.generateChecksum(requestToken);
    const body = new URLSearchParams({
      api_key: this.apiKey,
      request_token: requestToken,
      checksum: checksum,
    });

    const response = await fetch(`${this.baseUrl}/session/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Kite-Version": "3",
      },
      body: body.toString(),
    });

    const result = await response.json();

    if (!response.ok || result.status !== "success") {
      throw new Error(
        result.message || result.error_type || "Failed to generate Zerodha session token."
      );
    }

    return {
      access_token: result.data.access_token,
      public_token: result.data.public_token,
      user_id: result.data.user_id,
      user_name: result.data.user_name,
      email: result.data.email,
    };
  }

  /**
   * Fetches holdings for the authenticated user
   */
  async getHoldings(accessToken: string): Promise<ZerodhaHolding[]> {
    const response = await fetch(`${this.baseUrl}/portfolio/holdings`, {
      method: "GET",
      headers: {
        Authorization: `token ${this.apiKey}:${accessToken}`,
        "X-Kite-Version": "3",
      },
    });

    const result = await response.json();

    if (!response.ok || result.status !== "success") {
      throw new Error(result.message || "Failed to fetch Zerodha holdings.");
    }

    return result.data || [];
  }

  /**
   * Fetches open positions for the authenticated user
   */
  async getPositions(accessToken: string): Promise<{ net: ZerodhaPosition[]; day: ZerodhaPosition[] }> {
    const response = await fetch(`${this.baseUrl}/portfolio/positions`, {
      method: "GET",
      headers: {
        Authorization: `token ${this.apiKey}:${accessToken}`,
        "X-Kite-Version": "3",
      },
    });

    const result = await response.json();

    if (!response.ok || result.status !== "success") {
      throw new Error(result.message || "Failed to fetch Zerodha positions.");
    }

    return result.data || { net: [], day: [] };
  }
}
