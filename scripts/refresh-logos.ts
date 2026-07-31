/**
 * arthaX Production Logo Management System - Maintenance Job
 * Refreshes high-value brands and verifies logo validity.
 */

import { logoResolver } from "../src/lib/logo-engine/resolver";

const HIGH_VALUE_BRANDS = [
  "State Bank of India",
  "HDFC Bank",
  "ICICI Bank",
  "Axis Bank",
  "Kotak Mahindra",
  "Amazon Pay",
  "Google Pay",
  "PhonePe",
  "Paytm",
  "Swiggy",
  "Zomato",
  "Groww",
  "Zerodha",
  "LIC",
  "IRCTC",
];

async function runMaintenanceRefresh() {
  console.log("🚀 Starting arthaX Logo Maintenance Refresh Job...");

  let successCount = 0;
  for (const brand of HIGH_VALUE_BRANDS) {
    try {
      console.log(`[Refresh] Verifying brand: ${brand}`);
      const record = await logoResolver.resolve(brand, { forceRefresh: true });
      if (record) {
        console.log(`  ✓ Resolved domain: ${record.domain} via provider '${record.provider}'`);
        successCount++;
      }
    } catch (err: any) {
      console.error(`  ✗ Error refreshing ${brand}:`, err.message);
    }
  }

  console.log(`\n🎉 Maintenance Job Finished: ${successCount}/${HIGH_VALUE_BRANDS.length} brands verified & updated.`);
}

runMaintenanceRefresh().catch((err) => {
  console.error("Critical error in maintenance job:", err);
  process.exit(1);
});
