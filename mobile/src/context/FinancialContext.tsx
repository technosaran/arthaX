import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import {
  fetchAccounts,
  fetchTransactions,
  fallbackInvestments,
  fallbackStocks,
  fallbackMutualFunds,
  fallbackBullion,
  fallbackCrypto,
  fallbackBonds,
  fallbackFno,
  fallbackGoals,
  fallbackInsights,
  addTransaction as apiAddTransaction,
} from '../api/financialService';
import {
  calculateNetWorth,
  calculateGenuineCashFlow,
  calculateBudgetPacing,
  calculateTaxHarvesting,
  verifyStatementChecksum,
  CashFlowMetrics,
  BudgetPacingResult,
  TaxHarvestingMetrics,
  ReconciliationChecksumResult,
} from '../engine/afceCore';

interface FinancialContextType {
  netWorth: NetWorthSummary;
  cashFlow: CashFlowMetrics;
  budgetPacing: BudgetPacingResult;
  taxHarvesting: TaxHarvestingMetrics;
  reconciliation: ReconciliationChecksumResult;
  accounts: Account[];
  transactions: CanonicalTransaction[];
  investments: InvestmentAsset[];
  stocks: StockHolding[];
  mutualFunds: MutualFundHolding[];
  bullion: BullionRate[];
  cryptoAssets: CryptoHolding[];
  bonds: BondHolding[];
  fnoPositions: FnoPosition[];
  goals: SavingsGoal[];
  insights: FinancialInsight[];
  isLoading: boolean;
  isRefreshing: boolean;
  isPrivacyMasked: boolean;
  togglePrivacyMask: () => void;
  refreshData: () => Promise<void>;
  addNewTransaction: (tx: Omit<CanonicalTransaction, 'id' | 'user_id'>) => Promise<{ success: boolean; error?: string }>;
  addNewGoal: (goal: Omit<SavingsGoal, 'id'>) => void;
}

const defaultCashFlow: CashFlowMetrics = {
  genuineIncome: 195000,
  genuineExpense: 95000,
  netSurplus: 100000,
  savingsRate: 51.3,
  internalTransfersTotal: 0,
  totalTransactionCount: 7,
};

const FinancialContext = createContext<FinancialContextType>({
  netWorth: {
    totalAssets: 4850000,
    totalLiabilities: 320000,
    netWorth: 4530000,
    liquidCash: 850000,
    investmentsTotal: 4000000,
    creditOutstanding: 320000,
    currency: 'INR',
  },
  cashFlow: defaultCashFlow,
  budgetPacing: {
    spent: 95000,
    limit: 150000,
    remaining: 55000,
    utilizationPercentage: 63.3,
    daysPassedInMonth: 24,
    totalDaysInMonth: 30,
    expectedPacingPercentage: 80,
    status: 'SAFE',
  },
  taxHarvesting: {
    ltcgRealized: 78000,
    ltcgExemptionLimit: 125000,
    ltcgExemptionRemaining: 47000,
    ltcgTaxable: 0,
    stcgRealized: 12000,
    estimatedTaxPayable: 2400,
    taxLossHarvestingPotential: 18400,
    harvestingCandidates: [],
  },
  reconciliation: {
    openingBalance: 524500,
    closingBalance: 624500,
    totalCredits: 195000,
    totalDebits: 95000,
    expectedClosing: 624500,
    variance: 0,
    isBalanced: true,
  },
  accounts: [],
  transactions: [],
  investments: [],
  stocks: [],
  mutualFunds: [],
  bullion: [],
  cryptoAssets: [],
  bonds: [],
  fnoPositions: [],
  goals: [],
  insights: [],
  isLoading: true,
  isRefreshing: false,
  isPrivacyMasked: false,
  togglePrivacyMask: () => {},
  refreshData: async () => {},
  addNewTransaction: async () => ({ success: false }),
  addNewGoal: () => {},
});

export const FinancialProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<CanonicalTransaction[]>([]);
  const [investments, setInvestments] = useState<InvestmentAsset[]>(fallbackInvestments);
  const [stocks, setStocks] = useState<StockHolding[]>(fallbackStocks);
  const [mutualFunds, setMutualFunds] = useState<MutualFundHolding[]>(fallbackMutualFunds);
  const [bullion, setBullion] = useState<BullionRate[]>(fallbackBullion);
  const [cryptoAssets, setCryptoAssets] = useState<CryptoHolding[]>(fallbackCrypto);
  const [bonds, setBonds] = useState<BondHolding[]>(fallbackBonds);
  const [fnoPositions, setFnoPositions] = useState<FnoPosition[]>(fallbackFno);
  const [goals, setGoals] = useState<SavingsGoal[]>(fallbackGoals);
  const [insights, setInsights] = useState<FinancialInsight[]>(fallbackInsights);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPrivacyMasked, setIsPrivacyMasked] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('@arthax_privacy_mode').then((val) => {
      if (val === 'true') setIsPrivacyMasked(true);
    });
  }, []);

  const togglePrivacyMask = () => {
    setIsPrivacyMasked((prev) => {
      const next = !prev;
      AsyncStorage.setItem('@arthax_privacy_mode', next ? 'true' : 'false');
      return next;
    });
  };

  const loadData = useCallback(async () => {
    try {
      const [accs, txs] = await Promise.all([
        fetchAccounts(),
        fetchTransactions(),
      ]);
      setAccounts(accs);
      setTransactions(txs);
      setInvestments(fallbackInvestments);
      setStocks(fallbackStocks);
      setMutualFunds(fallbackMutualFunds);
      setBullion(fallbackBullion);
      setCryptoAssets(fallbackCrypto);
      setBonds(fallbackBonds);
      setFnoPositions(fallbackFno);
      setGoals(fallbackGoals);
      setInsights(fallbackInsights);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const refreshData = async () => {
    setIsRefreshing(true);
    await loadData();
  };

  // AFCE Dynamic Math Engines
  const netWorth = useMemo(() => {
    return calculateNetWorth(accounts, stocks, mutualFunds, cryptoAssets, bonds);
  }, [accounts, stocks, mutualFunds, cryptoAssets, bonds]);

  const cashFlow = useMemo(() => {
    return calculateGenuineCashFlow(transactions);
  }, [transactions]);

  const budgetPacing = useMemo(() => {
    return calculateBudgetPacing(cashFlow.genuineExpense || 95000, 150000);
  }, [cashFlow.genuineExpense]);

  const taxHarvesting = useMemo(() => {
    return calculateTaxHarvesting(stocks, mutualFunds);
  }, [stocks, mutualFunds]);

  const reconciliation = useMemo(() => {
    const opening = 524500;
    const closing = 624500;
    return verifyStatementChecksum(opening, closing, cashFlow.genuineIncome, cashFlow.genuineExpense);
  }, [cashFlow.genuineIncome, cashFlow.genuineExpense]);

  const addNewTransaction = async (txData: Omit<CanonicalTransaction, 'id' | 'user_id'>) => {
    const res = await apiAddTransaction(txData);
    if (res.success) {
      const newTx: CanonicalTransaction = {
        ...txData,
        id: `tx-${Date.now()}`,
        user_id: 'current-user',
      };
      setTransactions((prev) => [newTx, ...prev]);

      setAccounts((prev) =>
        prev.map((acc) => {
          if (acc.id === txData.account_id) {
            const delta = txData.direction === 'CREDIT' ? txData.amount : -txData.amount;
            return {
              ...acc,
              current_balance: acc.current_balance + delta,
            };
          }
          return acc;
        })
      );
    }
    return res;
  };

  const addNewGoal = (newGoalData: Omit<SavingsGoal, 'id'>) => {
    const newGoal: SavingsGoal = {
      ...newGoalData,
      id: `goal-${Date.now()}`,
    };
    setGoals((prev) => [newGoal, ...prev]);
  };

  return (
    <FinancialContext.Provider
      value={{
        netWorth,
        cashFlow,
        budgetPacing,
        taxHarvesting,
        reconciliation,
        accounts,
        transactions,
        investments,
        stocks,
        mutualFunds,
        bullion,
        cryptoAssets,
        bonds,
        fnoPositions,
        goals,
        insights,
        isLoading,
        isRefreshing,
        isPrivacyMasked,
        togglePrivacyMask,
        refreshData,
        addNewTransaction,
        addNewGoal,
      }}
    >
      {children}
    </FinancialContext.Provider>
  );
};

export const useFinancial = () => useContext(FinancialContext);
