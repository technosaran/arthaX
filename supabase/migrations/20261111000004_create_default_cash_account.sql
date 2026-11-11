-- Migration: 20261111000004_create_default_cash_account.sql
-- Default non-deletable Cash in Hand account

insert into public.accounts (id, user_id, name, type, balance, last_four)
values (
  '00000000-0000-0000-0000-000000000001',
  'default_user',
  'Cash in Hand',
  'Liquid Cash',
  0.00,
  'CASH'
)
on conflict (id) do nothing;
