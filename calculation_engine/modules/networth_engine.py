"""
Financial Calculation Engine - Net Worth Engine
Formula: Net Worth = Total Assets - Total Liabilities
Supports liquid accounts, cash, stocks, mutual funds, bonds, bullion, crypto,
loans, credit cards, and avoids double-counting transfers.
"""

from decimal import Decimal
from typing import List, Dict, Any, Optional
from collections import defaultdict
from ..core.precision import (
    to_decimal,
    quantize_currency,
    safe_divide,
    safe_percentage,
    DEFAULT_CURRENCY,
)
from ..core.base_calculator import BaseCalculator


class NetWorthEngine(BaseCalculator):
    CALCULATION_TYPE = "NETWORTH"

    def calculate(self, inputs: Dict[str, Any], context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Inputs:
            accounts: List of account records [{ id, name, type, balance, classification }]
            stocks: List of stock holdings [{ quantity, current_price, avg_buy_price, symbol }]
            mutual_funds: List of mutual fund holdings [{ units, current_nav, avg_nav, scheme_name }]
            bonds: List of bond holdings [{ quantity, current_price, avg_buy_price, invested_amount }]
            bullion: List of bullion holdings [{ metal, weight_grams, current_rate_per_gram, total_buy_price }]
            crypto: List of crypto holdings [{ asset, total_quantity, current_price_usd, total_value_usd }]
            usd_inr_rate: Optional Decimal exchange rate (default ~84.50)
            currency: Preferred output currency (default INR)
        """
        accounts: List[Dict[str, Any]] = inputs.get("accounts", [])
        stocks: List[Dict[str, Any]] = inputs.get("stocks", [])
        mutual_funds: List[Dict[str, Any]] = inputs.get("mutual_funds", [])
        bonds: List[Dict[str, Any]] = inputs.get("bonds", [])
        bullion: List[Dict[str, Any]] = inputs.get("bullion", [])
        crypto: List[Dict[str, Any]] = inputs.get("crypto", [])
        usd_inr_rate: Decimal = to_decimal(inputs.get("usd_inr_rate", "84.50"))
        preferred_currency: str = inputs.get("currency", DEFAULT_CURRENCY)

        # 1. Accounts: Liquid Assets vs Liabilities
        liquid_cash = Decimal("0.00")
        bank_savings = Decimal("0.00")
        fixed_deposits = Decimal("0.00")
        other_assets = Decimal("0.00")
        total_account_assets = Decimal("0.00")

        credit_card_debt = Decimal("0.00")
        loan_liabilities = Decimal("0.00")
        other_liabilities = Decimal("0.00")
        total_liabilities = Decimal("0.00")

        for acc in accounts:
            bal = to_decimal(acc.get("balance", 0))
            classification = str(acc.get("classification") or "").lower()
            acc_type = str(acc.get("type") or "").lower()
            acc_name = str(acc.get("name") or "").lower()

            is_liability = (
                classification == "liability"
                or "credit" in acc_type
                or "credit" in acc_name
                or "loan" in acc_type
                or "borrow" in acc_type
            )

            if is_liability:
                # Liability balance: standard balance represents outstanding debt
                debt_amt = abs(bal) if bal > 0 else abs(bal)
                if "credit" in acc_type or "credit" in acc_name:
                    credit_card_debt += debt_amt
                elif "loan" in acc_type or "loan" in acc_name:
                    loan_liabilities += debt_amt
                else:
                    other_liabilities += debt_amt
                total_liabilities += debt_amt
            else:
                # Asset account: can be positive or negative (overdraft)
                if "cash" in acc_type or "cash" in acc_name:
                    liquid_cash += bal
                elif "saving" in acc_type or "checking" in acc_type or "current" in acc_type or "bank" in acc_type:
                    bank_savings += bal
                elif "deposit" in acc_type or "fd" in acc_type or "rd" in acc_type:
                    fixed_deposits += bal
                else:
                    other_assets += bal

                # In financial accounting, negative asset balance acts as an overdraft (liability deduction)
                total_account_assets += bal

        # 2. Stocks Valuation
        stocks_valuation = Decimal("0.00")
        stocks_invested = Decimal("0.00")
        for s in stocks:
            qty = to_decimal(s.get("quantity", 0))
            cur_price = to_decimal(s.get("current_price", 0))
            avg_price = to_decimal(s.get("avg_buy_price", 0))
            if cur_price <= Decimal("0"):
                cur_price = avg_price

            val = qty * cur_price
            inv = qty * avg_price
            stocks_valuation += val
            stocks_invested += inv

        # 3. Mutual Funds Valuation
        mf_valuation = Decimal("0.00")
        mf_invested = Decimal("0.00")
        for m in mutual_funds:
            units = to_decimal(m.get("units", 0))
            cur_nav = to_decimal(m.get("current_nav", 0))
            avg_nav = to_decimal(m.get("avg_nav", 0))
            if cur_nav <= Decimal("0"):
                cur_nav = avg_nav

            val = units * cur_nav
            inv = to_decimal(m.get("invested_amount", 0))
            if inv <= Decimal("0"):
                inv = units * avg_nav

            mf_valuation += val
            mf_invested += inv

        # 4. Bonds Valuation
        bonds_valuation = Decimal("0.00")
        bonds_invested = Decimal("0.00")
        for b in bonds:
            qty = to_decimal(b.get("quantity", 1))
            cur_price = to_decimal(b.get("current_price", 0))
            face = to_decimal(b.get("face_value", 1000))
            buy_price = to_decimal(b.get("avg_buy_price", face))
            if cur_price <= Decimal("0"):
                cur_price = buy_price

            val = qty * cur_price
            inv = to_decimal(b.get("invested_amount", 0))
            if inv <= Decimal("0"):
                inv = qty * buy_price

            bonds_valuation += val
            bonds_invested += inv

        # 5. Bullion (Gold & Silver) Valuation
        gold_valuation = Decimal("0.00")
        silver_valuation = Decimal("0.00")
        bullion_invested = Decimal("0.00")
        for bul in bullion:
            metal = str(bul.get("metal") or "GOLD").upper()
            weight = to_decimal(bul.get("weight_grams", 0))
            rate = to_decimal(bul.get("current_rate_per_gram", 0))
            inv = to_decimal(bul.get("total_buy_price", 0))

            val = weight * rate
            bullion_invested += inv

            if metal == "GOLD":
                gold_valuation += val
            else:
                silver_valuation += val

        total_bullion_valuation = gold_valuation + silver_valuation

        # 6. Cryptocurrency Valuation
        crypto_usd_valuation = Decimal("0.00")
        for c in crypto:
            val_usd = to_decimal(c.get("total_value_usd", 0))
            if val_usd <= Decimal("0"):
                qty = to_decimal(c.get("total_quantity", 0))
                p_usd = to_decimal(c.get("current_price_usd", 0))
                val_usd = qty * p_usd
            crypto_usd_valuation += val_usd

        crypto_inr_valuation = crypto_usd_valuation * usd_inr_rate

        # 7. Aggregate Total Assets
        total_investments_valuation = (
            stocks_valuation
            + mf_valuation
            + bonds_valuation
            + total_bullion_valuation
            + crypto_inr_valuation
        )

        total_assets = total_account_assets + total_investments_valuation

        # 8. Net Worth Formula: Total Assets - Total Liabilities
        net_worth = total_assets - total_liabilities

        # 9. Asset Allocation Breakdown
        asset_breakdown = {
            "liquid_cash": str(quantize_currency(liquid_cash)),
            "bank_savings": str(quantize_currency(bank_savings)),
            "fixed_deposits": str(quantize_currency(fixed_deposits)),
            "stocks": str(quantize_currency(stocks_valuation)),
            "mutual_funds": str(quantize_currency(mf_valuation)),
            "bonds": str(quantize_currency(bonds_valuation)),
            "gold": str(quantize_currency(gold_valuation)),
            "silver": str(quantize_currency(silver_valuation)),
            "crypto_inr": str(quantize_currency(crypto_inr_valuation)),
            "crypto_usd": str(quantize_currency(crypto_usd_valuation)),
            "other_assets": str(quantize_currency(other_assets)),
        }

        allocation_percentages = {}
        if total_assets > Decimal("0"):
            allocation_percentages = {
                "liquid_accounts": float(safe_percentage(total_account_assets, total_assets)),
                "stocks": float(safe_percentage(stocks_valuation, total_assets)),
                "mutual_funds": float(safe_percentage(mf_valuation, total_assets)),
                "bonds": float(safe_percentage(bonds_valuation, total_assets)),
                "bullion": float(safe_percentage(total_bullion_valuation, total_assets)),
                "crypto": float(safe_percentage(crypto_inr_valuation, total_assets)),
            }

        liabilities_breakdown = {
            "credit_cards": str(quantize_currency(credit_card_debt)),
            "loans": str(quantize_currency(loan_liabilities)),
            "other_liabilities": str(quantize_currency(other_liabilities)),
            "total_liabilities": str(quantize_currency(total_liabilities)),
        }

        # Liquidity ratio: Liquid Cash + Bank Savings / Total Assets
        liquid_assets = max(Decimal("0.00"), liquid_cash + bank_savings)
        liquidity_percentage = safe_percentage(liquid_assets, total_assets) if total_assets > Decimal("0") else Decimal("100.00")

        # Debt to Asset ratio
        debt_to_asset_ratio = safe_percentage(total_liabilities, total_assets) if total_assets > Decimal("0") else Decimal("0.00")

        return {
            "currency": preferred_currency,
            "net_worth": str(quantize_currency(net_worth)),
            "total_assets": str(quantize_currency(total_assets)),
            "total_liabilities": str(quantize_currency(total_liabilities)),
            "total_liquid_accounts": str(quantize_currency(total_account_assets)),
            "total_investments": str(quantize_currency(total_investments_valuation)),
            "assets_breakdown": asset_breakdown,
            "liabilities_breakdown": liabilities_breakdown,
            "allocation_percentages": allocation_percentages,
            "liquidity_percentage": float(liquidity_percentage),
            "debt_to_asset_ratio_percent": float(debt_to_asset_ratio),
            "is_solvent": net_worth >= Decimal("0.00"),
        }
