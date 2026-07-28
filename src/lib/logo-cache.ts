/**
 * Logo URL cache & fallback resolution pipeline.
 * Prefers crisp SVG sources (Wikimedia, SimpleIcons) over raster favicons.
 */

const MEMORY_CACHE = new Map<string, string>();
const CACHE_KEY_PREFIX = "logo_cache_v3_";
const BLOCKED_HOSTS = ["cdn.brandfetch.io", "brandfetch.io"];

function normalizeLogoDomain(domain: string): string {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#]/)[0];
}

function isUsableLogoUrl(url: string): boolean {
  if (!url) return false;
  try {
    const { hostname } = new URL(url);
    return !BLOCKED_HOSTS.some(
      (blocked) => hostname === blocked || hostname.endsWith(`.${blocked}`)
    );
  } catch {
    return false;
  }
}

/** Verified high-quality logos for instant display (no broken Brandfetch hotlinks). */
const PREWARMED_LOGOS: Record<string, string> = {
  "google.com": "https://cdn.simpleicons.org/google",
  "microsoft.com": "https://cdn.simpleicons.org/microsoft",
  "apple.com": "https://cdn.simpleicons.org/apple",
  "amazon.com": "https://cdn.simpleicons.org/amazon",
  "meta.com": "https://cdn.simpleicons.org/meta",
  "netflix.com": "https://cdn.simpleicons.org/netflix",
  "openai.com": "https://cdn.simpleicons.org/openai",
  "zoom.us": "https://cdn.simpleicons.org/zoom",
  "salesforce.com": "https://cdn.simpleicons.org/salesforce",
  "accenture.com": "https://cdn.simpleicons.org/accenture",
  "zoho.com": "https://cdn.simpleicons.org/zoho",
  "razorpay.com": "https://cdn.simpleicons.org/razorpay",
  "uber.com": "https://cdn.simpleicons.org/uber",
  "spotify.com": "https://cdn.simpleicons.org/spotify",
  "adobe.com": "https://cdn.simpleicons.org/adobe",
  "nvidia.com": "https://cdn.simpleicons.org/nvidia",
  "tesla.com": "https://cdn.simpleicons.org/tesla",
  "intel.com": "https://cdn.simpleicons.org/intel",
  "amd.com": "https://cdn.simpleicons.org/amd",
  "fiverr.com": "https://cdn.simpleicons.org/fiverr",
  "upwork.com": "https://cdn.simpleicons.org/upwork",
  "stripe.com": "https://cdn.simpleicons.org/stripe",
  "github.com": "https://cdn.simpleicons.org/github",
  "gitlab.com": "https://cdn.simpleicons.org/gitlab",
  "slack.com": "https://cdn.simpleicons.org/slack",
  "youtube.com": "https://cdn.simpleicons.org/youtube",
  "sbi.co.in": "https://upload.wikimedia.org/wikipedia/commons/c/cc/SBI-Logo.svg",
  "hdfcbank.com": "https://upload.wikimedia.org/wikipedia/commons/2/28/HDFC_Bank_Logo.svg",
  "icicibank.com": "https://upload.wikimedia.org/wikipedia/commons/1/12/ICICI_Bank_Logo.svg",
  "axisbank.com": "https://upload.wikimedia.org/wikipedia/commons/1/1a/Axis_Bank_logo.svg",
  "kotak.com": "https://upload.wikimedia.org/wikipedia/commons/6/6b/Kotak_Mahindra_Bank_logo.svg",
  "pnbindia.in": "https://upload.wikimedia.org/wikipedia/commons/4/4b/Punjab_National_Bank_Logo.svg",
  "paytm.com": "https://upload.wikimedia.org/wikipedia/commons/2/24/Paytm_Logo.svg",
  "phonepe.com": "https://upload.wikimedia.org/wikipedia/commons/7/71/PhonePe_Logo.svg",
  "zerodha.com": "https://upload.wikimedia.org/wikipedia/commons/3/30/Zerodha_logo.svg",
  "groww.in": "https://upload.wikimedia.org/wikipedia/commons/b/b8/Groww_Logo.svg",
};

Object.entries(PREWARMED_LOGOS).forEach(([domain, url]) => {
  MEMORY_CACHE.set(domain, url);
});

/**
 * Get previously verified logo URL for a domain.
 */
export function getResolvedLogoUrl(domain: string): string | null {
  if (!domain) return null;
  const clean = normalizeLogoDomain(domain);

  if (MEMORY_CACHE.has(clean)) {
    const cached = MEMORY_CACHE.get(clean)!;
    if (isUsableLogoUrl(cached)) return cached;
    MEMORY_CACHE.delete(clean);
  }

  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const stored = localStorage.getItem(`${CACHE_KEY_PREFIX}${clean}`);
      if (stored && isUsableLogoUrl(stored)) {
        MEMORY_CACHE.set(clean, stored);
        return stored;
      }
      if (stored) {
        localStorage.removeItem(`${CACHE_KEY_PREFIX}${clean}`);
      }
    } catch {
      // Ignore localStorage errors
    }
  }

  return null;
}

/**
 * Cache a verified working logo URL for a domain.
 */
export function saveResolvedLogoUrl(domain: string, url: string): void {
  if (!domain || !url || !isUsableLogoUrl(url)) return;
  const clean = normalizeLogoDomain(domain);
  MEMORY_CACHE.set(clean, url);

  if (typeof window !== "undefined" && window.localStorage) {
    try {
      localStorage.setItem(`${CACHE_KEY_PREFIX}${clean}`, url);
    } catch {
      // Ignore localStorage errors
    }
  }
}

/**
 * Official 256px domain favicon from Google.
 */
export function getSingleBestLogoUrl(domain: string): string {
  if (!domain) return "";
  const cleanDomain = normalizeLogoDomain(domain);
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(cleanDomain)}&sz=256`;
}

/**
 * Generic fallback logo candidates for unknown domains.
 * Curated HD lists in banks/companies/amcs take priority; cached URLs come last.
 */
export function getFastLogoCandidateUrls(domain: string): string[] {
  if (!domain) return [];
  const cleanDomain = normalizeLogoDomain(domain);
  const cached = getResolvedLogoUrl(cleanDomain);

  return Array.from(
    new Set(
      [
        getSingleBestLogoUrl(cleanDomain),
        `https://unavatar.io/${cleanDomain}`,
        `https://icon.horse/icon/${cleanDomain}`,
        `https://icons.duckduckgo.com/ip3/${cleanDomain}.ico`,
        cached,
      ].filter((url): url is string => Boolean(url))
    )
  );
}
