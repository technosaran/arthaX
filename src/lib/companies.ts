/**
 * Company Registry mapping names to official web domains
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

const COMPANY_SIMPLE_ICONS: Record<string, string> = {
  "google.com": "google",
  "microsoft.com": "microsoft",
  "apple.com": "apple",
  "amazon.com": "amazon",
  "amazon.in": "amazon",
  "meta.com": "meta",
  "netflix.com": "netflix",
  "adobe.com": "adobe",
  "salesforce.com": "salesforce",
  "oracle.com": "oracle",
  "ibm.com": "ibm",
  "accenture.com": "accenture",
  "cognizant.com": "cognizant",
  "infosys.com": "infosys",
  "tcs.com": "tata",
  "tata.com": "tata",
  "wipro.com": "wipro",
  "swiggy.in": "swiggy",
  "zomato.com": "zomato",
  "stripe.com": "stripe",
  "razorpay.com": "razorpay",
  "upwork.com": "upwork",
  "fiverr.com": "fiverr",
  "github.com": "github",
  "gitlab.com": "gitlab",
  "atlassian.com": "atlassian",
  "uber.com": "uber",
  "zoom.us": "zoom",
  "linkedin.com": "linkedin",
};

/**
 * Get ordered logo URLs for a company using online SimpleIcons CDN, IconHorse, FaviconKit, DuckDuckGo, Clearbit and Google.
 */
export function getCompanyLogoSources(companyNameOrDomain: string): string[] {
  if (!companyNameOrDomain) return [];
  const raw = companyNameOrDomain.trim();
  const domainRegex = /^[a-z0-9\-]+\.(?:com|in|co|io|ai|org|net|tech|app|dev)$/i;

  let domain: string | null = null;
  if (domainRegex.test(raw)) {
    domain = raw.toLowerCase();
  } else {
    domain = getCompanyDomain(raw);
  }

  if (!domain) return [];

  const sources: string[] = [];

  // 1. SimpleIcons Online CDN first
  const simpleIconSlug = COMPANY_SIMPLE_ICONS[domain];
  if (simpleIconSlug) {
    sources.push(`https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/${simpleIconSlug}.svg`);
  }

  // 2. Multi-provider online CDN chain for Companies (IconHorse -> FaviconKit -> DuckDuckGo -> Clearbit -> Google)
  sources.push(
    `https://api.iconhorse.com/v1/${domain}`,
    `https://api.faviconkit.com/${domain}/128`,
    `https://icons.duckduckgo.com/ip3/${domain}.ico`,
    `https://logo.clearbit.com/${domain}`,
    `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
  );

  return sources;
}
