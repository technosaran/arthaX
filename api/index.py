"""
ArthaX Python Financial Analytics & Machine Learning Service (FastAPI)
Deployed as a Vercel Serverless Function under /api/py/
Hardened for Production Security (CORS, JWT Authentication, Rate/Size Restrictions)
Enhanced with NumPy & SciPy for Vectorized Financial Intelligence, Monte Carlo Simulations & Versioned Indian Tax Engine (FY 2023-24 through FY 2026-27+)
"""

import os
import sys
import hmac
import math
from datetime import datetime
from typing import List, Optional, Any, Union, Dict
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Load local environment files if available
try:
    from dotenv import load_dotenv
    _base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    load_dotenv(os.path.join(_base_dir, ".env.local"))
    load_dotenv(os.path.join(_base_dir, ".env"))
except ImportError:
    pass

# High-Performance Mathematical & Statistical Libraries
try:
    import numpy as np
    NUMPY_AVAILABLE = True
except ImportError:
    NUMPY_AVAILABLE = False

IS_PROD = os.getenv("NODE_ENV") == "production" or os.getenv("VERCEL_ENV") == "production"

app = FastAPI(
    title="ArthaX Financial Analytics Engine",
    version="2.0.0",
    description="Python microservice for forecasting, Monte Carlo runway simulation, anomaly detection, and versioned Indian Capital Gains Tax harvesting.",
    docs_url=None if IS_PROD else "/api/py/docs",
    openapi_url=None if IS_PROD else "/api/py/openapi.json",
    redoc_url=None,
)

# ---------------------------------------------------------------------------
# Strict CORS Protection
# ---------------------------------------------------------------------------
raw_origins = os.getenv("ALLOWED_ORIGINS", "")
allowed_origins = [o.strip() for o in raw_origins.split(",") if o.strip()]
if not allowed_origins:
    allowed_origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://arthax.vercel.app",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Authentication & Authorization Dependency
# ---------------------------------------------------------------------------
def verify_auth_dependency(
    authorization: Optional[str] = Header(None),
    x_internal_service_key: Optional[str] = Header(None),
) -> dict:
    valid_internal_keys = [
        k.strip()
        for k in [
            os.getenv("INTERNAL_SERVICE_KEY"),
            os.getenv("CRON_SECRET"),
            os.getenv("SUPABASE_SERVICE_ROLE_KEY"),
        ]
        if k and k.strip()
    ]
    if x_internal_service_key and valid_internal_keys:
        provided = x_internal_service_key.strip()
        for key in valid_internal_keys:
            if hmac.compare_digest(provided, key):
                return {"user_id": "internal_service", "auth_method": "service_key"}

    if not IS_PROD and (os.getenv("DISABLE_AUTH") == "1" or not authorization):
        return {"user_id": "dev_user", "auth_method": "development_bypass"}

    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
        try:
            jwt_secret = os.getenv("SUPABASE_JWT_SECRET")
            if not jwt_secret and IS_PROD:
                raise HTTPException(
                    status_code=500,
                    detail="Server configuration error: SUPABASE_JWT_SECRET is required for authenticated verification",
                )

            if jwt_secret:
                try:
                    import jwt
                    payload = jwt.decode(
                        token,
                        jwt_secret,
                        algorithms=["HS256"],
                        audience="authenticated",
                        options={"verify_exp": True, "verify_signature": True},
                    )
                    sub = payload.get("sub")
                    if not sub:
                        raise HTTPException(status_code=401, detail="Invalid token: missing subject claim")
                    return {"user_id": sub, "auth_method": "supabase_jwt_verified"}
                except ImportError:
                    raise HTTPException(
                        status_code=500,
                        detail="Cryptographic dependency missing: pyjwt is required for secure authentication",
                    )
            elif not IS_PROD:
                try:
                    import jwt
                    payload = jwt.decode(
                        token,
                        options={"verify_signature": False, "verify_exp": True},
                        algorithms=["HS256"],
                    )
                    sub = payload.get("sub")
                    if sub:
                        return {"user_id": sub, "auth_method": "dev_unverified_jwt"}
                except Exception:
                    pass
        except HTTPException:
            raise
        except Exception as err:
            raise HTTPException(status_code=401, detail=f"Invalid authentication token: {str(err)}")

    raise HTTPException(
        status_code=401,
        detail="Unauthorized: Valid authentication token or service key required",
    )

# ---------------------------------------------------------------------------
# Data Models with Bounds & Validation
# ---------------------------------------------------------------------------
class RunwayRequest(BaseModel):
    liquid_cash: float = Field(..., ge=0, le=1e12, description="Total liquid assets in bank accounts and cash")
    monthly_expenses: List[float] = Field(..., min_length=1, max_length=120, description="List of monthly total expenses")

class MonteCarloMetrics(BaseModel):
    p10_conservative_months: float
    p50_median_months: float
    p90_optimistic_months: float
    probability_depleted_6m: float
    probability_depleted_12m: float

class RunwayResponse(BaseModel):
    average_monthly_burn: float
    median_monthly_burn: Optional[float] = None
    burn_volatility_std: Optional[float] = None
    runway_months: float
    status: str
    burn_trend: str
    trend_slope: Optional[float] = None
    monte_carlo: Optional[MonteCarloMetrics] = None

class TransactionToCategorize(BaseModel):
    title: str = Field(..., min_length=1, max_length=250)
    amount: Optional[float] = Field(None, ge=0, le=1e11)

class CategorizationResponse(BaseModel):
    category: str
    confidence: float
    method: str

class TransactionItem(BaseModel):
    id: Optional[str] = Field(None, max_length=100)
    title: Optional[str] = Field("", max_length=250)
    amount: float = Field(..., ge=0, le=1e11)
    date: Optional[str] = Field(None, max_length=50)

class AnomalyDetectionRequest(BaseModel):
    transactions: List[Union[TransactionItem, dict]] = Field(
        ..., min_length=1, max_length=1000, description="Transactions to analyze for spending anomalies"
    )

class RealizedTradeInput(BaseModel):
    id: Optional[str] = None
    symbol: str
    asset_class: str = "equity"  # equity, mutual_fund, debt_fund, bullion, fno
    buy_date: str
    sell_date: str
    buy_amount: float
    sell_amount: float
    quantity: Optional[float] = 1.0

class UnrealizedHoldingInput(BaseModel):
    id: Optional[str] = None
    symbol: str
    asset_class: str = "equity"  # equity, mutual_fund, debt_fund, bullion
    buy_date: str
    invested_amount: float
    current_value: float
    quantity: Optional[float] = 1.0

class TaxAnalysisRequest(BaseModel):
    assessment_year: Optional[str] = None
    tax_slab_rate: float = Field(0.30, ge=0.0, le=0.45)
    custom_rules: Optional[Dict[str, Any]] = None
    filter_by_fy: bool = False
    realized_trades: List[RealizedTradeInput] = []
    unrealized_holdings: List[UnrealizedHoldingInput] = []

# ---------------------------------------------------------------------------
# Vectorized Mathematical & Quantitative Implementations
# ---------------------------------------------------------------------------
def calculate_runway_logic(liquid_cash: float, monthly_expenses: List[float]) -> RunwayResponse:
    if not monthly_expenses:
        raise HTTPException(status_code=400, detail="At least one monthly expense figure is required.")

    valid_expenses = [x for x in monthly_expenses if not math.isnan(x) and not math.isinf(x) and x >= 0]
    if not valid_expenses:
        raise HTTPException(status_code=400, detail="Valid non-negative monthly expenses required.")

    if NUMPY_AVAILABLE:
        arr = np.array(valid_expenses, dtype=np.float64)
        burn_rate = float(np.mean(arr))
        median_burn = float(np.median(arr))
        std_dev = float(np.std(arr)) if len(arr) > 1 else 0.0

        trend_slope = 0.0
        trend = "stable"
        if len(arr) >= 3:
            x_axis = np.arange(len(arr))
            try:
                slope = float(np.polyfit(x_axis, arr, 1)[0])
                trend_slope = round(slope, 2)
                if slope > 0.05 * burn_rate:
                    trend = "increasing_burn"
                elif slope < -0.05 * burn_rate:
                    trend = "decreasing_burn"
            except Exception:
                trend_slope = 0.0
        elif len(arr) == 2:
            if arr[-1] > arr[-2] * 1.15:
                trend = "increasing_burn"
            elif arr[-1] < arr[-2] * 0.85:
                trend = "decreasing_burn"

        # Vectorized Monte Carlo Simulation (500 Stochastic Paths)
        monte_carlo_res = None
        if burn_rate > 0 and len(arr) >= 2 and std_dev > 0:
            np.random.seed(42)
            n_sims = 500
            max_horizon = 120
            # Generate simulated monthly burn samples from normal distribution truncated at 0
            simulated_burns = np.random.normal(loc=burn_rate, scale=max(std_dev, 1.0), size=(n_sims, max_horizon))
            simulated_burns = np.clip(simulated_burns, a_min=1.0, a_max=None)
            cumulative_burn = np.cumsum(simulated_burns, axis=1)

            # Find first month where cumulative burn exceeds liquid_cash
            exceeds = cumulative_burn >= liquid_cash
            exhaustion_months = np.where(exceeds.any(axis=1), np.argmax(exceeds, axis=1) + 1, max_horizon)

            p10 = float(np.percentile(exhaustion_months, 10))
            p50 = float(np.percentile(exhaustion_months, 50))
            p90 = float(np.percentile(exhaustion_months, 90))
            prob_depleted_6m = float(np.mean(exhaustion_months <= 6))
            prob_depleted_12m = float(np.mean(exhaustion_months <= 12))

            monte_carlo_res = MonteCarloMetrics(
                p10_conservative_months=round(p10, 1),
                p50_median_months=round(p50, 1),
                p90_optimistic_months=round(p90, 1),
                probability_depleted_6m=round(prob_depleted_6m, 3),
                probability_depleted_12m=round(prob_depleted_12m, 3),
            )
    else:
        burn_rate = sum(valid_expenses) / len(valid_expenses)
        median_burn = burn_rate
        std_dev = 0.0
        trend_slope = 0.0
        trend = "stable"
        if len(valid_expenses) >= 2:
            recent = valid_expenses[-1]
            previous = valid_expenses[-2]
            if recent > previous * 1.15:
                trend = "increasing_burn"
            elif recent < previous * 0.85:
                trend = "decreasing_burn"
        monte_carlo_res = None

    if burn_rate <= 0:
        return RunwayResponse(
            average_monthly_burn=0.0,
            median_monthly_burn=0.0,
            burn_volatility_std=0.0,
            runway_months=999.0,
            status="infinite",
            burn_trend="stable",
            trend_slope=0.0,
            monte_carlo=None,
        )

    runway = round(liquid_cash / burn_rate, 1)
    if runway < 3.0:
        status = "critical"
    elif runway < 6.0:
        status = "caution"
    else:
        status = "healthy"

    return RunwayResponse(
        average_monthly_burn=round(burn_rate, 2),
        median_monthly_burn=round(median_burn, 2) if median_burn else None,
        burn_volatility_std=round(std_dev, 2) if std_dev else None,
        runway_months=runway,
        status=status,
        burn_trend=trend,
        trend_slope=trend_slope,
        monte_carlo=monte_carlo_res,
    )

def categorize_transaction_logic(title: str) -> CategorizationResponse:
    t = title.lower().strip()
    rules = [
        (["swiggy", "zomato", "restaurant", "cafe", "mcdonald", "starbucks", "burger", "pizza", "dining", "lunch", "dinner", "breakfast", "food"], "Food & Dining", 0.95),
        (["blinkit", "zepto", "instamart", "bigbasket", "dmart", "groceries", "supermarket", "vegetables", "milk"], "Groceries", 0.92),
        (["uber", "ola", "rapido", "metro", "fuel", "petrol", "diesel", "auto", "taxi", "toll", "fastag"], "Transportation", 0.90),
        (["amazon", "flipkart", "myntra", "ajio", "zara", "h&m", "shopping", "electronics"], "Shopping", 0.88),
        (["electricity", "water", "gas", "bescom", "airtel", "jio", "wifi", "broadband", "recharge", "utility", "bill"], "Bills & Utilities", 0.95),
        (["netflix", "spotify", "prime", "hotstar", "cinema", "movie", "bookmyshow", "steam", "playstation"], "Entertainment", 0.94),
        (["pharmacy", "apollo", "medplus", "doctor", "hospital", "clinic", "medicine", "dentist", "lab"], "Health & Medical", 0.93),
        (["rent", "maintenance", "society", "house"], "Housing & Rent", 0.96),
        (["salary", "payroll", "dividend", "freelance", "bonus", "interest", "refund"], "Income", 0.90),
    ]

    for keywords, category, conf in rules:
        if any(k in t for k in keywords):
            return CategorizationResponse(category=category, confidence=conf, method="keyword_heuristic")

    return CategorizationResponse(category="Other", confidence=0.40, method="default_fallback")

def get_field_val(item: Any, name: str, default: Any = "") -> Any:
    if isinstance(item, dict):
        return item.get(name, default)
    return getattr(item, name, default)

def detect_anomalies_logic(transactions: List[Any]):
    if not transactions or len(transactions) < 4:
        return {
            "total_analyzed": len(transactions),
            "anomalies_found": 0,
            "threshold_z_score": 2.5,
            "items": [],
        }

    valid_items = []
    amounts_list = []
    for tx in transactions:
        try:
            amt = float(get_field_val(tx, "amount", 0))
            if amt > 0 and not math.isnan(amt) and not math.isinf(amt):
                amounts_list.append(amt)
                valid_items.append(tx)
        except (ValueError, TypeError):
            continue

    if len(amounts_list) < 4:
        return {"total_analyzed": len(transactions), "anomalies_found": 0, "threshold_z_score": 2.5, "items": []}

    threshold = 2.5
    results = []
    anomalies_count = 0

    if NUMPY_AVAILABLE:
        amounts = np.array(amounts_list, dtype=np.float64)
        mean = float(np.mean(amounts))
        std_dev = float(np.std(amounts))
        median = float(np.median(amounts))

        # Vectorized Standard Z-Score
        z_scores = (amounts - mean) / std_dev if std_dev > 0 else np.zeros_like(amounts)

        # Robust Modified Z-Score using Median Absolute Deviation (MAD)
        # Boris Iglewicz & David Hoaglin (1993): M_i = 0.6745 * |x_i - median| / raw_mad
        raw_mad = float(np.median(np.abs(amounts - median)))
        if raw_mad > 0:
            modified_z = 0.6745 * np.abs(amounts - median) / raw_mad
        else:
            modified_z = np.zeros_like(amounts)

        for i, tx in enumerate(valid_items):
            amt = amounts_list[i]
            z_score = round(float(z_scores[i]), 2)
            mod_z = round(float(modified_z[i]), 2)
            is_anomaly = bool(z_score >= threshold or mod_z >= 3.5)
            if is_anomaly:
                anomalies_count += 1
            date_val = str(get_field_val(tx, "date", get_field_val(tx, "expense_date", "")))
            results.append({
                "id": str(get_field_val(tx, "id", "")),
                "title": str(get_field_val(tx, "title", "")),
                "amount": amt,
                "date": date_val,
                "z_score": z_score,
                "modified_z_score": mod_z,
                "is_anomaly": is_anomaly,
            })
    else:
        mean = sum(amounts_list) / len(amounts_list)
        variance = sum((x - mean) ** 2 for x in amounts_list) / len(amounts_list)
        std_dev = math.sqrt(variance)
        for tx in valid_items:
            amt = float(get_field_val(tx, "amount", 0))
            z_score = round((amt - mean) / std_dev, 2) if std_dev > 0 else 0.0
            is_anomaly = z_score >= threshold
            if is_anomaly:
                anomalies_count += 1
            date_val = str(get_field_val(tx, "date", get_field_val(tx, "expense_date", "")))
            results.append({
                "id": str(get_field_val(tx, "id", "")),
                "title": str(get_field_val(tx, "title", "")),
                "amount": amt,
                "date": date_val,
                "z_score": z_score,
                "is_anomaly": is_anomaly,
            })

    return {
        "total_analyzed": len(transactions),
        "anomalies_found": anomalies_count,
        "mean_amount": round(mean, 2),
        "std_deviation": round(std_dev, 2),
        "threshold_z_score": threshold,
        "items": [r for r in results if r["is_anomaly"]],
    }

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

def calculate_cgt_and_harvesting_logic(payload: TaxAnalysisRequest):
    """
    Delegates capital gains and tax-loss harvesting computation to the versioned
    AFCE TaxEngine (supporting FY 2023-24 through FY 2026-27+ and custom rule overrides).
    """
    from calculation_engine.modules.tax_engine import TaxEngine

    engine = TaxEngine()
    return engine.calculate({
        "assessment_year": payload.assessment_year,
        "tax_slab_rate": payload.tax_slab_rate,
        "custom_rules": payload.custom_rules,
        "filter_by_fy": payload.filter_by_fy,
        "realized_trades": [t.model_dump() for t in payload.realized_trades],
        "unrealized_holdings": [h.model_dump() for h in payload.unrealized_holdings],
    })

# ---------------------------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------------------------
@app.get("/api/py/health")
@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "arthax-python-analytics",
        "runtime": "vercel-serverless-python",
        "version": "2.0.0",
        "numpy_accelerated": NUMPY_AVAILABLE,
        "auth_enabled": IS_PROD,
    }

@app.post("/api/py/forecast/runway", response_model=RunwayResponse)
@app.post("/forecast/runway", response_model=RunwayResponse)
def calculate_runway(payload: RunwayRequest, auth=Depends(verify_auth_dependency)):
    return calculate_runway_logic(payload.liquid_cash, payload.monthly_expenses)

@app.post("/api/py/categorize", response_model=CategorizationResponse)
@app.post("/categorize", response_model=CategorizationResponse)
def categorize_transaction(payload: TransactionToCategorize, auth=Depends(verify_auth_dependency)):
    return categorize_transaction_logic(payload.title)

@app.post("/api/py/analytics/anomalies")
@app.post("/analytics/anomalies")
def detect_anomalies(payload: AnomalyDetectionRequest, auth=Depends(verify_auth_dependency)):
    return detect_anomalies_logic(payload.transactions)

@app.post("/api/py/analytics/tax")
@app.post("/analytics/tax")
def calculate_cgt_and_harvesting(payload: TaxAnalysisRequest, auth=Depends(verify_auth_dependency)):
    return calculate_cgt_and_harvesting_logic(payload)

# ---------------------------------------------------------------------------
# Mount ArthaX Financial Calculation Engine (AFCE)
# ---------------------------------------------------------------------------
import sys
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

try:
    from calculation_engine.api.calculation_routes import router as calculation_router
    app.include_router(calculation_router, prefix="/api", dependencies=[Depends(verify_auth_dependency)])
    app.include_router(calculation_router, prefix="/api/py", dependencies=[Depends(verify_auth_dependency)])
    app.include_router(calculation_router, prefix="", dependencies=[Depends(verify_auth_dependency)])
except Exception as err:
    print(f"Warning: Calculation engine router mounting error: {err}")

