-- Migration: Create Family Finance, Shared Goals, Responsibilities and Emergency Vault Tables
-- Multi-tenant isolation enforced via RLS

-- 1. Family Members Table
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
  notes text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_family_members_user_id on public.family_members(user_id);
create index if not exists idx_family_members_user_created on public.family_members(user_id, created_at desc);
alter table public.family_members enable row level security;

-- 2. Family Goals Table
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

-- 3. Household Planning / Responsibilities Table
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

-- 4. Emergency Vault / Safety Records Table
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

-- RLS Policies
-- Family Members
drop policy if exists "Users can view own family members" on public.family_members;
create policy "Users can view own family members" on public.family_members for select to authenticated using (auth.uid()::text = user_id);

drop policy if exists "Users can insert own family members" on public.family_members;
create policy "Users can insert own family members" on public.family_members for insert to authenticated with check (auth.uid()::text = user_id);

drop policy if exists "Users can update own family members" on public.family_members;
create policy "Users can update own family members" on public.family_members for update to authenticated using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);

drop policy if exists "Users can delete own family members" on public.family_members;
create policy "Users can delete own family members" on public.family_members for delete to authenticated using (auth.uid()::text = user_id);

-- Family Goals
drop policy if exists "Users can view own family goals" on public.family_goals;
create policy "Users can view own family goals" on public.family_goals for select to authenticated using (auth.uid()::text = user_id);

drop policy if exists "Users can insert own family goals" on public.family_goals;
create policy "Users can insert own family goals" on public.family_goals for insert to authenticated with check (auth.uid()::text = user_id);

drop policy if exists "Users can update own family goals" on public.family_goals;
create policy "Users can update own family goals" on public.family_goals for update to authenticated using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);

drop policy if exists "Users can delete own family goals" on public.family_goals;
create policy "Users can delete own family goals" on public.family_goals for delete to authenticated using (auth.uid()::text = user_id);

-- Family Responsibilities
drop policy if exists "Users can view own family responsibilities" on public.family_responsibilities;
create policy "Users can view own family responsibilities" on public.family_responsibilities for select to authenticated using (auth.uid()::text = user_id);

drop policy if exists "Users can insert own family responsibilities" on public.family_responsibilities;
create policy "Users can insert own family responsibilities" on public.family_responsibilities for insert to authenticated with check (auth.uid()::text = user_id);

drop policy if exists "Users can update own family responsibilities" on public.family_responsibilities;
create policy "Users can update own family responsibilities" on public.family_responsibilities for update to authenticated using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);

drop policy if exists "Users can delete own family responsibilities" on public.family_responsibilities;
create policy "Users can delete own family responsibilities" on public.family_responsibilities for delete to authenticated using (auth.uid()::text = user_id);

-- Family Emergency Vault
drop policy if exists "Users can view own emergency vault" on public.family_emergency_vault;
create policy "Users can view own emergency vault" on public.family_emergency_vault for select to authenticated using (auth.uid()::text = user_id);

drop policy if exists "Users can insert own emergency vault" on public.family_emergency_vault;
create policy "Users can insert own emergency vault" on public.family_emergency_vault for insert to authenticated with check (auth.uid()::text = user_id);

drop policy if exists "Users can update own emergency vault" on public.family_emergency_vault;
create policy "Users can update own emergency vault" on public.family_emergency_vault for update to authenticated using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);

drop policy if exists "Users can delete own emergency vault" on public.family_emergency_vault;
create policy "Users can delete own emergency vault" on public.family_emergency_vault for delete to authenticated using (auth.uid()::text = user_id);

-- Enable Realtime Publications
alter table public.family_members replica identity full;
alter table public.family_goals replica identity full;
alter table public.family_responsibilities replica identity full;
alter table public.family_emergency_vault replica identity full;

do $$
begin
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
