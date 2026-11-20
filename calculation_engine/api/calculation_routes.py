"""
Financial Calculation Engine - FastAPI Calculation Routes
Provides production-grade endpoints for all AFCE calculation modules,
health status, validation metrics dashboard, and audit history.
"""

from typing import Dict, Any, Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, Header
from pydantic import BaseModel, Field

from ..modules.expense_engine import ExpenseEngine
from ..modules.income_engine import IncomeEngine
from ..modules.budget_engine import BudgetEngine
from ..modules.networth_engine import NetWorthEngine
from ..modules.investment_engine import InvestmentEngine
from ..modules.portfolio_engine import PortfolioEngine
from ..modules.reconciliation_engine import ReconciliationEngine
from ..modules.tax_engine import TaxEngine
from ..bank_ingestion import parser_registry, validate_statement_continuity
from ..intelligence import classifier, match_internal_transfers, TransactionClassificationInput
from ..audit.calculation_logger import (
    get_validation_metrics,
    get_calculation_history,
)

router = APIRouter(prefix="", tags=["Financial Calculations"])

# Initialized Singletons
expense_engine = ExpenseEngine()
income_engine = IncomeEngine()
budget_engine = BudgetEngine()
networth_engine = NetWorthEngine()
investment_engine = InvestmentEngine()
portfolio_engine = PortfolioEngine()
reconciliation_engine = ReconciliationEngine()
tax_engine = TaxEngine()


# ---------------------------------------------------------------------------
# Request Models
# ---------------------------------------------------------------------------
class CalculationBaseRequest(BaseModel):
    user_id: Optional[str] = None
    currency: Optional[str] = "INR"


class ExpensesCalculationRequest(CalculationBaseRequest):
    transactions: List[Dict[str, Any]] = Field(default_factory=list)
    target_month: Optional[str] = None
    target_year: Optional[int] = None


class IncomeCalculationRequest(CalculationBaseRequest):
    income_records: List[Dict[str, Any]] = Field(default_factory=list)
    expense_records: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    target_month: Optional[str] = None
    target_year: Optional[int] = None


class BudgetCalculationRequest(CalculationBaseRequest):
    budgets: List[Dict[str, Any]] = Field(default_factory=list)
    expenses: List[Dict[str, Any]] = Field(default_factory=list)
    target_month: Optional[str] = None
    rollover_enabled: bool = False


class NetWorthCalculationRequest(CalculationBaseRequest):
    accounts: List[Dict[str, Any]] = Field(default_factory=list)
    stocks: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    mutual_funds: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    bonds: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    bullion: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    crypto: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    usd_inr_rate: Optional[float] = 84.50


class InvestmentCalculationRequest(CalculationBaseRequest):
    holdings: List[Dict[str, Any]] = Field(default_factory=list)
    transactions: Optional[List[Dict[str, Any]]] = Field(default_factory=list)


class PortfolioCalculationRequest(CalculationBaseRequest):
    holdings: List[Dict[str, Any]] = Field(default_factory=list)
    transactions: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    current_valuation: Optional[float] = None


class ReconciliationCalculationRequest(CalculationBaseRequest):
    accounts: List[Dict[str, Any]] = Field(default_factory=list)
    expenses: List[Dict[str, Any]] = Field(default_factory=list)
    income: List[Dict[str, Any]] = Field(default_factory=list)
    transfers: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    holdings: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    reported_net_worth: Optional[float] = None


class TaxCalculationRequest(CalculationBaseRequest):
    transactions: List[Dict[str, Any]] = Field(default_factory=list)
    unrealized_holdings: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    assessment_year: Optional[str] = "2025-2026"
    tax_slab_rate: Optional[float] = 0.30


class StatementParseRequest(CalculationBaseRequest):
    filename: str
    content_base64: str
    passwords: Optional[List[str]] = Field(default_factory=list)
    account_id: Optional[str] = None


class TransactionClassifyBatchRequest(CalculationBaseRequest):
    transactions: List[Dict[str, Any]] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------------------------
def resolve_user_id(payload_user_id: Optional[str], x_user_id: Optional[str]) -> Optional[str]:
    if x_user_id and payload_user_id and x_user_id != payload_user_id:
        raise HTTPException(status_code=403, detail="Forbidden: Cannot override authenticated user ID")
    return x_user_id or payload_user_id


@router.post("/calculations/expenses")
def calculate_expenses(payload: ExpensesCalculationRequest, x_user_id: Optional[str] = Header(None)):
    user_id = resolve_user_id(payload.user_id, x_user_id)
    inputs = payload.model_dump()
    return expense_engine.execute(inputs, user_id=user_id)


@router.post("/calculations/income")
def calculate_income(payload: IncomeCalculationRequest, x_user_id: Optional[str] = Header(None)):
    user_id = resolve_user_id(payload.user_id, x_user_id)
    inputs = payload.model_dump()
    return income_engine.execute(inputs, user_id=user_id)


@router.post("/calculations/budget")
def calculate_budget(payload: BudgetCalculationRequest, x_user_id: Optional[str] = Header(None)):
    user_id = resolve_user_id(payload.user_id, x_user_id)
    inputs = payload.model_dump()
    return budget_engine.execute(inputs, user_id=user_id)


@router.post("/calculations/networth")
def calculate_networth(payload: NetWorthCalculationRequest, x_user_id: Optional[str] = Header(None)):
    user_id = resolve_user_id(payload.user_id, x_user_id)
    inputs = payload.model_dump()
    return networth_engine.execute(inputs, user_id=user_id)


@router.post("/calculations/investments")
def calculate_investments(payload: InvestmentCalculationRequest, x_user_id: Optional[str] = Header(None)):
    user_id = resolve_user_id(payload.user_id, x_user_id)
    inputs = payload.model_dump()
    return investment_engine.execute(inputs, user_id=user_id)


@router.post("/calculations/portfolio")
def calculate_portfolio(payload: PortfolioCalculationRequest, x_user_id: Optional[str] = Header(None)):
    user_id = resolve_user_id(payload.user_id, x_user_id)
    inputs = payload.model_dump()
    return portfolio_engine.execute(inputs, user_id=user_id)


@router.post("/calculations/reconciliation")
def calculate_reconciliation(payload: ReconciliationCalculationRequest, x_user_id: Optional[str] = Header(None)):
    user_id = resolve_user_id(payload.user_id, x_user_id)
    inputs = payload.model_dump()
    return reconciliation_engine.execute(inputs, user_id=user_id)


@router.post("/calculations/tax")
def calculate_tax(payload: TaxCalculationRequest, x_user_id: Optional[str] = Header(None)):
    user_id = resolve_user_id(payload.user_id, x_user_id)
    inputs = payload.model_dump()
    return tax_engine.execute(inputs, user_id=user_id)


@router.get("/calculations/health")
def calculation_engine_health():
    return {
        "status": "healthy",
        "engine": "ArthaX Financial Calculation Engine (AFCE)",
        "version": "1.0.0",
        "precision_engine": "Python Decimal (Zero Floating-Point Error)",
        "active_modules": [
            "ExpenseEngine",
            "IncomeEngine",
            "BudgetEngine",
            "NetWorthEngine",
            "InvestmentEngine",
            "PortfolioEngine",
            "ReconciliationEngine",
            "TaxEngine",
        ],
    }


@router.get("/calculations/validation")
def get_validation_dashboard():
    """
    Returns calculation accuracy pass rates, total executed, failed details,
    and execution latency for the admin/developer dashboard.
    """
    return get_validation_metrics()


@router.get("/calculations/history")
def get_history(
    limit: int = Query(50, ge=1, le=500),
    type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    x_user_id: Optional[str] = Header(None),
):
    """
    Returns immutable calculation audit trail records scoped strictly to the requesting user.
    """
    effective_user_id = x_user_id or user_id
    if x_user_id and user_id and x_user_id != user_id:
        raise HTTPException(status_code=403, detail="Forbidden: Cannot query another user's calculation history.")

    return {
        "history": get_calculation_history(limit=limit, calculation_type=type, status=status, user_id=effective_user_id)
    }


# ---------------------------------------------------------------------------
# Statement Parsing & Transaction Intelligence Endpoints
# ---------------------------------------------------------------------------
@router.post("/statements/parse")
def parse_bank_statement(payload: StatementParseRequest):
    """
    Parses bank statement content (PDF or CSV), performs mathematical balance validation,
    and runs hybrid classification on all extracted transactions.
    """
    import base64
    from decimal import Decimal
    try:
        content_bytes = base64.b64decode(payload.content_base64)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid base64 payload: {str(e)}")

    parse_result = parser_registry.parse_statement(
        content=content_bytes,
        filename=payload.filename,
        passwords=payload.passwords,
    )

    if not parse_result.success and not parse_result.transactions:
        raise HTTPException(
            status_code=422,
            detail={
                "message": "Bank statement parsing failed",
                "errors": parse_result.errors,
                "bank_name": parse_result.bank_name,
                "file_hash": parse_result.file_hash,
            },
        )

    # Enrich each extracted transaction through the Transaction Intelligence Engine
    classified_txs = []
    for tx in parse_result.transactions:
        classification = classifier.classify(
            TransactionClassificationInput(
                amount=tx.amount,
                direction=tx.direction,
                original_narration=tx.original_narration,
                transaction_date=tx.transaction_date,
                transaction_reference=tx.transaction_reference,
            )
        )
        tx_dict = tx.model_dump()
        tx_dict["category"] = classification.category
        tx_dict["transaction_type"] = classification.transaction_type
        tx_dict["classification_confidence"] = float(classification.confidence)
        tx_dict["classification_reason"] = classification.reason
        tx_dict["merchant_name"] = classification.merchant_name
        tx_dict["merchant_category"] = classification.merchant_category
        tx_dict["counterparty_name"] = classification.counterparty_name
        tx_dict["counterparty_identifier"] = classification.counterparty_identifier
        tx_dict["channel"] = classification.channel
        tx_dict["is_refund"] = classification.is_refund
        classified_txs.append(tx_dict)

    res_dict = parse_result.model_dump()
    res_dict["transactions"] = classified_txs
    return {"success": True, "result": res_dict}


@router.post("/transactions/classify")
def classify_batch_transactions(payload: TransactionClassifyBatchRequest):
    """
    Classifies a batch of transactions and detects internal transfers across user accounts.
    """
    from decimal import Decimal
    classified = []
    for raw in payload.transactions:
        amt = Decimal(str(raw.get("amount", "0.00")))
        dir_val = str(raw.get("direction", "DEBIT")).upper()
        narration = str(raw.get("original_narration") or raw.get("narration") or raw.get("title") or "")
        d_val = raw.get("transaction_date") or raw.get("date") or "2026-01-01"
        if isinstance(d_val, str):
            from datetime import datetime
            try:
                parsed_d = datetime.strptime(d_val, "%Y-%m-%d").date()
            except ValueError:
                from datetime import date
                parsed_d = date.today()
        else:
            parsed_d = d_val

        c_res = classifier.classify(
            TransactionClassificationInput(
                id=raw.get("id"),
                account_id=raw.get("account_id"),
                amount=amt,
                direction=dir_val,
                original_narration=narration,
                transaction_date=parsed_d,
                transaction_reference=raw.get("transaction_reference") or raw.get("reference"),
            )
        )
        res_item = dict(raw)
        res_item["category"] = c_res.category
        res_item["transaction_type"] = c_res.transaction_type
        res_item["confidence"] = float(c_res.confidence)
        res_item["reason"] = c_res.reason
        res_item["merchant_name"] = c_res.merchant_name
        res_item["merchant_category"] = c_res.merchant_category
        res_item["counterparty_name"] = c_res.counterparty_name
        res_item["counterparty_identifier"] = c_res.counterparty_identifier
        res_item["channel"] = c_res.channel
        res_item["is_refund"] = c_res.is_refund
        classified.append(res_item)

    # Match internal transfers across the batch
    transfer_matches = match_internal_transfers(payload.transactions)

    return {
        "success": True,
        "classified_transactions": classified,
        "transfer_matches": [m.model_dump() for m in transfer_matches],
        "total_processed": len(classified),
        "transfers_detected": len(transfer_matches),
    }

