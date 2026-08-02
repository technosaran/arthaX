import { parseCASText } from "./cas-parser/cas-parser-engine";
import { CASParseResult } from "./cas-parser/types";

/**
 * Parses CAS text asynchronously on a background Web Worker thread.
 * Falls back seamlessly to synchronous parsing in SSR or environments without Worker support.
 */
export async function parseCASTextAsync(text: string): Promise<CASParseResult> {
  if (typeof window === "undefined" || !window.Worker) {
    return parseCASText(text);
  }

  return new Promise((resolve) => {
    try {
      const workerCode = `
        self.onmessage = (event) => {
          const { id, text } = event.data;
          try {
            const lines = text.split("\\n").map((l) => l.trim()).filter(Boolean);
            let casType = "Generic CAS";
            const lower = text.toLowerCase();
            if (lower.includes("cams") || lower.includes("computer age management")) casType = "CAMS CAS";
            else if (lower.includes("kfintech") || lower.includes("karvy")) casType = "KFintech CAS";
            else if (lower.includes("cdsl") || lower.includes("central depository")) casType = "CDSL CAS";
            else if (lower.includes("nsdl") || lower.includes("national securities depository")) casType = "NSDL CAS";

            const items = [];
            let itemCounter = 1;
            let totalValuation = 0;
            let currentFolio = "";

            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              const folioMatch = line.match(/folio\\s*(no|number)?\\s*[:.-]?\\s*([a-z0-9/]+)/i);
              if (folioMatch) {
                currentFolio = folioMatch[2];
              }

              const mfMatch = line.match(/^([A-Za-z0-9&()\\-\\s]+?(?:fund|index|growth|direct|regular|plan))\\s+([\\d,]+\\.\\d{2,4})\\s+([\\d,]+\\.\\d{2,4})\\s+([\\d,]+\\.\\d{2})/i);
              if (mfMatch) {
                const name = mfMatch[1].trim();
                const units = parseFloat(mfMatch[2].replace(/,/g, "")) || 0;
                const nav = parseFloat(mfMatch[3].replace(/,/g, "")) || 0;
                const val = parseFloat(mfMatch[4].replace(/,/g, "")) || units * nav;

                if (units > 0 && nav > 0) {
                  totalValuation += val;
                  items.push({
                    id: "cas-item-" + (itemCounter++),
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

            self.postMessage({ id, success: true, result: { casType, items, totalValuation, itemCount: items.length } });
          } catch (err) {
            self.postMessage({ id, success: false, error: err.message });
          }
        };
      `;

      const blob = new Blob([workerCode], { type: "application/javascript" });
      const workerUrl = URL.createObjectURL(blob);
      const worker = new Worker(workerUrl);

      const msgId = `msg-${Date.now()}-${Math.random()}`;

      worker.onmessage = (e: MessageEvent) => {
        const data = e.data;
        if (data.id === msgId) {
          worker.terminate();
          URL.revokeObjectURL(workerUrl);
          if (data.success) {
            resolve(data.result);
          } else {
            resolve(parseCASText(text));
          }
        }
      };

      worker.onerror = () => {
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
        resolve(parseCASText(text));
      };

      worker.postMessage({ id: msgId, text });
    } catch {
      resolve(parseCASText(text));
    }
  });
}
