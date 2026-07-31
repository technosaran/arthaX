-- Migration: Realtime & Query Performance Optimization
-- Date: 2026-08-01
-- Purpose: Optimize WAL log parsing overhead by tuning replica identity settings to DEFAULT on tables with primary keys.

ALTER TABLE public.accounts REPLICA IDENTITY DEFAULT;
ALTER TABLE public.expenses REPLICA IDENTITY DEFAULT;
ALTER TABLE public.incomes REPLICA IDENTITY DEFAULT;
ALTER TABLE public.investments REPLICA IDENTITY DEFAULT;
ALTER TABLE public.mutual_funds REPLICA IDENTITY DEFAULT;
ALTER TABLE public.bonds REPLICA IDENTITY DEFAULT;
ALTER TABLE public.alternative_assets REPLICA IDENTITY DEFAULT;
ALTER TABLE public.stock_trades REPLICA IDENTITY DEFAULT;
ALTER TABLE public.mutual_fund_trades REPLICA IDENTITY DEFAULT;
ALTER TABLE public.bond_transactions REPLICA IDENTITY DEFAULT;
ALTER TABLE public.fno_trades REPLICA IDENTITY DEFAULT;
ALTER TABLE public.budgets REPLICA IDENTITY DEFAULT;
ALTER TABLE public.goals REPLICA IDENTITY DEFAULT;
ALTER TABLE public.liabilities REPLICA IDENTITY DEFAULT;
ALTER TABLE public.family_members REPLICA IDENTITY DEFAULT;
ALTER TABLE public.family_transfers REPLICA IDENTITY DEFAULT;
ALTER TABLE public.family_allowances REPLICA IDENTITY DEFAULT;
ALTER TABLE public.forex_accounts REPLICA IDENTITY DEFAULT;
ALTER TABLE public.forex_trades REPLICA IDENTITY DEFAULT;
ALTER TABLE public.forex_transactions REPLICA IDENTITY DEFAULT;
