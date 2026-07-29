/* eslint-disable no-console */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const banksDir = path.join(projectRoot, "public", "logos", "banks");
fs.mkdirSync(banksDir, { recursive: true });

const BANKS_TO_DOWNLOAD = [
  { id: "sbi", domain: "sbi.co.in", svg: "https://upload.wikimedia.org/wikipedia/commons/c/cc/State_Bank_of_India_logo.svg" },
  { id: "indianbank", domain: "indianbank.in", svg: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Indian_Bank_logo.svg/512px-Indian_Bank_logo.svg.png" },
  { id: "hdfc", domain: "hdfcbank.com", svg: "https://upload.wikimedia.org/wikipedia/commons/2/28/HDFC_Bank_Logo.svg" },
  { id: "icici", domain: "icicibank.com", svg: "https://upload.wikimedia.org/wikipedia/commons/1/12/ICICI_Bank_Logo.svg" },
  { id: "axis", domain: "axisbank.com", svg: "https://upload.wikimedia.org/wikipedia/commons/1/1a/Axis_Bank_logo.svg" },
  { id: "kotak", domain: "kotak.com", svg: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Kotak_Mahindra_Bank_logo.svg/512px-Kotak_Mahindra_Bank_logo.svg.png" },
  { id: "pnb", domain: "pnbindia.in" },
  { id: "bob", domain: "bankofbaroda.in" },
  { id: "canara", domain: "canarabank.com", svg: "https://upload.wikimedia.org/wikipedia/commons/5/50/Canara_Bank_Logo.svg" },
  { id: "unionbank", domain: "unionbankofindia.co.in", svg: "https://upload.wikimedia.org/wikipedia/commons/d/d0/Union_Bank_of_India_Logo.svg" },
  { id: "bankofindia", domain: "bankofindia.co.in" },
  { id: "centralbank", domain: "centralbankofindia.co.in" },
  { id: "iob", domain: "iob.in" },
  { id: "uco", domain: "ucobank.com" },
  { id: "bankofmaharashtra", domain: "bankofmaharashtra.in" },
  { id: "idfcfirst", domain: "idfcfirstbank.com" },
  { id: "yesbank", domain: "yesbank.in" },
  { id: "indusind", domain: "indusind.com" },
  { id: "federalbank", domain: "federalbank.co.in" },
  { id: "rbl", domain: "rblbank.com" },
  { id: "aubank", domain: "aubank.in" },
  { id: "idbi", domain: "idbibank.in" },
  { id: "bandhan", domain: "bandhanbank.com" },
];

async function downloadBank(bank) {
  const pngUrl = `https://www.google.com/s2/favicons?domain=${bank.domain}&sz=256`;
  const pngPath = path.join(banksDir, `${bank.id}.png`);
  
  try {
    const res = await fetch(pngUrl);
    if (res.ok) {
      const buffer = await res.arrayBuffer();
      fs.writeFileSync(pngPath, Buffer.from(buffer));
      console.log(`Saved ${bank.id}.png (${buffer.byteLength} bytes)`);
    }
  } catch (err) {
    console.error(`Failed ${pngUrl}:`, err.message);
  }

  if (bank.svg) {
    try {
      const svgRes = await fetch(bank.svg, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (svgRes.ok) {
        const text = await svgRes.text();
        if (text.includes("<svg") || text.includes("<PNG")) {
          const svgPath = path.join(banksDir, `${bank.id}.svg`);
          fs.writeFileSync(svgPath, text, "utf-8");
          console.log(`Saved ${bank.id}.svg (${text.length} bytes)`);
        }
      }
    } catch {}
  }
}

async function main() {
  console.log("Downloading Bank Logos...");
  for (const b of BANKS_TO_DOWNLOAD) {
    await downloadBank(b);
  }
  console.log("Bank logo download complete!");
}

main();
