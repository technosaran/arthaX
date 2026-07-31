/**
 * Background Web Worker for Statement & CAS Parsing.
 * Runs on a separate thread to keep the main UI at 120 FPS.
 */

// Listener for worker messages
self.onmessage = (event: MessageEvent<{ id: string; type: "parse_cas" | "parse_bank"; text: string }>) => {
  const { id, type, text } = event.data;

  try {
    if (type === "parse_cas") {
      const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
      let casType = "Generic CAS";
      const lower = text.toLowerCase();
      if (lower.includes("cams") || lower.includes("computer age management")) casType = "CAMS CAS";
      else if (lower.includes("kfintech") || lower.includes("karvy")) casType = "KFintech CAS";
      else if (lower.includes("cdsl") || lower.includes("central depository")) casType = "CDSL CAS";
      else if (lower.includes("nsdl") || lower.includes("national securities depository")) casType = "NSDL CAS";

      const items: any[] = [];
      let itemCounter = 1;
      let totalValuation = 0;
      let currentFolio = "";

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const folioMatch = line.match(/folio\s*(no|number)?\s*[:.-]?\s*([a-z0-9/]+)/i);
        if (folioMatch) {
          currentFolio = folioMatch[2];
        }

        const mfMatch = line.match(/^([A-Za-z0-9&()\-\s]+?(?:fund|index|growth|direct|regular|plan))\s+([\d,]+\.\d{2,4})\s+([\d,]+\.\d{2,4})\s+([\d,]+\.\d{2})/i);
        if (mfMatch) {
          const name = mfMatch[1].trim();
          const units = parseFloat(mfMatch[2].replace(/,/g, "")) || 0;
          const nav = parseFloat(mfMatch[3].replace(/,/g, "")) || 0;
          const val = parseFloat(mfMatch[4].replace(/,/g, "")) || units * nav;

          if (units > 0 && nav > 0) {
            totalValuation += val;
            items.push({
              id: `cas-item-${itemCounter++}`,
              assetClass: "mutual_fund",
              name,
              folioNumber: currentFolio || undefined,
              unitsOrQuantity: units,
              currentNavOrPrice: nav,
              totalValuation: val,
              selected: true,
            });
          }
        }
      }

      self.postMessage({
        id,
        success: true,
        result: { casType, items, totalValuation, itemCount: items.length },
      });
    }
  } catch (err: any) {
    self.postMessage({ id, success: false, error: err.message || "Failed to parse in worker thread" });
  }
};
