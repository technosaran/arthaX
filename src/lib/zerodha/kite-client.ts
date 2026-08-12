import { createHash } from "crypto";

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
    // Trim on construction so all internal usage is clean
    this.apiKey = (apiKey || "").trim();
    this.apiSecret = (apiSecret || "").trim();
  }

  /**
   * Generates the Zerodha Kite OAuth login URL.
   *
   * The redirect URL is configured in the Kite Developer Console
   * (developers.kite.trade) and does NOT need to be passed here.
   * Zerodha always redirects to the registered redirect URL.
   */
  getLoginUrl(): string {
    return `https://kite.zerodha.com/connect/login?v=3&api_key=${encodeURIComponent(this.apiKey)}`;
  }

  /**
   * Computes SHA-256 checksum: sha256(api_key + request_token + api_secret)
   *
   * All values are trimmed consistently. The same trimmed values MUST be
   * used in the POST body to avoid checksum mismatch errors from Kite API.
   */
  private generateChecksum(requestToken: string): string {
    const data = this.apiKey + requestToken + this.apiSecret;
    return createHash("sha256").update(data).digest("hex");
  }

  /**
   * Exchanges a request_token for a session access_token.
   *
   * CRITICAL: The checksum is sha256(api_key + request_token + api_secret).
   * The api_key and request_token sent in the POST body MUST be the exact
   * same values used in the checksum computation, otherwise Kite returns
   * "Invalid checksum".
   */
  async generateSession(requestToken: string): Promise<ZerodhaSession> {
    // Trim the request token to remove any URL-encoding artifacts or whitespace
    const cleanRequestToken = (requestToken || "").trim();

    if (!cleanRequestToken) {
      throw new Error("Request token is empty. Please try logging in again.");
    }

    if (!this.apiKey || !this.apiSecret) {
      throw new Error("API key or secret is missing. Please check your Zerodha configuration.");
    }

    const checksum = this.generateChecksum(cleanRequestToken);

    // IMPORTANT: Use the exact same trimmed values for the POST body
    // that were used in checksum computation (this.apiKey is already trimmed
    // in constructor, cleanRequestToken is trimmed above)
    const body = new URLSearchParams({
      api_key: this.apiKey,
      request_token: cleanRequestToken,
      checksum: checksum,
    });

    console.log(
      `[Zerodha] Generating session — api_key: ${this.apiKey.substring(0, 4)}****, ` +
      `request_token: ${cleanRequestToken.substring(0, 6)}****, ` +
      `checksum: ${checksum.substring(0, 12)}...`
    );

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
      const errorType = result.error_type || "UnknownError";
      const errorMessage = result.message || "Failed to generate Zerodha session token.";

      console.error(
        `[Zerodha] Session generation failed — ` +
        `HTTP ${response.status}, error_type: ${errorType}, message: ${errorMessage}`
      );

      // Provide user-friendly error messages for known Kite error types
      if (errorType === "InputException" && errorMessage.toLowerCase().includes("checksum")) {
        throw new Error(
          "Checksum validation failed. This usually means the API key/secret is incorrect " +
          "or the request token has expired. Please try syncing again."
        );
      }

      if (errorType === "TokenException") {
        throw new Error(
          "Session token is invalid or expired. Please re-authenticate with Zerodha."
        );
      }

      if (errorType === "NetworkException") {
        throw new Error(
          "Could not reach Zerodha servers. Please check your internet connection and try again."
        );
      }

      if (errorType === "GeneralException" || errorType === "OrderException") {
        throw new Error(`Zerodha error: ${errorMessage}`);
      }

      throw new Error(`Zerodha ${errorType}: ${errorMessage}`);
    }

    console.log(`[Zerodha] Session generated successfully for user: ${result.data.user_id}`);

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
      const errorType = result.error_type || "";
      const errorMessage = result.message || "Failed to fetch Zerodha holdings.";

      if (errorType === "TokenException") {
        throw new Error("KITE_TOKEN_EXPIRED: " + errorMessage);
      }

      throw new Error(errorMessage);
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
      const errorType = result.error_type || "";
      const errorMessage = result.message || "Failed to fetch Zerodha positions.";

      if (errorType === "TokenException") {
        throw new Error("KITE_TOKEN_EXPIRED: " + errorMessage);
      }

      throw new Error(errorMessage);
    }

    return result.data || { net: [], day: [] };
  }
}
