/**
 * Cryptocurrency Brand & Logo Resolver
 * Supports major tokens, Binance Earn tokens (LD prefix), and multi-tier CDN fallbacks.
 */

export interface CryptoBrandInfo {
  name: string;
  color: string;
  bg: string;
  text: string;
}

export const KNOWN_CRYPTO_BRANDS: Record<string, CryptoBrandInfo> = {
  BTC: { name: "Bitcoin", color: "#F7931A", bg: "#F7931A", text: "#FFFFFF" },
  ETH: { name: "Ethereum", color: "#627EEA", bg: "#627EEA", text: "#FFFFFF" },
  SOL: { name: "Solana", color: "#14F195", bg: "#000000", text: "#FFFFFF" },
  BNB: { name: "BNB", color: "#F3BA2F", bg: "#F3BA2F", text: "#000000" },
  USDT: { name: "Tether USD", color: "#26A17B", bg: "#26A17B", text: "#FFFFFF" },
  USDC: { name: "USD Coin", color: "#2775CA", bg: "#2775CA", text: "#FFFFFF" },
  XRP: { name: "XRP", color: "#23292F", bg: "#23292F", text: "#FFFFFF" },
  ADA: { name: "Cardano", color: "#0033AD", bg: "#0033AD", text: "#FFFFFF" },
  DOGE: { name: "Dogecoin", color: "#C2A633", bg: "#C2A633", text: "#FFFFFF" },
  AVAX: { name: "Avalanche", color: "#E84142", bg: "#E84142", text: "#FFFFFF" },
  LINK: { name: "Chainlink", color: "#375BD2", bg: "#375BD2", text: "#FFFFFF" },
  DOT: { name: "Polkadot", color: "#E6007A", bg: "#E6007A", text: "#FFFFFF" },
  MATIC: { name: "Polygon", color: "#8247E5", bg: "#8247E5", text: "#FFFFFF" },
  POL: { name: "Polygon", color: "#8247E5", bg: "#8247E5", text: "#FFFFFF" },
  NEAR: { name: "NEAR Protocol", color: "#000000", bg: "#111827", text: "#FFFFFF" },
  SUI: { name: "Sui", color: "#2A82E4", bg: "#2A82E4", text: "#FFFFFF" },
  PEPE: { name: "Pepe", color: "#44A047", bg: "#44A047", text: "#FFFFFF" },
  SHIB: { name: "Shiba Inu", color: "#FFA409", bg: "#FFA409", text: "#FFFFFF" },
  LTC: { name: "Litecoin", color: "#345D9D", bg: "#345D9D", text: "#FFFFFF" },
  TRX: { name: "TRON", color: "#EF0027", bg: "#EF0027", text: "#FFFFFF" },
  APT: { name: "Aptos", color: "#000000", bg: "#1F2937", text: "#FFFFFF" },
  RENDER: { name: "Render", color: "#E53935", bg: "#E53935", text: "#FFFFFF" },
  TAO: { name: "Bittensor", color: "#000000", bg: "#18181B", text: "#FFFFFF" },
  BUSD: { name: "Binance USD", color: "#F3BA2F", bg: "#F3BA2F", text: "#000000" },
  DAI: { name: "Dai", color: "#F5AC37", bg: "#F5AC37", text: "#FFFFFF" },
  FDUSD: { name: "First Digital USD", color: "#00A86B", bg: "#00A86B", text: "#FFFFFF" },
  ATOM: { name: "Cosmos", color: "#2E3148", bg: "#2E3148", text: "#FFFFFF" },
  XLM: { name: "Stellar", color: "#14B6EB", bg: "#14B6EB", text: "#FFFFFF" },
  ICP: { name: "Internet Computer", color: "#29ABE2", bg: "#29ABE2", text: "#FFFFFF" },
  BCH: { name: "Bitcoin Cash", color: "#0AC18E", bg: "#0AC18E", text: "#FFFFFF" },
  UNI: { name: "Uniswap", color: "#FF007A", bg: "#FF007A", text: "#FFFFFF" },
  XMR: { name: "Monero", color: "#FF6600", bg: "#FF6600", text: "#FFFFFF" },
  ETC: { name: "Ethereum Classic", color: "#34FA99", bg: "#1E3A2F", text: "#34FA99" },
  FIL: { name: "Filecoin", color: "#0090FF", bg: "#0090FF", text: "#FFFFFF" },
  HBAR: { name: "Hedera", color: "#000000", bg: "#27272A", text: "#FFFFFF" },
  KAS: { name: "Kaspa", color: "#70C7BA", bg: "#70C7BA", text: "#000000" },
  FET: { name: "Artificial Superintelligence", color: "#1E1A34", bg: "#1E1A34", text: "#FFFFFF" },
  ARB: { name: "Arbitrum", color: "#28A0F0", bg: "#28A0F0", text: "#FFFFFF" },
  OP: { name: "Optimism", color: "#FF0420", bg: "#FF0420", text: "#FFFFFF" },
  TON: { name: "Toncoin", color: "#0098EA", bg: "#0098EA", text: "#FFFFFF" },
  INJ: { name: "Injective", color: "#00F2FE", bg: "#0B1528", text: "#00F2FE" },
  TIA: { name: "Celestia", color: "#7B2BF9", bg: "#7B2BF9", text: "#FFFFFF" },
  SEI: { name: "Sei", color: "#9E1F15", bg: "#9E1F15", text: "#FFFFFF" },
  AAVE: { name: "Aave", color: "#B6509E", bg: "#2B2D3C", text: "#FFFFFF" },
  MKR: { name: "Maker", color: "#1AAB9B", bg: "#1AAB9B", text: "#FFFFFF" },
  CRV: { name: "Curve DAO", color: "#4059AD", bg: "#4059AD", text: "#FFFFFF" },
  ALGO: { name: "Algorand", color: "#000000", bg: "#262626", text: "#FFFFFF" },
  VET: { name: "VeChain", color: "#15BDFF", bg: "#15BDFF", text: "#FFFFFF" },
  STX: { name: "Stacks", color: "#5546FF", bg: "#5546FF", text: "#FFFFFF" },
  WLD: { name: "Worldcoin", color: "#000000", bg: "#18181B", text: "#FFFFFF" },
  JUP: { name: "Jupiter", color: "#F3841E", bg: "#1E293B", text: "#F3841E" },
  ONDO: { name: "Ondo Finance", color: "#132742", bg: "#132742", text: "#FFFFFF" },
  WIF: { name: "dogwifhat", color: "#C59B73", bg: "#C59B73", text: "#FFFFFF" },
  BONK: { name: "Bonk", color: "#FFA409", bg: "#FFA409", text: "#FFFFFF" },
  FLOKI: { name: "Floki", color: "#000000", bg: "#1A1A1A", text: "#FFFFFF" },
  PYTH: { name: "Pyth Network", color: "#542382", bg: "#542382", text: "#FFFFFF" },
  PENDLE: { name: "Pendle", color: "#24C4B6", bg: "#0E1C24", text: "#24C4B6" },
  ENA: { name: "Ethena", color: "#000000", bg: "#18181B", text: "#FFFFFF" },
  NOT: { name: "Notcoin", color: "#000000", bg: "#18181B", text: "#FFFFFF" },
  STRK: { name: "Starknet", color: "#101827", bg: "#101827", text: "#FFFFFF" },
  ZK: { name: "ZKsync", color: "#1E1A34", bg: "#1E1A34", text: "#FFFFFF" },
};

/**
 * Normalizes input cryptocurrency ticker symbol.
 * Handles Binance Earn "LD" prefix (e.g. LDBTC -> BTC),
 * wrapped tokens (WBTC -> BTC), and trading pairs (BTCUSDT -> BTC).
 */
export function normalizeCryptoSymbol(raw: string): {
  cleanSymbol: string;
  displaySymbol: string;
  isEarn: boolean;
  isWrapped: boolean;
} {
  if (!raw || !raw.trim()) {
    return {
      cleanSymbol: "CRYPTO",
      displaySymbol: "CRYPTO",
      isEarn: false,
      isWrapped: false,
    };
  }

  const upper = raw.trim().toUpperCase();

  // Binance Simple Earn prefix (e.g. LDBTC, LDUSDT, LDSOL, LDBNB)
  if (upper.startsWith("LD") && upper.length > 3) {
    const underlying = upper.slice(2);
    return {
      cleanSymbol: underlying,
      displaySymbol: upper,
      isEarn: true,
      isWrapped: false,
    };
  }

  // Wrapped tokens (e.g. WBTC, WETH, WBNB, WSOL)
  if (
    upper.startsWith("W") &&
    upper.length >= 4 &&
    ["WBTC", "WETH", "WBNB", "WSOL", "WAVAX", "WFTM", "WMATIC"].includes(upper)
  ) {
    return {
      cleanSymbol: upper.slice(1),
      displaySymbol: upper,
      isEarn: false,
      isWrapped: true,
    };
  }

  // Binance Pegged Bitcoin
  if (upper === "BTCB") {
    return {
      cleanSymbol: "BTC",
      displaySymbol: upper,
      isEarn: false,
      isWrapped: true,
    };
  }

  // If a full market pair was passed, e.g. BTCUSDT, extract the base asset
  for (const quote of ["USDT", "USDC", "BUSD", "FDUSD", "TUSD", "EUR", "TRY", "BTC"]) {
    if (upper.endsWith(quote) && upper.length > quote.length) {
      const base = upper.slice(0, -quote.length);
      return {
        cleanSymbol: base,
        displaySymbol: upper,
        isEarn: false,
        isWrapped: false,
      };
    }
  }

  return {
    cleanSymbol: upper,
    displaySymbol: upper,
    isEarn: false,
    isWrapped: false,
  };
}

/**
 * Generates an array of fallback CDN image URLs for a cryptocurrency symbol.
 */
export function getCryptoLogoSources(cleanSymbol: string): string[] {
  const symLower = cleanSymbol.toLowerCase();
  const symUpper = cleanSymbol.toUpperCase();

  return [
    // 1. CoinCap 2x HD Retina PNG (ultra fast Cloudflare CDN, vast coverage)
    `https://assets.coincap.io/assets/icons/${symLower}@2x.png`,
    // 2. jsdelivr Cryptocurrency Icons (AtomicLabs / spothq 128px high-def PNG)
    `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/${symLower}.png`,
    // 3. jsdelivr Cryptocurrency Icons (SVG)
    `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color/${symLower}.svg`,
    // 4. Trust Wallet Assets (Binance Web3 official token repository)
    `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/binance/assets/${symUpper}/logo.png`,
    // 5. Unavatar Crypto
    `https://unavatar.io/crypto/${symLower}?fallback=false`,
  ];
}

/**
 * Deterministic color picker for unknown / custom altcoins.
 */
export function getCryptoFallbackColor(symbol: string): { bg: string; text: string } {
  if (KNOWN_CRYPTO_BRANDS[symbol]) {
    return {
      bg: KNOWN_CRYPTO_BRANDS[symbol].bg,
      text: KNOWN_CRYPTO_BRANDS[symbol].text,
    };
  }

  // Deterministic palette
  const PALETTE = [
    { bg: "#F59E0B", text: "#FFFFFF" }, // Amber
    { bg: "#10B981", text: "#FFFFFF" }, // Emerald
    { bg: "#3B82F6", text: "#FFFFFF" }, // Blue
    { bg: "#8B5CF6", text: "#FFFFFF" }, // Violet
    { bg: "#EC4899", text: "#FFFFFF" }, // Pink
    { bg: "#06B6D4", text: "#FFFFFF" }, // Cyan
    { bg: "#F97316", text: "#FFFFFF" }, // Orange
    { bg: "#6366F1", text: "#FFFFFF" }, // Indigo
    { bg: "#14B8A6", text: "#FFFFFF" }, // Teal
  ];

  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PALETTE.length;
  return PALETTE[index];
}
