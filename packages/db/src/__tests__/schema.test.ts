import { getTableName } from "drizzle-orm";
import {
  profiles,
  accounts,
  transactions,
  transfers,
  ledgerLogs,
  incomes,
  expenses,
  budgets,
  goals,
  liabilities,
  investments,
  stockTrades,
  mutualFunds,
  mutualFundTrades,
  bonds,
  bondTransactions,
  alternativeAssets,
  forexAccounts,
  forexTrades,
  forexTransactions,
  fnoTrades,
  familyMembers,
  familyAllowances,
  familyTransfers,
  recipients,
  insurancePolicies,
} from "../index";

describe("Database Schema Definitions", () => {
  describe("Table Names", () => {
    it("should map to correct PostgreSQL table names", () => {
      expect(getTableName(profiles)).toBe("profiles");
      expect(getTableName(accounts)).toBe("accounts");
      expect(getTableName(transactions)).toBe("transactions");
      expect(getTableName(transfers)).toBe("transfers");
      expect(getTableName(ledgerLogs)).toBe("ledger_logs");
      expect(getTableName(incomes)).toBe("incomes");
      expect(getTableName(expenses)).toBe("expenses");
      expect(getTableName(budgets)).toBe("budgets");
      expect(getTableName(goals)).toBe("goals");
      expect(getTableName(liabilities)).toBe("liabilities");
      expect(getTableName(investments)).toBe("investments");
      expect(getTableName(stockTrades)).toBe("stock_trades");
      expect(getTableName(mutualFunds)).toBe("mutual_funds");
      expect(getTableName(mutualFundTrades)).toBe("mutual_fund_trades");
      expect(getTableName(bonds)).toBe("bonds");
      expect(getTableName(bondTransactions)).toBe("bond_transactions");
      expect(getTableName(alternativeAssets)).toBe("alternative_assets");
      expect(getTableName(forexAccounts)).toBe("forex_accounts");
      expect(getTableName(forexTrades)).toBe("forex_trades");
      expect(getTableName(forexTransactions)).toBe("forex_transactions");
      expect(getTableName(fnoTrades)).toBe("fno_trades");
      expect(getTableName(familyMembers)).toBe("family_members");
      expect(getTableName(familyAllowances)).toBe("family_allowances");
      expect(getTableName(familyTransfers)).toBe("family_transfers");
      expect(getTableName(recipients)).toBe("recipients");
      expect(getTableName(insurancePolicies)).toBe("insurance_policies");
    });
  });

  describe("Core Table Columns", () => {
    it("should define columns for profiles", () => {
      expect(profiles.id).toBeDefined();
      expect(profiles.username).toBeDefined();
      expect(profiles.base_currency).toBeDefined();
      expect(profiles.theme).toBeDefined();
      expect(profiles.timezone).toBeDefined();
      expect(profiles.enabled_modules).toBeDefined();
      expect(profiles.default_accounts).toBeDefined();
    });

    it("should define columns for accounts", () => {
      expect(accounts.id).toBeDefined();
      expect(accounts.user_id).toBeDefined();
      expect(accounts.name).toBeDefined();
      expect(accounts.type).toBeDefined();
      expect(accounts.balance).toBeDefined();
      expect(accounts.currency).toBeDefined();
    });

    it("should define columns for transactions", () => {
      expect(transactions.id).toBeDefined();
      expect(transactions.user_id).toBeDefined();
      expect(transactions.account_id).toBeDefined();
      expect(transactions.type).toBeDefined();
      expect(transactions.amount).toBeDefined();
      expect(transactions.description).toBeDefined();
      expect(transactions.category).toBeDefined();
    });

    it("should define columns for investments and trading", () => {
      expect(investments.id).toBeDefined();
      expect(investments.symbol).toBeDefined();
      expect(investments.quantity).toBeDefined();
      expect(investments.buy_price).toBeDefined();
      expect(investments.current_price).toBeDefined();

      expect(stockTrades.id).toBeDefined();
      expect(stockTrades.symbol).toBeDefined();
      expect(stockTrades.trade_type).toBeDefined();
      expect(stockTrades.quantity).toBeDefined();

      expect(mutualFunds.id).toBeDefined();
      expect(mutualFunds.fund_name).toBeDefined();
      expect(mutualFunds.avg_nav).toBeDefined();

      expect(bonds.id).toBeDefined();
      expect(bonds.isin).toBeDefined();
      expect(bonds.coupon_rate).toBeDefined();

      expect(forexTrades.id).toBeDefined();
      expect(forexTrades.pair).toBeDefined();
      expect(forexTrades.lot_size).toBeDefined();

      expect(fnoTrades.id).toBeDefined();
      expect(fnoTrades.symbol).toBeDefined();
      expect(fnoTrades.instrument_type).toBeDefined();
    });

    it("should define columns for family and insurance", () => {
      expect(familyMembers.id).toBeDefined();
      expect(familyMembers.name).toBeDefined();
      expect(familyMembers.relationship).toBeDefined();

      expect(insurancePolicies.id).toBeDefined();
      expect(insurancePolicies.provider).toBeDefined();
      expect(insurancePolicies.coverage_amount).toBeDefined();
    });
  });
});
