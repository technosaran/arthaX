"""
Financial Calculation Engine - Indian Capital Gains Tax & Tax-Loss Harvesting Engine
Supports versioned statutory tax rules across Financial Years / Assessment Years:
- FY 2023-24 (AY 2024-25): Finance Act, 2023 (Pre-Budget 2024)
- FY 2024-25 (AY 2025-26): Union Budget 2024 (Finance (No. 2) Act, 2024)
- FY 2025-26 (AY 2026-27): Union Budget 2025 (Finance Act, 2025)
- FY 2026-27+ (AY 2027-28+): Income-tax Act, 2025 & Union Budget 2026
Also supports user-defined rule overrides for future budgets without code updates.
"""

import re
from datetime import datetime, date
from decimal import Decimal
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict, deque

from ..core.precision import (
    to_decimal,
    quantize_currency,
    safe_percentage,
)
from ..core.validators import parse_iso_date
from ..core.base_calculator import BaseCalculator


OLD_REGIME_STANDARD = {
    "standard_deduction": Decimal("50000.00"),
    "rebate_87a_max_income": Decimal("500000.00"),
    "rebate_87a_max_amount": Decimal("12500.00"),
    "marginal_relief_87a": False,
    "slabs": [
        (Decimal("250000.00"), Decimal("0.00")),
        (Decimal("500000.00"), Decimal("0.05")),
        (Decimal("1000000.00"), Decimal("0.20")),
        (None, Decimal("0.30")),
    ],
}

BUDGET_2025_NEW_REGIME = {
    "standard_deduction": Decimal("75000.00"),
    "rebate_87a_max_income": Decimal("1200000.00"),
    "rebate_87a_max_amount": Decimal("60000.00"),
    "marginal_relief_87a": True,
    "slabs": [
        (Decimal("400000.00"), Decimal("0.00")),
        (Decimal("800000.00"), Decimal("0.05")),
        (Decimal("1200000.00"), Decimal("0.10")),
        (Decimal("1600000.00"), Decimal("0.15")),
        (Decimal("2000000.00"), Decimal("0.20")),
        (Decimal("2400000.00"), Decimal("0.25")),
        (None, Decimal("0.30")),
    ],
}

_CRYPTO_VDA_DEFAULT = {
    "flat_rate": Decimal("0.30"),
    "cess_rate": Decimal("0.04"),
    "effective_rate": Decimal("0.312"),
    "allow_loss_setoff": False,
}

_POST_2024_CAP_GAINS = {
    "equity": {
        "holding_threshold_days": 365,
        "stcg_rate": Decimal("0.20"),
        "ltcg_rate": Decimal("0.125"),
        "ltcg_exemption_limit": Decimal("125000.00"),
    },
    "debt_mutual_funds": {"tax_treatment": "SLAB_RATE"},
    "bullion": {
        "holding_threshold_days": 730,
        "stcg_rate": "SLAB_RATE",
        "ltcg_rate": Decimal("0.125"),
    },
    "bonds_listed": {
        "holding_threshold_days": 365,
        "stcg_rate": "SLAB_RATE",
        "ltcg_rate": Decimal("0.125"),
    },
    "crypto_vda": _CRYPTO_VDA_DEFAULT,
    "fno_derivatives": {"tax_treatment": "SLAB_RATE"},
}

def _clone_rules(rules: Dict[str, Any]) -> Dict[str, Any]:
    """Fast structural clone avoiding expensive copy.deepcopy over immutable Decimals/tuples."""
    return {
        **rules,
        "equity": dict(rules["equity"]),
        "debt_mutual_funds": dict(rules["debt_mutual_funds"]),
        "bullion": dict(rules["bullion"]),
        "bonds_listed": dict(rules["bonds_listed"]),
        "crypto_vda": dict(rules["crypto_vda"]),
        "fno_derivatives": dict(rules["fno_derivatives"]),
        "new_regime": {**rules["new_regime"], "slabs": list(rules["new_regime"]["slabs"])},
        "old_regime": {**rules["old_regime"], "slabs": list(rules["old_regime"]["slabs"])},
    }

# Retained for backward compatibility with existing callers/tests
BUDGET_2024_TAX_RULES = _clone_rules({
    **_POST_2024_CAP_GAINS,
    "version": "Union Budget 2024 (Finance (No. 2) Act, 2024)",
    "statute_reference": "Income-tax Act, 1961 (post 23 Jul 2024 reform)",
    "effective_date": "2024-07-23",
    "new_regime": {
        "standard_deduction": Decimal("75000.00"),
        "rebate_87a_max_income": Decimal("700000.00"),
        "rebate_87a_max_amount": Decimal("25000.00"),
        "marginal_relief_87a": True,
        "slabs": [
            (Decimal("300000.00"), Decimal("0.00")),
            (Decimal("700000.00"), Decimal("0.05")),
            (Decimal("1000000.00"), Decimal("0.10")),
            (Decimal("1200000.00"), Decimal("0.15")),
            (Decimal("1500000.00"), Decimal("0.20")),
            (None, Decimal("0.30")),
        ],
    },
    "old_regime": OLD_REGIME_STANDARD,
})

TAX_RULES_BY_AY: Dict[str, Dict[str, Any]] = {
    "2024-2025": {
        "assessment_year": "2024-2025",
        "financial_year": "2023-2024",
        "version": "Finance Act, 2023 (Pre-Budget 2024)",
        "statute_reference": "Income-tax Act, 1961 (FY 2023-24)",
        "effective_date": "2023-04-01",
        "equity": {
            "holding_threshold_days": 365,
            "stcg_rate": Decimal("0.15"),
            "ltcg_rate": Decimal("0.10"),
            "ltcg_exemption_limit": Decimal("100000.00"),
        },
        "debt_mutual_funds": {"tax_treatment": "SLAB_RATE"},
        "bullion": {"holding_threshold_days": 1095, "stcg_rate": "SLAB_RATE", "ltcg_rate": Decimal("0.20")},
        "bonds_listed": {"holding_threshold_days": 365, "stcg_rate": "SLAB_RATE", "ltcg_rate": Decimal("0.10")},
        "crypto_vda": _CRYPTO_VDA_DEFAULT,
        "fno_derivatives": {"tax_treatment": "SLAB_RATE"},
        "new_regime": {
            "standard_deduction": Decimal("50000.00"),
            "rebate_87a_max_income": Decimal("700000.00"),
            "rebate_87a_max_amount": Decimal("25000.00"),
            "marginal_relief_87a": True,
            "slabs": [
                (Decimal("300000.00"), Decimal("0.00")),
                (Decimal("600000.00"), Decimal("0.05")),
                (Decimal("900000.00"), Decimal("0.10")),
                (Decimal("1200000.00"), Decimal("0.15")),
                (Decimal("1500000.00"), Decimal("0.20")),
                (None, Decimal("0.30")),
            ],
        },
        "old_regime": OLD_REGIME_STANDARD,
    },
    "2025-2026": {
        **BUDGET_2024_TAX_RULES,
        "assessment_year": "2025-2026",
        "financial_year": "2024-2025",
    },
    "2026-2027": {
        **BUDGET_2024_TAX_RULES,
        "assessment_year": "2026-2027",
        "financial_year": "2025-2026",
        "version": "Union Budget 2025 (Finance Act, 2025)",
        "statute_reference": "Income-tax Act, 1961 (Sec 115BAC & Sec 87A ₹12L Rebate)",
        "effective_date": "2025-04-01",
        "new_regime": BUDGET_2025_NEW_REGIME,
    },
    "2027-2028": {
        **BUDGET_2024_TAX_RULES,
        "assessment_year": "2027-2028",
        "financial_year": "2026-2027",
        "version": "Income-tax Act, 2025 & Union Budget 2026",
        "statute_reference": "Income-tax Act, 2025 (effective 1 Apr 2026)",
        "effective_date": "2026-04-01",
        "new_regime": BUDGET_2025_NEW_REGIME,
    },
}

LATEST_STATUTORY_AY = "2027-2028"
_AY_RE_SHORT = re.compile(r"^(\d{4})-(\d{2})$")
_AY_RE_FULL = re.compile(r"^(\d{4})-(\d{4})$")
_AY_PREFIX = re.compile(r"^(AY|FY)\s*", flags=re.IGNORECASE)


def get_current_indian_ay(now: Optional[datetime] = None) -> str:
    """Returns current Indian Assessment Year under April-March fiscal cycle."""
    ref = now or datetime.now()
    fy_start = ref.year if ref.month >= 4 else ref.year - 1
    ay_start = fy_start + 1
    return f"{ay_start}-{ay_start + 1}"


def normalize_assessment_year(raw: Optional[str] = None) -> str:
    """Normalizes AY strings like '2026-27' or 'AY 2026-2027' to 'YYYY-YYYY'."""
    if not raw:
        return get_current_indian_ay()
    cleaned = _AY_PREFIX.sub("", str(raw).strip())
    if m := _AY_RE_SHORT.match(cleaned):
        start = int(m.group(1))
        return f"{start}-{start + 1}"
    if m := _AY_RE_FULL.match(cleaned):
        return f"{m.group(1)}-{m.group(2)}"
    return get_current_indian_ay()


def get_fiscal_year_date_range(assessment_year: str) -> Tuple[str, str, str]:
    """Returns (financial_year, start_date, end_date) for an Assessment Year."""
    ay_start = int(normalize_assessment_year(assessment_year)[:4])
    fy_start = ay_start - 1
    return f"{fy_start}-{ay_start}", f"{fy_start}-04-01", f"{ay_start}-03-31"


def _normalize_slabs(raw_slabs: Any) -> Optional[List[Tuple[Optional[Decimal], Decimal]]]:
    if not isinstance(raw_slabs, list) or not raw_slabs:
        return None
    parsed: List[Tuple[Optional[Decimal], Decimal]] = []
    for item in raw_slabs:
        if isinstance(item, (list, tuple)) and len(item) >= 2:
            up_to, rate = item[0], item[1]
            parsed.append((None if up_to is None else to_decimal(up_to), to_decimal(rate)))
        elif isinstance(item, dict):
            up_to = item.get("upTo", item.get("up_to"))
            parsed.append((None if up_to is None else to_decimal(up_to), to_decimal(item.get("rate", 0))))
    return parsed or None


def _apply_mapped_overrides(
    target: Dict[str, Any],
    override: Any,
    spec: List[Tuple[str, str, str, Any]],
) -> None:
    if not isinstance(override, dict):
        return
    for dest_key, camel_key, snake_key, caster in spec:
        if camel_key in override:
            target[dest_key] = caster(override[camel_key])
        elif snake_key in override:
            target[dest_key] = caster(override[snake_key])


_REGIME_FIELD_SPEC = [
    ("standard_deduction", "standardDeduction", "standard_deduction", to_decimal),
    ("rebate_87a_max_income", "rebate87aMaxIncome", "rebate_87a_max_income", to_decimal),
    ("rebate_87a_max_amount", "rebate87aMaxAmount", "rebate_87a_max_amount", to_decimal),
    ("marginal_relief_87a", "marginalRelief87a", "marginal_relief_87a", bool),
]
_EQUITY_FIELD_SPEC = [
    ("holding_threshold_days", "ltcgThresholdDays", "holding_threshold_days", int),
    ("stcg_rate", "stcgRate", "stcg_rate", to_decimal),
    ("ltcg_rate", "ltcgRate", "ltcg_rate", to_decimal),
    ("ltcg_exemption_limit", "ltcgExemptionLimit", "ltcg_exemption_limit", to_decimal),
]
_LTCG_ASSET_FIELD_SPEC = [
    ("holding_threshold_days", "ltcgThresholdDays", "holding_threshold_days", int),
    ("ltcg_rate", "ltcgRate", "ltcg_rate", to_decimal),
]
_CRYPTO_FIELD_SPEC = [
    ("flat_rate", "flatRate", "flat_rate", to_decimal),
    ("cess_rate", "cessRate", "cess_rate", to_decimal),
    ("allow_loss_setoff", "allowLossSetoff", "allow_loss_setoff", bool),
]


def _apply_regime_override(base: Dict[str, Any], override: Any) -> None:
    if not isinstance(override, dict):
        return
    _apply_mapped_overrides(base, override, _REGIME_FIELD_SPEC)
    if parsed := _normalize_slabs(override.get("slabs")):
        base["slabs"] = parsed


def resolve_tax_rules(
    assessment_year: Optional[str] = None,
    custom_rules: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Resolves statutory tax preset for the given Assessment Year and merges optional overrides."""
    norm_ay = normalize_assessment_year(assessment_year)
    fy_str, fy_start, fy_end = get_fiscal_year_date_range(norm_ay)

    if norm_ay in TAX_RULES_BY_AY:
        resolved = _clone_rules(TAX_RULES_BY_AY[norm_ay])
        is_projected = False
    else:
        template_key = "2024-2025" if int(norm_ay[:4]) < 2024 else LATEST_STATUTORY_AY
        resolved = _clone_rules(TAX_RULES_BY_AY[template_key])
        resolved["assessment_year"] = norm_ay
        resolved["financial_year"] = fy_str
        resolved["effective_date"] = fy_start
        resolved["version"] = f"{resolved['version']} (Auto-carried forward — editable)"
        is_projected = True

    resolved.update({"fy_start": fy_start, "fy_end": fy_end, "is_projected": is_projected})

    has_override = isinstance(custom_rules, dict) and len(custom_rules) > 0
    if has_override:
        assert custom_rules is not None
        _apply_mapped_overrides(resolved["equity"], custom_rules.get("equity"), _EQUITY_FIELD_SPEC)
        _apply_mapped_overrides(resolved["bullion"], custom_rules.get("bullion"), _LTCG_ASSET_FIELD_SPEC)
        _apply_mapped_overrides(
            resolved["bonds_listed"],
            custom_rules.get("bondsListed") or custom_rules.get("bonds_listed"),
            _LTCG_ASSET_FIELD_SPEC,
        )
        crypto_ov = custom_rules.get("cryptoVda") or custom_rules.get("crypto_vda")
        if isinstance(crypto_ov, dict):
            _apply_mapped_overrides(resolved["crypto_vda"], crypto_ov, _CRYPTO_FIELD_SPEC)
            if "effectiveRate" in crypto_ov or "effective_rate" in crypto_ov:
                resolved["crypto_vda"]["effective_rate"] = to_decimal(
                    crypto_ov.get("effectiveRate", crypto_ov.get("effective_rate"))
                )
            elif any(k in crypto_ov for k in ("flatRate", "flat_rate", "cessRate", "cess_rate")):
                resolved["crypto_vda"]["effective_rate"] = (
                    resolved["crypto_vda"]["flat_rate"] * (Decimal("1.00") + resolved["crypto_vda"]["cess_rate"])
                )

        _apply_regime_override(resolved["new_regime"], custom_rules.get("newRegime") or custom_rules.get("new_regime"))
        _apply_regime_override(resolved["old_regime"], custom_rules.get("oldRegime") or custom_rules.get("old_regime"))

        custom_ver = custom_rules.get("rulesVersion") or custom_rules.get("version")
        resolved["version"] = str(custom_ver).strip() if custom_ver else f"{resolved['version']} + Custom Rules"

    resolved["is_customized"] = has_override
    return resolved


def build_disclaimer(rules: Dict[str, Any]) -> str:
    return (
        f"Estimated Indian capital gains tax analysis for FY {rules['financial_year']} "
        f"(AY {rules['assessment_year']}) using {rules['version']}. "
        "Calculations are simulated for personal portfolio planning and tax-loss harvesting only. "
        "They do not constitute certified tax filings under the Income Tax Department. "
        "Please consult a certified Chartered Accountant or tax advisor before filing ITR."
    )


DISCLAIMER_TEXT = build_disclaimer(TAX_RULES_BY_AY[LATEST_STATUTORY_AY])


class TaxEngine(BaseCalculator):
    CALCULATION_TYPE = "TAX"

    def match_lots_fifo(
        self,
        buy_lots: List[Dict[str, Any]],
        sell_orders: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """
        Executes strict First-In, First-Out (FIFO) matching between purchase lots and sell orders.
        buy_lots: [{ symbol, quantity, price, buy_date, id }]
        sell_orders: [{ symbol, quantity, price, sell_date, id }]
        Returns matched realized trades with exact purchase dates and cost bases.
        """
        # Group buys by symbol and sort chronologically
        inventory = defaultdict(deque)
        sorted_buys = sorted(
            buy_lots,
            key=lambda b: parse_iso_date(b.get("buy_date") or b.get("transaction_date") or b.get("date") or b.get("created_at")) or date.min
        )

        for b in sorted_buys:
            sym = str(b.get("symbol") or b.get("symbol_or_name") or "").strip().upper()
            qty = to_decimal(b.get("quantity", 0))
            price = to_decimal(b.get("price") or b.get("avg_buy_price", 0))
            b_date = parse_iso_date(b.get("buy_date") or b.get("transaction_date") or b.get("date") or b.get("created_at")) or date.today()
            if sym and qty > Decimal("0") and price > Decimal("0"):
                inventory[sym].append({
                    "lot_id": b.get("id"),
                    "symbol": sym,
                    "remaining_qty": qty,
                    "buy_price": price,
                    "buy_date": b_date,
                    "asset_class": b.get("asset_class", "equity"),
                })

        sorted_sells = sorted(
            sell_orders,
            key=lambda s: parse_iso_date(s.get("sell_date") or s.get("transaction_date") or s.get("date") or s.get("created_at")) or date.min
        )

        realized_trades = []

        for s in sorted_sells:
            sym = str(s.get("symbol") or s.get("symbol_or_name") or "").strip().upper()
            sell_qty = to_decimal(s.get("quantity", 0))
            sell_price = to_decimal(s.get("price", 0))
            s_date = parse_iso_date(s.get("sell_date") or s.get("transaction_date") or s.get("date") or s.get("created_at")) or date.today()
            asset_class = s.get("asset_class", "equity")

            if not sym or sell_qty <= Decimal("0") or sell_price <= Decimal("0"):
                continue

            unfilled_sell = sell_qty
            queue = inventory[sym]

            while unfilled_sell > Decimal("0") and queue:
                current_lot = queue[0]
                matched_qty = min(unfilled_sell, current_lot["remaining_qty"])

                buy_amt = matched_qty * current_lot["buy_price"]
                sell_amt = matched_qty * sell_price
                gain = sell_amt - buy_amt
                holding_days = (s_date - current_lot["buy_date"]).days

                realized_trades.append({
                    "symbol": sym,
                    "asset_class": asset_class or current_lot["asset_class"],
                    "quantity": float(matched_qty),
                    "buy_price": float(current_lot["buy_price"]),
                    "sell_price": float(sell_price),
                    "buy_amount": float(buy_amt),
                    "sell_amount": float(sell_amt),
                    "gain": float(gain),
                    "buy_date": current_lot["buy_date"].isoformat(),
                    "sell_date": s_date.isoformat(),
                    "holding_days": holding_days,
                })

                current_lot["remaining_qty"] -= matched_qty
                unfilled_sell -= matched_qty

                if current_lot["remaining_qty"] <= Decimal("0"):
                    queue.popleft()

            # If sell could not be matched with historical buys, record with available cost or zero basis
            if unfilled_sell > Decimal("0"):
                cost_estimate = unfilled_sell * sell_price * Decimal("0.85") # fallback flag
                gain = (unfilled_sell * sell_price) - cost_estimate
                realized_trades.append({
                    "symbol": sym,
                    "asset_class": asset_class,
                    "quantity": float(unfilled_sell),
                    "buy_price": float(sell_price * Decimal("0.85")),
                    "sell_price": float(sell_price),
                    "buy_amount": float(cost_estimate),
                    "sell_amount": float(unfilled_sell * sell_price),
                    "gain": float(gain),
                    "buy_date": s_date.isoformat(),
                    "sell_date": s_date.isoformat(),
                    "holding_days": 0,
                    "is_estimated_cost_basis": True,
                })

        return realized_trades

    def calculate(self, inputs: Dict[str, Any], context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Calculates capital gains tax liability and harvesting opportunities.
        Inputs:
            assessment_year: string (default "2025-26")
            tax_slab_rate: float (default 0.30)
            realized_trades: List[Dict] (or matched FIFO from buy_lots + sell_orders)
            buy_lots: Optional List[Dict] for FIFO matching
            sell_orders: Optional List[Dict] for FIFO matching
            unrealized_holdings: List[Dict] [{ id, symbol, asset_class, buy_date, invested_amount, current_value }]
        """
        ay = normalize_assessment_year(inputs.get("assessment_year"))
        slab_rate_dec: Decimal = to_decimal(inputs.get("tax_slab_rate", "0.30"))
        custom_rules = inputs.get("custom_rules") or inputs.get("tax_rules_override")
        rules = resolve_tax_rules(ay, custom_rules)
        eq_rules = rules["equity"]
        bul_rules = rules["bullion"]
        bond_rules = rules["bonds_listed"]
        crypto_rules = rules["crypto_vda"]
        filter_by_fy = bool(inputs.get("filter_by_fy", False))
        fy_start = rules["fy_start"]
        fy_end = rules["fy_end"]
        now = datetime.now()

        # 1. Determine realized trades (either directly supplied or matched via FIFO)
        realized_trades = inputs.get("realized_trades", [])
        buy_lots = inputs.get("buy_lots", [])
        sell_orders = inputs.get("sell_orders", [])

        if not realized_trades and not (buy_lots and sell_orders) and inputs.get("transactions"):
            txs = inputs.get("transactions", [])
            buy_lots = [t for t in txs if str(t.get("type", "")).upper() == "BUY"]
            sell_orders = [t for t in txs if str(t.get("type", "")).upper() == "SELL"]

        if not realized_trades and (buy_lots and sell_orders):
            realized_trades = self.match_lots_fifo(buy_lots, sell_orders)

        if filter_by_fy and realized_trades:
            filtered = []
            for trade in realized_trades:
                sell_dt = str(trade.get("sell_date") or "")[:10]
                if not sell_dt or (fy_start <= sell_dt <= fy_end):
                    filtered.append(trade)
            realized_trades = filtered

        # 2. Categorize Realized Gains & Losses
        equity_ltcg_gain = Decimal("0.00")
        equity_stcg_gain = Decimal("0.00")
        debt_gain = Decimal("0.00")
        bullion_ltcg_gain = Decimal("0.00")
        bullion_stcg_gain = Decimal("0.00")
        bonds_ltcg_gain = Decimal("0.00")
        bonds_stcg_gain = Decimal("0.00")
        crypto_gain = Decimal("0.00")
        crypto_losses = Decimal("0.00")
        fno_income = Decimal("0.00")

        eq_threshold = int(eq_rules["holding_threshold_days"])
        bul_threshold = int(bul_rules["holding_threshold_days"])
        bond_threshold = int(bond_rules["holding_threshold_days"])

        for trade in realized_trades:
            net_gain = to_decimal(trade.get("gain", 0))
            if "gain" not in trade and "sell_amount" in trade and "buy_amount" in trade:
                net_gain = to_decimal(trade.get("sell_amount", 0)) - to_decimal(trade.get("buy_amount", 0))

            holding_days = trade.get("holding_days")
            if holding_days is None:
                b_dt = parse_iso_date(trade.get("buy_date"))
                s_dt = parse_iso_date(trade.get("sell_date"))
                holding_days = (s_dt - b_dt).days if (s_dt and b_dt) else 0

            asset = str(trade.get("asset_class") or "equity").lower()

            if asset in ("equity", "stock", "mutual_fund", "equity_mf"):
                if holding_days >= eq_threshold:
                    equity_ltcg_gain += net_gain
                else:
                    equity_stcg_gain += net_gain
            elif asset in ("debt_fund", "debt_mf", "specified_mutual_fund", "debt"):
                debt_gain += net_gain
            elif asset in ("bullion", "gold", "silver"):
                if holding_days >= bul_threshold:
                    bullion_ltcg_gain += net_gain
                else:
                    bullion_stcg_gain += net_gain
            elif asset in ("bond", "bonds", "bonds_listed"):
                if holding_days >= bond_threshold:
                    bonds_ltcg_gain += net_gain
                else:
                    bonds_stcg_gain += net_gain
            elif asset in ("crypto", "cryptocurrency", "vda", "bitcoin", "ethereum"):
                if net_gain > Decimal("0.00"):
                    crypto_gain += net_gain
                else:
                    crypto_losses += abs(net_gain)
            elif asset in ("fno", "derivative", "option", "future"):
                fno_income += net_gain

        # 3. Inter-Asset Loss Set-Off Rules (Sections 70 & 71)
        # STCL can offset both STCG and LTCG.
        # LTCL can ONLY offset LTCG.
        # Crypto losses cannot offset any gains (Sec 115BBH) unless customized.
        adjusted_equity_ltcg = equity_ltcg_gain
        adjusted_equity_stcg = equity_stcg_gain

        # If STCG is net negative (STCL) and LTCG is positive, offset STCL against LTCG
        if adjusted_equity_stcg < Decimal("0.00") and adjusted_equity_ltcg > Decimal("0.00"):
            offset_amt = min(abs(adjusted_equity_stcg), adjusted_equity_ltcg)
            adjusted_equity_ltcg -= offset_amt
            adjusted_equity_stcg += offset_amt

        # 4. Tax Liability Computation
        ltcg_exemption = eq_rules["ltcg_exemption_limit"]
        taxable_equity_ltcg = max(Decimal("0.00"), adjusted_equity_ltcg - ltcg_exemption)
        equity_ltcg_tax = taxable_equity_ltcg * eq_rules["ltcg_rate"]
        equity_stcg_tax = max(Decimal("0.00"), adjusted_equity_stcg) * eq_rules["stcg_rate"]

        debt_tax = max(Decimal("0.00"), debt_gain) * slab_rate_dec
        bullion_ltcg_tax = max(Decimal("0.00"), bullion_ltcg_gain) * bul_rules["ltcg_rate"]
        bullion_stcg_tax = max(Decimal("0.00"), bullion_stcg_gain) * slab_rate_dec
        bonds_ltcg_tax = max(Decimal("0.00"), bonds_ltcg_gain) * bond_rules["ltcg_rate"]
        bonds_stcg_tax = max(Decimal("0.00"), bonds_stcg_gain) * slab_rate_dec
        fno_tax = max(Decimal("0.00"), fno_income) * slab_rate_dec

        # Crypto flat 30% (+4% cess = 31.2%) on gross gains (or net if custom allows loss setoff)
        crypto_taxable = (
            max(Decimal("0.00"), crypto_gain - crypto_losses)
            if crypto_rules.get("allow_loss_setoff")
            else crypto_gain
        )
        crypto_tax = crypto_taxable * crypto_rules["effective_rate"]

        total_realized_gains = (
            equity_ltcg_gain
            + equity_stcg_gain
            + debt_gain
            + bullion_ltcg_gain
            + bullion_stcg_gain
            + bonds_ltcg_gain
            + bonds_stcg_gain
            + crypto_gain
            + fno_income
        )

        total_estimated_tax = (
            equity_ltcg_tax
            + equity_stcg_tax
            + debt_tax
            + bullion_ltcg_tax
            + bullion_stcg_tax
            + bonds_ltcg_tax
            + bonds_stcg_tax
            + crypto_tax
            + fno_tax
        )

        # 5. Analyze Unrealized Holdings for Tax-Loss Harvesting Opportunities
        unrealized_holdings: List[Dict[str, Any]] = inputs.get("unrealized_holdings", [])
        harvesting_opportunities = []
        total_harvestable_loss = Decimal("0.00")
        total_potential_tax_savings = Decimal("0.00")

        for holding in unrealized_holdings:
            inv = to_decimal(holding.get("invested_amount", 0))
            cur = to_decimal(holding.get("current_value", 0))

            if cur < inv and inv > Decimal("0.00"):
                loss = inv - cur
                b_dt = parse_iso_date(holding.get("buy_date"))
                holding_days = (now.date() - b_dt).days if b_dt else 0
                months = round(holding_days / 30.4, 1)

                asset = str(holding.get("asset_class") or "equity").lower()
                is_equity = asset in ("equity", "stock", "mutual_fund", "equity_mf")
                is_bond = asset in ("bond", "bonds", "bonds_listed")
                is_crypto = asset in ("crypto", "cryptocurrency", "vda")
                is_debt = asset in ("debt", "debt_fund", "debt_mf")

                if is_crypto and not crypto_rules.get("allow_loss_setoff", False):
                    # Under Sec 115BBH, crypto losses cannot be harvested to offset any gains
                    tax_rate = Decimal("0.00")
                    gain_type = "VDA_LOSS_UNOFFSETTABLE"
                    potential_savings = Decimal("0.00")
                    rec = "Under Section 115BBH, Virtual Digital Asset (Crypto) losses cannot be set off against any gains or carried forward."
                elif is_crypto:
                    tax_rate = crypto_rules["effective_rate"]
                    gain_type = "VDA"
                    potential_savings = loss * tax_rate
                    rec = f"Harvest ₹{loss:,.2f} VDA loss under custom rule override to save ~₹{potential_savings:,.2f}."
                elif is_debt:
                    tax_rate = slab_rate_dec
                    gain_type = "SLAB"
                    potential_savings = loss * tax_rate
                    rec = f"Harvest ₹{loss:,.2f} debt fund loss to offset other capital gains and save up to ₹{potential_savings:,.2f}."
                elif is_bond:
                    is_long_term = holding_days >= bond_threshold
                    gain_type = "LTCG" if is_long_term else "STCG"
                    tax_rate = bond_rules["ltcg_rate"] if is_long_term else slab_rate_dec
                    potential_savings = loss * tax_rate
                    rec = f"Harvest ₹{loss:,.2f} bond loss to offset taxable {gain_type} gains and save ~₹{potential_savings:,.2f} in taxes."
                else:
                    is_long_term = (holding_days >= eq_threshold) if is_equity else (holding_days >= bul_threshold)
                    gain_type = "LTCG" if is_long_term else "STCG"
                    if is_long_term:
                        tax_rate = eq_rules["ltcg_rate"] if is_equity else bul_rules["ltcg_rate"]
                    else:
                        tax_rate = eq_rules["stcg_rate"] if is_equity else slab_rate_dec
                    potential_savings = loss * tax_rate
                    rec = f"Harvest ₹{loss:,.2f} loss to offset taxable {gain_type} gains and save ~₹{potential_savings:,.2f} in taxes."

                harvesting_opportunities.append({
                    "id": str(holding.get("id") or holding.get("symbol") or "holding"),
                    "symbol": str(holding.get("symbol") or holding.get("name") or "Asset"),
                    "assetClass": holding.get("asset_class", "equity"),
                    "buyDate": holding.get("buy_date") or "",
                    "investedAmount": float(quantize_currency(inv)),
                    "currentValue": float(quantize_currency(cur)),
                    "unrealizedLoss": float(quantize_currency(loss)),
                    "holdingPeriodMonths": months,
                    "gainType": gain_type,
                    "potentialTaxSavings": float(quantize_currency(potential_savings)),
                    "effectiveTaxRate": float(quantize_currency(tax_rate * Decimal("100"))),
                    "recommendation": rec,
                })

                if not is_crypto or crypto_rules.get("allow_loss_setoff", False):
                    total_harvestable_loss += loss
                    total_potential_tax_savings += potential_savings

        # Sort opportunities by potential tax savings descending
        harvesting_opportunities.sort(key=lambda x: x["potentialTaxSavings"], reverse=True)

        advice = []
        if taxable_equity_ltcg > Decimal("0.00"):
            advice.append(
                f"Your equity LTCG of ₹{equity_ltcg_gain:,.2f} exceeds the Section 112A ₹{ltcg_exemption:,.0f} exemption limit by ₹{taxable_equity_ltcg:,.2f}. Consider harvesting available long-term losses before March 31st to reduce tax liability."
            )
        elif equity_ltcg_gain > Decimal("0.00"):
            rem = ltcg_exemption - equity_ltcg_gain
            advice.append(
                f"You have ₹{rem:,.2f} in remaining tax-free LTCG exemption under Section 112A for AY {rules['assessment_year']}."
            )

        if equity_stcg_gain > Decimal("0.00") and total_harvestable_loss > Decimal("0.00"):
            stcg_pct = float(quantize_currency(eq_rules["stcg_rate"] * Decimal("100")))
            advice.append(
                f"You have ₹{equity_stcg_gain:,.2f} in taxable STCG (taxed at {stcg_pct:g}%). You can harvest available short-term losses to directly neutralize this liability."
            )

        if crypto_losses > Decimal("0.00") and not crypto_rules.get("allow_loss_setoff", False):
            advice.append(
                f"Note: You have ₹{crypto_losses:,.2f} in cryptocurrency losses. Section 115BBH strictly prohibits setting off crypto losses against capital gains from stocks, mutual funds, or other crypto."
            )

        # Optional: Include Income Tax Old vs New Regime Comparison if gross income provided
        regime_comparison = None
        gross_salary = inputs.get("gross_salary") or inputs.get("annual_income")
        if gross_salary is not None and to_decimal(gross_salary) > Decimal("0.00"):
            regime_comparison = self.compare_regimes(
                gross_income=to_decimal(gross_salary),
                deductions_80c=to_decimal(inputs.get("deductions_80c", 0)),
                deductions_80d=to_decimal(inputs.get("deductions_80d", 0)),
                nps_80ccd_1b=to_decimal(inputs.get("nps_80ccd_1b", 0)),
                home_loan_interest_24b=to_decimal(inputs.get("home_loan_interest_24b", 0)),
                hra_exemption=to_decimal(inputs.get("hra_exemption", 0)),
                other_deductions=to_decimal(inputs.get("other_deductions", 0)),
                assessment_year=rules["assessment_year"],
                custom_rules=custom_rules,
            )

        adjusted_taxable_ltcg = taxable_equity_ltcg
        adjusted_stcg = adjusted_equity_stcg
        return {
            "disclaimer": build_disclaimer(rules),
            "assessmentYear": rules["assessment_year"],
            "financialYear": rules["financial_year"],
            "fiscalYearStart": rules["fy_start"],
            "fiscalYearEnd": rules["fy_end"],
            "taxSlabRate": float(slab_rate_dec),
            "taxRulesVersion": rules["version"],
            "statuteReference": rules["statute_reference"],
            "isCustomized": rules["is_customized"],
            "realized": {
                "equityLtcgGain": float(quantize_currency(equity_ltcg_gain)),
                "equityLtcgTaxable": float(quantize_currency(adjusted_taxable_ltcg)),
                "equityLtcgTax": float(quantize_currency(equity_ltcg_tax)),
                "equityStcgGain": float(quantize_currency(adjusted_stcg)),
                "equityStcgTax": float(quantize_currency(equity_stcg_tax)),
                "debtGain": float(quantize_currency(debt_gain)),
                "debtTax": float(quantize_currency(debt_tax)),
                "bullionLtcgGain": float(quantize_currency(bullion_ltcg_gain)),
                "bullionLtcgTax": float(quantize_currency(bullion_ltcg_tax)),
                "bullionStcgGain": float(quantize_currency(bullion_stcg_gain)),
                "bullionStcgTax": float(quantize_currency(bullion_stcg_tax)),
                "bondsLtcgGain": float(quantize_currency(bonds_ltcg_gain)),
                "bondsLtcgTax": float(quantize_currency(bonds_ltcg_tax)),
                "bondsStcgGain": float(quantize_currency(bonds_stcg_gain)),
                "bondsStcgTax": float(quantize_currency(bonds_stcg_tax)),
                "cryptoGain": float(quantize_currency(crypto_gain)),
                "cryptoLosses": float(quantize_currency(crypto_losses)),
                "cryptoTax": float(quantize_currency(crypto_tax)),
                "fnoIncome": float(quantize_currency(fno_income)),
                "fnoTax": float(quantize_currency(fno_tax)),
                "totalRealizedGains": float(quantize_currency(total_realized_gains)),
                "totalEstimatedTax": float(quantize_currency(total_estimated_tax)),
            },
            "harvestingOpportunities": harvesting_opportunities,
            "totalHarvestableLoss": float(quantize_currency(total_harvestable_loss)),
            "totalPotentialTaxSavings": float(quantize_currency(total_potential_tax_savings)),
            "regimeComparison": regime_comparison,
            "advice": advice,
        }

    def _calculate_progressive_slab_tax(
        self,
        taxable_income: Decimal,
        slabs: List[Tuple[Optional[Decimal], Decimal]],
    ) -> Decimal:
        """Calculates slab tax dynamically across ordered progressive brackets."""
        if taxable_income <= Decimal("0.00") or not slabs:
            return Decimal("0.00")
        tax = Decimal("0.00")
        prev_cap = Decimal("0.00")
        for up_to, rate in slabs:
            if taxable_income <= prev_cap:
                break
            upper = taxable_income if up_to is None else min(taxable_income, up_to)
            band_width = max(Decimal("0.00"), upper - prev_cap)
            tax += band_width * rate
            if up_to is None:
                break
            prev_cap = up_to
        return tax

    def _calculate_new_regime_base_tax(
        self,
        taxable_income: Decimal,
        slabs: Optional[List[Tuple[Optional[Decimal], Decimal]]] = None,
    ) -> Decimal:
        """Calculates New Regime (Section 115BAC) slab tax before rebate, surcharge and cess."""
        active_slabs = slabs if slabs is not None else TAX_RULES_BY_AY[LATEST_STATUTORY_AY]["new_regime"]["slabs"]
        return self._calculate_progressive_slab_tax(taxable_income, active_slabs)

    def _calculate_old_regime_base_tax(
        self,
        taxable_income: Decimal,
        slabs: Optional[List[Tuple[Optional[Decimal], Decimal]]] = None,
    ) -> Decimal:
        """Calculates Old Regime slab tax before rebate, surcharge and cess."""
        active_slabs = slabs if slabs is not None else OLD_REGIME_STANDARD["slabs"]
        return self._calculate_progressive_slab_tax(taxable_income, active_slabs)

    def _calculate_surcharge_with_marginal_relief(
        self,
        taxable_income: Decimal,
        base_tax: Decimal,
        is_new_regime: bool,
        slabs: Optional[List[Tuple[Optional[Decimal], Decimal]]] = None,
    ) -> Tuple[Decimal, Decimal]:
        """
        Calculates Surcharge on high net worth incomes and applies statutory Marginal Relief.
        Returns (final_surcharge, marginal_relief_amount).
        """
        if taxable_income <= Decimal("5000000.00"):
            return Decimal("0.00"), Decimal("0.00")

        base_calc = (
            (lambda inc: self._calculate_new_regime_base_tax(inc, slabs=slabs))
            if is_new_regime
            else (lambda inc: self._calculate_old_regime_base_tax(inc, slabs=slabs))
        )

        # 1. Determine nominal surcharge rate
        if taxable_income <= Decimal("10000000.00"):
            nominal_rate = Decimal("0.10")
            threshold = Decimal("5000000.00")
            tax_at_threshold = base_calc(threshold)
            prior_surcharge_at_threshold = Decimal("0.00")
        elif taxable_income <= Decimal("20000000.00"):
            nominal_rate = Decimal("0.15")
            threshold = Decimal("10000000.00")
            tax_at_threshold = base_calc(threshold)
            prior_surcharge_at_threshold = tax_at_threshold * Decimal("0.10")
        elif taxable_income <= Decimal("50000000.00"):
            nominal_rate = Decimal("0.25")
            threshold = Decimal("20000000.00")
            tax_at_threshold = base_calc(threshold)
            prior_surcharge_at_threshold = tax_at_threshold * Decimal("0.15")
        else:
            # > 5 Crores: New Regime caps surcharge at 25%; Old Regime charges 37%
            nominal_rate = Decimal("0.25") if is_new_regime else Decimal("0.37")
            threshold = Decimal("50000000.00")
            tax_at_threshold = base_calc(threshold)
            prior_surcharge_at_threshold = tax_at_threshold * Decimal("0.25")

        nominal_surcharge = base_tax * nominal_rate

        # Marginal Relief Rule:
        # Total (tax + surcharge) shall not exceed (tax + surcharge on threshold) + (income - threshold)
        max_payable = (tax_at_threshold + prior_surcharge_at_threshold) + (taxable_income - threshold)
        total_under_nominal = base_tax + nominal_surcharge

        if total_under_nominal > max_payable:
            surcharge_relief = total_under_nominal - max_payable
            final_surcharge = max(Decimal("0.00"), nominal_surcharge - surcharge_relief)
            return quantize_currency(final_surcharge), quantize_currency(surcharge_relief)
        else:
            return quantize_currency(nominal_surcharge), Decimal("0.00")

    def compare_regimes(
        self,
        gross_income: Decimal,
        deductions_80c: Decimal = Decimal("0.00"),
        deductions_80d: Decimal = Decimal("0.00"),
        nps_80ccd_1b: Decimal = Decimal("0.00"),
        nps_80ccd_2: Decimal = Decimal("0.00"),
        home_loan_interest_24b: Decimal = Decimal("0.00"),
        hra_exemption: Decimal = Decimal("0.00"),
        other_deductions: Decimal = Decimal("0.00"),
        assessment_year: Optional[str] = None,
        custom_rules: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Versioned Old vs New Tax Regime Comparator across Financial/Assessment Years.
        Calculates tax liability under both regimes with Section 87A rebate,
        Section 87A marginal relief, Section 80CCD(2) Corporate NPS deductions,
        and High-Net-Worth Surcharge with Marginal Relief.
        """
        rules = resolve_tax_rules(assessment_year, custom_rules)
        new_cfg = rules["new_regime"]
        old_cfg = rules["old_regime"]
        cess_rate = Decimal("0.04")

        # ---------------------------------------------------------
        # 1. New Tax Regime (Section 115BAC / Income-tax Act 2025)
        # ---------------------------------------------------------
        new_std_deduction = new_cfg["standard_deduction"]
        new_taxable_income = max(Decimal("0.00"), gross_income - new_std_deduction - nps_80ccd_2)

        new_base_tax = self._calculate_new_regime_base_tax(new_taxable_income, slabs=new_cfg["slabs"])
        new_marginal_relief_87a = Decimal("0.00")
        new_rebate_87a = Decimal("0.00")

        new_rebate_limit = new_cfg["rebate_87a_max_income"]
        new_rebate_cap = new_cfg["rebate_87a_max_amount"]

        # Section 87A Rebate & Marginal Relief
        if new_taxable_income <= new_rebate_limit:
            new_rebate_87a = min(new_base_tax, new_rebate_cap)
            new_tax_after_87a = max(Decimal("0.00"), new_base_tax - new_rebate_87a)
        elif new_cfg.get("marginal_relief_87a", True):
            # Proviso to Section 87A: tax payable shall not exceed (taxable_income - rebate_limit)
            excess_income_over_limit = new_taxable_income - new_rebate_limit
            if new_base_tax > excess_income_over_limit:
                new_marginal_relief_87a = new_base_tax - excess_income_over_limit
                new_tax_after_87a = excess_income_over_limit
            else:
                new_tax_after_87a = new_base_tax
        else:
            new_tax_after_87a = new_base_tax

        # Surcharge on High Net Worth Incomes
        new_surcharge, new_surcharge_relief = self._calculate_surcharge_with_marginal_relief(
            new_taxable_income, new_tax_after_87a, is_new_regime=True, slabs=new_cfg["slabs"]
        )

        new_tax_with_surcharge = new_tax_after_87a + new_surcharge
        new_cess = quantize_currency(new_tax_with_surcharge * cess_rate)
        new_total_tax = new_tax_with_surcharge + new_cess

        # ---------------------------------------------------------
        # 2. Old Tax Regime
        # ---------------------------------------------------------
        old_std_deduction = old_cfg["standard_deduction"]
        capped_80c = min(deductions_80c, Decimal("150000.00"))
        capped_80d = min(deductions_80d, Decimal("100000.00"))
        capped_nps = min(nps_80ccd_1b, Decimal("50000.00"))
        capped_24b = min(home_loan_interest_24b, Decimal("200000.00"))

        total_old_deductions = (
            old_std_deduction
            + capped_80c
            + capped_80d
            + capped_nps
            + nps_80ccd_2
            + capped_24b
            + hra_exemption
            + other_deductions
        )

        old_taxable_income = max(Decimal("0.00"), gross_income - total_old_deductions)
        old_base_tax = self._calculate_old_regime_base_tax(old_taxable_income, slabs=old_cfg["slabs"])
        old_rebate_87a = Decimal("0.00")

        old_rebate_limit = old_cfg["rebate_87a_max_income"]
        old_rebate_cap = old_cfg["rebate_87a_max_amount"]

        # Section 87A Rebate for Old Regime (up to 5L)
        if old_taxable_income <= old_rebate_limit:
            old_rebate_87a = min(old_base_tax, old_rebate_cap)
            old_tax_after_87a = max(Decimal("0.00"), old_base_tax - old_rebate_87a)
        else:
            old_tax_after_87a = old_base_tax

        # Surcharge on High Net Worth Incomes (Old Regime)
        old_surcharge, old_surcharge_relief = self._calculate_surcharge_with_marginal_relief(
            old_taxable_income, old_tax_after_87a, is_new_regime=False, slabs=old_cfg["slabs"]
        )

        old_tax_with_surcharge = old_tax_after_87a + old_surcharge
        old_cess = quantize_currency(old_tax_with_surcharge * cess_rate)
        old_total_tax = old_tax_with_surcharge + old_cess

        # ---------------------------------------------------------
        # 3. Recommendation & Savings
        # ---------------------------------------------------------
        if new_total_tax < old_total_tax:
            recommended_regime = "NEW_REGIME"
            savings_amount = old_total_tax - new_total_tax
            advice_summary = (
                f"New Tax Regime saves ₹{savings_amount:,.2f} under {rules['version']} "
                f"(₹{new_std_deduction:,.0f} standard deduction, Section 87A relief up to ₹{new_rebate_limit:,.0f})."
            )
        elif old_total_tax < new_total_tax:
            recommended_regime = "OLD_REGIME"
            savings_amount = new_total_tax - old_total_tax
            advice_summary = (
                f"Old Tax Regime saves ₹{savings_amount:,.2f} due to high deductions "
                f"(₹{total_old_deductions:,.2f} total claimed across 80C, 80D, HRA, and Home Loan)."
            )
        else:
            recommended_regime = "EQUAL"
            savings_amount = Decimal("0.00")
            advice_summary = "Both tax regimes yield the exact same tax liability."

        return {
            "assessmentYear": rules["assessment_year"],
            "financialYear": rules["financial_year"],
            "taxRulesVersion": rules["version"],
            "statuteReference": rules["statute_reference"],
            "recommendedRegime": recommended_regime,
            "savingsAmount": float(quantize_currency(savings_amount)),
            "advice": advice_summary,
            "newRegime": {
                "grossIncome": float(quantize_currency(gross_income)),
                "standardDeduction": float(quantize_currency(new_std_deduction)),
                "corporateNpsDeduction": float(quantize_currency(nps_80ccd_2)),
                "taxableIncome": float(quantize_currency(new_taxable_income)),
                "baseIncomeTax": float(quantize_currency(new_base_tax)),
                "section87aRebate": float(quantize_currency(new_rebate_87a)),
                "section87aMarginalRelief": float(quantize_currency(new_marginal_relief_87a)),
                "taxAfterRebate": float(quantize_currency(new_tax_after_87a)),
                "surcharge": float(quantize_currency(new_surcharge)),
                "surchargeMarginalRelief": float(quantize_currency(new_surcharge_relief)),
                "cess": float(quantize_currency(new_cess)),
                "totalTax": float(quantize_currency(new_total_tax)),
                "effectiveRatePercent": float(safe_percentage(new_total_tax, gross_income)),
            },
            "oldRegime": {
                "grossIncome": float(quantize_currency(gross_income)),
                "standardDeduction": float(quantize_currency(old_std_deduction)),
                "corporateNpsDeduction": float(quantize_currency(nps_80ccd_2)),
                "totalDeductions": float(quantize_currency(total_old_deductions)),
                "taxableIncome": float(quantize_currency(old_taxable_income)),
                "baseIncomeTax": float(quantize_currency(old_base_tax)),
                "section87aRebate": float(quantize_currency(old_rebate_87a)),
                "taxAfterRebate": float(quantize_currency(old_tax_after_87a)),
                "surcharge": float(quantize_currency(old_surcharge)),
                "surchargeMarginalRelief": float(quantize_currency(old_surcharge_relief)),
                "cess": float(quantize_currency(old_cess)),
                "totalTax": float(quantize_currency(old_total_tax)),
                "effectiveRatePercent": float(safe_percentage(old_total_tax, gross_income)),
            },
        }
