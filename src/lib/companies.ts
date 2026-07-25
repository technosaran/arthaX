/**
 * Company Registry mapping names to official web domains
 * Used for fetching real company/employer logos for the Income section
 */
export type Company = { name: string; domain: string };

const COMPANIES: Company[] = [
  // Major Tech & Global Employers
  { name: "Google", domain: "google.com" },
  { name: "Alphabet", domain: "google.com" },
  { name: "Microsoft", domain: "microsoft.com" },
  { name: "Apple", domain: "apple.com" },
  { name: "Amazon", domain: "amazon.com" },
  { name: "Meta", domain: "meta.com" },
  { name: "Facebook", domain: "meta.com" },
  { name: "Netflix", domain: "netflix.com" },
  { name: "Adobe", domain: "adobe.com" },
  { name: "Salesforce", domain: "salesforce.com" },
  { name: "Oracle", domain: "oracle.com" },
  { name: "IBM", domain: "ibm.com" },
  { name: "Nvidia", domain: "nvidia.com" },
  { name: "OpenAI", domain: "openai.com" },
  { name: "Anthropic", domain: "anthropic.com" },
  { name: "Spotify", domain: "spotify.com" },
  { name: "Uber", domain: "uber.com" },
  { name: "Lyft", domain: "lyft.com" },
  { name: "Airbnb", domain: "airbnb.com" },
  { name: "Atlassian", domain: "atlassian.com" },
  { name: "GitHub", domain: "github.com" },
  { name: "GitLab", domain: "gitlab.com" },
  { name: "Stripe", domain: "stripe.com" },
  { name: "Twilio", domain: "twilio.com" },
  { name: "Slack", domain: "slack.com" },
  { name: "Zoom", domain: "zoom.us" },

  // Indian IT & Enterprise Employers
  { name: "Tata Consultancy Services", domain: "tcs.com" },
  { name: "TCS", domain: "tcs.com" },
  { name: "Infosys", domain: "infosys.com" },
  { name: "Wipro", domain: "wipro.com" },
  { name: "HCLTech", domain: "hcltech.com" },
  { name: "HCL", domain: "hcltech.com" },
  { name: "Tech Mahindra", domain: "techmahindra.com" },
  { name: "Accenture", domain: "accenture.com" },
  { name: "Cognizant", domain: "cognizant.com" },
  { name: "Capgemini", domain: "capgemini.com" },
  { name: "LTIMindtree", domain: "ltimindtree.com" },
  { name: "Zoho", domain: "zoho.com" },
  { name: "Freshworks", domain: "freshworks.com" },
  { name: "Flipkart", domain: "flipkart.com" },
  { name: "Swiggy", domain: "swiggy.in" },
  { name: "Zomato", domain: "zomato.com" },
  { name: "KFC", domain: "kfc.com" },
  { name: "Kentucky Fried Chicken", domain: "kfc.com" },
  { name: "McDonalds", domain: "mcdonalds.com" },
  { name: "McDonald's", domain: "mcdonalds.com" },
  { name: "Dominos", domain: "dominos.com" },
  { name: "Domino's", domain: "dominos.com" },
  { name: "Starbucks", domain: "starbucks.com" },
  { name: "Burger King", domain: "bk.com" },
  { name: "Razorpay", domain: "razorpay.com" },
  { name: "Paytm", domain: "paytm.com" },
  { name: "PhonePe", domain: "phonepe.com" },

  // Freelance & Creator Platforms
  { name: "Upwork", domain: "upwork.com" },
  { name: "Fiverr", domain: "fiverr.com" },
  { name: "Freelancer", domain: "freelancer.com" },
  { name: "Toptal", domain: "toptal.com" },
  { name: "YouTube", domain: "youtube.com" },
  { name: "Substack", domain: "substack.com" },
  { name: "Patreon", domain: "patreon.com" },
  { name: "Gumroad", domain: "gumroad.com" },
  { name: "Udemy", domain: "udemy.com" },
  { name: "Coursera", domain: "coursera.org" },

  // Consulting & Finance Employers
  { name: "Deloitte", domain: "deloitte.com" },
  { name: "PwC", domain: "pwc.com" },
  { name: "EY", domain: "ey.com" },
  { name: "KPMG", domain: "kpmg.com" },
  { name: "McKinsey", domain: "mckinsey.com" },
  { name: "BCG", domain: "bcg.com" },
  { name: "Bain", domain: "bain.com" },
  { name: "Goldman Sachs", domain: "goldmansachs.com" },
  { name: "J.P. Morgan", domain: "jpmorgan.com" },
  { name: "Morgan Stanley", domain: "morganstanley.com" },
];

const COMPANY_SHORTHANDS: Record<string, string> = {
  google: "google.com",
  msft: "microsoft.com",
  microsoft: "microsoft.com",
  apple: "apple.com",
  amazon: "amazon.com",
  meta: "meta.com",
  fb: "meta.com",
  openai: "openai.com",
  chatgpt: "openai.com",
  kfc: "kfc.com",
  "kentucky fried chicken": "kfc.com",
  mcdonalds: "mcdonalds.com",
  "mcdonald's": "mcdonalds.com",
  dominos: "dominos.com",
  "domino's": "dominos.com",
  starbucks: "starbucks.com",
  "burger king": "bk.com",
  bk: "bk.com",
  tcs: "tcs.com",
  infy: "infosys.com",
  infosys: "infosys.com",
  wipro: "wipro.com",
  hcl: "hcltech.com",
  accenture: "accenture.com",
  cts: "cognizant.com",
  cognizant: "cognizant.com",
  capgemini: "capgemini.com",
  upwork: "upwork.com",
  fiverr: "fiverr.com",
  stripe: "stripe.com",
  zoho: "zoho.com",
  freshworks: "freshworks.com",
  swiggy: "swiggy.in",
  zomato: "zomato.com",
  razorpay: "razorpay.com",
  flipkart: "flipkart.com",
  youtube: "youtube.com",
};

import { getFastLogoCandidateUrls } from "./logo-cache";

const HD_COMPANY_LOGOS: Record<string, string[]> = {
  "openai.com": [
    "https://upload.wikimedia.org/wikipedia/commons/4/4d/OpenAI_Logo.svg",
    "https://cdn.brandfetch.io/openai.com/w/512/h/512/theme/dark/icon",
    "https://logo.clearbit.com/openai.com?size=512",
  ],
  "kfc.com": [
    "https://upload.wikimedia.org/wikipedia/commons/b/bf/KFC_logo.svg",
    "https://cdn.brandfetch.io/kfc.com/w/512/h/512/theme/dark/icon",
    "https://logo.clearbit.com/kfc.com?size=512",
  ],
  "infosys.com": [
    "https://upload.wikimedia.org/wikipedia/commons/9/95/Infosys_logo.svg",
    "https://logo.clearbit.com/infosys.com?size=512",
    "https://cdn.brandfetch.io/infosys.com/w/512/h/512/theme/dark/icon",
  ],
  "tcs.com": [
    "https://upload.wikimedia.org/wikipedia/commons/b/b1/Tata_Consultancy_Services_Logo.svg",
    "https://logo.clearbit.com/tcs.com?size=512",
    "https://cdn.brandfetch.io/tcs.com/w/512/h/512/theme/dark/icon",
  ],
  "wipro.com": [
    "https://upload.wikimedia.org/wikipedia/commons/a/a0/Wipro_Primary_Logo_Color_RGB.svg",
    "https://logo.clearbit.com/wipro.com?size=512",
  ],
  "hcltech.com": [
    "https://upload.wikimedia.org/wikipedia/commons/7/7b/HCLTech_Logo.svg",
    "https://logo.clearbit.com/hcltech.com?size=512",
  ],
  "accenture.com": [
    "https://upload.wikimedia.org/wikipedia/commons/c/cd/Accenture_logo.svg",
    "https://logo.clearbit.com/accenture.com?size=512",
  ],
  "cognizant.com": [
    "https://upload.wikimedia.org/wikipedia/commons/f/f4/Cognizant_logo_2022.svg",
    "https://logo.clearbit.com/cognizant.com?size=512",
  ],
  "capgemini.com": [
    "https://upload.wikimedia.org/wikipedia/commons/9/9d/Capgemini_201x_logo.svg",
    "https://logo.clearbit.com/capgemini.com?size=512",
  ],
  "google.com": [
    "https://upload.wikimedia.org/wikipedia/commons/2/2f/Google_2015_logo.svg",
    "https://logo.clearbit.com/google.com?size=512",
  ],
  "microsoft.com": [
    "https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo_%282012%29.svg",
    "https://logo.clearbit.com/microsoft.com?size=512",
  ],
  "apple.com": [
    "https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg",
    "https://logo.clearbit.com/apple.com?size=512",
  ],
  "amazon.com": [
    "https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg",
    "https://logo.clearbit.com/amazon.com?size=512",
  ],
  "meta.com": [
    "https://upload.wikimedia.org/wikipedia/commons/7/7b/Meta_Platforms_Inc._logo.svg",
    "https://logo.clearbit.com/meta.com?size=512",
  ],
  "swiggy.in": [
    "https://upload.wikimedia.org/wikipedia/commons/1/13/Swiggy_logo.svg",
    "https://logo.clearbit.com/swiggy.in?size=512",
  ],
  "zomato.com": [
    "https://upload.wikimedia.org/wikipedia/commons/b/bd/Zomato_Logo.svg",
    "https://logo.clearbit.com/zomato.com?size=512",
  ],
  "mcdonalds.com": [
    "https://upload.wikimedia.org/wikipedia/commons/3/36/McDonald%27s_Golden_Arches.svg",
    "https://logo.clearbit.com/mcdonalds.com?size=512",
  ],
  "dominos.com": [
    "https://upload.wikimedia.org/wikipedia/commons/7/74/Dominos_pizza_logo.svg",
    "https://logo.clearbit.com/dominos.com?size=512",
  ],
  "starbucks.com": [
    "https://upload.wikimedia.org/wikipedia/en/d/d3/Starbucks_Corporation_Logo_2011.svg",
    "https://logo.clearbit.com/starbucks.com?size=512",
  ],
  "bk.com": [
    "https://upload.wikimedia.org/wikipedia/commons/c/cc/Burger_King_2020.svg",
    "https://logo.clearbit.com/bk.com?size=512",
  ],
  "upwork.com": [
    "https://upload.wikimedia.org/wikipedia/commons/d/d2/Upwork-logo.svg",
    "https://logo.clearbit.com/upwork.com?size=512",
  ],
  "fiverr.com": [
    "https://upload.wikimedia.org/wikipedia/commons/1/18/Fiverr_Logo_09.2020.svg",
    "https://logo.clearbit.com/fiverr.com?size=512",
  ],
};

/**
 * Get prioritized ultra-high-resolution online logo CDN URLs for a company domain
 */
export function getCompanyLogoUrls(domain: string): string[] {
  if (!domain) return [];
  const clean = domain.trim().toLowerCase();
  const list: string[] = [];
  if (HD_COMPANY_LOGOS[clean]) {
    list.push(...HD_COMPANY_LOGOS[clean]);
  }
  const defaults = getFastLogoCandidateUrls(clean);
  return Array.from(new Set([...list, ...defaults]));
}

/**
 * Get web domain registered or inferred for a company or income description
 */
export function getCompanyDomain(name: string): string | null {
  if (!name) return null;
  const raw = name.trim();

  // 1. Direct match if name already contains a valid domain extension
  const domainRegex = /\b([a-z0-9\-]+\.(?:com|in|co|io|ai|org|net|tech|app|dev))\b/i;
  const directMatch = raw.match(domainRegex);
  if (directMatch) {
    return directMatch[1].toLowerCase();
  }

  const normalized = raw.toLowerCase();

  // 2. Direct shorthand lookup
  if (COMPANY_SHORTHANDS[normalized]) {
    return COMPANY_SHORTHANDS[normalized];
  }

  // 3. Registry exact match
  let company = COMPANIES.find((c) => c.name.toLowerCase() === normalized);

  // 4. Registry substring / word match
  if (!company) {
    company = COMPANIES.find((c) => {
      const cName = c.name.toLowerCase();
      return normalized.includes(cName) || cName.includes(normalized);
    });
  }

  // 5. Token match
  if (!company) {
    const tokens = normalized.split(/[\s\-_\/]+/);
    for (const token of tokens) {
      if (token.length > 2 && COMPANY_SHORTHANDS[token]) {
        return COMPANY_SHORTHANDS[token];
      }
    }
  }

  if (company) return company.domain;

  // 6. Generic clean candidate (e.g. "Acme Corp" -> "acme.com")
  const cleanWord = normalized
    .replace(/\b(inc|ltd|pvt|llc|corp|corporation|technologies|solutions|services|group|labs|studio|co|company)\b/g, "")
    .trim()
    .split(/\s+/)[0]
    .replace(/[^a-z0-9]/g, "");

  if (cleanWord.length >= 3) {
    return `${cleanWord}.com`;
  }

  return null;
}
