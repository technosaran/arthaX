"""
Financial Calculation Engine - FastAPI Calculation Routes
Provides production-grade endpoints for all AFCE calculation modules,
health status, validation metrics dashboard, and audit history.
"""

from typing import Dict, Any, Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from ..modules.expense_engine import ExpenseEngine
from ..modules.income_engine import IncomeEngine
from ..modules.budget_engine import BudgetEngine
from ..modules.networth_engine import NetWorthEngine
from ..modules.investment_engine import InvestmentEngine
from ..modules.portfolio_engine import PortfolioEngine
from ..modules.reconciliation_engine import ReconciliationEngine
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


# ---------------------------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------------------------
@router.post("/calculations/expenses")
def calculate_expenses(payload: ExpensesCalculationRequest):
    inputs = payload.model_dump()
    return expense_engine.execute(inputs, user_id=payload.user_id)


@router.post("/calculations/income")
def calculate_income(payload: IncomeCalculationRequest):
    inputs = payload.model_dump()
    return income_engine.execute(inputs, user_id=payload.user_id)


@router.post("/calculations/budget")
def calculate_budget(payload: BudgetCalculationRequest):
    inputs = payload.model_dump()
    return budget_engine.execute(inputs, user_id=payload.user_id)


@router.post("/calculations/networth")
def calculate_networth(payload: NetWorthCalculationRequest):
    inputs = payload.model_dump()
    return networth_engine.execute(inputs, user_id=payload.user_id)


@router.post("/calculations/investments")
def calculate_investments(payload: InvestmentCalculationRequest):
    inputs = payload.model_dump()
    return investment_engine.execute(inputs, user_id=payload.user_id)


@router.post("/calculations/portfolio")
def calculate_portfolio(payload: PortfolioCalculationRequest):
    inputs = payload.model_dump()
    return portfolio_engine.execute(inputs, user_id=payload.user_id)


@router.post("/calculations/reconciliation")
def calculate_reconciliation(payload: ReconciliationCalculationRequest):
    inputs = payload.model_dump()
    return reconciliation_engine.execute(inputs, user_id=payload.user_id)


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
):
    """
    Returns immutable calculation audit trail records.
    """
    return {
        "history": get_calculation_history(limit=limit, calculation_type=type, status=status, user_id=user_id)
    }
