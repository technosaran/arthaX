/**
 * arthaX Logo Provider Pipeline
 * Executes providers in strict priority order with format optimization (SVG > PNG > WebP > Favicon).
 */

import { LogoAsset, LogoFormat, ProviderResult } from "../types";
import { LogoProvider } from "./provider-interface";

export class BrandfetchProvider implements LogoProvider {
  name = "brandfetch";
  priority = 4;

  async fetchLogo(domain: string): Promise<ProviderResult> {
    const apiKey = process.env.BRANDFETCH_API_KEY;
    if (apiKey) {
      try {
        const res = await fetch(`https://api.brandfetch.io/v2/brands/${domain}`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (res.ok) {
          const data = await res.json();
          const logos = data.logos || [];
          const assets: LogoAsset[] = [];
          for (const l of logos) {
            for (const format of l.formats || []) {
              let logoFmt: LogoFormat = "png";
              if (format.format === "svg") logoFmt = "svg";
              else if (format.format === "webp") logoFmt = "webp";
              assets.push({
                url: format.src,
                format: logoFmt,
                width: format.width,
                height: format.height,
                provider: this.name,
              });
            }
          }
          if (assets.length > 0) {
            return { provider: this.name, domain, assets, success: true };
          }
        }
      } catch (_e) {
        // Fall through to public asset endpoint
      }
    }

    // Public endpoint fallback for Brandfetch
    return {
      provider: this.name,
      domain,
      assets: [
        { url: `https://asset.brandfetch.io/${domain}/logo`, format: "png", provider: this.name },
      ],
      success: true,
    };
  }
}

export class LogoDevProvider implements LogoProvider {
  name = "logodev";
  priority = 5;

  async fetchLogo(domain: string): Promise<ProviderResult> {
    const apiKey = process.env.LOGODEV_API_KEY;
    const tokenParam = apiKey ? `?token=${apiKey}` : "";
    return {
      provider: this.name,
      domain,
      assets: [
        { url: `https://img.logo.dev/${domain}${tokenParam}`, format: "png", provider: this.name },
      ],
      success: true,
    };
  }
}

export class IconHorseProvider implements LogoProvider {
  name = "iconhorse";
  priority = 6;

  async fetchLogo(domain: string): Promise<ProviderResult> {
    return {
      provider: this.name,
      domain,
      assets: [
        { url: `https://api.iconhorse.com/v1/${domain}`, format: "png", provider: this.name },
      ],
      success: true,
    };
  }
}

export class DuckDuckGoProvider implements LogoProvider {
  name = "duckduckgo";
  priority = 7;

  async fetchLogo(domain: string): Promise<ProviderResult> {
    return {
      provider: this.name,
      domain,
      assets: [
        { url: `https://icons.duckduckgo.com/ip3/${domain}.ico`, format: "favicon", provider: this.name },
      ],
      success: true,
    };
  }
}

export class FaviconKitProvider implements LogoProvider {
  name = "faviconkit";
  priority = 8;

  async fetchLogo(domain: string): Promise<ProviderResult> {
    return {
      provider: this.name,
      domain,
      assets: [
        { url: `https://api.faviconkit.com/${domain}/128`, format: "favicon", provider: this.name },
      ],
      success: true,
    };
  }
}

export class GoogleFaviconProvider implements LogoProvider {
  name = "google";
  priority = 9;

  async fetchLogo(domain: string): Promise<ProviderResult> {
    return {
      provider: this.name,
      domain,
      assets: [
        { url: `https://www.google.com/s2/favicons?domain=${domain}&sz=128`, format: "favicon", provider: this.name },
      ],
      success: true,
    };
  }
}

export class ProviderPipeline {
  private providers: LogoProvider[];

  constructor() {
    this.providers = [
      new BrandfetchProvider(),
      new LogoDevProvider(),
      new IconHorseProvider(),
      new DuckDuckGoProvider(),
      new FaviconKitProvider(),
      new GoogleFaviconProvider(),
    ].sort((a, b) => a.priority - b.priority);
  }

  /**
   * Execute provider pipeline until valid logo assets are generated.
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

          // Check if SVG format is available (highest priority)
          const svgAsset = result.assets.find((a) => a.format === "svg");
          if (svgAsset) {
            return { bestAsset: svgAsset, provider: provider.name, assets: allAssets };
          }
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
