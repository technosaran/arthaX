-- Consolidated Supabase Schema for arthaX Multi-Tenant Architecture
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/fvpfzbuoizzjwgekuhot/sql

-- 1. User Settings Table
create table if not exists public.user_settings (
  id text primary key,
  name text not null default 'User',
  theme text not null default 'ultra',
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

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
    'ultra'
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
end $$;
