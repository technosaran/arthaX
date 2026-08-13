export function isAccountAggregatorEnabled(): boolean {
  const envFlag = process.env.NEXT_PUBLIC_ENABLE_ACCOUNT_AGGREGATOR;
  if (envFlag !== undefined) {
    return envFlag === "true" || envFlag === "1";
  }
  return true;
}

export interface AAProviderConfig {
  clientId?: string;
  clientSecret?: string;
  productInstanceId?: string;
  environment: "sandbox" | "production";
}

export function getAAConfig(): AAProviderConfig {
  return {
    clientId: process.env.SETU_AA_CLIENT_ID || process.env.FINVU_AA_CLIENT_ID || "",
    clientSecret: process.env.SETU_AA_CLIENT_SECRET || process.env.FINVU_AA_CLIENT_SECRET || "",
    productInstanceId: process.env.SETU_AA_PRODUCT_INSTANCE_ID || "",
    environment: (process.env.AA_ENVIRONMENT as "sandbox" | "production") || "sandbox",
  };
}

export const SUPPORTED_BANKS_AA = [
  { id: "hdfc", name: "HDFC Bank", category: "savings", logo: "hdfc", fipId: "HDFC-FIP" },
  { id: "icici", name: "ICICI Bank", category: "checking", logo: "icici", fipId: "ICICI-FIP" },
  { id: "sbi", name: "State Bank of India", category: "savings", logo: "sbi", fipId: "SBI-FIP" },
  { id: "axis", name: "Axis Bank", category: "checking", logo: "axis", fipId: "AXIS-FIP" },
  { id: "kotak", name: "Kotak Mahindra Bank", category: "savings", logo: "kotak", fipId: "KOTAK-FIP" },
  { id: "idfc", name: "IDFC FIRST Bank", category: "savings", logo: "idfc", fipId: "IDFC-FIP" },
  { id: "bob", name: "Bank of Baroda", category: "savings", logo: "bob", fipId: "BOB-FIP" },
  { id: "pnb", name: "Punjab National Bank", category: "savings", logo: "pnb", fipId: "PNB-FIP" },
];
