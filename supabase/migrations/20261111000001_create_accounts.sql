-- Migration: 20261111000001_create_accounts.sql

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default 'default_user',
  name text not null,
  type text not null,
  balance numeric(15, 2) not null default 0.00,
  last_four text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.accounts enable row level security;

-- Policies allowing select, insert, update, delete
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'accounts' and policyname = 'Allow public read accounts'
  ) then
    create policy "Allow public read accounts" on public.accounts for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'accounts' and policyname = 'Allow public insert accounts'
  ) then
    create policy "Allow public insert accounts" on public.accounts for insert with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'accounts' and policyname = 'Allow public update accounts'
  ) then
    create policy "Allow public update accounts" on public.accounts for update using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'accounts' and policyname = 'Allow public delete accounts'
  ) then
    create policy "Allow public delete accounts" on public.accounts for delete using (true);
  end if;
end $$;
