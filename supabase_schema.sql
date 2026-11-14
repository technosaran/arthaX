-- Consolidated Supabase Schema for arthaX Multi-Tenant Architecture
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/fvpfzbuoizzjwgekuhot/sql

-- 1. User Settings Table
create table if not exists public.user_settings (
  id text primary key,
  name text not null default 'User',
  theme text not null default 'dark',
  telegram_chat_id text,
  telegram_username text,
  telegram_link_token text,
  telegram_linked_at timestamptz,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_user_settings_telegram_chat_id on public.user_settings(telegram_chat_id);
create index if not exists idx_user_settings_telegram_link_token on public.user_settings(telegram_link_token);

alter table public.user_settings enable row level security;

-- 2. Accounts Table
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default coalesce(auth.uid()::text, 'default_user'),
  name text not null,
  type text not null,
  balance numeric(15, 2) not null default 0.00,
  last_four text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_accounts_user_id on public.accounts(user_id);
create index if not exists idx_accounts_user_created on public.accounts(user_id, created_at desc);
alter table public.accounts enable row level security;

-- 3. Income Table
create table if not exists public.income (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default coalesce(auth.uid()::text, 'default_user'),
  title text not null,
  amount numeric(14, 2) not null default 0,
  category text not null default 'Salary',
  frequency text not null default 'Monthly',
  account_id uuid references public.accounts(id) on delete set null,
  received_date date not null default current_date,
  notes text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_income_user_id on public.income(user_id);
create index if not exists idx_income_user_received_date on public.income(user_id, received_date desc);
alter table public.income enable row level security;

-- 4. Expenses Table
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default coalesce(auth.uid()::text, 'default_user'),
  title text not null,
  amount numeric(14, 2) not null default 0,
  category text not null default 'Food & Dining',
  account_id uuid references public.accounts(id) on delete set null,
  expense_date date not null default current_date,
  notes text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_expenses_user_id on public.expenses(user_id);
create index if not exists idx_expenses_user_expense_date on public.expenses(user_id, expense_date desc);
alter table public.expenses enable row level security;

-- 5. Budgets Table
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default coalesce(auth.uid()::text, 'default_user'),
  category text not null,
  amount numeric(14, 2) not null default 0,
  period text not null default 'monthly',
  month_year text not null default to_char(current_date, 'YYYY-MM'),
  alert_threshold integer not null default 80,
  notes text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_budgets_user_id on public.budgets(user_id);
create index if not exists idx_budgets_user_created on public.budgets(user_id, created_at desc);
alter table public.budgets enable row level security;

-- 6. Row Level Security Policies (Strict User Isolation)
-- User Settings
drop policy if exists "Users can view own settings" on public.user_settings;
create policy "Users can view own settings" on public.user_settings for select to authenticated using (auth.uid()::text = id);

drop policy if exists "Users can insert own settings" on public.user_settings;
create policy "Users can insert own settings" on public.user_settings for insert to authenticated with check (auth.uid()::text = id);

drop policy if exists "Users can update own settings" on public.user_settings;
create policy "Users can update own settings" on public.user_settings for update to authenticated using (auth.uid()::text = id) with check (auth.uid()::text = id);

drop policy if exists "Users can delete own settings" on public.user_settings;
create policy "Users can delete own settings" on public.user_settings for delete to authenticated using (auth.uid()::text = id);

-- Accounts
drop policy if exists "Users can view own accounts" on public.accounts;
create policy "Users can view own accounts" on public.accounts for select to authenticated using (auth.uid()::text = user_id);

drop policy if exists "Users can insert own accounts" on public.accounts;
create policy "Users can insert own accounts" on public.accounts for insert to authenticated with check (auth.uid()::text = user_id);

drop policy if exists "Users can update own accounts" on public.accounts;
create policy "Users can update own accounts" on public.accounts for update to authenticated using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);

drop policy if exists "Users can delete own accounts" on public.accounts;
create policy "Users can delete own accounts" on public.accounts for delete to authenticated using (auth.uid()::text = user_id);

-- Income
drop policy if exists "Users can view own income" on public.income;
create policy "Users can view own income" on public.income for select to authenticated using (auth.uid()::text = user_id);

drop policy if exists "Users can insert own income" on public.income;
create policy "Users can insert own income" on public.income for insert to authenticated with check (auth.uid()::text = user_id);

drop policy if exists "Users can update own income" on public.income;
create policy "Users can update own income" on public.income for update to authenticated using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);

drop policy if exists "Users can delete own income" on public.income;
create policy "Users can delete own income" on public.income for delete to authenticated using (auth.uid()::text = user_id);

-- Expenses
drop policy if exists "Users can view own expenses" on public.expenses;
create policy "Users can view own expenses" on public.expenses for select to authenticated using (auth.uid()::text = user_id);

drop policy if exists "Users can insert own expenses" on public.expenses;
create policy "Users can insert own expenses" on public.expenses for insert to authenticated with check (auth.uid()::text = user_id);

drop policy if exists "Users can update own expenses" on public.expenses;
create policy "Users can update own expenses" on public.expenses for update to authenticated using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);

drop policy if exists "Users can delete own expenses" on public.expenses;
create policy "Users can delete own expenses" on public.expenses for delete to authenticated using (auth.uid()::text = user_id);

-- Budgets
drop policy if exists "Users can view own budgets" on public.budgets;
create policy "Users can view own budgets" on public.budgets for select to authenticated using (auth.uid()::text = user_id);

drop policy if exists "Users can insert own budgets" on public.budgets;
create policy "Users can insert own budgets" on public.budgets for insert to authenticated with check (auth.uid()::text = user_id);

drop policy if exists "Users can update own budgets" on public.budgets;
create policy "Users can update own budgets" on public.budgets for update to authenticated using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);

drop policy if exists "Users can delete own budgets" on public.budgets;
create policy "Users can delete own budgets" on public.budgets for delete to authenticated using (auth.uid()::text = user_id);

-- 7. Automated Provisioning Triggers
-- Auto-confirm email to avoid SMTP delivery issues
create or replace function public.auto_confirm_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.email_confirmed_at is null then
    new.email_confirmed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_before_insert on auth.users;
create trigger on_auth_user_before_insert
  before insert on auth.users
  for each row execute function public.auto_confirm_user();

-- Automatically provision user_settings and starter Cash account
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.user_settings (id, name, theme)
  values (
    new.id::text,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'User'),
    'dark'
  )
  on conflict (id) do nothing;

  insert into public.accounts (user_id, name, type, balance, last_four)
  values (
    new.id::text,
    'Cash in Hand',
    'Liquid Cash',
    0.00,
    'CASH'
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 8. Atomic Balance Operations (RPC Functions)
create or replace function public.decrement_account_balance(
  p_account_id uuid,
  p_user_id text,
  p_amount numeric
)
returns numeric
language plpgsql
security definer
as $$
declare
  v_new_balance numeric;
begin
  update public.accounts
  set balance = round((balance - p_amount)::numeric, 2)
  where id = p_account_id and user_id = p_user_id
  returning balance into v_new_balance;

  return coalesce(v_new_balance, 0);
end;
$$;

create or replace function public.increment_account_balance(
  p_account_id uuid,
  p_user_id text,
  p_amount numeric
)
returns numeric
language plpgsql
security definer
as $$
declare
  v_new_balance numeric;
begin
  update public.accounts
  set balance = round((balance + p_amount)::numeric, 2)
  where id = p_account_id and user_id = p_user_id
  returning balance into v_new_balance;

  return coalesce(v_new_balance, 0);
end;
$$;

-- 9. Enable Realtime Publications & Replica Identity Full
alter table public.accounts replica identity full;
alter table public.user_settings replica identity full;
alter table public.income replica identity full;
alter table public.expenses replica identity full;
alter table public.budgets replica identity full;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'accounts') then
    alter publication supabase_realtime add table public.accounts;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'user_settings') then
    alter publication supabase_realtime add table public.user_settings;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'income') then
    alter publication supabase_realtime add table public.income;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'expenses') then
    alter publication supabase_realtime add table public.expenses;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'budgets') then
    alter publication supabase_realtime add table public.budgets;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'family_members') then
    alter publication supabase_realtime add table public.family_members;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'family_goals') then
    alter publication supabase_realtime add table public.family_goals;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'family_responsibilities') then
    alter publication supabase_realtime add table public.family_responsibilities;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'family_emergency_vault') then
    alter publication supabase_realtime add table public.family_emergency_vault;
  end if;
end $$;

-- 10. Family Finance & Household Planning Module
-- Family Members
create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default coalesce(auth.uid()::text, 'default_user'),
  name text not null,
  relationship text not null default 'Spouse',
  avatar_color text not null default '#4bb473',
  monthly_allowance numeric(14, 2) not null default 0.00,
  current_spending numeric(14, 2) not null default 0.00,
  role text not null default 'member',
  email text,
  phone text,
  telegram_chat_id text,
  telegram_username text,
  notes text,
  created_at timestamptz not null default timezone('utc'::text, now())
);
create index if not exists idx_family_members_user_id on public.family_members(user_id);
create index if not exists idx_family_members_user_created on public.family_members(user_id, created_at desc);
create index if not exists idx_family_members_telegram_chat_id on public.family_members(telegram_chat_id);
alter table public.family_members enable row level security;

-- Family Goals
create table if not exists public.family_goals (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default coalesce(auth.uid()::text, 'default_user'),
  title text not null,
  target_amount numeric(14, 2) not null default 0.00,
  current_amount numeric(14, 2) not null default 0.00,
  target_date date,
  category text not null default 'General',
  icon text not null default 'Target',
  assigned_members jsonb default '[]'::jsonb,
  status text not null default 'active',
  notes text,
  created_at timestamptz not null default timezone('utc'::text, now())
);
create index if not exists idx_family_goals_user_id on public.family_goals(user_id);
create index if not exists idx_family_goals_user_created on public.family_goals(user_id, created_at desc);
alter table public.family_goals enable row level security;

-- Family Responsibilities
create table if not exists public.family_responsibilities (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default coalesce(auth.uid()::text, 'default_user'),
  title text not null,
  assigned_to text,
  amount numeric(14, 2) not null default 0.00,
  frequency text not null default 'monthly',
  due_date text,
  category text not null default 'Bills',
  is_completed boolean not null default false,
  notes text,
  created_at timestamptz not null default timezone('utc'::text, now())
);
create index if not exists idx_family_resp_user_id on public.family_responsibilities(user_id);
create index if not exists idx_family_resp_user_created on public.family_responsibilities(user_id, created_at desc);
alter table public.family_responsibilities enable row level security;

-- Emergency Vault
create table if not exists public.family_emergency_vault (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default coalesce(auth.uid()::text, 'default_user'),
  title text not null,
  type text not null default 'contact',
  provider_or_name text not null,
  reference_number text,
  contact_number text,
  notes text,
  created_at timestamptz not null default timezone('utc'::text, now())
);
create index if not exists idx_family_vault_user_id on public.family_emergency_vault(user_id);
create index if not exists idx_family_vault_user_created on public.family_emergency_vault(user_id, created_at desc);
alter table public.family_emergency_vault enable row level security;

-- Family RLS Policies
drop policy if exists "Users can view own family members" on public.family_members;
create policy "Users can view own family members" on public.family_members for select to authenticated using (auth.uid()::text = user_id);
drop policy if exists "Users can insert own family members" on public.family_members;
create policy "Users can insert own family members" on public.family_members for insert to authenticated with check (auth.uid()::text = user_id);
drop policy if exists "Users can update own family members" on public.family_members;
create policy "Users can update own family members" on public.family_members for update to authenticated using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
drop policy if exists "Users can delete own family members" on public.family_members;
create policy "Users can delete own family members" on public.family_members for delete to authenticated using (auth.uid()::text = user_id);

drop policy if exists "Users can view own family goals" on public.family_goals;
create policy "Users can view own family goals" on public.family_goals for select to authenticated using (auth.uid()::text = user_id);
drop policy if exists "Users can insert own family goals" on public.family_goals;
create policy "Users can insert own family goals" on public.family_goals for insert to authenticated with check (auth.uid()::text = user_id);
drop policy if exists "Users can update own family goals" on public.family_goals;
create policy "Users can update own family goals" on public.family_goals for update to authenticated using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
drop policy if exists "Users can delete own family goals" on public.family_goals;
create policy "Users can delete own family goals" on public.family_goals for delete to authenticated using (auth.uid()::text = user_id);

drop policy if exists "Users can view own family responsibilities" on public.family_responsibilities;
create policy "Users can view own family responsibilities" on public.family_responsibilities for select to authenticated using (auth.uid()::text = user_id);
drop policy if exists "Users can insert own family responsibilities" on public.family_responsibilities;
create policy "Users can insert own family responsibilities" on public.family_responsibilities for insert to authenticated with check (auth.uid()::text = user_id);
drop policy if exists "Users can update own family responsibilities" on public.family_responsibilities;
create policy "Users can update own family responsibilities" on public.family_responsibilities for update to authenticated using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
drop policy if exists "Users can delete own family responsibilities" on public.family_responsibilities;
create policy "Users can delete own family responsibilities" on public.family_responsibilities for delete to authenticated using (auth.uid()::text = user_id);

drop policy if exists "Users can view own emergency vault" on public.family_emergency_vault;
create policy "Users can view own emergency vault" on public.family_emergency_vault for select to authenticated using (auth.uid()::text = user_id);
drop policy if exists "Users can insert own emergency vault" on public.family_emergency_vault;
create policy "Users can insert own emergency vault" on public.family_emergency_vault for insert to authenticated with check (auth.uid()::text = user_id);
drop policy if exists "Users can update own emergency vault" on public.family_emergency_vault;
create policy "Users can update own emergency vault" on public.family_emergency_vault for update to authenticated using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
drop policy if exists "Users can delete own emergency vault" on public.family_emergency_vault;
create policy "Users can delete own emergency vault" on public.family_emergency_vault for delete to authenticated using (auth.uid()::text = user_id);
-- ============================================================================
-- Migration: 20261113000000_production_financial_core.sql
-- Description: Production Financial Core upgrade for ArthaX
-- Features:
--   1. Account classification (asset vs liability) for accurate Net Worth
--   2. Dedicated Transfers table (account-to-account zero leakage)
--   3. Recurring rules engine & audit logs
--   4. Composite performance indexes
--   5. Atomic PostgreSQL stored procedures with pessimistic row-locking (FOR UPDATE)
-- ============================================================================

-- 1. Enhance accounts table
ALTER TABLE public.accounts 
  ADD COLUMN IF NOT EXISTS classification text NOT NULL DEFAULT 'asset' 
    CHECK (classification IN ('asset', 'liability')),
  ADD COLUMN IF NOT EXISTS currency varchar(3) NOT NULL DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz NULL;

-- Classify known credit card or loan account types as liabilities
UPDATE public.accounts 
SET classification = 'liability' 
WHERE lower(type) LIKE '%credit%' 
   OR lower(name) LIKE '%credit%' 
   OR lower(type) LIKE '%loan%' 
   OR lower(type) LIKE '%borrowing%';

-- 2. Enhance expenses and income tables with tags, currency, and transfer linkage
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS transaction_type text NOT NULL DEFAULT 'expense'
    CHECK (transaction_type IN ('expense', 'transfer_out', 'refund_payout')),
  ADD COLUMN IF NOT EXISTS currency varchar(3) NOT NULL DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS transfer_id uuid NULL,
  ADD COLUMN IF NOT EXISTS recurring_rule_id uuid NULL;

ALTER TABLE public.income
  ADD COLUMN IF NOT EXISTS transaction_type text NOT NULL DEFAULT 'income'
    CHECK (transaction_type IN ('income', 'transfer_in', 'refund_income')),
  ADD COLUMN IF NOT EXISTS currency varchar(3) NOT NULL DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS transfer_id uuid NULL,
  ADD COLUMN IF NOT EXISTS recurring_rule_id uuid NULL;

-- 3. Dedicated Account-to-Account Transfers Table
CREATE TABLE IF NOT EXISTS public.transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL DEFAULT coalesce(auth.uid()::text, 'default_user'),
  from_account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  to_account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  amount numeric(15, 2) NOT NULL CHECK (amount > 0),
  currency varchar(3) NOT NULL DEFAULT 'INR',
  transfer_date date NOT NULL DEFAULT current_date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT chk_different_accounts CHECK (from_account_id <> to_account_id)
);

CREATE INDEX IF NOT EXISTS idx_transfers_user_date ON public.transfers(user_id, transfer_date DESC);
CREATE INDEX IF NOT EXISTS idx_transfers_from_acc ON public.transfers(from_account_id);
CREATE INDEX IF NOT EXISTS idx_transfers_to_acc ON public.transfers(to_account_id);
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own transfers" ON public.transfers;
CREATE POLICY "Users can view own transfers" ON public.transfers
  FOR SELECT TO authenticated
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can insert own transfers" ON public.transfers;
CREATE POLICY "Users can insert own transfers" ON public.transfers
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can update own transfers" ON public.transfers;
CREATE POLICY "Users can update own transfers" ON public.transfers
  FOR UPDATE TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can delete own transfers" ON public.transfers;
CREATE POLICY "Users can delete own transfers" ON public.transfers
  FOR DELETE TO authenticated
  USING (auth.uid()::text = user_id);

-- 4. Recurring Transaction Rules Engine Table
CREATE TABLE IF NOT EXISTS public.recurring_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL DEFAULT coalesce(auth.uid()::text, 'default_user'),
  title text NOT NULL,
  amount numeric(15, 2) NOT NULL CHECK (amount > 0),
  transaction_type text NOT NULL CHECK (transaction_type IN ('expense', 'income', 'transfer')),
  category text NOT NULL DEFAULT 'Other',
  from_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  to_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  frequency text NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
  start_date date NOT NULL DEFAULT current_date,
  next_run_date date NOT NULL,
  last_run_date date NULL,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_recurring_rules_active ON public.recurring_rules(is_active, next_run_date);
ALTER TABLE public.recurring_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own recurring rules" ON public.recurring_rules;
CREATE POLICY "Users can manage own recurring rules" ON public.recurring_rules
  FOR ALL TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

-- 5. Financial Audit & Activity Log Table
CREATE TABLE IF NOT EXISTS public.financial_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  entity_type text NOT NULL, -- 'expense', 'income', 'transfer', 'account'
  entity_id uuid NOT NULL,
  action text NOT NULL,      -- 'CREATE', 'UPDATE', 'DELETE', 'REVERSE'
  delta_amount numeric(15, 2) NULL,
  old_state jsonb NULL,
  new_state jsonb NULL,
  performed_by text NOT NULL DEFAULT coalesce(auth.uid()::text, 'system'),
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_audit_user_created ON public.financial_audit_logs(user_id, created_at DESC);
ALTER TABLE public.financial_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own audit logs" ON public.financial_audit_logs;
CREATE POLICY "Users can read own audit logs" ON public.financial_audit_logs
  FOR SELECT TO authenticated
  USING (auth.uid()::text = user_id);

-- 6. Composite Indexes on Existing Tables for Scalability
CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON public.expenses(user_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_user_account ON public.expenses(user_id, account_id);
CREATE INDEX IF NOT EXISTS idx_expenses_user_category ON public.expenses(user_id, category);

CREATE INDEX IF NOT EXISTS idx_income_user_date ON public.income(user_id, received_date DESC);
CREATE INDEX IF NOT EXISTS idx_income_user_account ON public.income(user_id, account_id);
CREATE INDEX IF NOT EXISTS idx_income_user_category ON public.income(user_id, category);

-- Unique constraint on budgets to avoid duplicate category budgets in same month
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_budget_month 
  ON public.budgets(user_id, category, month_year);

-- Enable Realtime for transfers and recurring rules
ALTER TABLE public.transfers REPLICA IDENTITY FULL;
ALTER TABLE public.recurring_rules REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'transfers') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.transfers;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'recurring_rules') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.recurring_rules;
  END IF;
END $$;

-- ============================================================================
-- 7. ATOMIC FINANCIAL STORED PROCEDURES (ACID with pessimistic row locks)
-- ============================================================================

-- Function: Atomic Record Expense
CREATE OR REPLACE FUNCTION public.fn_record_expense_atomic(
  p_user_id text,
  p_title text,
  p_amount numeric,
  p_category text,
  p_account_id uuid,
  p_expense_date date,
  p_notes text DEFAULT NULL,
  p_tags text[] DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expense_id uuid;
  v_old_balance numeric := 0;
  v_new_balance numeric := 0;
  v_acc_name text := NULL;
  v_acc_classification text := 'asset';
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Expense amount must be strictly greater than zero.';
  END IF;

  -- Lock and Update Account Balance if account provided
  IF p_account_id IS NOT NULL THEN
    SELECT name, balance, classification INTO v_acc_name, v_old_balance, v_acc_classification
    FROM public.accounts
    WHERE id = p_account_id AND user_id = p_user_id
    FOR UPDATE; -- Row-level lock prevents race conditions

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Account % not found or unauthorized for user %.', p_account_id, p_user_id;
    END IF;

    -- If liability (credit card/loan), spending adds to liability.
    -- If asset (bank/cash), spending deducts from available balance.
    IF v_acc_classification = 'liability' THEN
      v_new_balance := round((v_old_balance + p_amount)::numeric, 2);
    ELSE
      v_new_balance := round((v_old_balance - p_amount)::numeric, 2);
    END IF;

    UPDATE public.accounts
    SET balance = v_new_balance
    WHERE id = p_account_id AND user_id = p_user_id;
  END IF;

  -- Insert Expense Record
  INSERT INTO public.expenses (
    user_id, title, amount, category, account_id, expense_date, notes, tags
  )
  VALUES (
    p_user_id, trim(p_title), round(p_amount::numeric, 2), p_category, p_account_id, p_expense_date, p_notes, p_tags
  )
  RETURNING id INTO v_expense_id;

  -- Write Audit Log
  INSERT INTO public.financial_audit_logs (
    user_id, entity_type, entity_id, action, delta_amount, new_state
  )
  VALUES (
    p_user_id, 'expense', v_expense_id, 'CREATE', -p_amount,
    jsonb_build_object('title', p_title, 'amount', p_amount, 'account', v_acc_name, 'new_balance', v_new_balance)
  );

  RETURN jsonb_build_object(
    'expense_id', v_expense_id,
    'account_id', p_account_id,
    'account_name', v_acc_name,
    'new_balance', v_new_balance
  );
END;
$$;

-- Function: Atomic Update Expense (Adjusts balance differences)
CREATE OR REPLACE FUNCTION public.fn_update_expense_atomic(
  p_expense_id uuid,
  p_user_id text,
  p_title text,
  p_amount numeric,
  p_category text,
  p_account_id uuid,
  p_expense_date date,
  p_notes text DEFAULT NULL,
  p_tags text[] DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_rec record;
  v_old_acc record;
  v_new_acc record;
  v_amount_diff numeric;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Expense amount must be strictly greater than zero.';
  END IF;

  SELECT * INTO v_old_rec
  FROM public.expenses
  WHERE id = p_expense_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expense record % not found.', p_expense_id;
  END IF;

  -- Case A: Same account, adjust difference
  IF v_old_rec.account_id IS NOT NULL AND v_old_rec.account_id = p_account_id THEN
    SELECT * INTO v_old_acc FROM public.accounts WHERE id = p_account_id AND user_id = p_user_id FOR UPDATE;
    IF FOUND THEN
      v_amount_diff := p_amount - v_old_rec.amount;
      IF v_old_acc.classification = 'liability' THEN
        UPDATE public.accounts SET balance = round((balance + v_amount_diff)::numeric, 2) WHERE id = p_account_id;
      ELSE
        UPDATE public.accounts SET balance = round((balance - v_amount_diff)::numeric, 2) WHERE id = p_account_id;
      END IF;
    END IF;

  -- Case B: Account changed (revert old account, apply to new account)
  ELSIF v_old_rec.account_id IS DISTINCT FROM p_account_id THEN
    -- Revert old account
    IF v_old_rec.account_id IS NOT NULL THEN
      SELECT * INTO v_old_acc FROM public.accounts WHERE id = v_old_rec.account_id AND user_id = p_user_id FOR UPDATE;
      IF FOUND THEN
        IF v_old_acc.classification = 'liability' THEN
          UPDATE public.accounts SET balance = round((balance - v_old_rec.amount)::numeric, 2) WHERE id = v_old_rec.account_id;
        ELSE
          UPDATE public.accounts SET balance = round((balance + v_old_rec.amount)::numeric, 2) WHERE id = v_old_rec.account_id;
        END IF;
      END IF;
    END IF;

    -- Apply to new account
    IF p_account_id IS NOT NULL THEN
      SELECT * INTO v_new_acc FROM public.accounts WHERE id = p_account_id AND user_id = p_user_id FOR UPDATE;
      IF FOUND THEN
        IF v_new_acc.classification = 'liability' THEN
          UPDATE public.accounts SET balance = round((balance + p_amount)::numeric, 2) WHERE id = p_account_id;
        ELSE
          UPDATE public.accounts SET balance = round((balance - p_amount)::numeric, 2) WHERE id = p_account_id;
        END IF;
      END IF;
    END IF;
  END IF;

  -- Update expense row
  UPDATE public.expenses
  SET title = trim(p_title),
      amount = round(p_amount::numeric, 2),
      category = p_category,
      account_id = p_account_id,
      expense_date = p_expense_date,
      notes = p_notes,
      tags = p_tags
  WHERE id = p_expense_id AND user_id = p_user_id;

  -- Audit log
  INSERT INTO public.financial_audit_logs (user_id, entity_type, entity_id, action, delta_amount, old_state, new_state)
  VALUES (
    p_user_id, 'expense', p_expense_id, 'UPDATE', p_amount - v_old_rec.amount,
    to_jsonb(v_old_rec),
    jsonb_build_object('title', p_title, 'amount', p_amount, 'account_id', p_account_id)
  );

  RETURN jsonb_build_object('success', true, 'expense_id', p_expense_id);
END;
$$;

-- Function: Atomic Delete Expense (Refunds balance to account)
CREATE OR REPLACE FUNCTION public.fn_delete_expense_atomic(
  p_expense_id uuid,
  p_user_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec record;
  v_acc record;
  v_reversed_balance numeric := NULL;
BEGIN
  SELECT * INTO v_rec
  FROM public.expenses
  WHERE id = p_expense_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expense record not found.';
  END IF;

  -- Refund / reverse balance on account
  IF v_rec.account_id IS NOT NULL THEN
    SELECT * INTO v_acc
    FROM public.accounts
    WHERE id = v_rec.account_id AND user_id = p_user_id
    FOR UPDATE;

    IF FOUND THEN
      IF v_acc.classification = 'liability' THEN
        v_reversed_balance := round((v_acc.balance - v_rec.amount)::numeric, 2);
      ELSE
        v_reversed_balance := round((v_acc.balance + v_rec.amount)::numeric, 2);
      END IF;

      UPDATE public.accounts
      SET balance = v_reversed_balance
      WHERE id = v_rec.account_id AND user_id = p_user_id;
    END IF;
  END IF;

  DELETE FROM public.expenses WHERE id = p_expense_id AND user_id = p_user_id;

  INSERT INTO public.financial_audit_logs (user_id, entity_type, entity_id, action, delta_amount, old_state)
  VALUES (
    p_user_id, 'expense', p_expense_id, 'DELETE_AND_REVERSE', v_rec.amount,
    to_jsonb(v_rec)
  );

  RETURN jsonb_build_object(
    'success', true,
    'deleted_expense_id', p_expense_id,
    'reversed_amount', v_rec.amount,
    'account_new_balance', v_reversed_balance
  );
END;
$$;

-- Function: Atomic Record Income
CREATE OR REPLACE FUNCTION public.fn_record_income_atomic(
  p_user_id text,
  p_title text,
  p_amount numeric,
  p_category text,
  p_frequency text,
  p_account_id uuid,
  p_received_date date,
  p_notes text DEFAULT NULL,
  p_tags text[] DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_income_id uuid;
  v_old_balance numeric := 0;
  v_new_balance numeric := 0;
  v_acc_name text := NULL;
  v_acc_classification text := 'asset';
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Income amount must be strictly greater than zero.';
  END IF;

  IF p_account_id IS NOT NULL THEN
    SELECT name, balance, classification INTO v_acc_name, v_old_balance, v_acc_classification
    FROM public.accounts
    WHERE id = p_account_id AND user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Account % not found or unauthorized.', p_account_id;
    END IF;

    -- If liability, income/payment decreases the debt.
    -- If asset, income increases available balance.
    IF v_acc_classification = 'liability' THEN
      v_new_balance := round((v_old_balance - p_amount)::numeric, 2);
    ELSE
      v_new_balance := round((v_old_balance + p_amount)::numeric, 2);
    END IF;

    UPDATE public.accounts
    SET balance = v_new_balance
    WHERE id = p_account_id AND user_id = p_user_id;
  END IF;

  INSERT INTO public.income (
    user_id, title, amount, category, frequency, account_id, received_date, notes, tags
  )
  VALUES (
    p_user_id, trim(p_title), round(p_amount::numeric, 2), p_category, p_frequency, p_account_id, p_received_date, p_notes, p_tags
  )
  RETURNING id INTO v_income_id;

  INSERT INTO public.financial_audit_logs (user_id, entity_type, entity_id, action, delta_amount, new_state)
  VALUES (
    p_user_id, 'income', v_income_id, 'CREATE', p_amount,
    jsonb_build_object('title', p_title, 'amount', p_amount, 'account', v_acc_name, 'new_balance', v_new_balance)
  );

  RETURN jsonb_build_object(
    'income_id', v_income_id,
    'account_id', p_account_id,
    'account_name', v_acc_name,
    'new_balance', v_new_balance
  );
END;
$$;

-- Function: Atomic Delete Income (Deducts credited amount from account)
CREATE OR REPLACE FUNCTION public.fn_delete_income_atomic(
  p_income_id uuid,
  p_user_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec record;
  v_acc record;
  v_reversed_balance numeric := NULL;
BEGIN
  SELECT * INTO v_rec
  FROM public.income
  WHERE id = p_income_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Income record not found.';
  END IF;

  IF v_rec.account_id IS NOT NULL THEN
    SELECT * INTO v_acc
    FROM public.accounts
    WHERE id = v_rec.account_id AND user_id = p_user_id
    FOR UPDATE;

    IF FOUND THEN
      IF v_acc.classification = 'liability' THEN
        v_reversed_balance := round((v_acc.balance + v_rec.amount)::numeric, 2);
      ELSE
        v_reversed_balance := round((v_acc.balance - v_rec.amount)::numeric, 2);
      END IF;

      UPDATE public.accounts
      SET balance = v_reversed_balance
      WHERE id = v_rec.account_id AND user_id = p_user_id;
    END IF;
  END IF;

  DELETE FROM public.income WHERE id = p_income_id AND user_id = p_user_id;

  INSERT INTO public.financial_audit_logs (user_id, entity_type, entity_id, action, delta_amount, old_state)
  VALUES (
    p_user_id, 'income', p_income_id, 'DELETE_AND_REVERSE', -v_rec.amount,
    to_jsonb(v_rec)
  );

  RETURN jsonb_build_object(
    'success', true,
    'deleted_income_id', p_income_id,
    'reversed_amount', v_rec.amount,
    'account_new_balance', v_reversed_balance
  );
END;
$$;

-- Function: Atomic Transfer Between Accounts
CREATE OR REPLACE FUNCTION public.fn_record_transfer_atomic(
  p_user_id text,
  p_from_account_id uuid,
  p_to_account_id uuid,
  p_amount numeric,
  p_transfer_date date,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transfer_id uuid;
  v_from_bal numeric;
  v_to_bal numeric;
  v_from_name text;
  v_to_name text;
  v_from_class text;
  v_to_class text;
  v_from_new_bal numeric;
  v_to_new_bal numeric;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Transfer amount must be strictly greater than zero.';
  END IF;
  IF p_from_account_id = p_to_account_id THEN
    RAISE EXCEPTION 'Source and destination accounts must be distinct.';
  END IF;

  -- Lock both accounts in deterministic sorted order to prevent deadlocks
  IF p_from_account_id < p_to_account_id THEN
    SELECT name, balance, classification INTO v_from_name, v_from_bal, v_from_class 
    FROM public.accounts WHERE id = p_from_account_id AND user_id = p_user_id FOR UPDATE;
    SELECT name, balance, classification INTO v_to_name, v_to_bal, v_to_class 
    FROM public.accounts WHERE id = p_to_account_id AND user_id = p_user_id FOR UPDATE;
  ELSE
    SELECT name, balance, classification INTO v_to_name, v_to_bal, v_to_class 
    FROM public.accounts WHERE id = p_to_account_id AND user_id = p_user_id FOR UPDATE;
    SELECT name, balance, classification INTO v_from_name, v_from_bal, v_from_class 
    FROM public.accounts WHERE id = p_from_account_id AND user_id = p_user_id FOR UPDATE;
  END IF;

  IF v_from_name IS NULL OR v_to_name IS NULL THEN
    RAISE EXCEPTION 'One or both accounts do not exist or access is unauthorized.';
  END IF;

  -- Debit source account:
  -- If from_account is asset (bank), balance decreases.
  -- If from_account is liability (credit card cash advance), balance (debt) increases.
  IF v_from_class = 'liability' THEN
    v_from_new_bal := round((v_from_bal + p_amount)::numeric, 2);
  ELSE
    v_from_new_bal := round((v_from_bal - p_amount)::numeric, 2);
  END IF;

  -- Credit destination account:
  -- If to_account is asset (cash), balance increases.
  -- If to_account is liability (paying credit card bill), debt balance decreases.
  IF v_to_class = 'liability' THEN
    v_to_new_bal := round((v_to_bal - p_amount)::numeric, 2);
  ELSE
    v_to_new_bal := round((v_to_bal + p_amount)::numeric, 2);
  END IF;

  UPDATE public.accounts SET balance = v_from_new_bal WHERE id = p_from_account_id;
  UPDATE public.accounts SET balance = v_to_new_bal WHERE id = p_to_account_id;

  INSERT INTO public.transfers (
    user_id, from_account_id, to_account_id, amount, transfer_date, notes
  )
  VALUES (
    p_user_id, p_from_account_id, p_to_account_id, round(p_amount::numeric, 2), p_transfer_date, p_notes
  )
  RETURNING id INTO v_transfer_id;

  INSERT INTO public.financial_audit_logs (user_id, entity_type, entity_id, action, delta_amount, new_state)
  VALUES (
    p_user_id, 'transfer', v_transfer_id, 'EXECUTE_TRANSFER', p_amount,
    jsonb_build_object(
      'from_account', v_from_name,
      'to_account', v_to_name,
      'amount', p_amount,
      'from_new_balance', v_from_new_bal,
      'to_new_balance', v_to_new_bal
    )
  );

  RETURN jsonb_build_object(
    'transfer_id', v_transfer_id,
    'from_account', v_from_name,
    'to_account', v_to_name,
    'amount', p_amount,
    'from_new_balance', v_from_new_bal,
    'to_new_balance', v_to_new_bal
  );
END;
$$;

-- Function: Atomic Delete Transfer (Reverses transfer balances)
CREATE OR REPLACE FUNCTION public.fn_delete_transfer_atomic(
  p_transfer_id uuid,
  p_user_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tr record;
  v_from_acc record;
  v_to_acc record;
BEGIN
  SELECT * INTO v_tr
  FROM public.transfers
  WHERE id = p_transfer_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transfer record not found.';
  END IF;

  -- Lock both accounts
  IF v_tr.from_account_id < v_tr.to_account_id THEN
    SELECT * INTO v_from_acc FROM public.accounts WHERE id = v_tr.from_account_id FOR UPDATE;
    SELECT * INTO v_to_acc FROM public.accounts WHERE id = v_tr.to_account_id FOR UPDATE;
  ELSE
    SELECT * INTO v_to_acc FROM public.accounts WHERE id = v_tr.to_account_id FOR UPDATE;
    SELECT * INTO v_from_acc FROM public.accounts WHERE id = v_tr.from_account_id FOR UPDATE;
  END IF;

  -- Reverse source account
  IF v_from_acc.classification = 'liability' THEN
    UPDATE public.accounts SET balance = round((balance - v_tr.amount)::numeric, 2) WHERE id = v_tr.from_account_id;
  ELSE
    UPDATE public.accounts SET balance = round((balance + v_tr.amount)::numeric, 2) WHERE id = v_tr.from_account_id;
  END IF;

  -- Reverse destination account
  IF v_to_acc.classification = 'liability' THEN
    UPDATE public.accounts SET balance = round((balance + v_tr.amount)::numeric, 2) WHERE id = v_tr.to_account_id;
  ELSE
    UPDATE public.accounts SET balance = round((balance - v_tr.amount)::numeric, 2) WHERE id = v_tr.to_account_id;
  END IF;

  DELETE FROM public.transfers WHERE id = p_transfer_id AND user_id = p_user_id;

  INSERT INTO public.financial_audit_logs (user_id, entity_type, entity_id, action, delta_amount, old_state)
  VALUES (
    p_user_id, 'transfer', p_transfer_id, 'DELETE_AND_REVERSE', v_tr.amount,
    to_jsonb(v_tr)
  );

  RETURN jsonb_build_object('success', true, 'deleted_transfer_id', p_transfer_id);
END;
$$;
-- Migration: 20261113000001_create_wipe_user_data_function.sql
-- Function to perform an atomic, cascade-safe master wipe of all user data.

CREATE OR REPLACE FUNCTION public.fn_wipe_user_data(p_user_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cash_id uuid;
  v_deleted_expenses int := 0;
  v_deleted_income int := 0;
  v_deleted_transfers int := 0;
  v_deleted_budgets int := 0;
  v_deleted_rules int := 0;
  v_deleted_family_resp int := 0;
  v_deleted_family_goals int := 0;
  v_deleted_family_vault int := 0;
  v_deleted_family_members int := 0;
  v_deleted_accounts int := 0;
BEGIN
  IF p_user_id IS NULL OR trim(p_user_id) = '' THEN
    RAISE EXCEPTION 'p_user_id is required';
  END IF;

  -- 1. Transfers (must delete before accounts due to ON DELETE RESTRICT on accounts)
  DELETE FROM public.transfers WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_transfers = ROW_COUNT;

  -- 2. Recurring transaction rules
  DELETE FROM public.recurring_rules WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_rules = ROW_COUNT;

  -- 3. Expenses
  DELETE FROM public.expenses WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_expenses = ROW_COUNT;

  -- 4. Income
  DELETE FROM public.income WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_income = ROW_COUNT;

  -- 5. Budgets
  DELETE FROM public.budgets WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_budgets = ROW_COUNT;

  -- 6. Family tables
  DELETE FROM public.family_responsibilities WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_family_resp = ROW_COUNT;

  DELETE FROM public.family_goals WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_family_goals = ROW_COUNT;

  DELETE FROM public.family_emergency_vault WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_family_vault = ROW_COUNT;

  DELETE FROM public.family_members WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_family_members = ROW_COUNT;

  -- 7. Audit logs
  DELETE FROM public.financial_audit_logs WHERE user_id = p_user_id;

  -- 8. Identify existing Cash in Hand account
  SELECT id INTO v_cash_id
  FROM public.accounts
  WHERE user_id = p_user_id
    AND (
      id = '00000000-0000-0000-0000-000000000001'
      OR last_four = 'CASH'
      OR lower(name) = 'cash in hand'
    )
  ORDER BY created_at ASC
  LIMIT 1;

  -- Delete all other accounts
  IF v_cash_id IS NOT NULL THEN
    DELETE FROM public.accounts WHERE user_id = p_user_id AND id <> v_cash_id;
    GET DIAGNOSTICS v_deleted_accounts = ROW_COUNT;

    -- Reset Cash in Hand balance to 0.00
    UPDATE public.accounts
    SET balance = 0.00,
        updated_at = timezone('utc'::text, now())
    WHERE id = v_cash_id;
  ELSE
    DELETE FROM public.accounts WHERE user_id = p_user_id;
    GET DIAGNOSTICS v_deleted_accounts = ROW_COUNT;

    -- Create fresh default cash account
    INSERT INTO public.accounts (user_id, name, type, balance, last_four)
    VALUES (p_user_id, 'Cash in Hand', 'Liquid Cash', 0.00, 'CASH');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Workspace wiped successfully',
    'deleted_transfers', v_deleted_transfers,
    'deleted_rules', v_deleted_rules,
    'deleted_expenses', v_deleted_expenses,
    'deleted_income', v_deleted_income,
    'deleted_budgets', v_deleted_budgets,
    'deleted_accounts', v_deleted_accounts,
    'deleted_family_members', v_deleted_family_members,
    'deleted_family_goals', v_deleted_family_goals,
    'deleted_family_resp', v_deleted_family_resp,
    'deleted_family_vault', v_deleted_family_vault
  );
END;
$$;

-- Grant execution to authenticated users and service role
GRANT EXECUTE ON FUNCTION public.fn_wipe_user_data(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_wipe_user_data(text) TO service_role;
