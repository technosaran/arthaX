export type Bank = { name: string; domain: string };

// Bank registry mapping names to their official domains
// Used for logo resolution via multiple logo APIs
const BANKS: Bank[] = [
  // Major Public Sector Banks
  { name: "State Bank of India (SBI)",  domain: "sbi.co.in" },
  { name: "Punjab National Bank (PNB)", domain: "pnbindia.in" },
  { name: "Bank of Baroda (BOB)",       domain: "bankofbaroda.in" },
  { name: "Canara Bank",                domain: "canarabank.com" },
  { name: "Union Bank of India",        domain: "unionbankofindia.co.in" },
  { name: "Bank of India (BOI)",        domain: "bankofindia.co.in" },
  { name: "Indian Bank",                domain: "indianbank.in" },
  { name: "Central Bank of India",      domain: "centralbankofindia.co.in" },
  { name: "Indian Overseas Bank",       domain: "iob.in" },
  { name: "UCO Bank",                   domain: "ucobank.com" },
  { name: "Bank of Maharashtra",        domain: "bankofmaharashtra.in" },
  { name: "Punjab & Sind Bank",         domain: "punjabandsindbank.co.in" },

  // Major Private Sector Banks
  { name: "HDFC Bank",                  domain: "hdfcbank.com" },
  { name: "ICICI Bank",                 domain: "icicibank.com" },
  { name: "Axis Bank",                  domain: "axisbank.com" },
  { name: "Kotak Mahindra Bank",        domain: "kotak.com" },
  { name: "IndusInd Bank",              domain: "indusind.com" },
  { name: "Yes Bank",                   domain: "yesbank.in" },
  { name: "IDFC First Bank",            domain: "idfcfirstbank.com" },
  { name: "Federal Bank",               domain: "federalbank.co.in" },
  { name: "South Indian Bank",          domain: "southindianbank.com" },
  { name: "Karnataka Bank",             domain: "karnatakabank.com" },
  { name: "RBL Bank",                   domain: "rblbank.com" },
  { name: "Karur Vysya Bank",           domain: "kvb.co.in" },
  { name: "Bandhan Bank",               domain: "bandhanbank.com" },
  { name: "IDBI Bank",                  domain: "idbibank.in" },
  { name: "City Union Bank",            domain: "cityunionbank.com" },
  { name: "DCB Bank",                   domain: "dcbbank.com" },
  { name: "Tamilnad Mercantile Bank",   domain: "tmb.in" },
  { name: "J&K Bank",                   domain: "jkbank.com" },
  { name: "CSB Bank",                   domain: "csb.co.in" },
  { name: "Dhanlaxmi Bank",             domain: "dhanbank.com" },

  // International Banks (India Operations)
  { name: "HSBC India",                 domain: "hsbc.co.in" },
  { name: "Standard Chartered",         domain: "sc.com" },
  { name: "Citibank India",             domain: "citibank.co.in" },
  { name: "DBS Bank India",             domain: "dbs.com" },
  { name: "Deutsche Bank India",        domain: "db.com" },
  { name: "Barclays India",             domain: "barclays.com" },
  { name: "J.P. Morgan India",          domain: "jpmorgan.com" },

  // Small Finance & Payments Banks
  { name: "AU Small Finance Bank",      domain: "aubank.in" },
  { name: "Equitas Small Finance Bank", domain: "equitasbank.com" },
  { name: "Ujjivan Small Finance Bank", domain: "ujjivansfb.in" },
  { name: "ESAF Small Finance Bank",    domain: "esafbank.com" },
  { name: "Suryoday Small Finance Bank",domain: "suryodaybank.com" },
  { name: "Jana Small Finance Bank",    domain: "janabank.com" },
  { name: "Utkarsh Small Finance Bank", domain: "utkarshbank.in" },
  { name: "Capital Small Finance Bank", domain: "capitalbank.co.in" },
  { name: "Paytm Payments Bank",        domain: "paytm.com" },
  { name: "Airtel Payments Bank",       domain: "airtel.in" },
  { name: "Jio Payments Bank",          domain: "jio.com" },
  { name: "India Post Payments Bank",   domain: "ippbonline.com" },
  { name: "Fino Payments Bank",         domain: "finobank.com" },
  { name: "NSDL Payments Bank",         domain: "nsdlbank.com" },

  // Neo-Banks & Fintech
  { name: "Jupiter",                    domain: "jupiter.money" },
  { name: "Fi Money",                   domain: "fi.money" },
  { name: "Niyo",                       domain: "goniyo.com" },
  { name: "Slice",                      domain: "sliceit.com" },
  { name: "Uni Cards",                  domain: "uni.cards" },
  { name: "OneCard",                    domain: "getonecard.com" },
  { name: "FamPay",                     domain: "fampay.in" },
  { name: "Mobikwik",                   domain: "mobikwik.com" },
  { name: "PhonePe",                    domain: "phonepe.com" },
  { name: "Google Pay",                 domain: "pay.google.com" },
  { name: "Amazon Pay",                 domain: "amazon.in" },
  { name: "CRED",                       domain: "cred.club" },
  { name: "BharatPe",                   domain: "bharatpe.com" },
  { name: "Navi",                       domain: "navi.com" },

  // Investment Platforms
  { name: "Zerodha",                    domain: "zerodha.com" },
  { name: "Upstox",                     domain: "upstox.com" },
  { name: "Groww",                      domain: "groww.in" },
  { name: "Angel One",                  domain: "angelone.in" },
  { name: "Kuvera",                     domain: "kuvera.in" },
  { name: "Indmoney",                   domain: "indmoney.com" },
  { name: "ET Money",                   domain: "etmoney.com" },
  { name: "Smallcase",                  domain: "smallcase.com" },
  { name: "Wealthy",                    domain: "wealthy.in" },
  { name: "Paytm Money",               domain: "paytmmoney.com" },
  { name: "Coin by Zerodha",            domain: "zerodha.com" },
  
  // Cooperative & Regional Urban Banks
  { name: "Saraswat Bank",              domain: "saraswatbank.com" },
  { name: "Cosmos Bank",                domain: "cosmosbank.com" },
  { name: "TJSB Sahakari Bank",         domain: "tjsb.co.in" },
  { name: "SVC Cooperative Bank",       domain: "svcbank.com" },
  { name: "Abhyudaya Bank",             domain: "abhyudayabank.co.in" },
  { name: "NKGSB Bank",                 domain: "nkgsb.co.in" },
  { name: "Kalupur Bank",               domain: "kalupurbank.com" },
  { name: "Shamrao Vithal Bank",        domain: "svcbank.com" },

  // Credit Cards & BNPL
  { name: "LazyPay",                    domain: "lazypay.in" },
  { name: "Simpl",                      domain: "getsimpl.com" },
  { name: "Cashfree Payments",          domain: "cashfree.com" },
  { name: "Instamojo",                  domain: "instamojo.com" },
  { name: "Pine Labs",                  domain: "pinelabs.com" },
  { name: "PayU India",                 domain: "payu.in" },

  // Additional Investment & Trading Platforms
  { name: "Dhan",                       domain: "dhan.co" },
  { name: "5Paisa",                     domain: "5paisa.com" },
  { name: "Motilal Oswal",              domain: "motilaloswal.com" },
  { name: "Sharekhan",                  domain: "sharekhan.com" },
  { name: "ICICI Direct",               domain: "icicidirect.com" },
  { name: "HDFC Securities",            domain: "hdfcsec.com" },
  { name: "Kotak Securities",           domain: "kotaksecurities.com" },
  { name: "SBI Securities",             domain: "sbisecurities.in" },
  { name: "Axis Direct",                domain: "axisdirect.in" },
  { name: "IIFL Securities",            domain: "iifl.com" },
  { name: "Geojit Financial Services",  domain: "geojit.com" },
  { name: "Edelweiss Wealth",           domain: "edelweiss.in" },
  { name: "Scripbox",                   domain: "scripbox.com" },
  { name: "Vested Finance",             domain: "vestedfinance.com" },

  // Global Financial Institutions & Neo-Banks
  { name: "Barclays",                   domain: "barclays.com" },
  { name: "UBS",                        domain: "ubs.com" },
  { name: "Credit Suisse",              domain: "credit-suisse.com" },
  { name: "BNP Paribas",                domain: "bnpparibas.com" },
  { name: "Societe Generale",           domain: "societegenerale.com" },
  { name: "Fidelity Investments",       domain: "fidelity.com" },
  { name: "Vanguard",                   domain: "vanguard.com" },
  { name: "Charles Schwab",             domain: "schwab.com" },
  { name: "E*TRADE",                    domain: "etrade.com" },
  { name: "Webull",                     domain: "webull.com" },
  { name: "Interactive Brokers",        domain: "interactivebrokers.com" },
  { name: "N26",                        domain: "n26.com" },
  { name: "Monzo",                      domain: "monzo.com" },
  { name: "Starling Bank",              domain: "starlingbank.com" },
  { name: "Remitly",                    domain: "remitly.com" },

  { name: "Chase Bank",                 domain: "chase.com" },
  { name: "Bank of America",            domain: "bankofamerica.com" },
  { name: "Wells Fargo",                domain: "wellsfargo.com" },
  { name: "Capital One",                domain: "capitalone.com" },
  { name: "Morgan Stanley",             domain: "morganstanley.com" },
  { name: "Revolut",                    domain: "revolut.com" },
  { name: "Wise",                       domain: "wise.com" },
  { name: "PayPal",                     domain: "paypal.com" },
  { name: "Robinhood",                  domain: "robinhood.com" },
  { name: "Coinbase",                   domain: "coinbase.com" },
  { name: "Binance",                    domain: "binance.com" },
  { name: "SBI",                        domain: "sbi.co.in" },
  { name: "HDFC",                       domain: "hdfcbank.com" },
  { name: "ICICI",                      domain: "icicibank.com" },
];

const SHORTHAND_DOMAINS: Record<string, string> = {
  sbi: "sbi.co.in",
  "state bank": "sbi.co.in",
  "state bank of india": "sbi.co.in",
  hdfc: "hdfcbank.com",
  "hdfc bank": "hdfcbank.com",
  icici: "icicibank.com",
  "icici bank": "icicibank.com",
  axis: "axisbank.com",
  "axis bank": "axisbank.com",
  kotak: "kotak.com",
  "kotak bank": "kotak.com",
  "kotak mahindra": "kotak.com",
  "kotak mahindra bank": "kotak.com",
  pnb: "pnbindia.in",
  "punjab national bank": "pnbindia.in",
  bob: "bankofbaroda.in",
  baroda: "bankofbaroda.in",
  "bank of baroda": "bankofbaroda.in",
  canara: "canarabank.com",
  "canara bank": "canarabank.com",
  union: "unionbankofindia.co.in",
  "union bank": "unionbankofindia.co.in",
  "union bank of india": "unionbankofindia.co.in",
  boi: "bankofindia.co.in",
  "bank of india": "bankofindia.co.in",
  indianbank: "indianbank.in",
  "indian bank": "indianbank.in",
  cbi: "centralbankofindia.co.in",
  "central bank": "centralbankofindia.co.in",
  "central bank of india": "centralbankofindia.co.in",
  iob: "iob.in",
  "indian overseas bank": "iob.in",
  uco: "ucobank.com",
  "uco bank": "ucobank.com",
  bom: "bankofmaharashtra.in",
  "bank of maharashtra": "bankofmaharashtra.in",
  psb: "punjabandsindbank.co.in",
  "punjab & sind bank": "punjabandsindbank.co.in",
  idfc: "idfcfirstbank.com",
  "idfc first": "idfcfirstbank.com",
  "idfc bank": "idfcfirstbank.com",
  "idfc first bank": "idfcfirstbank.com",
  indusind: "indusind.com",
  "indusind bank": "indusind.com",
  yes: "yesbank.in",
  "yes bank": "yesbank.in",
  federal: "federalbank.co.in",
  "federal bank": "federalbank.co.in",
  rbl: "rblbank.com",
  "rbl bank": "rblbank.com",
  sib: "southindianbank.com",
  "south indian bank": "southindianbank.com",
  karnataka: "karnatakabank.com",
  "karnataka bank": "karnatakabank.com",
  kvb: "kvb.co.in",
  "karur vysya bank": "kvb.co.in",
  bandhan: "bandhanbank.com",
  "bandhan bank": "bandhanbank.com",
  idbi: "idbibank.in",
  "idbi bank": "idbibank.in",
  cub: "cityunionbank.com",
  "city union bank": "cityunionbank.com",
  dcb: "dcbbank.com",
  "dcb bank": "dcbbank.com",
  tmb: "tmb.in",
  "tamilnad mercantile bank": "tmb.in",
  au: "aubank.in",
  "au bank": "aubank.in",
  "au small finance bank": "aubank.in",
  equitas: "equitasbank.com",
  "equitas small finance bank": "equitasbank.com",
  ujjivan: "ujjivansfb.in",
  "ujjivan small finance bank": "ujjivansfb.in",
  hsbc: "hsbc.co.in",
  "hsbc bank": "hsbc.co.in",
  "hsbc india": "hsbc.co.in",
  "standard chartered": "sc.com",
  citi: "citibank.co.in",
  citibank: "citibank.co.in",
  "citibank india": "citibank.co.in",
  dbs: "dbs.com",
  "dbs bank": "dbs.com",
  chase: "chase.com",
  bofa: "bankofamerica.com",
  "bank of america": "bankofamerica.com",
  wellsfargo: "wellsfargo.com",
  "wells fargo": "wellsfargo.com",
  capitalone: "capitalone.com",
  "capital one": "capitalone.com",
  revolut: "revolut.com",
  wise: "wise.com",
  paypal: "paypal.com",
  paytm: "paytm.com",
  phonepe: "phonepe.com",
  gpay: "pay.google.com",
  cred: "cred.club",
  zerodha: "zerodha.com",
  coin: "zerodha.com",
  "coin by zerodha": "zerodha.com",
  ippb: "ippbonline.com",
  "india post": "ippbonline.com",
  "india post payments bank": "ippbonline.com",
  groww: "groww.in",
  upstox: "upstox.com",
  angelone: "angelone.in",
  binance: "binance.com",
  coinbase: "coinbase.com",
};

import { getFastLogoCandidateUrls } from "./logo-cache";

const HD_BANK_LOGOS: Record<string, string[]> = {
  "sbi.co.in": [
    "https://upload.wikimedia.org/wikipedia/commons/c/cc/SBI-Logo.svg",
    "https://cdn.simpleicons.org/statebankofindia",
    "https://www.google.com/s2/favicons?domain=sbi.co.in&sz=256",
  ],
  "indianbank.in": [
    "https://upload.wikimedia.org/wikipedia/commons/0/02/Indian_Bank_logo.svg",
    "https://www.google.com/s2/favicons?domain=indianbank.in&sz=256",
  ],
  "bankofindia.co.in": [
    "https://upload.wikimedia.org/wikipedia/commons/6/68/Bank_of_India_logo.svg",
    "https://www.google.com/s2/favicons?domain=bankofindia.co.in&sz=256",
  ],
  "rblbank.com": [
    "https://upload.wikimedia.org/wikipedia/commons/0/07/RBL_Bank_Logo.svg",
    "https://www.google.com/s2/favicons?domain=rblbank.com&sz=256",
  ],
  "centralbankofindia.co.in": [
    "https://upload.wikimedia.org/wikipedia/commons/5/53/Central_Bank_of_India_logo.svg",
    "https://www.google.com/s2/favicons?domain=centralbankofindia.co.in&sz=256",
  ],
  "iob.in": [
    "https://upload.wikimedia.org/wikipedia/commons/3/36/Indian_Overseas_Bank_Logo.svg",
    "https://www.google.com/s2/favicons?domain=iob.in&sz=256",
  ],
  "iob.co.in": [
    "https://upload.wikimedia.org/wikipedia/commons/3/36/Indian_Overseas_Bank_Logo.svg",
    "https://www.google.com/s2/favicons?domain=iob.co.in&sz=256",
  ],
  "ucobank.com": [
    "https://upload.wikimedia.org/wikipedia/commons/d/df/UCO_Bank_Logo.svg",
    "https://www.google.com/s2/favicons?domain=ucobank.com&sz=256",
  ],
  "bankofmaharashtra.in": [
    "https://upload.wikimedia.org/wikipedia/commons/d/d4/Bank_of_Maharashtra_logo.svg",
    "https://www.google.com/s2/favicons?domain=bankofmaharashtra.in&sz=256",
  ],
  "punjabandsindbank.co.in": [
    "https://upload.wikimedia.org/wikipedia/commons/3/3a/Punjab_%26_Sind_Bank_logo.svg",
    "https://www.google.com/s2/favicons?domain=punjabandsindbank.co.in&sz=256",
  ],
  "southindianbank.com": [
    "https://upload.wikimedia.org/wikipedia/commons/7/7b/South_Indian_Bank_Logo.svg",
    "https://www.google.com/s2/favicons?domain=southindianbank.com&sz=256",
  ],
  "karnatakabank.com": [
    "https://upload.wikimedia.org/wikipedia/commons/b/b8/Karnataka_Bank_Logo.svg",
    "https://www.google.com/s2/favicons?domain=karnatakabank.com&sz=256",
  ],
  "kvb.co.in": [
    "https://upload.wikimedia.org/wikipedia/commons/7/7e/Karur_Vysya_Bank_logo.svg",
    "https://www.google.com/s2/favicons?domain=kvb.co.in&sz=256",
  ],
  "bandhanbank.com": [
    "https://upload.wikimedia.org/wikipedia/commons/8/87/Bandhan_Bank_logo.svg",
    "https://www.google.com/s2/favicons?domain=bandhanbank.com&sz=256",
  ],
  "idbibank.in": [
    "https://upload.wikimedia.org/wikipedia/commons/a/a2/IDBI_Bank_logo.svg",
    "https://www.google.com/s2/favicons?domain=idbibank.in&sz=256",
  ],
  "cityunionbank.com": [
    "https://upload.wikimedia.org/wikipedia/commons/3/30/City_Union_Bank_Logo.svg",
    "https://www.google.com/s2/favicons?domain=cityunionbank.com&sz=256",
  ],
  "dcbbank.com": [
    "https://upload.wikimedia.org/wikipedia/commons/0/07/DCB_Bank_logo.svg",
    "https://www.google.com/s2/favicons?domain=dcbbank.com&sz=256",
  ],
  "aubank.in": [
    "https://upload.wikimedia.org/wikipedia/commons/8/80/AU_Small_Finance_Bank_logo.svg",
    "https://www.google.com/s2/favicons?domain=aubank.in&sz=256",
  ],
  "equitasbank.com": [
    "https://upload.wikimedia.org/wikipedia/commons/c/c5/Equitas_Small_Finance_Bank_logo.svg",
    "https://www.google.com/s2/favicons?domain=equitasbank.com&sz=256",
  ],
  "ujjivansfb.in": [
    "https://upload.wikimedia.org/wikipedia/commons/e/e0/Ujjivan_Small_Finance_Bank_logo.svg",
    "https://www.google.com/s2/favicons?domain=ujjivansfb.in&sz=256",
  ],
  "ippbonline.com": [
    "https://upload.wikimedia.org/wikipedia/commons/e/e0/India_Post_Payments_Bank_logo.svg",
    "https://www.google.com/s2/favicons?domain=ippbonline.com&sz=256",
  ],
  "hdfcbank.com": [
    "https://upload.wikimedia.org/wikipedia/commons/2/28/HDFC_Bank_Logo.svg",
    "https://www.google.com/s2/favicons?domain=hdfcbank.com&sz=256",
  ],
  "icicibank.com": [
    "https://upload.wikimedia.org/wikipedia/commons/1/12/ICICI_Bank_Logo.svg",
    "https://www.google.com/s2/favicons?domain=icicibank.com&sz=256",
  ],
  "axisbank.com": [
    "https://upload.wikimedia.org/wikipedia/commons/1/1a/Axis_Bank_logo.svg",
    "https://www.google.com/s2/favicons?domain=axisbank.com&sz=256",
  ],
  "kotak.com": [
    "https://upload.wikimedia.org/wikipedia/commons/6/6b/Kotak_Mahindra_Bank_logo.svg",
    "https://www.google.com/s2/favicons?domain=kotak.com&sz=256",
  ],
  "pnbindia.in": [
    "https://upload.wikimedia.org/wikipedia/commons/4/4b/Punjab_National_Bank_Logo.svg",
    "https://www.google.com/s2/favicons?domain=pnbindia.in&sz=256",
  ],
  "bankofbaroda.in": [
    "https://upload.wikimedia.org/wikipedia/commons/7/7b/Bank_of_Baroda_logo.svg",
    "https://www.google.com/s2/favicons?domain=bankofbaroda.in&sz=256",
  ],
  "canarabank.com": [
    "https://upload.wikimedia.org/wikipedia/commons/2/2a/Canara_Bank_Logo.svg",
    "https://www.google.com/s2/favicons?domain=canarabank.com&sz=256",
  ],
  "unionbankofindia.co.in": [
    "https://upload.wikimedia.org/wikipedia/commons/0/05/Union_Bank_of_India_Logo.svg",
    "https://www.google.com/s2/favicons?domain=unionbankofindia.co.in&sz=256",
  ],
  "idfcfirstbank.com": [
    "https://upload.wikimedia.org/wikipedia/commons/2/29/IDFC_First_Bank_logo.svg",
    "https://www.google.com/s2/favicons?domain=idfcfirstbank.com&sz=256",
  ],
  "indusind.com": [
    "https://upload.wikimedia.org/wikipedia/commons/8/82/IndusInd_Bank_logo.svg",
    "https://www.google.com/s2/favicons?domain=indusind.com&sz=256",
  ],
  "yesbank.in": [
    "https://upload.wikimedia.org/wikipedia/commons/4/49/Yes_Bank_Logo.svg",
    "https://www.google.com/s2/favicons?domain=yesbank.in&sz=256",
  ],
  "federalbank.co.in": [
    "https://upload.wikimedia.org/wikipedia/commons/2/27/Federal_Bank_Logo.svg",
    "https://www.google.com/s2/favicons?domain=federalbank.co.in&sz=256",
  ],
  "paytmbank.com": [
    "https://upload.wikimedia.org/wikipedia/commons/2/24/Paytm_Logo.svg",
    "https://cdn.simpleicons.org/paytm",
    "https://www.google.com/s2/favicons?domain=paytm.com&sz=256",
  ],
  "paytm.com": [
    "https://upload.wikimedia.org/wikipedia/commons/2/24/Paytm_Logo.svg",
    "https://cdn.simpleicons.org/paytm",
    "https://www.google.com/s2/favicons?domain=paytm.com&sz=256",
  ],
  "phonepe.com": [
    "https://upload.wikimedia.org/wikipedia/commons/7/71/PhonePe_Logo.svg",
    "https://cdn.simpleicons.org/phonepe",
    "https://www.google.com/s2/favicons?domain=phonepe.com&sz=256",
  ],
  "cred.club": [
    "https://upload.wikimedia.org/wikipedia/commons/8/87/CRED_logo.svg",
    "https://www.google.com/s2/favicons?domain=cred.club&sz=256",
  ],
  "zerodha.com": [
    "https://upload.wikimedia.org/wikipedia/commons/3/30/Zerodha_logo.svg",
    "https://www.google.com/s2/favicons?domain=zerodha.com&sz=256",
  ],
  "groww.in": [
    "https://upload.wikimedia.org/wikipedia/commons/b/b8/Groww_Logo.svg",
    "https://www.google.com/s2/favicons?domain=groww.in&sz=256",
  ],
  "hsbc.co.in": [
    "https://upload.wikimedia.org/wikipedia/commons/a/aa/HSBC_logo_%282018%29.svg",
    "https://cdn.simpleicons.org/hsbc",
  ],
  "sc.com": [
    "https://upload.wikimedia.org/wikipedia/commons/a/a0/Standard_Chartered_logo.svg",
    "https://cdn.simpleicons.org/standardchartered",
  ],
  "citibank.co.in": [
    "https://upload.wikimedia.org/wikipedia/commons/1/1b/Citibank.svg",
    "https://cdn.simpleicons.org/citibank",
  ],
  "dbs.com": [
    "https://upload.wikimedia.org/wikipedia/commons/a/a4/DBS_Bank_logo.svg",
  ],
  "chase.com": [
    "https://upload.wikimedia.org/wikipedia/commons/a/a4/Chase_logo.svg",
    "https://cdn.simpleicons.org/chase",
  ],
  "bankofamerica.com": [
    "https://upload.wikimedia.org/wikipedia/commons/2/20/Bank_of_America_logo.svg",
    "https://cdn.simpleicons.org/bankofamerica",
  ],
  "wise.com": [
    "https://upload.wikimedia.org/wikipedia/commons/9/94/Wise_Logo.svg",
    "https://cdn.simpleicons.org/wise",
  ],
  "revolut.com": [
    "https://upload.wikimedia.org/wikipedia/commons/c/c5/Revolut_logo.svg",
    "https://cdn.simpleicons.org/revolut",
  ],
  "paypal.com": [
    "https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg",
    "https://cdn.simpleicons.org/paypal",
  ],
  "pay.google.com": [
    "https://upload.wikimedia.org/wikipedia/commons/f/f2/Google_Pay_Logo.svg",
    "https://cdn.simpleicons.org/googlepay",
    "https://www.google.com/s2/favicons?domain=pay.google.com&sz=256",
  ],
  "jupiter.money": [
    "https://www.google.com/s2/favicons?domain=jupiter.money&sz=256",
  ],
  "fi.money": [
    "https://www.google.com/s2/favicons?domain=fi.money&sz=256",
  ],
  "upstox.com": [
    "https://www.google.com/s2/favicons?domain=upstox.com&sz=256",
  ],
  "angelone.in": [
    "https://www.google.com/s2/favicons?domain=angelone.in&sz=256",
  ],
};

export function getBankLogoUrls(domain: string): string[] {
  if (!domain) return [];
  const clean = domain.trim().toLowerCase();
  const curated = HD_BANK_LOGOS[clean] || [];
  const defaults = getFastLogoCandidateUrls(clean);
  return Array.from(new Set([...curated, ...defaults]));
}

/**
 * Get the domain registered for a bank name or account title
 */
export function getBankDomain(bankName: string): string | null {
  if (!bankName) return null;
  const raw = bankName.trim();

  // 0. Direct match if input already contains a domain (e.g. "sbi.co.in", "hdfcbank.com", "chase.com")
  const domainRegex = /\b([a-z0-9\-]+\.(?:co\.in|com|in|co|io|ai|org|net|tech|app|dev|club|money))\b/i;
  const directMatch = raw.match(domainRegex);
  if (directMatch) {
    return directMatch[1].toLowerCase();
  }

  const normalizedSearch = raw.toLowerCase().trim();

  // 0B. Direct shorthand override
  if (SHORTHAND_DOMAINS[normalizedSearch]) {
    return SHORTHAND_DOMAINS[normalizedSearch];
  }

  // Helper to get clean bank name without parenthetical acronyms (e.g. "State Bank of India (SBI)" -> "state bank of india")
  const cleanBankName = (bName: string) => bName.replace(/\s*\([^)]*\)/g, "").toLowerCase().trim();

  // 1. Exact match against full name or clean name without parentheticals
  let bank = BANKS.find((b) => b.name.toLowerCase() === normalizedSearch || cleanBankName(b.name) === normalizedSearch);
  
  // 2. Acronym match (e.g., matching "SBI" in "State Bank of India (SBI)")
  if (!bank) {
    bank = BANKS.find((b) => {
      const match = b.name.match(/\(([^)]+)\)/);
      return match && match[1].toLowerCase() === normalizedSearch;
    });
  }

  // 3. Exact clean name match
  if (!bank) {
    bank = BANKS.find((b) => cleanBankName(b.name) === normalizedSearch);
  }

  // 4. Token-based word match (e.g. "My SBI Salary" -> matches "sbi" in SHORTHAND_DOMAINS or BANKS)
  if (!bank) {
    const tokens = normalizedSearch.split(/[\s\-_\/]+/);
    for (const token of tokens) {
      if (token.length >= 2 && SHORTHAND_DOMAINS[token]) {
        return SHORTHAND_DOMAINS[token];
      }
      const matched = BANKS.find((b) => {
        const clean = cleanBankName(b.name);
        return clean === token || clean.split(" ")[0] === token;
      });
      if (matched) return matched.domain;
    }
  }

  // 5. Substring match with length closeness sorting to prevent matching "State Bank of India" when query is "Bank of India"
  if (!bank) {
    const candidates = BANKS.filter((b) => {
      const clean = cleanBankName(b.name);
      return clean.includes(normalizedSearch) || normalizedSearch.includes(clean);
    });

    if (candidates.length > 0) {
      candidates.sort((a, b) => {
        const cleanA = cleanBankName(a.name);
        const cleanB = cleanBankName(b.name);
        const diffA = Math.abs(cleanA.length - normalizedSearch.length);
        const diffB = Math.abs(cleanB.length - normalizedSearch.length);
        return diffA - diffB;
      });
      bank = candidates[0];
    }
  }

  if (bank) return bank.domain;

  // 6. Fallback candidate (e.g. "Axis Savings" -> "axisbank.com" or "axis.com")
  const cleanWord = normalizedSearch
    .replace(/\b(bank|checking|savings|account|wallet|card|primary|personal|business)\b/g, "")
    .trim()
    .split(/\s+/)[0]
    .replace(/[^a-z0-9]/g, "");

  if (cleanWord.length >= 3) {
    if (SHORTHAND_DOMAINS[cleanWord]) return SHORTHAND_DOMAINS[cleanWord];
    return `${cleanWord}.com`;
  }

  return null;
}

export function searchBanks(query: string): Bank[] {
  if (!query.trim()) return BANKS.slice(0, 15); // Show popular banks by default
  const q = query.toLowerCase();
  const cleanBankName = (name: string) => name.replace(/\s*\([^)]*\)/g, "").toLowerCase().trim();
  const acronymFor = (name: string) => name.match(/\(([^)]+)\)/)?.[1]?.toLowerCase() || "";
  const scoreBank = (bank: Bank) => {
    const name = bank.name.toLowerCase();
    const clean = cleanBankName(bank.name);
    const acronym = acronymFor(bank.name);

    if (name === q || clean === q || acronym === q) return 0;
    if (SHORTHAND_DOMAINS[q] === bank.domain) return 1;
    if (name.startsWith(q) || clean.startsWith(q)) return 2;
    if (acronym.startsWith(q)) return 3;
    if (name.includes(q) || clean.includes(q)) return 4;
    return 5;
  };
  
  // Sort by priority and match quality
  return BANKS.filter((b) => {
    const name = b.name.toLowerCase();
    const clean = cleanBankName(b.name);
    const acronym = acronymFor(b.name);
    return (
      name.includes(q) ||
      clean.includes(q) ||
      acronym.includes(q) ||
      SHORTHAND_DOMAINS[q] === b.domain ||
      q.includes(clean.split(" ")[0])
    );
  })
  .sort((a, b) => {
    const scoreDiff = scoreBank(a) - scoreBank(b);
    if (scoreDiff !== 0) return scoreDiff;
    return a.name.localeCompare(b.name);
  })
  .slice(0, 12);
}


