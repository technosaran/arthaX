/**
 * Global Ultra-Fast Logo Cache & Multi-Engine HD Resolution Pipeline
 * Pre-warms top brand logo URLs in memory for sub-millisecond 0ms instant display
 */

const MEMORY_CACHE = new Map<string, string>();

// Pre-warm top bank & company domains into memory cache on module load for 0ms instant display
const PREWARMED_LOGOS: Record<string, string> = {
  "sbi.co.in": "https://upload.wikimedia.org/wikipedia/commons/c/cc/State_Bank_of_India_logo.svg",
  "indianbank.in": "https://upload.wikimedia.org/wikipedia/commons/e/ea/Indian_Bank_logo.svg",
  "bankofindia.co.in": "https://upload.wikimedia.org/wikipedia/commons/6/69/Bank_of_India_logo.svg",
  "rblbank.com": "https://upload.wikimedia.org/wikipedia/commons/a/a2/RBL_Bank_logo.svg",
  "centralbankofindia.co.in": "https://upload.wikimedia.org/wikipedia/en/e/e6/Central_Bank_of_India_logo.svg",
  "iob.in": "https://upload.wikimedia.org/wikipedia/commons/b/ba/Indian_Overseas_Bank_logo.svg",
  "ucobank.com": "https://upload.wikimedia.org/wikipedia/commons/a/aa/UCO_Bank_Logo.svg",
  "bankofmaharashtra.in": "https://upload.wikimedia.org/wikipedia/commons/4/40/Bank_of_Maharashtra_logo.svg",
  "punjabandsindbank.co.in": "https://upload.wikimedia.org/wikipedia/commons/9/9b/Punjab_%26_Sind_Bank_logo.svg",
  "southindianbank.com": "https://upload.wikimedia.org/wikipedia/commons/7/7d/South_Indian_Bank_Logo.svg",
  "karnatakabank.com": "https://upload.wikimedia.org/wikipedia/commons/b/b5/Karnataka_Bank_Logo.svg",
  "kvb.co.in": "https://upload.wikimedia.org/wikipedia/commons/9/90/Karur_Vysya_Bank_logo.svg",
  "bandhanbank.com": "https://upload.wikimedia.org/wikipedia/commons/c/c8/Bandhan_Bank_logo.svg",
  "idbibank.in": "https://upload.wikimedia.org/wikipedia/commons/b/b5/IDBI_Bank_logo.svg",
  "cityunionbank.com": "https://upload.wikimedia.org/wikipedia/commons/1/14/City_Union_Bank_logo.svg",
  "dcbbank.com": "https://upload.wikimedia.org/wikipedia/commons/a/a6/DCB_Bank_logo.svg",
  "aubank.in": "https://upload.wikimedia.org/wikipedia/commons/4/46/AU_Small_Finance_Bank_logo.svg",
  "equitasbank.com": "https://upload.wikimedia.org/wikipedia/commons/8/87/Equitas_Small_Finance_Bank_logo.svg",
  "ujjivansfb.in": "https://upload.wikimedia.org/wikipedia/commons/0/06/Ujjivan_Small_Finance_Bank_logo.svg",
  "hsbc.co.in": "https://upload.wikimedia.org/wikipedia/commons/a/aa/HSBC_logo_%282018%29.svg",
  "sc.com": "https://upload.wikimedia.org/wikipedia/commons/a/a0/Standard_Chartered_logo.svg",
  "citibank.co.in": "https://upload.wikimedia.org/wikipedia/commons/1/1b/Citibank.svg",
  "dbs.com": "https://upload.wikimedia.org/wikipedia/commons/a/a4/DBS_Bank_logo.svg",
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
    // Engine 1: Clearbit 512px High-Def Vector Engine
    `https://logo.clearbit.com/${cleanDomain}?size=512`,
    // Engine 2: Brandfetch 512px Modern Crisp Brand Asset CDN
    `https://cdn.brandfetch.io/${cleanDomain}/w/512/h/512/theme/dark/icon`,
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

