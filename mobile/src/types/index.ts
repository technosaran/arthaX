export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: 'SAVINGS' | 'CURRENT' | 'CREDIT_CARD' | 'WALLET' | 'INVESTMENT' | 'LOAN';
  institution: string;
  account_number_mask?: string;
  current_balance: number;
  currency: string;
  is_active: boolean;
  color?: string;
  updated_at: string;
}

export interface CanonicalTransaction {
  id: string;
  user_id: string;
  account_id: string;
  account_name?: string;
  transaction_date: string;
  value_date?: string;
  amount: number;
  currency: string;
  direction: 'DEBIT' | 'CREDIT';
  original_narration: string;
  normalized_narration: string;
  clean_merchant?: string;
  upi_vpa?: string;
  category?: string;
  subcategory?: string;
  transaction_reference?: string;
  is_transfer?: boolean;
  notes?: string;
  tags?: string[];
}

export interface NetWorthSummary {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  liquidCash: number;
  investmentsTotal: number;
  creditOutstanding: number;
  currency: string;
  monthlySavingsRate?: number;
  monthlyBurnRate?: number;
  projectedRunwayDays?: number;
}

export interface InvestmentAsset {
  id: string;
  name: string;
  symbol?: string;
  assetClass: 'STOCKS' | 'MUTUAL_FUNDS' | 'GOLD_SILVER' | 'CRYPTO' | 'BONDS' | 'FNO';
  investedValue: number;
  currentValue: number;
  pnl: number;
  pnlPercentage: number;
  quantity?: number;
  lastUpdated: string;
}

export interface StockHolding {
  id: string;
  symbol: string;
  name: string;
  quantity: number;
  avgPrice: number;
  ltp: number;
  currentValue: number;
  totalPnl: number;
  pnlPercentage: number;
  dayChangePercentage: number;
}

export interface MutualFundHolding {
  id: string;
  fundName: string;
  amfiCode: string;
  investedValue: number;
  currentValue: number;
  pnl: number;
  xirr: number;
  nav: number;
  folioNumber: string;
}

export interface BullionRate {
  asset: 'GOLD_24K' | 'SILVER';
  name: string;
  pricePerUnit: number;
  unit: string;
  dayChange: number;
  dayChangePercentage: number;
}

export interface CryptoHolding {
  id: string;
  symbol: string;
  name: string;
  holdings: number;
  currentPrice: number;
  currentValue: number;
  avgBuyPrice: number;
  totalPnl: number;
  pnlPercentage: number;
  dayChangePercentage: number;
}

export interface BondHolding {
  id: string;
  name: string;
  issuer: string;
  bondType: 'GOVERNMENT' | 'CORPORATE' | 'SGB' | 'TAX_FREE';
  couponRate: number;
  investedAmount: number;
  currentValue: number;
  maturityDate: string;
  creditRating: string;
}

export interface FnoPosition {
  id: string;
  symbol: string;
  instrumentType: 'CE' | 'PE' | 'FUT';
  strikePrice: number;
  expiryDate: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  lots: number;
  avgPrice: number;
  ltp: number;
  pnl: number;
  pnlPercentage: number;
}

export interface SavingsGoal {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  category: 'EMERGENCY' | 'TRAVEL' | 'HOME' | 'RETIREMENT' | 'LUXURY';
  deadline: string;
}

export interface FinancialInsight {
  id: string;
  title: string;
  description: string;
  type: 'BILL' | 'ALERT' | 'GROWTH' | 'TAX';
  actionLabel?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  currency: string;
  avatar_url?: string;
  telegram_connected?: boolean;
  whatsapp_connected?: boolean;
  created_at: string;
}
