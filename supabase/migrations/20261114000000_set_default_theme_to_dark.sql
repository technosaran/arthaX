-- Migration: 20261114000000_set_default_theme_to_dark.sql
-- Set default theme to 'dark' and migrate any existing 'ultra' entries

alter table public.user_settings
  alter column theme set default 'dark';

update public.user_settings
  set theme = 'dark'
  where theme = 'ultra';
