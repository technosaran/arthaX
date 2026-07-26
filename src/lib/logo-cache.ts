/**
 * Global Ultra-Fast Logo Cache & Multi-Engine HD Resolution Pipeline
 * Pre-warms top brand logo URLs in memory for sub-millisecond 0ms instant display
 */

const MEMORY_CACHE = new Map<string, string>();

// Pre-warm top bank & company domains into memory cache on module load for 0ms instant display
const PREWARMED_LOGOS: Record<string, string> = {
  "sbi.co.in": "https://upload.wikimedia.org/wikipedia/commons/c/cc/SBI-Logo.svg",
  "hdfcbank.com": "https://upload.wikimedia.org/wikipedia/commons/2/28/HDFC_Bank_Logo.svg",
  "icicibank.com": "https://upload.wikimedia.org/wikipedia/commons/1/12/ICICI_Bank_Logo.svg",
  "axisbank.com": "https://upload.wikimedia.org/wikipedia/commons/1/1a/Axis_Bank_logo.svg",
  "kotak.com": "https://upload.wikimedia.org/wikipedia/commons/6/6b/Kotak_Mahindra_Bank_logo.svg",
  "pnbindia.in": "https://upload.wikimedia.org/wikipedia/commons/4/4b/Punjab_National_Bank_Logo.svg",
  "bankofbaroda.in": "https://upload.wikimedia.org/wikipedia/commons/7/7b/Bank_of_Baroda_logo.svg",
  "canarabank.com": "https://upload.wikimedia.org/wikipedia/commons/2/2a/Canara_Bank_Logo.svg",
  "unionbankofindia.co.in": "https://upload.wikimedia.org/wikipedia/commons/0/05/Union_Bank_of_India_Logo.svg",
  "idfcfirstbank.com": "https://upload.wikimedia.org/wikipedia/commons/2/29/IDFC_First_Bank_logo.svg",
  "indusind.com": "https://upload.wikimedia.org/wikipedia/commons/8/82/IndusInd_Bank_logo.svg",
  "yesbank.in": "https://upload.wikimedia.org/wikipedia/commons/4/49/Yes_Bank_Logo.svg",
  "federalbank.co.in": "https://upload.wikimedia.org/wikipedia/commons/2/27/Federal_Bank_Logo.svg",
  "paytm.com": "https://upload.wikimedia.org/wikipedia/commons/2/24/Paytm_Logo.svg",
  "phonepe.com": "https://upload.wikimedia.org/wikipedia/commons/7/71/PhonePe_Logo.svg",
  "cred.club": "https://upload.wikimedia.org/wikipedia/commons/8/87/CRED_logo.svg",
  "zerodha.com": "https://upload.wikimedia.org/wikipedia/commons/3/30/Zerodha_logo.svg",
  "groww.in": "https://upload.wikimedia.org/wikipedia/commons/b/b8/Groww_Logo.svg",
  "hsbc.co.in": "https://upload.wikimedia.org/wikipedia/commons/a/aa/HSBC_logo_%282018%29.svg",
  "sc.com": "https://upload.wikimedia.org/wikipedia/commons/a/a0/Standard_Chartered_logo.svg",
  "citibank.co.in": "https://upload.wikimedia.org/wikipedia/commons/1/1b/Citibank.svg",
  "dbs.com": "https://upload.wikimedia.org/wikipedia/commons/a/a4/DBS_Bank_logo.svg",
  "chase.com": "https://upload.wikimedia.org/wikipedia/commons/a/a4/Chase_logo.svg",
  "bankofamerica.com": "https://upload.wikimedia.org/wikipedia/commons/2/20/Bank_of_America_logo.svg",
  "google.com": "https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg",
  "microsoft.com": "https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg",
  "apple.com": "https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg",
  "amazon.com": "https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg",
  "meta.com": "https://upload.wikimedia.org/wikipedia/commons/7/7b/Meta_Platforms_Inc._logo.svg",
  "netflix.com": "https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg",
  "openai.com": "https://upload.wikimedia.org/wikipedia/commons/0/04/ChatGPT_logo.svg",
  "swiggy.in": "https://upload.wikimedia.org/wikipedia/commons/1/12/Swiggy_logo.svg",
  "zomato.com": "https://upload.wikimedia.org/wikipedia/commons/b/b3/Zomato_logo.svg",
  "zoom.us": "https://upload.wikimedia.org/wikipedia/commons/7/7b/Zoom_Communications_Logo.svg",
  "salesforce.com": "https://upload.wikimedia.org/wikipedia/commons/f/f9/Salesforce.com_logo.svg",
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

  // 2. LocalStorage Persistence (v2 cache key)
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const stored = localStorage.getItem(`logo_cache_v2_${clean}`);
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
      localStorage.setItem(`logo_cache_v2_${clean}`, url);
    } catch {
      // Ignore localStorage errors
    }
  }
}

/**
 * Get prioritized 8-engine ultra-high-resolution vector logo CDN URLs for a domain
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

  // 2. High-Resolution Vector Brand Logo Pipeline (SimpleIcons, Brandfetch 512px & Google 256px)
  candidates.push(
    // Engine 1: SimpleIcons Ultra-Crisp Vector SVG Engine
    `https://cdn.simpleicons.org/${slug}`,
    // Engine 2: Brandfetch 512px Modern Crisp Brand Asset CDN
    `https://cdn.brandfetch.io/${cleanDomain}/w/512/h/512/theme/dark/icon`,
    // Engine 3: Google 256px High-Res Live Favicon Engine
    `https://www.google.com/s2/favicons?domain=${cleanDomain}&sz=256`,
    // Engine 4: Unavatar 512px Aggregator Engine
    `https://unavatar.io/${cleanDomain}?ttl=28d&fallback=false`,
    // Engine 5: Icon Horse 512px High-Res Engine
    `https://icon.horse/icon/${cleanDomain}?size=512`,
    // Engine 6: DuckDuckGo Vector Icon Engine
    `https://icons.duckduckgo.com/ip3/${cleanDomain}.ico`,
    // Engine 7: Statvoo HD Favicon Engine
    `https://api.statvoo.com/favicon/?url=${cleanDomain}`,
    // Engine 8: Clearbit 512px Engine
    `https://logo.clearbit.com/${cleanDomain}?size=512`
  );

  return Array.from(new Set(candidates));
}

