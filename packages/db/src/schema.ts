import { pgTable, uuid, text, numeric, timestamp, integer, jsonb, index } from "drizzle-orm/pg-core";

// profiles
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  username: text("username"),
  base_currency: text("base_currency").default("INR").notNull(),
  theme: text("theme").default("dark").notNull(),
  timezone: text("timezone").default("Asia/Kolkata").notNull(),
  enabled_modules: jsonb("enabled_modules").default([]),
  default_accounts: jsonb("default_accounts").default({}),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// accounts
export const accounts = pgTable("accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: uuid("user_id").references(() => profiles.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  balance: numeric("balance").default("0").notNull(),
  currency: text("currency").default("INR").notNull(),
  bank_name: text("bank_name"),
  institution: text("institution"),
  account_number: text("account_number"),
  color: text("color"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
}, (t) => ({
  userIdIdx: index("accounts_user_id_idx").on(t.user_id)
}));

// transactions
export const transactions = pgTable("transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: uuid("user_id").references(() => profiles.id, { onDelete: "cascade" }).notNull(),
  account_id: uuid("account_id").references(() => accounts.id, { onDelete: "cascade" }).notNull(),
  type: text("type").notNull(),
  amount: numeric("amount").notNull(),
  description: text("description").notNull(),
  category: text("category"),
  date: timestamp("date").defaultNow().notNull(),
  source_type: text("source_type"),
  source_id: uuid("source_id"),
  ledger_log_id: uuid("ledger_log_id"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow(),
}, (t) => ({
  userIdIdx: index("transactions_user_id_idx").on(t.user_id),
  accountIdIdx: index("transactions_account_id_idx").on(t.account_id),
  userDateIdx: index("transactions_user_date_idx").on(t.user_id, t.date),
}));

// ledger_logs
export const ledgerLogs = pgTable("ledger_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull(),
  account_id: uuid("account_id"),
  account_name: text("account_name"),
  action_type: text("action_type").notNull(),
  amount: numeric("amount"),
  previous_balance: numeric("previous_balance"),
  new_balance: numeric("new_balance"),
  details: text("details"),
  source_type: text("source_type"),
  source_id: uuid("source_id"),
  metadata: jsonb("metadata"),
  created_at: timestamp("created_at").defaultNow(),
}, (t) => ({
  userIdIdx: index("ledger_logs_user_id_idx").on(t.user_id),
  accountIdIdx: index("ledger_logs_account_id_idx").on(t.account_id),
  userCreatedIdx: index("ledger_logs_user_created_idx").on(t.user_id, t.created_at),
}));

// budgets
export const budgets = pgTable("budgets", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull(),
  category: text("category").notNull(),
  amount: numeric("amount").default("0").notNull(),
  period_month: integer("period_month").notNull(),
  period_year: integer("period_year").notNull(),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
}, (t) => ({
  userIdIdx: index("budgets_user_id_idx").on(t.user_id)
}));

// investments
export const investments = pgTable("investments", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  symbol: text("symbol"),
  quantity: numeric("quantity").default("0"),
  buy_price: numeric("buy_price").default("0"),
  current_price: numeric("current_price").default("0"),
  currency: text("currency").default("INR").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  userIdIdx: index("investments_user_id_idx").on(t.user_id)
}));
