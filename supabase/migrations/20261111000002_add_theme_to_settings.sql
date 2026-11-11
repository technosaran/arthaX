-- Migration: 20261111000002_add_theme_to_settings.sql

alter table public.user_settings
  add column if not exists theme text not null default 'ultra';
