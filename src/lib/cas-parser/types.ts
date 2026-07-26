export type AssetClass = "mutual_fund" | "stock";

export interface CASParsedItem {
  id: string;
  assetClass: AssetClass;
  name: string;
  symbolOrSchemeCode?: string;
  folioNumber?: string;
  isin?: string;
  unitsOrQuantity: number;
  avgCost?: number;
  currentNavOrPrice: number;
  totalValuation: number;
  selected: boolean;
}

export interface CASParseResult {
  success: boolean;
  casType: string;
  statementPeriod?: string;
  items: CASParsedItem[];
  totalValuation: number;
  error?: string;
}
