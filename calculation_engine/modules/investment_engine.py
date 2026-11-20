"""
Financial Calculation Engine - Investment Engine
Calculates invested capital, current valuation, realized & unrealized P&L,
absolute and percentage returns, asset class allocation, and dividend/interest tracking.
"""

from decimal import Decimal
from typing import List, Dict, Any, Optional
from collections import defaultdict
from ..core.precision import (
    to_decimal,
    quantize_currency,
    quantize_units,
    quantize_rate,
    safe_divide,
    safe_percentage,
    DEFAULT_CURRENCY,
)
from ..core.base_calculator import BaseCalculator


class InvestmentEngine(BaseCalculator):
    CALCULATION_TYPE = "INVESTMENT"

    def calculate(self, inputs: Dict[str, Any], context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Inputs:
            holdings: List of unified holding items:
                [{ id, symbol, name, asset_class, quantity, avg_price, current_price, invested_amount }]
            transactions: List of investment transactions:
                [{ holding_id, type (BUY, SELL, DIVIDEND, COUPON_PAYOUT), quantity, price, amount }]
            currency: Preferred currency
        """
        holdings: List[Dict[str, Any]] = inputs.get("holdings", [])
        transactions: List[Dict[str, Any]] = inputs.get("transactions", [])
        preferred_currency: str = inputs.get("currency", DEFAULT_CURRENCY)

        total_invested = Decimal("0.00")
        total_current_value = Decimal("0.00")
        total_dividends_interest = Decimal("0.00")
        total_realized_pnl = Decimal("0.00")

        asset_class_stats = defaultdict(lambda: {
            "invested": Decimal("0.00"),
            "current_value": Decimal("0.00"),
            "unrealized_pnl": Decimal("0.00"),
            "count": 0,
        })

        holding_details = []

        for h in holdings:
            asset_class = str(h.get("asset_class") or "equity").lower()
            qty = to_decimal(h.get("quantity", 0))
            avg_p = to_decimal(h.get("avg_price", 0))
            cur_p = to_decimal(h.get("current_price", 0))
            if cur_p <= Decimal("0"):
                cur_p = avg_p

            inv = to_decimal(h.get("invested_amount", 0))
            if inv <= Decimal("0"):
                inv = qty * avg_p

            val = qty * cur_p
            unrealized = val - inv
            ret_pct = safe_percentage(unrealized, inv) if inv > Decimal("0") else Decimal("0.00")

            total_invested += inv
            total_current_value += val

            asset_class_stats[asset_class]["invested"] += inv
            asset_class_stats[asset_class]["current_value"] += val
            asset_class_stats[asset_class]["unrealized_pnl"] += unrealized
            asset_class_stats[asset_class]["count"] += 1

            holding_details.append({
                "id": str(h.get("id") or h.get("symbol") or ""),
                "symbol": str(h.get("symbol") or h.get("name") or ""),
                "asset_class": asset_class,
                "quantity": str(quantize_units(qty)),
                "avg_price": str(quantize_currency(avg_p)),
                "current_price": str(quantize_currency(cur_p)),
                "invested_amount": str(quantize_currency(inv)),
                "current_value": str(quantize_currency(val)),
                "unrealized_pnl": str(quantize_currency(unrealized)),
                "return_percent": float(ret_pct),
                "is_profit": unrealized >= Decimal("0.00"),
            })

        # 2. Process Transactions for Realized P&L, Dividends & Interest
        for tx in transactions:
            tx_type = str(tx.get("type") or "").upper()
            amt = to_decimal(tx.get("amount", 0))

            if tx_type in ("DIVIDEND", "COUPON_PAYOUT", "INTEREST"):
                total_dividends_interest += amt
            elif tx_type == "SELL":
                sell_pnl = to_decimal(tx.get("pnl", 0))
                if sell_pnl == Decimal("0.00"):
                    # Calculate sell PnL from price and cost
                    sell_qty = to_decimal(tx.get("quantity", 0))
                    sell_price = to_decimal(tx.get("price", 0))
                    buy_price = to_decimal(tx.get("buy_price", 0))
                    charges = to_decimal(tx.get("brokerage_charges", 0))
                    if buy_price > Decimal("0"):
                        sell_pnl = (sell_qty * (sell_price - buy_price)) - charges
                total_realized_pnl += sell_pnl

        total_unrealized_pnl = total_current_value - total_invested
        total_pnl = total_unrealized_pnl + total_realized_pnl + total_dividends_interest
        total_absolute_return = total_pnl
        total_return_percent = safe_percentage(total_unrealized_pnl, total_invested) if total_invested > Decimal("0") else Decimal("0.00")

        # 3. Allocation Breakdown
        allocation = {}
        for ac, data in asset_class_stats.items():
            pct = safe_percentage(data["current_value"], total_current_value) if total_current_value > Decimal("0") else Decimal("0.00")
            ac_pnl_pct = safe_percentage(data["unrealized_pnl"], data["invested"]) if data["invested"] > Decimal("0") else Decimal("0.00")
            allocation[ac] = {
                "invested": str(quantize_currency(data["invested"])),
                "current_value": str(quantize_currency(data["current_value"])),
                "unrealized_pnl": str(quantize_currency(data["unrealized_pnl"])),
                "return_percent": float(ac_pnl_pct),
                "allocation_percent": float(pct),
                "holdings_count": data["count"],
            }

        return {
            "currency": preferred_currency,
            "total_invested": str(quantize_currency(total_invested)),
            "total_current_value": str(quantize_currency(total_current_value)),
            "total_unrealized_pnl": str(quantize_currency(total_unrealized_pnl)),
            "total_realized_pnl": str(quantize_currency(total_realized_pnl)),
            "total_dividends_interest": str(quantize_currency(total_dividends_interest)),
            "total_absolute_return": str(quantize_currency(total_absolute_return)),
            "total_return_percent": float(total_return_percent),
            "is_profit": total_unrealized_pnl >= Decimal("0.00"),
            "holdings_count": len(holdings),
            "asset_class_allocation": allocation,
            "holdings": holding_details,
        }
