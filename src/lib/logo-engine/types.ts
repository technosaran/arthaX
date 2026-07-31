/**
 * arthaX Production Logo Management System - Types & Interfaces
 */

export type EntityCategory =
  | "bank"
  | "company"
  | "merchant"
  | "income"
  | "payment_app"
  | "investment"
  | "mutual_fund"
  | "brokerage"
  | "insurance"
  | "crypto"
  | "upi"
  | "wallet"
  | "credit_card"
  | "government"
  | "general";

export type LogoFormat = "svg" | "png" | "webp" | "favicon" | "placeholder";

export interface LogoAsset {
  url: string;
  format: LogoFormat;
  width?: number;
  height?: number;
  mimeType?: string;
  provider: string;
}

export interface LogoRecord {
  id?: string;
  merchant_name: string;
  normalized_name: string;
  domain: string;
  category: EntityCategory;
  svg_url?: string | null;
  png_url?: string | null;
  webp_url?: string | null;
  favicon_url?: string | null;
  best_logo_url: string;
  provider: string;
  preferred_format: LogoFormat;
  etag?: string | null;
  width?: number | null;
  height?: number | null;
  last_verified?: string | null;
  updated_at?: string;
  created_at?: string;
}

export interface NormalizationResult {
  rawQuery: string;
  normalizedName: string;
  domain: string;
  category: EntityCategory;
  aliasMatched: boolean;
}

export interface ProviderResult {
  provider: string;
  domain: string;
  assets: LogoAsset[];
  bestAsset?: LogoAsset;
  success: boolean;
  error?: string;
}

export interface LogoResolverOptions {
  forceRefresh?: boolean;
  minFormat?: LogoFormat;
  category?: EntityCategory;
}
