-- Migration: 20261114000001_add_telegram_integration.sql
-- Adds Telegram Bot integration fields to user_settings and family_members

-- 1. Add Telegram columns to user_settings
alter table public.user_settings
  add column if not exists telegram_chat_id text,
  add column if not exists telegram_username text,
  add column if not exists telegram_link_token text,
  add column if not exists telegram_linked_at timestamptz;

create index if not exists idx_user_settings_telegram_chat_id 
  on public.user_settings(telegram_chat_id);

create index if not exists idx_user_settings_telegram_link_token 
  on public.user_settings(telegram_link_token);

-- 2. Add Telegram columns to family_members for multi-member household logging
alter table public.family_members
  add column if not exists telegram_chat_id text,
  add column if not exists telegram_username text;

create index if not exists idx_family_members_telegram_chat_id 
  on public.family_members(telegram_chat_id);
