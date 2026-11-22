"""
Financial Calculation Engine - Test Fixtures
Provides deterministic test cases across standard and edge-case financial scenarios.
"""

from decimal import Decimal

# Known benchmark from prompt:
# Assets = ₹100,000, Liabilities = ₹15,000 -> Expected Net Worth = ₹85,000
BENCHMARK_NET_WORTH_INPUT = {
    "accounts": [
        {"id": "acc-1", "name": "Savings Account", "type": "Bank", "balance": "100000.00", "classification": "asset"},
        {"id": "acc-2", "name": "Credit Card", "type": "Credit Card", "balance": "15000.00", "classification": "liability"},
    ]
}
EXPECTED_BENCHMARK_NET_WORTH = Decimal("85000.00")

# Normal transactions
NORMAL_EXPENSES = [
    {"id": "e-1", "title": "Groceries", "amount": "3450.50", "category": "Groceries", "expense_date": "2026-11-05"},
    {"id": "e-2", "title": "Electricity Bill", "amount": "1800.00", "category": "Utilities", "expense_date": "2026-11-10"},
    {"id": "e-3", "title": "Dining Out", "amount": "1250.75", "category": "Food & Dining", "expense_date": "2026-11-15"},
    {"id": "e-4", "title": "Fuel", "amount": "2000.00", "category": "Transport", "expense_date": "2026-11-20"},
]

# Refund and reversal transactions
REFUND_EXPENSES = [
    {"id": "e-1", "title": "Amazon Purchase", "amount": "5000.00", "category": "Shopping", "expense_date": "2026-11-01"},
    {"id": "e-2", "title": "Amazon Refund", "amount": "5000.00", "category": "Shopping", "expense_date": "2026-11-03", "transaction_type": "refund"},
    {"id": "e-3", "title": "Coffee", "amount": "250.00", "category": "Food & Dining", "expense_date": "2026-11-04"},
]

# Duplicate transactions
DUPLICATE_EXPENSES = [
    {"id": "dup-1", "title": "Dinner", "amount": "1500.00", "category": "Food", "expense_date": "2026-11-10"},
    {"id": "dup-1", "title": "Dinner", "amount": "1500.00", "category": "Food", "expense_date": "2026-11-10"},
    {"id": "dup-2", "title": "Uber", "amount": "350.00", "category": "Transport", "expense_date": "2026-11-11"},
]

# Internal transfers (must be excluded from spending)
INTERNAL_TRANSFER_EXPENSES = [
    {"id": "e-1", "title": "Groceries", "amount": "1200.00", "category": "Food", "expense_date": "2026-11-05"},
    {"id": "t-1", "title": "Transfer to Cash", "amount": "10000.00", "category": "Transfer", "expense_date": "2026-11-06", "transaction_type": "transfer_out"},
    {"id": "t-2", "title": "Money sent to Sister", "amount": "5000.00", "category": "Family", "expense_date": "2026-11-07", "tags": ["family_support"]},
]

# Large amount transactions (Crores)
LARGE_AMOUNT_TRANSACTIONS = [
    {"id": "lg-1", "title": "Real Estate Investment", "amount": "25000000.00", "category": "Investments", "expense_date": "2026-05-15"},
    {"id": "lg-2", "title": "Commercial Property Sale", "amount": "45000000.00", "category": "Capital Gain", "received_date": "2026-06-20"},
]

# Leap year boundary test (2024 is a leap year with Feb 29)
LEAP_YEAR_EXPENSES = [
    {"id": "ly-1", "title": "Leap Day Rent", "amount": "25000.00", "category": "Housing", "expense_date": "2024-02-29"},
    {"id": "ly-2", "title": "March 1 Groceries", "amount": "3000.00", "category": "Groceries", "expense_date": "2024-03-01"},
]
