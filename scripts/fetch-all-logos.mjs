/* eslint-disable no-console */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const banksDir = path.join(projectRoot, "public", "logos", "banks");
const companiesDir = path.join(projectRoot, "public", "logos", "companies");

fs.mkdirSync(banksDir, { recursive: true });
fs.mkdirSync(companiesDir, { recursive: true });

const BANK_LOGOS = [
  { file: "sbi.svg", urls: ["https://cdn.jsdelivr.net/gh/praveenpuglia/indian-banks@master/assets/logos/sbi.svg"] },
  { file: "indianbank.svg", urls: ["https://cdn.jsdelivr.net/gh/praveenpuglia/indian-banks@master/assets/logos/idib.svg"] },
  { file: "hdfc.svg", urls: ["https://cdn.jsdelivr.net/gh/praveenpuglia/indian-banks@master/assets/logos/hdfc.svg"] },
  { file: "icici.svg", urls: ["https://cdn.jsdelivr.net/gh/praveenpuglia/indian-banks@master/assets/logos/icici.svg"] },
  { file: "axis.svg", urls: ["https://cdn.jsdelivr.net/gh/praveenpuglia/indian-banks@master/assets/logos/axis.svg"] },
  { file: "kotak.svg", urls: ["https://cdn.jsdelivr.net/gh/praveenpuglia/indian-banks@master/assets/logos/kotak.svg"] },
  { file: "pnb.svg", urls: ["https://cdn.jsdelivr.net/gh/praveenpuglia/indian-banks@master/assets/logos/pnb.svg"] },
  { file: "bob.svg", urls: ["https://cdn.jsdelivr.net/gh/praveenpuglia/indian-banks@master/assets/logos/bob.svg"] },
  { file: "canara.svg", urls: ["https://cdn.jsdelivr.net/gh/praveenpuglia/indian-banks@master/assets/logos/cnrb.svg"] },
  { file: "unionbank.svg", urls: ["https://cdn.jsdelivr.net/gh/praveenpuglia/indian-banks@master/assets/logos/ubin.svg"] },
  { file: "bankofindia.svg", urls: ["https://cdn.jsdelivr.net/gh/praveenpuglia/indian-banks@master/assets/logos/bkid.svg"] },
  { file: "centralbank.svg", urls: ["https://cdn.jsdelivr.net/gh/praveenpuglia/indian-banks@master/assets/logos/cbin.svg"] },
  { file: "iob.svg", urls: ["https://cdn.jsdelivr.net/gh/praveenpuglia/indian-banks@master/assets/logos/ioba.svg"] },
  { file: "uco.svg", urls: ["https://cdn.jsdelivr.net/gh/praveenpuglia/indian-banks@master/assets/logos/ucba.svg"] },
  { file: "bankofmaharashtra.svg", urls: ["https://cdn.jsdelivr.net/gh/praveenpuglia/indian-banks@master/assets/logos/mahb.svg"] },
  { file: "idfcfirst.svg", urls: ["https://cdn.jsdelivr.net/gh/praveenpuglia/indian-banks@master/assets/logos/idfb.svg"] },
  { file: "yesbank.svg", urls: ["https://cdn.jsdelivr.net/gh/praveenpuglia/indian-banks@master/assets/logos/yesb.svg"] },
  { file: "indusind.svg", urls: ["https://cdn.jsdelivr.net/gh/praveenpuglia/indian-banks@master/assets/logos/indb.svg"] },
  { file: "federalbank.svg", urls: ["https://cdn.jsdelivr.net/gh/praveenpuglia/indian-banks@master/assets/logos/fdrl.svg"] },
  { file: "rbl.svg", urls: ["https://cdn.jsdelivr.net/gh/praveenpuglia/indian-banks@master/assets/logos/ratn.svg"] },
  { file: "chase.svg", urls: ["https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/chase.svg"] },
  { file: "bofa.svg", urls: ["https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/bankofamerica.svg"] },
  { file: "wellsfargo.svg", urls: ["https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/wellsfargo.svg"] },
  { file: "hsbc.svg", urls: ["https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/hsbc.svg"] },
  { file: "revolut.svg", urls: ["https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/revolut.svg"] },
  { file: "wise.svg", urls: ["https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/wise.svg"] },
  { file: "paytm.svg", urls: ["https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/paytm.svg"] },
  { file: "phonepe.svg", urls: ["https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/phonepe.svg"] },
];

const COMPANY_LOGOS = [
  { file: "salesforce.svg", urls: ["https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/salesforce.svg"] },
  { file: "google.svg", urls: ["https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/google.svg"] },
  { file: "zoom.svg", urls: ["https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/zoom.svg"] },
  { file: "fiverr.svg", urls: ["https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/fiverr.svg"] },
  { file: "infosys.svg", urls: ["https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/infosys.svg"] },
  { file: "tcs.svg", urls: ["https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/tata.svg"] },
  { file: "tata.svg", urls: ["https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/tata.svg"] },
  { file: "swiggy.svg", urls: ["https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/swiggy.svg"] },
  { file: "zomato.svg", urls: ["https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/zomato.svg"] },
  { file: "stripe.svg", urls: ["https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/stripe.svg"] },
  { file: "upwork.svg", urls: ["https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/upwork.svg"] },
  { file: "microsoft.svg", urls: ["https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/microsoft.svg"] },
  { file: "apple.svg", urls: ["https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/apple.svg"] },
  { file: "amazon.svg", urls: ["https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/amazon.svg"] },
  { file: "meta.svg", urls: ["https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/meta.svg"] },
  { file: "facebook.svg", urls: ["https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/facebook.svg"] },
  { file: "netflix.svg", urls: ["https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/netflix.svg"] },
  { file: "uber.svg", urls: ["https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/uber.svg"] },
  { file: "linkedin.svg", urls: ["https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/linkedin.svg"] },
  { file: "atlassian.svg", urls: ["https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/atlassian.svg"] },
  { file: "github.svg", urls: ["https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/github.svg"] },
  { file: "gitlab.svg", urls: ["https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/gitlab.svg"] },
  { file: "adobe.svg", urls: ["https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/adobe.svg"] },
  { file: "razorpay.svg", urls: ["https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/razorpay.svg"] },
  { file: "wipro.svg", urls: ["https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/wipro.svg"] },
  { file: "accenture.svg", urls: ["https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/accenture.svg"] },
  { file: "cognizant.svg", urls: ["https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/cognizant.svg"] },
  { file: "oracle.svg", urls: ["https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/oracle.svg"] },
  { file: "ibm.svg", urls: ["https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/ibm.svg"] },
];

async function downloadFile(item, targetDir) {
  const filePath = path.join(targetDir, item.file);
  for (const url of item.urls) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const content = await res.text();
        if (content.includes("<svg") || content.includes("xml")) {
          fs.writeFileSync(filePath, content, "utf-8");
          console.log(`Saved ${item.file} (${content.length} bytes)`);
          return true;
        }
      }
    } catch (err) {
      console.error(`Failed ${url}:`, err.message);
    }
  }
  return false;
}

async function main() {
  console.log("Downloading Bank Logos...");
  for (const b of BANK_LOGOS) {
    await downloadFile(b, banksDir);
  }

  console.log("Downloading Company Logos...");
  for (const c of COMPANY_LOGOS) {
    await downloadFile(c, companiesDir);
  }

  console.log("All logo downloads completed!");
}

main();
