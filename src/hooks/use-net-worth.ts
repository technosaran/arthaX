import { useMemo } from "react";
import { useFinanceData } from "@/hooks/use-finance-data";
import { MODULE_KEYS } from "@/lib/modules";

const USD_EXCHANGE_RATE = 85.0; // 1 USD = 85 INR

export function useNetWorth() {
  const { data } = useFinanceData();
  const {
    profile,
    accounts = [],
    investments = [],
    forexAccounts = [],
    mutualFunds = [],
    bonds = [],
    alternativeAssets = [],
    liabilities = [],
  } = data || {};

  return useMemo(() => {
    const raw = profile?.enabled_modules || [...MODULE_KEYS];
    const enabledModules = [...raw] as string[];
    
    // Bidirectional fallback mapping for Cashflow
    if (raw.includes("Income & Expenses")) {
      enabledModules.push("Income", "Expenses");
    } else if (raw.includes("Income") || raw.includes("Expenses")) {
      enabledModules.push("Income & Expenses");
    }
    
    // Bidirectional fallback mapping for Investments
    if (raw.includes("Investments")) {
      enabledModules.push("Stocks", "Mutual Funds", "Bonds", "FnO", "Forex");
    } else if (
      raw.includes("Stocks") || 
      raw.includes("Mutual Funds") || 
      raw.includes("Bonds") || 
      raw.includes("FnO") || 
      raw.includes("Forex")
    ) {
      enabledModules.push("Investments");
    }
    
    const hasStocks = enabledModules.includes("Stocks");
    const hasForex = enabledModules.includes("Forex");
    const hasMF = enabledModules.includes("Mutual Funds");
    const hasBonds = enabledModules.includes("Bonds");
    const hasAlt = enabledModules.includes("Alt Assets");
    const hasLiabilities = enabledModules.includes("Liabilities");

    const getConvertedValues = (val: number, currency?: string) => {
      const amount = Number(val || 0);
      const isUSD = currency === "USD";
      const inr = isUSD ? amount * USD_EXCHANGE_RATE : amount;
      const usd = isUSD ? amount : amount / USD_EXCHANGE_RATE;
      return { inr, usd };
    };

    // Accounts / Cash
    let cashBalanceINR = 0;
    let cashBalanceUSD = 0;
    accounts.forEach(acc => {
      const { inr, usd } = getConvertedValues(acc.balance, acc.currency);
      cashBalanceINR += inr;
      cashBalanceUSD += usd;
    });

    // Stocks
    let stockBalanceINR = 0;
    let stockBalanceUSD = 0;
    if (hasStocks) {
      investments.filter(i => i.type === "stock").forEach(inv => {
        const val = Number(inv.quantity || 0) * Number(inv.current_price || 0);
        const { inr, usd } = getConvertedValues(val, inv.currency);
        stockBalanceINR += inr;
        stockBalanceUSD += usd;
      });
    }

    // Forex Accounts
    let forexBalanceINR = 0;
    let forexBalanceUSD = 0;
    if (hasForex) {
      forexAccounts.forEach(acc => {
        const { inr, usd } = getConvertedValues(acc.balance, acc.currency);
        forexBalanceINR += inr;
        forexBalanceUSD += usd;
      });
    }

    // Crypto
    let cryptoBalanceINR = 0;
    let cryptoBalanceUSD = 0;
    investments.filter(i => i.type === "crypto").forEach(inv => {
      const val = Number(inv.quantity || 0) * Number(inv.current_price || 0);
      const { inr, usd } = getConvertedValues(val, inv.currency);
      cryptoBalanceINR += inr;
      cryptoBalanceUSD += usd;
    });

    // Mutual Funds
    let mfBalanceINR = 0;
    let mfBalanceUSD = 0;
    if (hasMF) {
      mutualFunds.forEach(mf => {
        const val = Number(mf.units || 0) * Number(mf.current_nav || 0);
        const { inr, usd } = getConvertedValues(val, (mf as any).currency);
        mfBalanceINR += inr;
        mfBalanceUSD += usd;
      });
    }

    // Bonds
    let bondBalanceINR = 0;
    let bondBalanceUSD = 0;
    if (hasBonds) {
      (bonds || []).filter(b => b.status === "Active").forEach(b => {
        const { inr, usd } = getConvertedValues(b.current_value, (b as any).currency);
        bondBalanceINR += inr;
        bondBalanceUSD += usd;
      });
    }

    // Alternative Assets
    let altBalanceINR = 0;
    let altBalanceUSD = 0;
    if (hasAlt) {
      (alternativeAssets || []).forEach(asset => {
        const { inr, usd } = getConvertedValues(asset.current_value, (asset as any).currency);
        altBalanceINR += inr;
        altBalanceUSD += usd;
      });
    }

    // Liabilities / Debt
    let debtBalanceINR = 0;
    let debtBalanceUSD = 0;
    if (hasLiabilities) {
      liabilities.forEach(debt => {
        const { inr, usd } = getConvertedValues(debt.remaining_amount, (debt as any).currency);
        debtBalanceINR += inr;
        debtBalanceUSD += usd;
      });
    }

    const liquidBalanceINR = cashBalanceINR + stockBalanceINR + mfBalanceINR + bondBalanceINR + forexBalanceINR + cryptoBalanceINR;
    const totalAssetsINR = liquidBalanceINR + altBalanceINR;
    const netWorthINR = totalAssetsINR - debtBalanceINR;

    const liquidBalanceUSD = cashBalanceUSD + stockBalanceUSD + mfBalanceUSD + bondBalanceUSD + forexBalanceUSD + cryptoBalanceUSD;
    const totalAssetsUSD = liquidBalanceUSD + altBalanceUSD;
    const netWorthUSD = totalAssetsUSD - debtBalanceUSD;

    // Default unified properties aligned to user currency preference
    const isUSD = profile?.base_currency === "USD";
    const netWorth = isUSD ? netWorthUSD : netWorthINR;
    const cashBalance = isUSD ? cashBalanceUSD : cashBalanceINR;
    const stockBalance = isUSD ? stockBalanceUSD : stockBalanceINR;
    const forexBalance = isUSD ? forexBalanceUSD : forexBalanceINR;
    const cryptoBalance = isUSD ? cryptoBalanceUSD : cryptoBalanceINR;
    const mfBalance = isUSD ? mfBalanceUSD : mfBalanceINR;
    const bondBalance = isUSD ? bondBalanceUSD : bondBalanceINR;
    const altBalance = isUSD ? altBalanceUSD : altBalanceINR;
    const debtBalance = isUSD ? debtBalanceUSD : debtBalanceINR;
    const liquidBalance = isUSD ? liquidBalanceUSD : liquidBalanceINR;
    const totalAssets = isUSD ? totalAssetsUSD : totalAssetsINR;

    return {
      netWorth,
      netWorthINR,
      netWorthUSD,
      cashBalance,
      cashBalanceINR,
      cashBalanceUSD,
      stockBalance,
      stockBalanceINR,
      stockBalanceUSD,
      forexBalance,
      forexBalanceINR,
      forexBalanceUSD,
      cryptoBalance,
      mfBalance,
      bondBalance,
      altBalance,
      debtBalance,
      liquidBalance,
      totalAssets,
      totalAssetsINR,
      totalAssetsUSD
    };
  }, [accounts, investments, forexAccounts, mutualFunds, bonds, alternativeAssets, liabilities, profile]);
}
