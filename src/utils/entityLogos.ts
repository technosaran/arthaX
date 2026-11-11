/**
 * Universal Entity, Brand, Company & Merchant Domain Resolver
 * Supports major employers, IT firms, startups, tech giants, food delivery, shopping, and utilities.
 */

const COMMON_ENTITIES: Record<string, string> = {
  // --- Indian IT, Corporates & Employers ---
  tcs: "tcs.com",
  "tata consultancy": "tcs.com",
  "tata consultancy services": "tcs.com",
  infosys: "infosys.com",
  wipro: "wipro.com",
  hcl: "hcltech.com",
  "hcl tech": "hcltech.com",
  "hcl technologies": "hcltech.com",
  "tech mahindra": "techmahindra.com",
  mahindra: "mahindra.com",
  tata: "tata.com",
  "tata sons": "tata.com",
  "tata motors": "tatamotors.com",
  "tata steel": "tatasteel.com",
  reliance: "ril.com",
  jio: "jio.com",
  "reliance jio": "jio.com",
  adani: "adani.com",
  "l&t": "larsentoubro.com",
  "larsen & toubro": "larsentoubro.com",
  larsen: "larsentoubro.com",
  cognizant: "cognizant.com",
  capgemini: "capgemini.com",
  accenture: "accenture.com",
  deloitte: "deloitte.com",
  pwc: "pwc.com",
  "price waterhouse": "pwc.com",
  ey: "ey.com",
  "ernst & young": "ey.com",
  kpmg: "kpmg.com",
  ibm: "ibm.com",
  zoho: "zoho.com",
  freshworks: "freshworks.com",
  postman: "postman.com",
  razorpay: "razorpay.com",
  phonepe: "phonepe.com",
  paytm: "paytm.com",
  cred: "cred.club",
  zerodha: "zerodha.com",
  groww: "groww.in",
  flipkart: "flipkart.com",
  swiggy: "swiggy.com",
  zomato: "zomato.com",
  blinkit: "blinkit.com",
  zepto: "zeptonow.com",
  meesho: "meesho.com",
  nykaa: "nykaa.com",
  ola: "olacabs.com",
  "ola cabs": "olacabs.com",
  rapido: "rapido.bike",
  lenskart: "lenskart.com",
  "urban company": "urbancompany.com",
  urbancompany: "urbancompany.com",
  "cult.fit": "cult.fit",
  cultfit: "cult.fit",
  byjus: "byjus.com",
  "byju's": "byjus.com",
  unacademy: "unacademy.com",
  upgrad: "upgrad.com",
  ge: "ge.com",
  siemens: "siemens.com",
  bosch: "bosch.com",

  // --- Global Tech, FAANG & Software ---
  google: "google.com",
  alphabet: "google.com",
  microsoft: "microsoft.com",
  apple: "apple.com",
  amazon: "amazon.com",
  meta: "meta.com",
  facebook: "meta.com",
  netflix: "netflix.com",
  adobe: "adobe.com",
  oracle: "oracle.com",
  salesforce: "salesforce.com",
  cisco: "cisco.com",
  intel: "intel.com",
  nvidia: "nvidia.com",
  amd: "amd.com",
  uber: "uber.com",
  airbnb: "airbnb.com",
  twitter: "x.com",
  x: "x.com",
  linkedin: "linkedin.com",
  spotify: "spotify.com",
  stripe: "stripe.com",
  paypal: "paypal.com",
  github: "github.com",
  gitlab: "gitlab.com",
  atlassian: "atlassian.com",
  jira: "atlassian.com",
  slack: "slack.com",
  figma: "figma.com",
  notion: "notion.so",
  canva: "canva.com",
  zoom: "zoom.us",
  dropbox: "dropbox.com",
  shopify: "shopify.com",
  openai: "openai.com",
  chatgpt: "openai.com",
  anthropic: "anthropic.com",
  claude: "anthropic.com",
  datadog: "datadoghq.com",
  snowflake: "snowflake.com",
  cloudflare: "cloudflare.com",
  vercel: "vercel.com",
  supabase: "supabase.com",
  aws: "aws.amazon.com",

  // --- Food, Grocery & Dining ---
  instamart: "swiggy.com",
  bigbasket: "bigbasket.com",
  bb: "bigbasket.com",
  dunzo: "dunzo.com",
  mcdonalds: "mcdonalds.com",
  "mcdonald's": "mcdonalds.com",
  mcd: "mcdonalds.com",
  dominos: "dominos.co.in",
  "domino's": "dominos.co.in",
  starbucks: "starbucks.in",
  kfc: "kfc.com",
  "burger king": "burgerking.in",
  burgerking: "burgerking.in",
  "pizza hut": "pizzahut.co.in",
  subway: "subway.com",
  "chai point": "chaipoint.com",
  chaayos: "chaayos.com",
  haldirams: "haldirams.com",
  "haldiram's": "haldirams.com",
  barbeque: "barbequenation.com",
  "barbeque nation": "barbequenation.com",

  // --- Shopping, Lifestyle & Retail ---
  myntra: "myntra.com",
  ajio: "ajio.com",
  zara: "zara.com",
  "h&m": "hm.com",
  hm: "hm.com",
  nike: "nike.com",
  adidas: "adidas.com",
  puma: "puma.com",
  decathlon: "decathlon.in",
  croma: "croma.com",
  "reliance digital": "reliancedigital.in",
  ikea: "ikea.com",
  "tata cliq": "tatacliq.com",
  cliq: "tatacliq.com",
  westside: "mywestside.com",
  pantaloons: "pantaloons.com",
  shopperstop: "shoppersstop.com",
  "shoppers stop": "shoppersstop.com",

  // --- Utilities, Telecom & Subscriptions ---
  airtel: "airtel.in",
  vi: "myvi.in",
  vodafone: "myvi.in",
  "tata play": "tataplay.com",
  "tata sky": "tataplay.com",
  hotstar: "hotstar.com",
  "disney hotstar": "hotstar.com",
  youtube: "youtube.com",
  "prime video": "primevideo.com",
  prime: "amazon.in",
  "apple music": "apple.com",
  bookmyshow: "bookmyshow.com",
  pvr: "pvrcinemas.com",
  inox: "inoxmovies.com",
  "tata power": "tatapower.com",
  bescom: "bescom.karnataka.gov.in",
  act: "actcorp.in",
  "act fibernet": "actcorp.in",
  hathway: "hathway.com",

  // --- Travel, Fuel & Commute ---
  irctc: "irctc.co.in",
  indigo: "goindigo.in",
  "air india": "airindia.com",
  airindia: "airindia.com",
  vistara: "airvistara.com",
  makemytrip: "makemytrip.com",
  mmt: "makemytrip.com",
  goibibo: "goibibo.com",
  yatra: "yatra.com",
  shell: "shell.com",
  hpcl: "hindustanpetroleum.com",
  bpcl: "bharatpetroleum.in",
  iocl: "iocl.com",
  "indian oil": "iocl.com",
  petrol: "iocl.com",
  fuel: "iocl.com",

  // --- Health & Fitness ---
  apollo: "apollopharmacy.in",
  "apollo pharmacy": "apollopharmacy.in",
  "1mg": "1mg.com",
  "tata 1mg": "1mg.com",
  pharmeasy: "pharmeasy.in",
  medplus: "medplusmart.com",
  practo: "practo.com",

  // --- Banks & Cards (also common for salary/deposits) ---
  hdfc: "hdfcbank.com",
  sbi: "sbi.co.in",
  icici: "icicibank.com",
  axis: "axisbank.com",
  kotak: "kotakbank.com",
};

// Sort entries by key length descending so longer matching phrases take precedence
const SORTED_ENTITIES = Object.entries(COMMON_ENTITIES).sort(
  (a, b) => b[0].length - a[0].length
);

export function getEntityDomain(inputName: string): string | null {
  if (!inputName || !inputName.trim()) return null;
  const clean = inputName.trim().toLowerCase();

  // If input already contains a domain (e.g. google.com or tcs.com)
  if (clean.includes(".") && !clean.includes(" ")) {
    return clean.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  }

  // Check direct and substring dictionary match
  for (const [key, domain] of SORTED_ENTITIES) {
    if (key.length <= 3) {
      // Word boundary check for short acronyms like tcs, hcl, jio, ey, ge
      const regex = new RegExp(`(^|\\s|[^a-z0-9])${key}($|\\s|[^a-z0-9])`, "i");
      if (clean === key || regex.test(clean)) {
        return domain;
      }
    } else {
      if (clean.includes(key)) {
        return domain;
      }
    }
  }

  // Fallback: if user typed a clean single brand name like "Stripe", "Figma", "Slack"
  const tokens = clean.split(/[\s/\\-]+/).filter(Boolean);
  const ignoredWords = [
    "salary",
    "stipend",
    "bonus",
    "dividend",
    "interest",
    "payout",
    "monthly",
    "weekly",
    "expense",
    "payment",
    "dining",
    "groceries",
    "food",
    "rent",
    "bill",
    "charges",
    "subscription",
    "recharge",
  ];

  for (const token of tokens) {
    const stripped = token.replace(/[^a-z0-9]/g, "");
    if (stripped.length >= 3 && !ignoredWords.includes(stripped)) {
      return `${stripped}.com`;
    }
  }

  return null;
}

export function getEntityVectorLogo(domain: string): string {
  return `https://unavatar.io/${encodeURIComponent(domain)}?fallback=false`;
}

export function getEntityLogoDev(domain: string, size: number = 100): string {
  const token =
    process.env.NEXT_PUBLIC_LOGOS_DEV_API_KEY ||
    "pk_bIuq9jRhRO-QRCdxlZWt4Q";
  const params = new URLSearchParams();
  if (token) params.set("token", token);
  params.set("size", String(Math.max(size * 2, 120)));
  params.set("format", "png");
  params.set("retina", "true");
  return `https://img.logo.dev/${encodeURIComponent(domain)}?${params.toString()}`;
}

export function getEntityGoogleFavicon(domain: string, size: number = 128): string {
  return `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${encodeURIComponent(domain)}&size=${size}`;
}
