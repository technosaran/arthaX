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

  // Indian Industrial & Conglomerates
  { name: "Reliance Industries", domain: "ril.com" },
  { name: "Jio", domain: "jio.com" },
  { name: "Tata Group", domain: "tata.com" },
  { name: "Aditya Birla Group", domain: "adityabirla.com" },
  { name: "Mahindra & Mahindra", domain: "mahindra.com" },
  { name: "Bajaj Finserv", domain: "bajajfinserv.in" },
  { name: "Larsen & Toubro", domain: "larsentoubro.com" },
  { name: "Adani Group", domain: "adani.com" },
  { name: "Airtel", domain: "airtel.in" },
  { name: "Godrej", domain: "godrej.com" },
  { name: "ITC", domain: "itcportal.com" },
  { name: "Hindustan Unilever", domain: "hul.co.in" },
  { name: "Dabur", domain: "dabur.com" },
  { name: "Britannia", domain: "britannia.co.in" },
  { name: "Asian Paints", domain: "asianpaints.com" },
  { name: "Titan", domain: "titan.co.in" },
  { name: "Avenue Supermarts (DMart)", domain: "dmartindia.com" },

  // E-Commerce, Retail & Quick Commerce
  { name: "Myntra", domain: "myntra.com" },
  { name: "Nykaa", domain: "nykaa.com" },
  { name: "Ajio", domain: "ajio.com" },
  { name: "Meesho", domain: "meesho.com" },
  { name: "Blinkit", domain: "blinkit.com" },
  { name: "Zepto", domain: "zepto.now" },
  { name: "BigBasket", domain: "bigbasket.com" },
  { name: "Urban Company", domain: "urbancompany.com" },
  { name: "Ola Cabs", domain: "olacabs.com" },
  { name: "Rapido", domain: "rapido.bike" },
  { name: "BookMyShow", domain: "bookmyshow.com" },
  { name: "MakeMyTrip", domain: "makemytrip.com" },

  // Automobile & EV Giants
  { name: "Maruti Suzuki", domain: "marutisuzuki.com" },
  { name: "Hyundai Motors", domain: "hyundai.com" },
  { name: "Tata Motors", domain: "tatamotors.com" },
  { name: "Hero MotoCorp", domain: "heromotocorp.com" },
  { name: "TVS Motor", domain: "tvsmotor.com" },
  { name: "Royal Enfield", domain: "royalenfield.com" },
  { name: "Ather Energy", domain: "atherenergy.com" },
  { name: "Tesla", domain: "tesla.com" },

  // Global Enterprise Tech, Cloud & AI
  { name: "Intel", domain: "intel.com" },
  { name: "AMD", domain: "amd.com" },
  { name: "Qualcomm", domain: "qualcomm.com" },
  { name: "Cisco", domain: "cisco.com" },
  { name: "SAP", domain: "sap.com" },
  { name: "ServiceNow", domain: "servicenow.com" },
  { name: "Snowflake", domain: "snowflake.com" },
  { name: "Databricks", domain: "databricks.com" },
  { name: "Cloudflare", domain: "cloudflare.com" },
  { name: "Palantir", domain: "palantir.com" },
  { name: "Notion", domain: "notion.so" },
  { name: "Figma", domain: "figma.com" },
  { name: "Canva", domain: "canva.com" },
  { name: "Shopify", domain: "shopify.com" },

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
  salesforce: "salesforce.com",
  zoom: "zoom.us",
  adobe: "adobe.com",
  oracle: "oracle.com",
  ibm: "ibm.com",
  nvidia: "nvidia.com",
  spotify: "spotify.com",
  uber: "uber.com",
  airbnb: "airbnb.com",
  atlassian: "atlassian.com",
  github: "github.com",
  gitlab: "gitlab.com",
  slack: "slack.com",
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
  zepto: "zepto.co",
  blinkit: "blinkit.com",
  instamart: "swiggy.in",
  myntra: "myntra.com",
  ajio: "ajio.com",
  nike: "nike.com",
  adidas: "adidas.com",
  zara: "zara.com",
  hm: "hm.com",
  "h&m": "hm.com",
  decathlon: "decathlon.in",
  netflix: "netflix.com",
  prime: "amazon.in",
  hotstar: "hotstar.com",
  ola: "olacabs.com",
  rapido: "rapido.bike",
  bookmyshow: "bookmyshow.com",
  pvr: "pvrcinemas.com",
  inox: "inoxmovies.com",
  airtel: "airtel.in",
  jio: "jio.com",
  vi: "myvi.in",
  vodafone: "myvi.in",
  tataplay: "tataplay.com",
  urbancompany: "urbancompany.com",
  cultfit: "cult.fit",
  bigbasket: "bigbasket.com",
  dunzo: "dunzo.com",
  nykaa: "nykaa.com",
  lenskart: "lenskart.com",
  firstcry: "firstcry.com",
  meesho: "meesho.com",
  makemytrip: "makemytrip.com",
  goibibo: "goibibo.com",
  redbus: "redbus.in",
  subway: "subway.com",
  pizzahut: "pizzahut.co.in",
};

import { getFastLogoCandidateUrls } from "./logo-cache";

const HD_COMPANY_LOGOS: Record<string, string[]> = {
  "google.com": [
    "https://cdn.simpleicons.org/google",
    "https://www.google.com/s2/favicons?domain=google.com&sz=256",
  ],
  "microsoft.com": [
    "https://cdn.simpleicons.org/microsoft",
    "https://www.google.com/s2/favicons?domain=microsoft.com&sz=256",
  ],
  "apple.com": [
    "https://cdn.simpleicons.org/apple",
    "https://www.google.com/s2/favicons?domain=apple.com&sz=256",
  ],
  "amazon.com": [
    "https://cdn.simpleicons.org/amazon",
    "https://www.google.com/s2/favicons?domain=amazon.com&sz=256",
  ],
  "meta.com": [
    "https://cdn.simpleicons.org/meta",
    "https://www.google.com/s2/favicons?domain=meta.com&sz=256",
  ],
  "netflix.com": [
    "https://cdn.simpleicons.org/netflix",
    "https://www.google.com/s2/favicons?domain=netflix.com&sz=256",
  ],
  "salesforce.com": [
    "https://cdn.simpleicons.org/salesforce",
    "https://www.google.com/s2/favicons?domain=salesforce.com&sz=256",
  ],
  "zoom.us": [
    "https://cdn.simpleicons.org/zoom",
    "https://www.google.com/s2/favicons?domain=zoom.us&sz=256",
  ],
  "adobe.com": [
    "https://cdn.simpleicons.org/adobe",
    "https://www.google.com/s2/favicons?domain=adobe.com&sz=256",
  ],
  "oracle.com": [
    "https://cdn.simpleicons.org/oracle",
    "https://www.google.com/s2/favicons?domain=oracle.com&sz=256",
  ],
  "ibm.com": [
    "https://cdn.simpleicons.org/ibm",
    "https://www.google.com/s2/favicons?domain=ibm.com&sz=256",
  ],
  "nvidia.com": [
    "https://cdn.simpleicons.org/nvidia",
    "https://www.google.com/s2/favicons?domain=nvidia.com&sz=256",
  ],
  "spotify.com": [
    "https://cdn.simpleicons.org/spotify",
    "https://www.google.com/s2/favicons?domain=spotify.com&sz=256",
  ],
  "uber.com": [
    "https://cdn.simpleicons.org/uber",
    "https://www.google.com/s2/favicons?domain=uber.com&sz=256",
  ],
  "airbnb.com": [
    "https://cdn.simpleicons.org/airbnb",
    "https://www.google.com/s2/favicons?domain=airbnb.com&sz=256",
  ],
  "atlassian.com": [
    "https://cdn.simpleicons.org/atlassian",
    "https://www.google.com/s2/favicons?domain=atlassian.com&sz=256",
  ],
  "github.com": [
    "https://cdn.simpleicons.org/github",
    "https://www.google.com/s2/favicons?domain=github.com&sz=256",
  ],
  "gitlab.com": [
    "https://cdn.simpleicons.org/gitlab",
    "https://www.google.com/s2/favicons?domain=gitlab.com&sz=256",
  ],
  "slack.com": [
    "https://cdn.simpleicons.org/slack",
    "https://www.google.com/s2/favicons?domain=slack.com&sz=256",
  ],
  "openai.com": [
    "https://cdn.simpleicons.org/openai",
    "https://www.google.com/s2/favicons?domain=openai.com&sz=256",
  ],
  "kfc.com": [
    "https://cdn.simpleicons.org/kfc",
    "https://www.google.com/s2/favicons?domain=kfc.com&sz=256",
  ],
  "infosys.com": [
    "https://www.google.com/s2/favicons?domain=infosys.com&sz=256",
  ],
  "tcs.com": [
    "https://www.google.com/s2/favicons?domain=tcs.com&sz=256",
  ],
  "wipro.com": [
    "https://cdn.simpleicons.org/wipro",
    "https://www.google.com/s2/favicons?domain=wipro.com&sz=256",
  ],
  "hcltech.com": [
    "https://www.google.com/s2/favicons?domain=hcltech.com&sz=256",
  ],
  "accenture.com": [
    "https://cdn.simpleicons.org/accenture",
    "https://www.google.com/s2/favicons?domain=accenture.com&sz=256",
  ],
  "cognizant.com": [
    "https://www.google.com/s2/favicons?domain=cognizant.com&sz=256",
  ],
  "capgemini.com": [
    "https://www.google.com/s2/favicons?domain=capgemini.com&sz=256",
  ],
  "swiggy.in": [
    "https://cdn.simpleicons.org/swiggy",
    "https://www.google.com/s2/favicons?domain=swiggy.in&sz=256",
  ],
  "zomato.com": [
    "https://cdn.simpleicons.org/zomato",
    "https://www.google.com/s2/favicons?domain=zomato.com&sz=256",
  ],
  "mcdonalds.com": [
    "https://cdn.simpleicons.org/mcdonalds",
    "https://www.google.com/s2/favicons?domain=mcdonalds.com&sz=256",
  ],
  "dominos.com": [
    "https://cdn.simpleicons.org/dominos",
    "https://www.google.com/s2/favicons?domain=dominos.com&sz=256",
  ],
  "starbucks.com": [
    "https://cdn.simpleicons.org/starbucks",
    "https://www.google.com/s2/favicons?domain=starbucks.com&sz=256",
  ],
  "bk.com": [
    "https://cdn.simpleicons.org/burgerking",
    "https://www.google.com/s2/favicons?domain=bk.com&sz=256",
  ],
  "upwork.com": [
    "https://cdn.simpleicons.org/upwork",
    "https://www.google.com/s2/favicons?domain=upwork.com&sz=256",
  ],
  "fiverr.com": [
    "https://cdn.simpleicons.org/fiverr",
    "https://www.google.com/s2/favicons?domain=fiverr.com&sz=256",
  ],
  "razorpay.com": [
    "https://cdn.simpleicons.org/razorpay",
    "https://www.google.com/s2/favicons?domain=razorpay.com&sz=256",
  ],
};

export function getCompanyLogoUrls(domain: string): string[] {
  if (!domain) return [];
  const clean = domain.trim().toLowerCase();
  const curated = HD_COMPANY_LOGOS[clean] || [];
  const defaults = getFastLogoCandidateUrls(clean);
  return Array.from(new Set([...curated, ...defaults]));
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
