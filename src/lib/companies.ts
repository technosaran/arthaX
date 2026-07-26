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
    "https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg",
    "https://cdn.simpleicons.org/google",
    "https://cdn.brandfetch.io/google.com/w/512/h/512/theme/dark/icon",
    "https://www.google.com/s2/favicons?domain=google.com&sz=256",
  ],
  "microsoft.com": [
    "https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg",
    "https://cdn.simpleicons.org/microsoft",
    "https://cdn.brandfetch.io/microsoft.com/w/512/h/512/theme/dark/icon",
  ],
  "apple.com": [
    "https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg",
    "https://cdn.simpleicons.org/apple",
    "https://cdn.brandfetch.io/apple.com/w/512/h/512/theme/dark/icon",
  ],
  "amazon.com": [
    "https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg",
    "https://cdn.simpleicons.org/amazon",
    "https://cdn.brandfetch.io/amazon.com/w/512/h/512/theme/dark/icon",
  ],
  "meta.com": [
    "https://upload.wikimedia.org/wikipedia/commons/7/7b/Meta_Platforms_Inc._logo.svg",
    "https://cdn.simpleicons.org/meta",
    "https://cdn.brandfetch.io/meta.com/w/512/h/512/theme/dark/icon",
  ],
  "netflix.com": [
    "https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg",
    "https://cdn.simpleicons.org/netflix",
    "https://cdn.brandfetch.io/netflix.com/w/512/h/512/theme/dark/icon",
  ],
  "salesforce.com": [
    "https://upload.wikimedia.org/wikipedia/commons/f/f9/Salesforce.com_logo.svg",
    "https://cdn.simpleicons.org/salesforce",
    "https://cdn.brandfetch.io/salesforce.com/w/512/h/512/theme/dark/icon",
  ],
  "zoom.us": [
    "https://upload.wikimedia.org/wikipedia/commons/7/7b/Zoom_Communications_Logo.svg",
    "https://cdn.simpleicons.org/zoom",
    "https://cdn.brandfetch.io/zoom.us/w/512/h/512/theme/dark/icon",
  ],
  "adobe.com": [
    "https://upload.wikimedia.org/wikipedia/commons/1/18/Adobe_Corporate_logo.svg",
    "https://cdn.simpleicons.org/adobe",
    "https://cdn.brandfetch.io/adobe.com/w/512/h/512/theme/dark/icon",
  ],
  "oracle.com": [
    "https://upload.wikimedia.org/wikipedia/commons/5/50/Oracle_logo.svg",
    "https://cdn.simpleicons.org/oracle",
    "https://cdn.brandfetch.io/oracle.com/w/512/h/512/theme/dark/icon",
  ],
  "ibm.com": [
    "https://upload.wikimedia.org/wikipedia/commons/5/51/IBM_logo.svg",
    "https://cdn.simpleicons.org/ibm",
    "https://cdn.brandfetch.io/ibm.com/w/512/h/512/theme/dark/icon",
  ],
  "nvidia.com": [
    "https://upload.wikimedia.org/wikipedia/commons/2/21/Nvidia_logo.svg",
    "https://cdn.simpleicons.org/nvidia",
    "https://cdn.brandfetch.io/nvidia.com/w/512/h/512/theme/dark/icon",
  ],
  "spotify.com": [
    "https://upload.wikimedia.org/wikipedia/commons/2/19/Spotify_logo_without_text.svg",
    "https://cdn.simpleicons.org/spotify",
    "https://cdn.brandfetch.io/spotify.com/w/512/h/512/theme/dark/icon",
  ],
  "uber.com": [
    "https://upload.wikimedia.org/wikipedia/commons/c/cc/Uber_logo_2018.svg",
    "https://cdn.simpleicons.org/uber",
    "https://cdn.brandfetch.io/uber.com/w/512/h/512/theme/dark/icon",
  ],
  "airbnb.com": [
    "https://upload.wikimedia.org/wikipedia/commons/6/69/Airbnb_Logo_B%C3%A9lo.svg",
    "https://cdn.simpleicons.org/airbnb",
    "https://cdn.brandfetch.io/airbnb.com/w/512/h/512/theme/dark/icon",
  ],
  "atlassian.com": [
    "https://upload.wikimedia.org/wikipedia/commons/7/74/Atlassian-icon-logo.svg",
    "https://cdn.simpleicons.org/atlassian",
    "https://cdn.brandfetch.io/atlassian.com/w/512/h/512/theme/dark/icon",
  ],
  "github.com": [
    "https://upload.wikimedia.org/wikipedia/commons/c/c2/GitHub_Invertocat_Logo.svg",
    "https://cdn.simpleicons.org/github",
    "https://cdn.brandfetch.io/github.com/w/512/h/512/theme/dark/icon",
  ],
  "gitlab.com": [
    "https://upload.wikimedia.org/wikipedia/commons/e/e1/GitLab_logo.svg",
    "https://cdn.simpleicons.org/gitlab",
    "https://cdn.brandfetch.io/gitlab.com/w/512/h/512/theme/dark/icon",
  ],
  "slack.com": [
    "https://upload.wikimedia.org/wikipedia/commons/d/d5/Slack_icon_2019.svg",
    "https://cdn.simpleicons.org/slack",
    "https://cdn.brandfetch.io/slack.com/w/512/h/512/theme/dark/icon",
  ],
  "openai.com": [
    "https://upload.wikimedia.org/wikipedia/commons/0/04/ChatGPT_logo.svg",
    "https://cdn.simpleicons.org/openai",
    "https://cdn.brandfetch.io/openai.com/w/512/h/512/theme/dark/icon",
  ],
  "kfc.com": [
    "https://upload.wikimedia.org/wikipedia/commons/b/bf/KFC_logo.svg",
    "https://cdn.simpleicons.org/kfc",
    "https://cdn.brandfetch.io/kfc.com/w/512/h/512/theme/dark/icon",
  ],
  "infosys.com": [
    "https://upload.wikimedia.org/wikipedia/commons/9/95/Infosys_logo.svg",
    "https://cdn.brandfetch.io/infosys.com/w/512/h/512/theme/dark/icon",
    "https://www.google.com/s2/favicons?domain=infosys.com&sz=256",
  ],
  "tcs.com": [
    "https://upload.wikimedia.org/wikipedia/commons/b/b1/Tata_Consultancy_Services_Logo.svg",
    "https://cdn.brandfetch.io/tcs.com/w/512/h/512/theme/dark/icon",
    "https://www.google.com/s2/favicons?domain=tcs.com&sz=256",
  ],
  "wipro.com": [
    "https://upload.wikimedia.org/wikipedia/commons/a/a0/Wipro_Primary_Logo_Color_RGB.svg",
    "https://cdn.simpleicons.org/wipro",
    "https://cdn.brandfetch.io/wipro.com/w/512/h/512/theme/dark/icon",
  ],
  "hcltech.com": [
    "https://upload.wikimedia.org/wikipedia/commons/7/79/HCLTech_Logo.svg",
    "https://cdn.brandfetch.io/hcltech.com/w/512/h/512/theme/dark/icon",
  ],
  "accenture.com": [
    "https://upload.wikimedia.org/wikipedia/commons/c/cd/Accenture.svg",
    "https://cdn.simpleicons.org/accenture",
    "https://cdn.brandfetch.io/accenture.com/w/512/h/512/theme/dark/icon",
  ],
  "cognizant.com": [
    "https://upload.wikimedia.org/wikipedia/commons/3/30/Cognizant_logo_2022.svg",
    "https://cdn.brandfetch.io/cognizant.com/w/512/h/512/theme/dark/icon",
  ],
  "capgemini.com": [
    "https://upload.wikimedia.org/wikipedia/commons/a/a2/Capgemini_logo.svg",
    "https://cdn.brandfetch.io/capgemini.com/w/512/h/512/theme/dark/icon",
  ],
  "swiggy.in": [
    "https://upload.wikimedia.org/wikipedia/commons/1/12/Swiggy_logo.svg",
    "https://cdn.simpleicons.org/swiggy",
    "https://cdn.brandfetch.io/swiggy.in/w/512/h/512/theme/dark/icon",
  ],
  "zomato.com": [
    "https://upload.wikimedia.org/wikipedia/commons/b/b3/Zomato_logo.svg",
    "https://cdn.simpleicons.org/zomato",
    "https://cdn.brandfetch.io/zomato.com/w/512/h/512/theme/dark/icon",
  ],
  "mcdonalds.com": [
    "https://upload.wikimedia.org/wikipedia/commons/3/36/McDonald%27s_Golden_Arches.svg",
    "https://cdn.simpleicons.org/mcdonalds",
    "https://cdn.brandfetch.io/mcdonalds.com/w/512/h/512/theme/dark/icon",
  ],
  "dominos.com": [
    "https://upload.wikimedia.org/wikipedia/commons/7/74/Dominos_pizza_logo.svg",
    "https://cdn.simpleicons.org/dominos",
    "https://cdn.brandfetch.io/dominos.com/w/512/h/512/theme/dark/icon",
  ],
  "starbucks.com": [
    "https://upload.wikimedia.org/wikipedia/commons/4/45/Starbucks_Corporation_Logo_2011.svg",
    "https://cdn.simpleicons.org/starbucks",
    "https://cdn.brandfetch.io/starbucks.com/w/512/h/512/theme/dark/icon",
  ],
  "bk.com": [
    "https://upload.wikimedia.org/wikipedia/commons/8/85/Burger_King_logo_%282021%29.svg",
    "https://cdn.simpleicons.org/burgerking",
    "https://cdn.brandfetch.io/bk.com/w/512/h/512/theme/dark/icon",
  ],
  "upwork.com": [
    "https://upload.wikimedia.org/wikipedia/commons/c/cd/Upwork-logo.svg",
    "https://cdn.simpleicons.org/upwork",
    "https://cdn.brandfetch.io/upwork.com/w/512/h/512/theme/dark/icon",
  ],
  "fiverr.com": [
    "https://upload.wikimedia.org/wikipedia/commons/1/18/Fiverr_Logo_09.2020.svg",
    "https://cdn.simpleicons.org/fiverr",
    "https://cdn.brandfetch.io/fiverr.com/w/512/h/512/theme/dark/icon",
  ],
  "razorpay.com": [
    "https://upload.wikimedia.org/wikipedia/commons/8/89/Razorpay_logo.svg",
    "https://cdn.simpleicons.org/razorpay",
    "https://cdn.brandfetch.io/razorpay.com/w/512/h/512/theme/dark/icon",
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
