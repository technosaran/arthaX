-- Migration: Database Performance Compound Query Indexes
-- Date: 2026-08-13
-- Purpose: Optimize analytical query performance for user dashboard RPCs by creating compound indexes on (user_id, date DESC).

-- 1. Transactions compound index
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions(user_id, date DESC);

-- 2. Expenses compound index
CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON public.expenses(user_id, date DESC);

-- 3. Incomes compound index
CREATE INDEX IF NOT EXISTS idx_incomes_user_date ON public.incomes(user_id, date DESC);

-- 4. Ledger logs compound index
CREATE INDEX IF NOT EXISTS idx_ledger_logs_user_created ON public.ledger_logs(user_id, created_at DESC);

-- 5. Investments user symbol index
CREATE INDEX IF NOT EXISTS idx_investments_user_symbol ON public.investments(user_id, symbol);

-- 6. Mutual Funds user symbol index
CREATE INDEX IF NOT EXISTS idx_mutual_funds_user_symbol ON public.mutual_funds(user_id, fund_symbol);
