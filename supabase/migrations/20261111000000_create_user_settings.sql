-- Migration: 20261111000000_create_user_settings.sql

create table if not exists public.user_settings (
  id text primary key default 'default_user',
  name text not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.user_settings enable row level security;

-- Policies allowing read and write access
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'user_settings' and policyname = 'Allow public read'
  ) then
    create policy "Allow public read" on public.user_settings for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'user_settings' and policyname = 'Allow public insert'
  ) then
    create policy "Allow public insert" on public.user_settings for insert with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'user_settings' and policyname = 'Allow public update'
  ) then
    create policy "Allow public update" on public.user_settings for update using (true);
  end if;
end $$;

-- Insert initial record
insert into public.user_settings (id, name)
values ('default_user', 'Saran')
on conflict (id) do nothing;
