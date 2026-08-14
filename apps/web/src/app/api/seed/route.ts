import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import logger from "@/lib/logger";

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const userId = user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized. Please login first to seed data." }, { status: 401 });
    }

    // 1. Profile Setup
    await supabase.from("profiles").upsert({
      id: userId,
      enabled_modules: JSON.stringify([
        "Dashboard", "Accounts", "Income", "Expenses", "Budget",
        "Stocks", "Mutual Funds", "Bonds", "Alt Assets",
        "Liabilities", "Goals", "Tax & Reports", "Crypto"
      ]),
      base_currency: "INR",
      updated_at: new Date().toISOString(),
    });

    // 2. Accounts
    const hdfcId = crypto.randomUUID();
    const iciciId = crypto.randomUUID();
    const zerodhaId = crypto.randomUUID();

    await supabase.from("accounts").insert([
      { id: hdfcId, user_id: userId, name: "HDFC Salary Account", type: "bank", bank_name: "HDFC Bank", account_number: "XX7890", balance: 245000.00, currency: "INR", institution: "HDFC Bank Ltd", color: "#004B87" },
      { id: iciciId, user_id: userId, name: "ICICI Wealth Savings", type: "bank", bank_name: "ICICI Bank", account_number: "XX3412", balance: 180000.00, currency: "INR", institution: "ICICI Bank Ltd", color: "#F37021" },
      { id: zerodhaId, user_id: userId, name: "Zerodha Demat Trading", type: "investment", bank_name: "Zerodha", account_number: "10984512", balance: 45000.00, currency: "INR", institution: "Zerodha Broking Ltd", color: "#388E3C" },
    ]);

    // 3. Incomes & Expenses
    const today = new Date().toISOString().split("T")[0];
    const inc1 = crypto.randomUUID();
    const exp1 = crypto.randomUUID();

    await supabase.from("incomes").insert([
      { id: inc1, user_id: userId, description: "Monthly Salary - Senior Tech Lead", amount: 185000, category: "Salary", date: today, account_id: hdfcId, is_recurring: true, recurrence_frequency: "monthly" },
      { user_id: userId, description: "House Rental Income - Flat 302", amount: 25000, category: "Rental Income", date: today, account_id: iciciId, is_recurring: true, recurrence_frequency: "monthly" },
      { user_id: userId, description: "Q3 Dividend - Reliance Industries", amount: 4500, category: "Dividend", date: today, account_id: hdfcId, is_recurring: false },
    ]);

    await supabase.from("expenses").insert([
      { id: exp1, user_id: userId, description: "Apartment Rent (HRA Eligible)", amount: 28000, category: "House Rent", date: today, account_id: hdfcId, is_recurring: true },
      { user_id: userId, description: "EPF Salary Deduction (Sec 80C)", amount: 12500, category: "EPF", date: today, account_id: hdfcId, is_recurring: true },
      { user_id: userId, description: "HDFC ERGO Health Insurance (Sec 80D)", amount: 2200, category: "Health Insurance", date: today, account_id: hdfcId, is_recurring: true },
      { user_id: userId, description: "NPS Contribution (Sec 80CCD 1B)", amount: 4166, category: "NPS", date: today, account_id: iciciId, is_recurring: true },
      { user_id: userId, description: "Advance Tax Q3 Payment", amount: 15000, category: "Advance Tax", date: today, account_id: iciciId, is_recurring: false },
      { user_id: userId, description: "Groceries & Organic Supplies", amount: 8500, category: "Food & Dining", date: today, account_id: hdfcId, is_recurring: false },
      { user_id: userId, description: "Electricity & High-Speed Fiber", amount: 3800, category: "Utilities", date: today, account_id: iciciId, is_recurring: false },
    ]);

    // 4. Linked Transactions
    await supabase.from("transactions").insert([
      { user_id: userId, account_id: hdfcId, amount: 185000, type: "income", category: "Salary", description: "Monthly Salary - Senior Tech Lead", date: today, source_id: inc1, source_type: "income" },
      { user_id: userId, account_id: hdfcId, amount: 28000, type: "expense", category: "House Rent", description: "Apartment Rent (HRA Eligible)", date: today, source_id: exp1, source_type: "expense" },
    ]);

    // 5. Stocks & Mutual Funds & Bonds
    await supabase.from("investments").insert([
      { user_id: userId, symbol: "RELIANCE", name: "Reliance Industries Ltd", type: "Equity", quantity: 15, buy_price: 2750, current_price: 2980, currency: "INR" },
      { user_id: userId, symbol: "TCS", name: "Tata Consultancy Services", type: "Equity", quantity: 10, buy_price: 3600, current_price: 4120, currency: "INR" },
      { user_id: userId, symbol: "INFY", name: "Infosys Limited", type: "Equity", quantity: 25, buy_price: 1450, current_price: 1820, currency: "INR" },
      { user_id: userId, symbol: "HDFCBANK", name: "HDFC Bank Limited", type: "Equity", quantity: 30, buy_price: 1520, current_price: 1640, currency: "INR" },
      { user_id: userId, symbol: "AAPL", name: "Apple Inc.", type: "US Equities", quantity: 5, buy_price: 175, current_price: 225, currency: "USD" },
    ]);

    await supabase.from("mutual_funds").insert([
      { user_id: userId, fund_name: "Parag Parikh Flexi Cap Fund - Direct Growth", fund_symbol: "PPFCF", scheme_code: "122639", amc_name: "PPFAS Mutual Fund", category: "Flexi Cap", units: 450, avg_nav: 62.50, current_nav: 78.40 },
      { user_id: userId, fund_name: "Mirae Asset Large Cap Fund - Direct Growth", fund_symbol: "MALCF", scheme_code: "118834", amc_name: "Mirae Asset Mutual Fund", category: "Large Cap", units: 320, avg_nav: 85.00, current_nav: 98.20 },
      { user_id: userId, fund_name: "UTI Nifty 50 Index Fund - Direct Growth", fund_symbol: "UTIN50", scheme_code: "120716", amc_name: "UTI Mutual Fund", category: "Index Fund", units: 600, avg_nav: 115.00, current_nav: 142.50 },
    ]);

    await supabase.from("bonds").insert([
      { user_id: userId, bond_name: "Sovereign Gold Bond 2023-24 Series III", isin: "IN0020230182", bond_type: "SGB", issuer: "Reserve Bank of India", face_value: 6100, quantity: 10, purchase_price: 6100, current_price: 7450, current_value: 74500, coupon_rate: 2.5, purchase_date: "2023-11-20", maturity_date: "2031-11-20", total_invested: 61000 },
      { user_id: userId, bond_name: "NHAI 54EC Capital Gains Exemption Bond", isin: "INE906J07062", bond_type: "54EC", issuer: "NHAI", face_value: 10000, quantity: 2, purchase_price: 10000, current_price: 10000, current_value: 20000, coupon_rate: 5.25, purchase_date: "2024-02-15", maturity_date: "2029-02-15", total_invested: 20000 },
    ]);

    // 6. Alternative Assets & Liabilities & Goals & Budgets
    await supabase.from("alternative_assets").insert([
      { user_id: userId, name: "24K Gold Bullion Coins (50g)", category: "Gold", purchase_price: 310000, current_value: 375000, notes: "HDFC Safe Locker #142" },
    ]);

    await supabase.from("liabilities").insert([
      { user_id: userId, name: "HDFC Housing Loan", category: "Home Loan", total_amount: 4500000, remaining_amount: 3850000, interest_rate: 8.50, monthly_payment: 38200 },
      { user_id: userId, name: "ICICI Auto Loan (SUV)", category: "Car Loan", total_amount: 850000, remaining_amount: 320000, interest_rate: 9.10, monthly_payment: 14500 },
    ]);

    await supabase.from("goals").insert([
      { user_id: userId, name: "Emergency Reserve Fund (6 Months)", category: "Safety Net", target_amount: 500000, current_amount: 350000, deadline: "2026-12-31" },
      { user_id: userId, name: "Home Renovation & Interior Fund", category: "Lifestyle", target_amount: 1000000, current_amount: 420000, deadline: "2027-06-30" },
      { user_id: userId, name: "Retirement Corpus 2045", category: "Retirement", target_amount: 10000000, current_amount: 2450000, deadline: "2045-12-31" },
    ]);

    const curMonth = new Date().getMonth() + 1;
    const curYear = new Date().getFullYear();

    await supabase.from("budgets").insert([
      { user_id: userId, category: "Food & Dining", amount: 20000, period_month: curMonth, period_year: curYear },
      { user_id: userId, category: "Shopping", amount: 15000, period_month: curMonth, period_year: curYear },
      { user_id: userId, category: "Utilities", amount: 10000, period_month: curMonth, period_year: curYear },
    ]);

    // 7. Ledger Audit Logs
    await supabase.from("ledger_logs").insert([
      { user_id: userId, account_id: hdfcId, account_name: "HDFC Salary Account", action_type: "CREDIT", amount: 185000, previous_balance: 60000, new_balance: 245000, source_id: inc1, source_type: "income", details: "Salary credited from Employer" },
      { user_id: userId, account_id: hdfcId, account_name: "HDFC Salary Account", action_type: "DEBIT", amount: 28000, previous_balance: 273000, new_balance: 245000, source_id: exp1, source_type: "expense", details: "Rent paid to Landlord" },
    ]);

    logger.info("Database successfully seeded with realistic interconnected data", { userId });

    return NextResponse.json({
      success: true,
      message: "Database successfully seeded with realistic interconnected data across all sections!",
      seeded: {
        accounts: 3,
        incomes: 3,
        expenses: 7,
        investments: 5,
        mutualFunds: 3,
        bonds: 2,
        altAssets: 1,
        liabilities: 2,
        goals: 3,
        budgets: 3
      }
    });
  } catch (err: any) {
    logger.error("Failed to seed database:", err);
    return NextResponse.json({ error: err.message || "Failed to seed database" }, { status: 500 });
  }
}

export async function GET() {
  return POST();
}
