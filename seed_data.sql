-- ====================================================================
-- REALISTIC SEED DATA SCRIPT FOR FINANCE DASHBOARD
-- Links all sections: Accounts, Incomes, Expenses, Transactions,
-- Investments, Mutual Funds, Bonds, Alt Assets, Liabilities, Goals, Budgets, Ledger Logs
-- ====================================================================

DO $$
DECLARE
  v_user_id UUID;
  v_hdfc_id UUID := gen_random_uuid();
  v_icici_id UUID := gen_random_uuid();
  v_zerodha_id UUID := gen_random_uuid();
  
  v_inc1_id UUID := gen_random_uuid();
  v_inc2_id UUID := gen_random_uuid();
  v_inc3_id UUID := gen_random_uuid();
  
  v_exp1_id UUID := gen_random_uuid();
  v_exp2_id UUID := gen_random_uuid();
  v_exp3_id UUID := gen_random_uuid();
  v_exp4_id UUID := gen_random_uuid();
  v_exp5_id UUID := gen_random_uuid();
  v_exp6_id UUID := gen_random_uuid();
  v_exp7_id UUID := gen_random_uuid();

  v_stock1_id UUID := gen_random_uuid();
  v_stock2_id UUID := gen_random_uuid();
  v_stock3_id UUID := gen_random_uuid();
  v_stock4_id UUID := gen_random_uuid();
  v_stock5_id UUID := gen_random_uuid();

  v_mf1_id UUID := gen_random_uuid();
  v_mf2_id UUID := gen_random_uuid();
  v_mf3_id UUID := gen_random_uuid();
BEGIN
  -- Get active authenticated user (or default to first user in auth.users)
  SELECT id INTO v_user_id FROM auth.users ORDER BY created_at ASC LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'No user found in auth.users. Please register/login first.';
    RETURN;
  END IF;

  RAISE NOTICE 'Seeding interconnected financial data for user_id: %', v_user_id;

  -- ------------------------------------------------------------------
  -- 1. PROFILES: Enable all dashboard modules & set INR currency
  -- ------------------------------------------------------------------
  INSERT INTO public.profiles (id, enabled_modules, base_currency, updated_at)
  VALUES (
    v_user_id,
    '["Dashboard", "Accounts", "Income", "Expenses", "Budget", "Stocks", "Mutual Funds", "Bonds", "Alt Assets", "Liabilities", "Goals", "Tax & Reports", "Crypto"]',
    'INR',
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    enabled_modules = EXCLUDED.enabled_modules,
    base_currency = EXCLUDED.base_currency,
    updated_at = NOW();

  -- ------------------------------------------------------------------
  -- 2. ACCOUNTS: Seed linked bank & trading accounts
  -- ------------------------------------------------------------------
  INSERT INTO public.accounts (id, user_id, name, type, bank_name, account_number, balance, currency, institution, color)
  VALUES
    (v_hdfc_id, v_user_id, 'HDFC Salary Account', 'bank', 'HDFC Bank', 'XX7890', 245000.00, 'INR', 'HDFC Bank Ltd', '#004B87'),
    (v_icici_id, v_user_id, 'ICICI Wealth Savings', 'bank', 'ICICI Bank', 'XX3412', 180000.00, 'INR', 'ICICI Bank Ltd', '#F37021'),
    (v_zerodha_id, v_user_id, 'Zerodha Demat Trading', 'investment', 'Zerodha', '10984512', 45000.00, 'INR', 'Zerodha Broking Ltd', '#388E3C')
  ON CONFLICT (id) DO NOTHING;

  -- ------------------------------------------------------------------
  -- 3. INCOMES: Seed recurring & regular salary, rental & dividend inflows
  -- ------------------------------------------------------------------
  INSERT INTO public.incomes (id, user_id, description, amount, category, date, account_id, is_recurring, recurrence_frequency)
  VALUES
    (v_inc1_id, v_user_id, 'Monthly Salary - Senior Tech Lead', 185000.00, 'Salary', CURRENT_DATE - INTERVAL '5 days', v_hdfc_id, true, 'monthly'),
    (v_inc2_id, v_user_id, 'House Rental Income - Flat 302', 25000.00, 'Rental Income', CURRENT_DATE - INTERVAL '10 days', v_icici_id, true, 'monthly'),
    (v_inc3_id, v_user_id, 'Q3 Dividend - Reliance Industries', 4500.00, 'Dividend', CURRENT_DATE - INTERVAL '15 days', v_hdfc_id, false, null)
  ON CONFLICT (id) DO NOTHING;

  -- ------------------------------------------------------------------
  -- 4. EXPENSES: Seed Section 80C/80D tax deductions & living expenses
  -- ------------------------------------------------------------------
  INSERT INTO public.expenses (id, user_id, description, amount, category, date, account_id, is_recurring)
  VALUES
    (v_exp1_id, v_user_id, 'Apartment Rent (HRA Eligible)', 28000.00, 'House Rent', CURRENT_DATE - INTERVAL '2 days', v_hdfc_id, true),
    (v_exp2_id, v_user_id, 'EPF Salary Deduction (Sec 80C)', 12500.00, 'EPF', CURRENT_DATE - INTERVAL '5 days', v_hdfc_id, true),
    (v_exp3_id, v_user_id, 'HDFC ERGO Health Insurance (Sec 80D)', 2200.00, 'Health Insurance', CURRENT_DATE - INTERVAL '8 days', v_hdfc_id, true),
    (v_exp4_id, v_user_id, 'NPS Contribution (Sec 80CCD 1B)', 4166.00, 'NPS', CURRENT_DATE - INTERVAL '12 days', v_icici_id, true),
    (v_exp5_id, v_user_id, 'Advance Tax Q3 Payment', 15000.00, 'Advance Tax', CURRENT_DATE - INTERVAL '20 days', v_icici_id, false),
    (v_exp6_id, v_user_id, 'Groceries & Organic Supplies', 8500.00, 'Food & Dining', CURRENT_DATE - INTERVAL '3 days', v_hdfc_id, false),
    (v_exp7_id, v_user_id, 'Electricity & High-Speed Fiber', 3800.00, 'Utilities', CURRENT_DATE - INTERVAL '6 days', v_icici_id, false)
  ON CONFLICT (id) DO NOTHING;

  -- ------------------------------------------------------------------
  -- 5. TRANSACTIONS: Link income & expense events to account histories
  -- ------------------------------------------------------------------
  INSERT INTO public.transactions (id, user_id, account_id, amount, type, category, description, date, source_id, source_type)
  VALUES
    (gen_random_uuid(), v_user_id, v_hdfc_id, 185000.00, 'income', 'Salary', 'Monthly Salary - Senior Tech Lead', CURRENT_DATE - INTERVAL '5 days', v_inc1_id, 'income'),
    (gen_random_uuid(), v_user_id, v_icici_id, 25000.00, 'income', 'Rental Income', 'House Rental Income - Flat 302', CURRENT_DATE - INTERVAL '10 days', v_inc2_id, 'income'),
    (gen_random_uuid(), v_user_id, v_hdfc_id, 4500.00, 'income', 'Dividend', 'Q3 Dividend - Reliance Industries', CURRENT_DATE - INTERVAL '15 days', v_inc3_id, 'income'),
    (gen_random_uuid(), v_user_id, v_hdfc_id, 28000.00, 'expense', 'House Rent', 'Apartment Rent (HRA Eligible)', CURRENT_DATE - INTERVAL '2 days', v_exp1_id, 'expense'),
    (gen_random_uuid(), v_user_id, v_hdfc_id, 12500.00, 'expense', 'EPF', 'EPF Salary Deduction (Sec 80C)', CURRENT_DATE - INTERVAL '5 days', v_exp2_id, 'expense'),
    (gen_random_uuid(), v_user_id, v_hdfc_id, 2200.00, 'expense', 'Health Insurance', 'HDFC ERGO Health Insurance (Sec 80D)', CURRENT_DATE - INTERVAL '8 days', v_exp3_id, 'expense'),
    (gen_random_uuid(), v_user_id, v_icici_id, 4166.00, 'expense', 'NPS', 'NPS Contribution (Sec 80CCD 1B)', CURRENT_DATE - INTERVAL '12 days', v_exp4_id, 'expense'),
    (gen_random_uuid(), v_user_id, v_icici_id, 15000.00, 'expense', 'Advance Tax', 'Advance Tax Q3 Payment', CURRENT_DATE - INTERVAL '20 days', v_exp5_id, 'expense'),
    (gen_random_uuid(), v_user_id, v_hdfc_id, 8500.00, 'expense', 'Food & Dining', 'Groceries & Organic Supplies', CURRENT_DATE - INTERVAL '3 days', v_exp6_id, 'expense'),
    (gen_random_uuid(), v_user_id, v_icici_id, 3800.00, 'expense', 'Utilities', 'Electricity & High-Speed Fiber', CURRENT_DATE - INTERVAL '6 days', v_exp7_id, 'expense')
  ON CONFLICT DO NOTHING;

  -- ------------------------------------------------------------------
  -- 6. STOCKS & INVESTMENTS: Seed Indian Bluechips & US Equities
  -- ------------------------------------------------------------------
  INSERT INTO public.investments (id, user_id, symbol, name, type, quantity, buy_price, current_price, currency, bought_at, previous_close, day_change)
  VALUES
    (v_stock1_id, v_user_id, 'RELIANCE', 'Reliance Industries Ltd', 'Equity', 15, 2750.00, 2980.00, 'INR', CURRENT_DATE - INTERVAL '180 days', 2950.00, 30.00),
    (v_stock2_id, v_user_id, 'TCS', 'Tata Consultancy Services', 'Equity', 10, 3600.00, 4120.00, 'INR', CURRENT_DATE - INTERVAL '220 days', 4090.00, 30.00),
    (v_stock3_id, v_user_id, 'INFY', 'Infosys Limited', 'Equity', 25, 1450.00, 1820.00, 'INR', CURRENT_DATE - INTERVAL '120 days', 1800.00, 20.00),
    (v_stock4_id, v_user_id, 'HDFCBANK', 'HDFC Bank Limited', 'Equity', 30, 1520.00, 1640.00, 'INR', CURRENT_DATE - INTERVAL '90 days', 1630.00, 10.00),
    (v_stock5_id, v_user_id, 'AAPL', 'Apple Inc.', 'US Equities', 5, 175.00, 225.00, 'USD', CURRENT_DATE - INTERVAL '300 days', 222.00, 3.00)
  ON CONFLICT (id) DO NOTHING;

  -- ------------------------------------------------------------------
  -- 7. MUTUAL FUNDS: Seed Top Performing Direct Growth Funds
  -- ------------------------------------------------------------------
  INSERT INTO public.mutual_funds (id, user_id, fund_name, fund_symbol, scheme_code, amc_name, category, units, avg_nav, current_nav, previous_nav, day_change)
  VALUES
    (v_mf1_id, v_user_id, 'Parag Parikh Flexi Cap Fund - Direct Growth', 'PPFCF', '122639', 'PPFAS Mutual Fund', 'Flexi Cap', 450.00, 62.50, 78.40, 77.90, 0.50),
    (v_mf2_id, v_user_id, 'Mirae Asset Large Cap Fund - Direct Growth', 'MALCF', '118834', 'Mirae Asset Mutual Fund', 'Large Cap', 320.00, 85.00, 98.20, 97.60, 0.60),
    (v_mf3_id, v_user_id, 'UTI Nifty 50 Index Fund - Direct Growth', 'UTIN50', '120716', 'UTI Mutual Fund', 'Index Fund', 600.00, 115.00, 142.50, 141.80, 0.70)
  ON CONFLICT (id) DO NOTHING;

  -- ------------------------------------------------------------------
  -- 8. BONDS: Seed Sovereign Gold Bond & 54EC Tax Savings Bond
  -- ------------------------------------------------------------------
  INSERT INTO public.bonds (id, user_id, bond_name, isin, bond_type, issuer, face_value, quantity, purchase_price, current_price, current_value, coupon_rate, purchase_date, maturity_date)
  VALUES
    (gen_random_uuid(), v_user_id, 'Sovereign Gold Bond 2023-24 Series III', 'IN0020230182', 'SGB', 'Reserve Bank of India', 6100.00, 10, 6100.00, 7450.00, 74500.00, 2.50, '2023-11-20', '2031-11-20'),
    (gen_random_uuid(), v_user_id, 'NHAI 54EC Capital Gains Exemption Bond', 'INE906J07062', '54EC', 'National Highways Authority of India', 10000.00, 2, 10000.00, 10000.00, 20000.00, 5.25, '2024-02-15', '2029-02-15')
  ON CONFLICT (id) DO NOTHING;

  -- ------------------------------------------------------------------
  -- 9. ALTERNATIVE ASSETS: Physical Gold Bullion
  -- ------------------------------------------------------------------
  INSERT INTO public.alternative_assets (id, user_id, name, category, purchase_price, current_value, purchase_date, notes)
  VALUES
    (gen_random_uuid(), v_user_id, '24K Gold Bullion Coins (50g)', 'Gold', 310000.00, 375000.00, '2023-05-10', 'Stored in HDFC Bank Safe Locker #142')
  ON CONFLICT (id) DO NOTHING;

  -- ------------------------------------------------------------------
  -- 10. LIABILITIES: Housing Loan & Car Loan
  -- ------------------------------------------------------------------
  INSERT INTO public.liabilities (id, user_id, name, category, total_amount, remaining_amount, interest_rate, monthly_payment, due_date)
  VALUES
    (gen_random_uuid(), v_user_id, 'HDFC Housing Loan', 'Home Loan', 4500000.00, 3850000.00, 8.50, 38200.00, '10th of every month'),
    (gen_random_uuid(), v_user_id, 'ICICI Auto Loan (SUV)', 'Car Loan', 850000.00, 320000.00, 9.10, 14500.00, '5th of every month')
  ON CONFLICT (id) DO NOTHING;

  -- ------------------------------------------------------------------
  -- 11. GOALS: Emergency Reserve & Home Renovation
  -- ------------------------------------------------------------------
  INSERT INTO public.goals (id, user_id, name, category, target_amount, current_amount, deadline)
  VALUES
    (gen_random_uuid(), v_user_id, 'Emergency Reserve Fund (6 Months)', 'Safety Net', 500000.00, 350000.00, '2026-12-31'),
    (gen_random_uuid(), v_user_id, 'Home Renovation & Interior Fund', 'Lifestyle', 1000000.00, 420000.00, '2027-06-30'),
    (gen_random_uuid(), v_user_id, 'Retirement Corpus 2045', 'Retirement', 10000000.00, 2450000.00, '2045-12-31')
  ON CONFLICT (id) DO NOTHING;

  -- ------------------------------------------------------------------
  -- 12. BUDGETS: Monthly category spending targets
  -- ------------------------------------------------------------------
  INSERT INTO public.budgets (id, user_id, category, amount, period_month, period_year)
  VALUES
    (gen_random_uuid(), v_user_id, 'Food & Dining', 20000.00, EXTRACT(MONTH FROM CURRENT_DATE)::integer, EXTRACT(YEAR FROM CURRENT_DATE)::integer),
    (gen_random_uuid(), v_user_id, 'Shopping', 15000.00, EXTRACT(MONTH FROM CURRENT_DATE)::integer, EXTRACT(YEAR FROM CURRENT_DATE)::integer),
    (gen_random_uuid(), v_user_id, 'Utilities', 10000.00, EXTRACT(MONTH FROM CURRENT_DATE)::integer, EXTRACT(YEAR FROM CURRENT_DATE)::integer)
  ON CONFLICT (id) DO NOTHING;

  -- ------------------------------------------------------------------
  -- 13. LEDGER LOGS: Immutable audit trail for financial entries
  -- ------------------------------------------------------------------
  INSERT INTO public.ledger_logs (id, user_id, account_id, account_name, action_type, amount, previous_balance, new_balance, source_id, source_type, details)
  VALUES
    (gen_random_uuid(), v_user_id, v_hdfc_id, 'HDFC Salary Account', 'CREDIT', 185000.00, 60000.00, 245000.00, v_inc1_id, 'income', 'Salary credited from Employer'),
    (gen_random_uuid(), v_user_id, v_icici_id, 'ICICI Wealth Savings', 'CREDIT', 25000.00, 155000.00, 180000.00, v_inc2_id, 'income', 'Rental income credited for Flat 302'),
    (gen_random_uuid(), v_user_id, v_hdfc_id, 'HDFC Salary Account', 'DEBIT', 28000.00, 273000.00, 245000.00, v_exp1_id, 'expense', 'Rent paid to Landlord')
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'SUCCESS! Seed data created cleanly for user_id: %', v_user_id;
END $$;
