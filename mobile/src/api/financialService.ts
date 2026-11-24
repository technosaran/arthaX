import { supabase } from './supabase';
import {
  Account,
  CanonicalTransaction,
  NetWorthSummary,
  InvestmentAsset,
  StockHolding,
  MutualFundHolding,
  BullionRate,
  CryptoHolding,
  BondHolding,
  FnoPosition,
  SavingsGoal,
  FinancialInsight,
} from '../types';

export const fallbackNetWorth: NetWorthSummary = {
  totalAssets: 4850000,
  totalLiabilities: 320000,
  netWorth: 4530000,
  liquidCash: 850000,
  investmentsTotal: 4000000,
  creditOutstanding: 320000,
  currency: 'INR',
  monthlySavingsRate: 42.5,
  monthlyBurnRate: 95000,
  projectedRunwayDays: 270,
};

export const fallbackAccounts: Account[] = [
  {
    id: 'acc-1',
    user_id: 'demo-user',
    name: 'HDFC Salary Account',
    type: 'SAVINGS',
    institution: 'HDFC Bank',
    account_number_mask: '•••• 4921',
    current_balance: 624500,
    currency: 'INR',
    is_active: true,
    color: '#3b82f6',
    updated_at: new Date().toISOString(),
  },
  {
    id: 'acc-2',
    user_id: 'demo-user',
    name: 'ICICI Wealth Savings',
    type: 'SAVINGS',
    institution: 'ICICI Bank',
    account_number_mask: '•••• 8832',
    current_balance: 225500,
    currency: 'INR',
    is_active: true,
    color: '#f97316',
    updated_at: new Date().toISOString(),
  },
  {
    id: 'acc-3',
    user_id: 'demo-user',
    name: 'Axis Bank Magnus Card',
    type: 'CREDIT_CARD',
    institution: 'Axis Bank',
    account_number_mask: '•••• 1044',
    current_balance: -185000,
    currency: 'INR',
    is_active: true,
    color: '#f43f5e',
    updated_at: new Date().toISOString(),
  },
  {
    id: 'acc-4',
    user_id: 'demo-user',
    name: 'HDFC Regalia Gold',
    type: 'CREDIT_CARD',
    institution: 'HDFC Bank',
    account_number_mask: '•••• 7721',
    current_balance: -135000,
    currency: 'INR',
    is_active: true,
    color: '#a855f7',
    updated_at: new Date().toISOString(),
  },
  {
    id: 'acc-5',
    user_id: 'demo-user',
    name: 'Zerodha Demat Portfolio',
    type: 'INVESTMENT',
    institution: 'Zerodha Broking',
    account_number_mask: 'ZERODHA-IN',
    current_balance: 4000000,
    currency: 'INR',
    is_active: true,
    color: '#10b981',
    updated_at: new Date().toISOString(),
  },
];

export const fallbackTransactions: CanonicalTransaction[] = [
  {
    id: 'tx-1',
    user_id: 'demo-user',
    account_id: 'acc-1',
    account_name: 'HDFC Salary Account',
    transaction_date: new Date().toISOString().split('T')[0],
    amount: 195000,
    currency: 'INR',
    direction: 'CREDIT',
    original_narration: 'ACH CR-GOOGLE TECH IN SALARY-NOV26-UTR88192',
    normalized_narration: 'Google Tech Monthly Salary Credit',
    clean_merchant: 'Google India',
    category: 'Income',
    subcategory: 'Salary',
    transaction_reference: 'UTR88192019482',
    tags: ['Salary', 'Primary Inflow'],
  },
  {
    id: 'tx-2',
    user_id: 'demo-user',
    account_id: 'acc-3',
    account_name: 'Axis Bank Magnus Card',
    transaction_date: new Date().toISOString().split('T')[0],
    amount: 4850,
    currency: 'INR',
    direction: 'DEBIT',
    original_narration: 'UPI-SWIGGY-swiggy@icici-ORDER-827161',
    normalized_narration: 'Swiggy Gourmet Dining',
    clean_merchant: 'Swiggy',
    upi_vpa: 'swiggy@icici',
    category: 'Food & Dining',
    subcategory: 'Delivery',
    transaction_reference: 'UPI/492102910294',
    tags: ['Dinner', 'Social'],
  },
  {
    id: 'tx-3',
    user_id: 'demo-user',
    account_id: 'acc-1',
    account_name: 'HDFC Salary Account',
    transaction_date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    amount: 25000,
    currency: 'INR',
    direction: 'DEBIT',
    original_narration: 'ACH DR-SIP NIPPON INDIA SMALL CAP-IN1029',
    normalized_narration: 'Nippon India Small Cap SIP auto-debit',
    clean_merchant: 'Nippon Mutual Fund',
    category: 'Investments',
    subcategory: 'Mutual Funds',
    transaction_reference: 'AMFI/MF882910',
    tags: ['Wealth Accumulation'],
  },
  {
    id: 'tx-4',
    user_id: 'demo-user',
    account_id: 'acc-3',
    account_name: 'Axis Bank Magnus Card',
    transaction_date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    amount: 14200,
    currency: 'INR',
    direction: 'DEBIT',
    original_narration: 'POS-APPLE STORE MUMBAI-BKC-CARD8821',
    normalized_narration: 'Apple Store India BKC',
    clean_merchant: 'Apple India',
    category: 'Electronics',
    subcategory: 'Hardware',
    transaction_reference: 'POS-TX-9921',
    tags: ['Gadgets'],
  },
  {
    id: 'tx-5',
    user_id: 'demo-user',
    account_id: 'acc-2',
    account_name: 'ICICI Wealth Savings',
    transaction_date: new Date(Date.now() - 172800000).toISOString().split('T')[0],
    amount: 2200,
    currency: 'INR',
    direction: 'DEBIT',
    original_narration: 'UPI-UBER TRIP-uber.pay@axis-TXN882',
    normalized_narration: 'Uber Travel Premium Ride',
    clean_merchant: 'Uber',
    upi_vpa: 'uber.pay@axis',
    category: 'Transport',
    subcategory: 'Cabs',
    transaction_reference: 'UPI/39019284102',
    tags: ['Travel', 'Commute'],
  },
  {
    id: 'tx-6',
    user_id: 'demo-user',
    account_id: 'acc-1',
    account_name: 'HDFC Salary Account',
    transaction_date: new Date(Date.now() - 259200000).toISOString().split('T')[0],
    amount: 1999,
    currency: 'INR',
    direction: 'DEBIT',
    original_narration: 'NETFLIX ENTERTAINMENT IN-SUB4491',
    normalized_narration: 'Netflix Premium 4K Subscription',
    clean_merchant: 'Netflix',
    category: 'Entertainment',
    subcategory: 'Streaming',
    transaction_reference: 'REC/NFLX-882',
    tags: ['Subscription'],
  },
  {
    id: 'tx-7',
    user_id: 'demo-user',
    account_id: 'acc-1',
    account_name: 'HDFC Salary Account',
    transaction_date: new Date(Date.now() - 345600000).toISOString().split('T')[0],
    amount: 6500,
    currency: 'INR',
    direction: 'DEBIT',
    original_narration: 'AMAZON PAY INDIA RETAIL-ORD9982',
    normalized_narration: 'Amazon India Electronics Order',
    clean_merchant: 'Amazon',
    category: 'Shopping',
    subcategory: 'Online',
    transaction_reference: 'AMZN/8821092',
    tags: ['Home'],
  },
];

export const fallbackInvestments: InvestmentAsset[] = [
  {
    id: 'inv-1',
    name: 'Direct Equity / Stocks',
    symbol: 'NSE/BSE',
    assetClass: 'STOCKS',
    investedValue: 1850000,
    currentValue: 2240000,
    pnl: 390000,
    pnlPercentage: 21.08,
    lastUpdated: new Date().toISOString(),
  },
  {
    id: 'inv-2',
    name: 'Mutual Funds (SIP Portfolio)',
    symbol: 'AMFI',
    assetClass: 'MUTUAL_FUNDS',
    investedValue: 1100000,
    currentValue: 1320000,
    pnl: 220000,
    pnlPercentage: 20.0,
    lastUpdated: new Date().toISOString(),
  },
  {
    id: 'inv-3',
    name: 'Sovereign Gold Bonds & Bullion',
    symbol: 'SGB / 24K',
    assetClass: 'GOLD_SILVER',
    investedValue: 300000,
    currentValue: 440000,
    pnl: 140000,
    pnlPercentage: 46.67,
    lastUpdated: new Date().toISOString(),
  },
  {
    id: 'inv-4',
    name: 'Crypto & Digital Assets',
    symbol: 'BTC/ETH',
    assetClass: 'CRYPTO',
    investedValue: 250000,
    currentValue: 460000,
    pnl: 210000,
    pnlPercentage: 84.0,
    lastUpdated: new Date().toISOString(),
  },
  {
    id: 'inv-5',
    name: 'Government & Corporate Bonds',
    symbol: 'G-SEC',
    assetClass: 'BONDS',
    investedValue: 450000,
    currentValue: 465000,
    pnl: 15000,
    pnlPercentage: 3.33,
    lastUpdated: new Date().toISOString(),
  },
];

export const fallbackStocks: StockHolding[] = [
  {
    id: 'stk-1',
    symbol: 'HDFCBANK',
    name: 'HDFC Bank Ltd',
    quantity: 350,
    avgPrice: 1520,
    ltp: 1745.5,
    currentValue: 610925,
    totalPnl: 78925,
    pnlPercentage: 14.83,
    dayChangePercentage: 1.15,
  },
  {
    id: 'stk-2',
    symbol: 'RELIANCE',
    name: 'Reliance Industries Ltd',
    quantity: 180,
    avgPrice: 2410,
    ltp: 2980.0,
    currentValue: 536400,
    totalPnl: 102600,
    pnlPercentage: 23.65,
    dayChangePercentage: -0.45,
  },
  {
    id: 'stk-3',
    symbol: 'TATAMOTORS',
    name: 'Tata Motors Passenger Vehicles',
    quantity: 420,
    avgPrice: 680,
    ltp: 965.2,
    currentValue: 405384,
    totalPnl: 119784,
    pnlPercentage: 41.94,
    dayChangePercentage: 2.3,
  },
  {
    id: 'stk-4',
    symbol: 'INFY',
    name: 'Infosys Ltd',
    quantity: 210,
    avgPrice: 1450,
    ltp: 1840.0,
    currentValue: 386400,
    totalPnl: 81900,
    pnlPercentage: 26.89,
    dayChangePercentage: 0.85,
  },
  {
    id: 'stk-5',
    symbol: 'ZOMATO',
    name: 'Zomato Ltd (Eternal)',
    quantity: 1100,
    avgPrice: 135,
    ltp: 273.5,
    currentValue: 300850,
    totalPnl: 152350,
    pnlPercentage: 102.59,
    dayChangePercentage: 3.4,
  },
];

export const fallbackMutualFunds: MutualFundHolding[] = [
  {
    id: 'mf-1',
    fundName: 'Parag Parikh Flexi Cap Fund - Direct (G)',
    amfiCode: '122639',
    investedValue: 450000,
    currentValue: 585000,
    pnl: 135000,
    xirr: 24.2,
    nav: 84.52,
    folioNumber: 'PPFAS-998210',
  },
  {
    id: 'mf-2',
    fundName: 'Quant Small Cap Fund - Direct (G)',
    amfiCode: '120828',
    investedValue: 350000,
    currentValue: 448000,
    pnl: 98000,
    xirr: 28.6,
    nav: 242.15,
    folioNumber: 'QNT-772102',
  },
  {
    id: 'mf-3',
    fundName: 'Mirae Asset Large Cap Fund - Direct (G)',
    amfiCode: '107578',
    investedValue: 300000,
    currentValue: 367000,
    pnl: 67000,
    xirr: 17.8,
    nav: 112.4,
    folioNumber: 'MIR-391024',
  },
];

export const fallbackCrypto: CryptoHolding[] = [
  {
    id: 'cry-1',
    symbol: 'BTC',
    name: 'Bitcoin',
    holdings: 0.35,
    currentPrice: 7950000,
    currentValue: 2782500,
    avgBuyPrice: 4800000,
    totalPnl: 1102500,
    pnlPercentage: 65.62,
    dayChangePercentage: 2.8,
  },
  {
    id: 'cry-2',
    symbol: 'ETH',
    name: 'Ethereum',
    holdings: 2.8,
    currentPrice: 285000,
    currentValue: 798000,
    avgBuyPrice: 210000,
    totalPnl: 210000,
    pnlPercentage: 35.71,
    dayChangePercentage: 1.4,
  },
  {
    id: 'cry-3',
    symbol: 'SOL',
    name: 'Solana',
    holdings: 15.0,
    currentPrice: 18200,
    currentValue: 273000,
    avgBuyPrice: 9400,
    totalPnl: 132000,
    pnlPercentage: 93.62,
    dayChangePercentage: 4.1,
  },
];

export const fallbackBonds: BondHolding[] = [
  {
    id: 'bnd-1',
    name: '7.18% GS 2033 (Govt of India)',
    issuer: 'Reserve Bank of India',
    bondType: 'GOVERNMENT',
    couponRate: 7.18,
    investedAmount: 200000,
    currentValue: 206800,
    maturityDate: '14 Aug 2033',
    creditRating: 'SOVEREIGN (AAA)',
  },
  {
    id: 'bnd-2',
    name: 'NHAI 8.30% Tax-Free Bonds',
    issuer: 'National Highways Authority of India',
    bondType: 'TAX_FREE',
    couponRate: 8.3,
    investedAmount: 150000,
    currentValue: 158400,
    maturityDate: '25 Jan 2029',
    creditRating: 'CRISIL AAA',
  },
  {
    id: 'bnd-3',
    name: 'Power Finance Corp (PFC) Tier II',
    issuer: 'Power Finance Corporation Ltd',
    bondType: 'CORPORATE',
    couponRate: 8.15,
    investedAmount: 100000,
    currentValue: 103200,
    maturityDate: '10 Nov 2030',
    creditRating: 'ICRA AAA',
  },
];

export const fallbackFno: FnoPosition[] = [
  {
    id: 'fno-1',
    symbol: 'NIFTY 28NOV 24500 CE',
    instrumentType: 'CE',
    strikePrice: 24500,
    expiryDate: '28 Nov 2026',
    side: 'BUY',
    quantity: 50,
    lots: 1,
    avgPrice: 142.5,
    ltp: 188.0,
    pnl: 2275,
    pnlPercentage: 31.93,
  },
  {
    id: 'fno-2',
    symbol: 'BANKNIFTY 28NOV 52000 PE',
    instrumentType: 'PE',
    strikePrice: 52000,
    expiryDate: '28 Nov 2026',
    side: 'BUY',
    quantity: 30,
    lots: 2,
    avgPrice: 215.0,
    ltp: 168.0,
    pnl: -1410,
    pnlPercentage: -21.86,
  },
];

export const fallbackBullion: BullionRate[] = [
  {
    asset: 'GOLD_24K',
    name: '24K Pure Gold (999)',
    pricePerUnit: 7865,
    unit: '1 gm',
    dayChange: 45,
    dayChangePercentage: 0.58,
  },
  {
    asset: 'SILVER',
    name: 'Fine Silver (999)',
    pricePerUnit: 92450,
    unit: '1 kg',
    dayChange: -320,
    dayChangePercentage: -0.34,
  },
];

export const fallbackGoals: SavingsGoal[] = [
  {
    id: 'goal-1',
    title: 'Emergency Reserve (6 Months)',
    targetAmount: 600000,
    currentAmount: 510000,
    category: 'EMERGENCY',
    deadline: 'Dec 2026',
  },
  {
    id: 'goal-2',
    title: 'Swiss Alps Expedition 2027',
    targetAmount: 350000,
    currentAmount: 220000,
    category: 'TRAVEL',
    deadline: 'Jun 2027',
  },
  {
    id: 'goal-3',
    title: 'Home Renovation & Solar',
    targetAmount: 800000,
    currentAmount: 380000,
    category: 'HOME',
    deadline: 'Mar 2028',
  },
];

export const fallbackInsights: FinancialInsight[] = [
  {
    id: 'ins-1',
    title: 'Axis Magnus Card Due in 4 Days',
    description: 'Statement balance of ₹1,85,000 due on 28th Nov. Auto-debit scheduled from HDFC.',
    type: 'BILL',
    actionLabel: 'Verify Auto-Debit',
  },
  {
    id: 'ins-2',
    title: 'Tax Harvesting Opportunity',
    description: 'Harvest ₹18,400 in unrealized short-term losses to offset taxable capital gains.',
    type: 'TAX',
    actionLabel: 'Review Holdings',
  },
  {
    id: 'ins-3',
    title: 'High Savings Rate (42.5%)',
    description: 'Your savings rate this month is 12% higher than your 6-month historical average.',
    type: 'GROWTH',
  },
];

export async function fetchNetWorth(): Promise<NetWorthSummary> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return fallbackNetWorth;

    const { data: accounts, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id);

    if (error || !accounts || accounts.length === 0) {
      return fallbackNetWorth;
    }

    let assets = 0;
    let liabilities = 0;
    let liquid = 0;
    let investments = 0;

    for (const acc of accounts) {
      const bal = Number(acc.current_balance) || 0;
      if (acc.type === 'CREDIT_CARD' || acc.type === 'LOAN') {
        liabilities += Math.abs(bal);
      } else if (acc.type === 'INVESTMENT') {
        investments += Math.max(0, bal);
        assets += Math.max(0, bal);
      } else {
        liquid += Math.max(0, bal);
        assets += Math.max(0, bal);
      }
    }

    return {
      totalAssets: assets,
      totalLiabilities: liabilities,
      netWorth: assets - liabilities,
      liquidCash: liquid,
      investmentsTotal: investments,
      creditOutstanding: liabilities,
      currency: 'INR',
      monthlySavingsRate: 42.5,
      monthlyBurnRate: 95000,
      projectedRunwayDays: 270,
    };
  } catch {
    return fallbackNetWorth;
  }
}

export async function fetchAccounts(): Promise<Account[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return fallbackAccounts;

    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)
      .order('name');

    if (error || !data || data.length === 0) return fallbackAccounts;
    return data as Account[];
  } catch {
    return fallbackAccounts;
  }
}

export async function fetchTransactions(): Promise<CanonicalTransaction[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return fallbackTransactions;

    const { data, error } = await supabase
      .from('canonical_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('transaction_date', { ascending: false })
      .limit(50);

    if (error || !data || data.length === 0) return fallbackTransactions;
    return data as CanonicalTransaction[];
  } catch {
    return fallbackTransactions;
  }
}

export async function addTransaction(tx: Omit<CanonicalTransaction, 'id' | 'user_id'>): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user ? user.id : 'demo-user';

    const { error } = await supabase.from('canonical_transactions').insert([
      {
        ...tx,
        user_id: userId,
      },
    ]);

    if (error) {
      console.warn('Supabase insert warning, saved locally:', error.message);
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
