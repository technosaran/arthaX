/**
 * arthaX Logo Resolver Engine
 * Coordinates Memory Cache -> Redis -> Database -> Provider Pipeline -> Negative Cache.
 */

import { LogoRecord, LogoResolverOptions } from "./types";
import { normalizeMerchant } from "./normalization";
import { ProviderPipeline } from "./providers/pipeline";
import { CacheService } from "@/lib/cache-service";
import { createClient as createServerClient } from "@/lib/supabase-server";

const NOT_FOUND_FLAG = "NOT_FOUND";
const memoryCache = new Map<string, LogoRecord | typeof NOT_FOUND_FLAG>();
const cacheService = new CacheService();
const providerPipeline = new ProviderPipeline();

export class LogoResolver {
  /**
   * Main entry point to resolve a merchant/bank/company query into an optimized LogoRecord.
   */
  public async resolve(query: string, options: LogoResolverOptions = {}): Promise<LogoRecord | null> {
    if (!query) return null;

    const norm = normalizeMerchant(query);
    const domain = norm.domain;
    const cacheKey = `logo:v2:${norm.normalizedName}:${domain}`;

    // 1. In-Memory Cache Check
    if (!options.forceRefresh && memoryCache.has(cacheKey)) {
      const memVal = memoryCache.get(cacheKey);
      if (memVal === NOT_FOUND_FLAG) return null;
      if (memVal) return memVal as LogoRecord;
    }

    // 2. Redis Cache Check
    if (!options.forceRefresh) {
      try {
        const cached = await cacheService.get<LogoRecord | typeof NOT_FOUND_FLAG>(cacheKey);
        if (cached === NOT_FOUND_FLAG) {
          memoryCache.set(cacheKey, NOT_FOUND_FLAG);
          return null;
        }
        if (cached) {
          memoryCache.set(cacheKey, cached as LogoRecord);
          return cached as LogoRecord;
        }
    } catch {
        // Continue if Redis fails
      }
    }

    // 3. Database Check (Supabase public.merchant_logos)
    if (!options.forceRefresh && domain) {
      try {
        const supabase = await createServerClient();
        const { data: dbRecord } = await (supabase
          .from("merchant_logos" as any)
          .select("*")
          .eq("domain", domain)
          .single() as any);

        if (dbRecord) {
          const rec: LogoRecord = {
            id: dbRecord.id,
            merchant_name: dbRecord.merchant_name || norm.rawQuery,
            normalized_name: dbRecord.normalized_name || norm.normalizedName,
            domain: dbRecord.domain,
            category: (dbRecord.category as any) || norm.category,
            svg_url: dbRecord.svg_url,
            png_url: dbRecord.png_url,
            webp_url: dbRecord.webp_url,
            favicon_url: dbRecord.favicon_url,
            best_logo_url: dbRecord.best_logo_url || dbRecord.svg_url || dbRecord.png_url || dbRecord.favicon_url,
            provider: dbRecord.provider || "database",
            preferred_format: (dbRecord.preferred_format as any) || "svg",
            etag: dbRecord.etag,
            last_verified: dbRecord.last_verified,
          };

          memoryCache.set(cacheKey, rec);
          await cacheService.set(cacheKey, rec, 86400 * 7); // Cache for 7 days in Redis
          return rec;
        }
    } catch {
        // Continue if DB check fails
      }
    }

    // 4. Provider Pipeline Execution
    if (domain) {
      const pipelineRes = await providerPipeline.resolveLogoFromProviders(domain);

      if (pipelineRes && pipelineRes.bestAsset) {
        const best = pipelineRes.bestAsset;
        const svgUrl = pipelineRes.assets.find((a) => a.format === "svg")?.url || (best.format === "svg" ? best.url : null);
        const pngUrl = pipelineRes.assets.find((a) => a.format === "png")?.url || (best.format === "png" ? best.url : null);
        const webpUrl = pipelineRes.assets.find((a) => a.format === "webp")?.url || (best.format === "webp" ? best.url : null);
        const faviconUrl = pipelineRes.assets.find((a) => a.format === "favicon")?.url || (best.format === "favicon" ? best.url : null);

        const record: LogoRecord = {
          merchant_name: query,
          normalized_name: norm.normalizedName,
          domain,
          category: options.category || norm.category,
          svg_url: svgUrl,
          png_url: pngUrl,
          webp_url: webpUrl,
          favicon_url: faviconUrl,
          best_logo_url: best.url,
          provider: pipelineRes.provider,
          preferred_format: best.format,
          etag: `W/"logo-${domain}-${Date.now()}"`,
          last_verified: new Date().toISOString(),
        };

        // Cache in Memory & Redis
        memoryCache.set(cacheKey, record);
        await cacheService.set(cacheKey, record, 86400 * 7);

        // Async insert to Supabase DB using WHERE NOT EXISTS guideline
        this.saveRecordToDatabase(record).catch(() => {});

        return record;
      }
    }

    // 5. Negative Cache Flag (prevent repeated failed provider calls)
    memoryCache.set(cacheKey, NOT_FOUND_FLAG);
    await cacheService.set(cacheKey, NOT_FOUND_FLAG, 86400 * 3); // Negative cache for 3 days

    return null;
  }

  /**
   * Persists resolved logo record to database with duplicate prevention.
   */
  private async saveRecordToDatabase(record: LogoRecord): Promise<void> {
    try {
      const supabase = await createServerClient();
      await (supabase.rpc as any)("upsert_merchant_logo", {
        p_merchant_name: record.merchant_name,
        p_normalized_name: record.normalized_name,
        p_domain: record.domain,
        p_category: record.category,
        p_svg_url: record.svg_url,
        p_png_url: record.png_url,
        p_webp_url: record.webp_url,
        p_favicon_url: record.favicon_url,
        p_best_logo_url: record.best_logo_url,
        p_provider: record.provider,
        p_preferred_format: record.preferred_format,
        p_etag: record.etag,
      });
    } catch {
      // Ignore database write failures during background save
    }
  }
}

export const logoResolver = new LogoResolver();
