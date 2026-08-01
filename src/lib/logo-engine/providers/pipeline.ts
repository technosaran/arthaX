/**
 * arthaX Logo Provider Pipeline
 * Uses logo.dev as the single logo source.
 */

import { LogoAsset, LogoFormat, ProviderResult } from "../types";
import { LogoProvider } from "./provider-interface";

export class LogoDevProvider implements LogoProvider {
  name = "logodev";
  priority = 1;

  async fetchLogo(domain: string): Promise<ProviderResult> {
    const apiKey = process.env.LOGODEV_API_KEY || "pk_eUkLSBOcQ7-s3ZgpjJOLvQ";
    return {
      provider: this.name,
      domain,
      assets: [
        { url: `https://img.logo.dev/${domain}?token=${apiKey}&format=png&size=256`, format: "png", provider: this.name },
      ],
      success: true,
    };
  }
}

export class ProviderPipeline {
  private providers: LogoProvider[];

  constructor() {
    this.providers = [
      new LogoDevProvider(),
    ];
  }

  /**
   * Execute provider pipeline — logo.dev only.
   * Format priority: SVG > PNG > WebP > Favicon
   */
  async resolveLogoFromProviders(domain: string): Promise<{ bestAsset: LogoAsset; provider: string; assets: LogoAsset[] } | null> {
    if (!domain) return null;

    const allAssets: LogoAsset[] = [];

    for (const provider of this.providers) {
      try {
        const result = await provider.fetchLogo(domain);
        if (result.success && result.assets.length > 0) {
          allAssets.push(...result.assets);
        }
      } catch (_e) {
        // Continue to next provider in fallback pipeline
      }
    }

    if (allAssets.length === 0) return null;

    // Format selection priority: SVG > PNG > WebP > Favicon
    const formatOrder: LogoFormat[] = ["svg", "png", "webp", "favicon"];
    let bestAsset: LogoAsset | undefined = undefined;

    for (const fmt of formatOrder) {
      bestAsset = allAssets.find((a) => a.format === fmt);
      if (bestAsset) break;
    }

    if (!bestAsset) bestAsset = allAssets[0];

    return {
      bestAsset,
      provider: bestAsset.provider,
      assets: allAssets,
    };
  }
}

