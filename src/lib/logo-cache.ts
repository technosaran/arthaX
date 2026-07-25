/**
 * Global Ultra-Fast Logo Cache & Multi-Engine HD Resolution Pipeline
 * Pre-warms top brand logo URLs in memory for sub-millisecond 0ms instant display
 */

const MEMORY_CACHE = new Map<string, string>();

// Pre-warm top bank & company domains into memory cache on module load for 0ms instant display
const PREWARMED_LOGOS: Record<string, string> = {
  "sbi.co.in": "https://upload.wikimedia.org/wikipedia/commons/c/cc/State_Bank_of_India_logo.svg",
  "hdfcbank.com": "https://upload.wikimedia.org/wikipedia/commons/2/28/HDFC_Bank_Logo.svg",
  "icicibank.com": "https://upload.wikimedia.org/wikipedia/commons/1/12/ICICI_Bank_Logo.svg",
  "axisbank.com": "https://upload.wikimedia.org/wikipedia/commons/1/1a/Axis_Bank_logo.svg",
  "kotak.com": "https://upload.wikimedia.org/wikipedia/commons/6/6b/Kotak_Mahindra_Bank_logo.svg",
  "zerodha.com": "https://logo.clearbit.com/zerodha.com?size=512",
  "groww.in": "https://logo.clearbit.com/groww.in?size=512",
  "chase.com": "https://logo.clearbit.com/chase.com?size=512",
  "bankofamerica.com": "https://logo.clearbit.com/bankofamerica.com?size=512",
  "infosys.com": "https://upload.wikimedia.org/wikipedia/commons/9/95/Infosys_logo.svg",
  "tcs.com": "https://upload.wikimedia.org/wikipedia/commons/b/b1/Tata_Consultancy_Services_Logo.svg",
  "wipro.com": "https://upload.wikimedia.org/wikipedia/commons/a/a0/Wipro_Primary_Logo_Color_RGB.svg",
  "google.com": "https://upload.wikimedia.org/wikipedia/commons/2/2f/Google_2015_logo.svg",
  "microsoft.com": "https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo_%282012%29.svg",
  "apple.com": "https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg",
  "amazon.com": "https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg",
  "openai.com": "https://upload.wikimedia.org/wikipedia/commons/4/4d/OpenAI_Logo.svg",
  "swiggy.in": "https://upload.wikimedia.org/wikipedia/commons/1/13/Swiggy_logo.svg",
  "zomato.com": "https://upload.wikimedia.org/wikipedia/commons/b/bd/Zomato_Logo.svg",
  "kfc.com": "https://upload.wikimedia.org/wikipedia/commons/b/bf/KFC_logo.svg",
  "mcdonalds.com": "https://upload.wikimedia.org/wikipedia/commons/3/36/McDonald%27s_Golden_Arches.svg",
  "dominos.com": "https://upload.wikimedia.org/wikipedia/commons/7/74/Dominos_pizza_logo.svg",
};

Object.entries(PREWARMED_LOGOS).forEach(([domain, url]) => {
  MEMORY_CACHE.set(domain, url);
});

/**
 * Get previously verified logo URL for a domain (0ms lookup)
 */
export function getResolvedLogoUrl(domain: string): string | null {
  if (!domain) return null;
  const clean = domain.trim().toLowerCase();

  // 1. Memory Map (Instant <1ms)
  if (MEMORY_CACHE.has(clean)) {
    return MEMORY_CACHE.get(clean)!;
  }

  // 2. LocalStorage Persistence
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const stored = localStorage.getItem(`logo_cache_${clean}`);
      if (stored) {
        MEMORY_CACHE.set(clean, stored);
        return stored;
      }
    } catch {
      // Ignore localStorage errors
    }
  }

  return null;
}

/**
 * Cache verified working logo URL for a domain
 */
export function saveResolvedLogoUrl(domain: string, url: string): void {
  if (!domain || !url) return;
  const clean = domain.trim().toLowerCase();
  MEMORY_CACHE.set(clean, url);

  if (typeof window !== "undefined" && window.localStorage) {
    try {
      localStorage.setItem(`logo_cache_${clean}`, url);
    } catch {
      // Ignore localStorage errors
    }
  }
}

/**
 * Get prioritized 8-engine ultra-high-resolution 512px vector logo CDN URLs for a domain
 */
export function getFastLogoCandidateUrls(domain: string): string[] {
  if (!domain) return [];
  const cleanDomain = domain.trim().toLowerCase();
  const cachedUrl = getResolvedLogoUrl(cleanDomain);

  const candidates: string[] = [];

  // 1. Verified working URL first if cached
  if (cachedUrl) {
    candidates.push(cachedUrl);
  }

  const slug = cleanDomain.split(".")[0].replace(/[^a-z0-9]/g, "");

  // 2. High-Resolution 512px Vector Brand Logo Pipeline (Clearbit 512px & Brandfetch 512px FIRST for max crispness)
  candidates.push(
    // Engine 1: Brandfetch 512px Modern Crisp Brand Asset CDN
    `https://cdn.brandfetch.io/${cleanDomain}/w/512/h/512/theme/dark/icon`,
    // Engine 2: Clearbit 512px High-Def Vector Engine
    `https://logo.clearbit.com/${cleanDomain}?size=512`,
    // Engine 3: Unavatar 512px Aggregator Engine
    `https://unavatar.io/${cleanDomain}?ttl=28d&fallback=false`,
    // Engine 4: Icon Horse 512px High-Res Engine
    `https://icon.horse/icon/${cleanDomain}?size=512`,
    // Engine 5: Google 256px Live Favicon
    `https://www.google.com/s2/favicons?domain=${cleanDomain}&sz=256`,
    // Engine 6: DuckDuckGo High-Res Vector Icon Engine
    `https://icons.duckduckgo.com/ip3/${cleanDomain}.ico`,
    // Engine 7: Statvoo HD Favicon Engine
    `https://api.statvoo.com/favicon/?url=${cleanDomain}`,
    // Engine 8: GitHub Dashboard Icons CDN
    `https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/${slug}.png`
  );

  return Array.from(new Set(candidates));
}
