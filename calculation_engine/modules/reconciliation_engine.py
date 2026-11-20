"""
Financial Calculation Engine - Reconciliation Engine
Performs forensic audits across financial tables, compares transaction balances,
detects missing/duplicate entries, negative unexpected balances, and mathematical inconsistencies.
CRITICAL: Never automatically modifies financial records to conceal discrepancies.
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


class ReconciliationEngine(BaseCalculator):
    CALCULATION_TYPE = "RECONCILIATION"

    def calculate(self, inputs: Dict[str, Any], context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Inputs:
            accounts: List of account records [{ id, name, balance, opening_balance, classification }]
            expenses: List of expenses [{ id, amount, category, account_id, transaction_type }]
            income: List of income [{ id, amount, category, account_id, transaction_type }]
            transfers: List of transfers [{ id, from_account_id, to_account_id, amount }]
            holdings: Optional list of holdings [{ id, quantity, current_price, avg_price }]
            reported_net_worth: Optional net worth figure reported by client/dashboard
            currency: Preferred currency
        """
        accounts: List[Dict[str, Any]] = inputs.get("accounts", [])
        expenses: List[Dict[str, Any]] = inputs.get("expenses", [])
        income: List[Dict[str, Any]] = inputs.get("income", [])
        transfers: List[Dict[str, Any]] = inputs.get("transfers", [])
        holdings: List[Dict[str, Any]] = inputs.get("holdings", [])
        reported_net_worth_in = inputs.get("reported_net_worth")
        preferred_currency: str = inputs.get("currency", DEFAULT_CURRENCY)

        discrepancies = []
        warnings = []
        checks_performed = 0

        account_ids = {str(acc.get("id")) for acc in accounts if acc.get("id")}

        # ---------------------------------------------------------------------
        # Check 1: Duplicate Transaction Detection
        # ---------------------------------------------------------------------
        checks_performed += 1
        seen_expense_ids = set()
        duplicate_expenses = []
        for exp in expenses:
            e_id = exp.get("id")
            if e_id:
                if e_id in seen_expense_ids:
                    duplicate_expenses.append(e_id)
                seen_expense_ids.add(e_id)

        seen_income_ids = set()
        duplicate_incomes = []
        for inc in income:
            i_id = inc.get("id")
            if i_id:
                if i_id in seen_income_ids:
                    duplicate_incomes.append(i_id)
                seen_income_ids.add(i_id)

        if duplicate_expenses:
            discrepancies.append({
                "check_name": "DUPLICATE_EXPENSE_TRANSACTIONS",
                "severity": "HIGH",
                "details": f"Found {len(duplicate_expenses)} duplicate expense IDs: {duplicate_expenses[:5]}",
                "expected": "0 duplicates",
                "actual": f"{len(duplicate_expenses)} duplicates",
            })

        if duplicate_incomes:
            discrepancies.append({
                "check_name": "DUPLICATE_INCOME_TRANSACTIONS",
                "severity": "HIGH",
                "details": f"Found {len(duplicate_incomes)} duplicate income IDs: {duplicate_incomes[:5]}",
                "expected": "0 duplicates",
                "actual": f"{len(duplicate_incomes)} duplicates",
            })

        # ---------------------------------------------------------------------
        # Check 2: Transaction Totals vs Category Aggregation Check
        # ---------------------------------------------------------------------
        checks_performed += 1
        raw_expense_sum = Decimal("0.00")
        category_sums = defaultdict(Decimal)

        for exp in expenses:
            tx_type = str(exp.get("transaction_type") or "expense").lower()
            if tx_type in ("transfer_out", "transfer") or exp.get("transfer_id"):
                continue
            amt = to_decimal(exp.get("amount", 0))
            raw_expense_sum += amt
            cat = str(exp.get("category") or "Other").strip()
            category_sums[cat] += amt

        cat_aggregate_sum = sum(category_sums.values(), Decimal("0.00"))
        delta_expense_cat = abs(raw_expense_sum - cat_aggregate_sum)

        if delta_expense_cat > Decimal("0.01"):
            discrepancies.append({
                "check_name": "EXPENSE_CATEGORY_AGGREGATION_MISMATCH",
                "severity": "HIGH",
                "details": f"Sum of transaction amounts ({raw_expense_sum}) does not match category sum ({cat_aggregate_sum})",
                "expected": str(quantize_currency(raw_expense_sum)),
                "actual": str(quantize_currency(cat_aggregate_sum)),
                "difference": str(quantize_currency(delta_expense_cat)),
            })

        # ---------------------------------------------------------------------
        # Check 3: Transfer Integrity & Orphaned Reference Detection
        # ---------------------------------------------------------------------
        checks_performed += 1
        for tr in transfers:
            tr_id = tr.get("id") or "unknown"
            from_id = str(tr.get("from_account_id") or "")
            to_id = str(tr.get("to_account_id") or "")
            amt = to_decimal(tr.get("amount", 0))

            if amt <= Decimal("0.00"):
                discrepancies.append({
                    "check_name": "INVALID_TRANSFER_AMOUNT",
                    "severity": "HIGH",
                    "details": f"Transfer '{tr_id}' has non-positive amount {amt}",
                    "expected": "> 0.00",
                    "actual": str(amt),
                })

            if from_id == to_id and from_id != "":
                discrepancies.append({
                    "check_name": "IDENTICAL_TRANSFER_ACCOUNTS",
                    "severity": "HIGH",
                    "details": f"Transfer '{tr_id}' has source account identical to destination account ({from_id})",
                    "expected": "from_account_id != to_account_id",
                    "actual": f"{from_id} == {to_id}",
                })

            if account_ids:
                if from_id and from_id not in account_ids:
                    discrepancies.append({
                        "check_name": "UNMATCHED_TRANSFER_SOURCE",
                        "severity": "HIGH",
                        "details": f"Transfer '{tr_id}' refers to non-existent source account: {from_id}",
                        "expected": "account exists in user accounts",
                        "actual": from_id,
                    })
                if to_id and to_id not in account_ids:
                    discrepancies.append({
                        "check_name": "UNMATCHED_TRANSFER_DESTINATION",
                        "severity": "HIGH",
                        "details": f"Transfer '{tr_id}' refers to non-existent destination account: {to_id}",
                        "expected": "account exists in user accounts",
                        "actual": to_id,
                    })

        # ---------------------------------------------------------------------
        # Check 4: Account Balance Flow Reconciliation & Variance Detection
        # Formula: Expected Closing = Opening Balance + Income - Expenses + Transfers In - Transfers Out
        # Variance = Recorded Closing Balance - Expected Closing Balance
        # ---------------------------------------------------------------------
        checks_performed += 1
        account_flows = defaultdict(lambda: {
            "income": Decimal("0.00"),
            "expenses": Decimal("0.00"),
            "transfers_in": Decimal("0.00"),
            "transfers_out": Decimal("0.00"),
        })

        for inc in income:
            a_id = inc.get("account_id")
            if a_id:
                account_flows[str(a_id)]["income"] += to_decimal(inc.get("amount", 0))

        for exp in expenses:
            a_id = exp.get("account_id")
            if a_id:
                account_flows[str(a_id)]["expenses"] += to_decimal(exp.get("amount", 0))

        for tr in transfers:
            from_id = tr.get("from_account_id")
            to_id = tr.get("to_account_id")
            amt = to_decimal(tr.get("amount", 0))
            if from_id:
                account_flows[str(from_id)]["transfers_out"] += amt
            if to_id:
                account_flows[str(to_id)]["transfers_in"] += amt

        account_reconciliation_details = []
        for acc in accounts:
            acc_id = str(acc.get("id"))
            acc_name = acc.get("name", "Account")
            recorded_bal = to_decimal(acc.get("balance", 0))
            opening_bal = to_decimal(acc.get("opening_balance", acc.get("initial_balance", 0)))
            has_opening_declared = "opening_balance" in acc or "initial_balance" in acc
            classification = str(acc.get("classification") or "asset").lower()

            flows = account_flows.get(acc_id, {
                "income": Decimal("0.00"),
                "expenses": Decimal("0.00"),
                "transfers_in": Decimal("0.00"),
                "transfers_out": Decimal("0.00"),
            })

            net_flow = flows["income"] - flows["expenses"] + flows["transfers_in"] - flows["transfers_out"]
            expected_closing = opening_bal + net_flow
            variance = recorded_bal - expected_closing

            # Detect variance if opening balance was explicitly supplied
            if has_opening_declared and abs(variance) > Decimal("0.01"):
                discrepancies.append({
                    "check_name": "ACCOUNT_BALANCE_FLOW_VARIANCE",
                    "severity": "HIGH",
                    "account_id": acc_id,
                    "account_name": acc_name,
                    "details": f"Account '{acc_name}' recorded balance ({recorded_bal}) does not match expected closing balance ({expected_closing}). Variance: {variance}",
                    "expected": str(quantize_currency(expected_closing)),
                    "actual": str(quantize_currency(recorded_bal)),
                    "variance": str(quantize_currency(variance)),
                })

            # Unexpected negative balance on liquid cash or bank accounts
            if classification == "asset" and recorded_bal < Decimal("0.00"):
                warnings.append({
                    "check_name": "UNEXPECTED_NEGATIVE_ASSET_BALANCE",
                    "severity": "MEDIUM",
                    "details": f"Account '{acc_name}' ({acc_id}) has a negative balance of {recorded_bal}.",
                    "balance": str(quantize_currency(recorded_bal)),
                })

            account_reconciliation_details.append({
                "account_id": acc_id,
                "account_name": acc_name,
                "classification": classification,
                "opening_balance": str(quantize_currency(opening_bal)),
                "recorded_balance": str(quantize_currency(recorded_bal)),
                "expected_closing_balance": str(quantize_currency(expected_closing)),
                "variance": str(quantize_currency(variance)),
                "total_income_credited": str(quantize_currency(flows["income"])),
                "total_expense_debited": str(quantize_currency(flows["expenses"])),
                "transfers_received": str(quantize_currency(flows["transfers_in"])),
                "transfers_sent": str(quantize_currency(flows["transfers_out"])),
                "net_transaction_flow": str(quantize_currency(net_flow)),
            })

        # ---------------------------------------------------------------------
        # Check 5: Net Worth Integrity Check (Assets - Liabilities = Net Worth)
        # ---------------------------------------------------------------------
        checks_performed += 1
        total_assets = Decimal("0.00")
        total_liabilities = Decimal("0.00")

        for acc in accounts:
            bal = to_decimal(acc.get("balance", 0))
            classification = str(acc.get("classification") or "").lower()
            is_liab = classification == "liability" or "credit" in str(acc.get("type", "")).lower() or "loan" in str(acc.get("type", "")).lower()

            if is_liab:
                total_liabilities += abs(bal)
            else:
                total_assets += bal

        total_holdings_val = Decimal("0.00")
        for h in holdings:
            qty = to_decimal(h.get("quantity", 0))
            p = to_decimal(h.get("current_price", 0))
            if p <= Decimal("0"):
                p = to_decimal(h.get("avg_price", 0))
            total_holdings_val += (qty * p)

        calculated_net_worth = (total_assets + total_holdings_val) - total_liabilities

        if reported_net_worth_in is not None:
            reported_nw = to_decimal(reported_net_worth_in)
            delta_nw = abs(calculated_net_worth - reported_nw)
            if delta_nw > Decimal("1.00"):
                discrepancies.append({
                    "check_name": "REPORTED_VS_CALCULATED_NET_WORTH_MISMATCH",
                    "severity": "CRITICAL",
                    "details": f"Dashboard reported net worth ({reported_nw}) differs from backend calculated net worth ({calculated_net_worth})",
                    "expected": str(quantize_currency(calculated_net_worth)),
                    "actual": str(quantize_currency(reported_nw)),
                    "difference": str(quantize_currency(delta_nw)),
                })

        # Summary Status
        status = "PASS"
        if discrepancies:
            status = "FAIL"
        elif warnings:
            status = "WARNING"

        return {
            "reconciliation_status": status,
            "currency": preferred_currency,
            "checks_performed_count": checks_performed,
            "discrepancies_count": len(discrepancies),
            "warnings_count": len(warnings),
            "discrepancies": discrepancies,
            "warnings": warnings,
            "calculated_assets": str(quantize_currency(total_assets + total_holdings_val)),
            "calculated_liabilities": str(quantize_currency(total_liabilities)),
            "calculated_net_worth": str(quantize_currency(calculated_net_worth)),
            "account_reconciliation": account_reconciliation_details,
        }
