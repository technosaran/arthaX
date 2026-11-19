"""
ArthaX Python Financial Analytics & Machine Learning Service (FastAPI)
Deployed as a Vercel Serverless Function under /api/py/
Hardened for Production Security (CORS, JWT Authentication, Rate/Size Restrictions)
Enhanced with NumPy & SciPy for Vectorized Financial Intelligence, Monte Carlo Simulations & Union Budget 2024 CGT Engine
"""

import os
import time
import hmac
import hashlib
import json
import base64
import math
from datetime import datetime, date
from typing import List, Optional, Any, Union
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# High-Performance Mathematical & Statistical Libraries
try:
    import numpy as np
    from scipy import stats
    NUMPY_AVAILABLE = True
except ImportError:
    NUMPY_AVAILABLE = False

IS_PROD = os.getenv("NODE_ENV") == "production" or os.getenv("VERCEL_ENV") == "production"

app = FastAPI(
    title="ArthaX Financial Analytics Engine",
    version="2.0.0",
    description="Python microservice for forecasting, Monte Carlo runway simulation, anomaly detection, and Union Budget 2024 Indian Capital Gains Tax harvesting.",
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
    if not IS_PROD and (os.getenv("DISABLE_AUTH") == "1" or (not authorization and not x_internal_service_key)):
        return {"user_id": "dev_user", "auth_method": "development_bypass"}

    internal_key = (
        os.getenv("INTERNAL_SERVICE_KEY")
        or os.getenv("CRON_SECRET")
        or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    )
    if internal_key and x_internal_service_key:
        if hmac.compare_digest(x_internal_service_key.strip(), internal_key.strip()):
            return {"user_id": "internal_service", "auth_method": "service_key"}

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
    monthly_expenses: List[float] = Field(..., min_items=1, max_items=120, description="List of monthly total expenses")

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
        ..., min_items=1, max_items=1000, description="Transactions to analyze for spending anomalies"
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
    assessment_year: str = "2025-2026"
    tax_slab_rate: float = Field(0.30, ge=0.0, le=0.45)
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
                slope, _, r_val, p_val, _ = stats.linregress(x_axis, arr)
                trend_slope = round(float(slope), 2)
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
        try:
            mad = float(stats.median_abs_deviation(amounts, scale="normal"))
        except Exception:
            mad = float(np.median(np.abs(amounts - median))) * 1.4826

        modified_z = (0.6745 * np.abs(amounts - median) / mad) if mad > 0 else np.zeros_like(amounts)

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

# ---------------------------------------------------------------------------
# Indian Capital Gains Tax (CGT) & Tax-Loss Harvesting Engine (Union Budget 2024)
# ---------------------------------------------------------------------------
def parse_date_safe(d_str: str) -> Optional[datetime]:
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%SZ", "%d-%m-%Y"):
        try:
            return datetime.strptime(d_str[:10], fmt[: len(d_str[:10])])
        except Exception:
            continue
    return None

def calculate_cgt_and_harvesting_logic(payload: TaxAnalysisRequest):
    """
    Union Budget 2024 Tax Provisions:
    - Equity / Equity Mutual Funds:
      * LTCG (> 365 days): 12.5% on gains exceeding ₹1.25 Lakh annual exemption limit (Sec 112A).
      * STCG (<= 365 days): 20% flat tax (Sec 111A).
    - Specified Debt Funds (post-April 1, 2023) / Unlisted Bonds:
      * Taxed at investor's slab rate (default 30%).
    - Physical Bullion (Gold & Silver):
      * LTCG (> 730 days / 24 months): 12.5% without indexation (Budget 2024 reform).
      * STCG (<= 24 months): Taxed at slab rate.
    - Futures & Options (F&O):
      * Non-speculative business income -> Taxed at slab rate.
    """
    slab_rate = payload.tax_slab_rate
    now = datetime.now()

    equity_ltcg_gain = 0.0
    equity_stcg_gain = 0.0
    debt_gain = 0.0
    bullion_ltcg_gain = 0.0
    bullion_stcg_gain = 0.0
    fno_income = 0.0

    # 1. Process Realized Trades
    for trade in payload.realized_trades:
        net_gain = trade.sell_amount - trade.buy_amount
        b_dt = parse_date_safe(trade.buy_date)
        s_dt = parse_date_safe(trade.sell_date)
        holding_days = (s_dt - b_dt).days if (s_dt and b_dt) else 0

        asset = trade.asset_class.lower()
        if asset in ("equity", "stock", "mutual_fund", "equity_mf"):
            if holding_days >= 365:
                equity_ltcg_gain += net_gain
            else:
                equity_stcg_gain += net_gain
        elif asset in ("debt_fund", "debt", "bond"):
            debt_gain += net_gain
        elif asset in ("bullion", "gold", "silver"):
            if holding_days >= 730:
                bullion_ltcg_gain += net_gain
            else:
                bullion_stcg_gain += net_gain
        elif asset in ("fno", "derivative", "option", "future"):
            fno_income += net_gain

    # LTCG Exemption under Section 112A: ₹1.25 Lakh
    ltcg_exemption = 125000.0
    taxable_equity_ltcg = max(0.0, equity_ltcg_gain - ltcg_exemption)
    equity_ltcg_tax = taxable_equity_ltcg * 0.125
    equity_stcg_tax = max(0.0, equity_stcg_gain) * 0.20
    debt_tax = max(0.0, debt_gain) * slab_rate
    bullion_ltcg_tax = max(0.0, bullion_ltcg_gain) * 0.125
    bullion_stcg_tax = max(0.0, bullion_stcg_gain) * slab_rate
    fno_tax = max(0.0, fno_income) * slab_rate

    total_realized_gains = round(
        equity_ltcg_gain + equity_stcg_gain + debt_gain + bullion_ltcg_gain + bullion_stcg_gain + fno_income, 2
    )
    total_estimated_tax = round(
        equity_ltcg_tax + equity_stcg_tax + debt_tax + bullion_ltcg_tax + bullion_stcg_tax + fno_tax, 2
    )

    # 2. Analyze Unrealized Holdings for Tax-Loss Harvesting Opportunities
    harvesting_opportunities = []
    total_harvestable_loss = 0.0
    total_potential_tax_savings = 0.0

    for holding in payload.unrealized_holdings:
        if holding.current_value < holding.invested_amount:
            unrealized_loss = round(holding.invested_amount - holding.current_value, 2)
            b_dt = parse_date_safe(holding.buy_date)
            holding_days = (now - b_dt).days if b_dt else 0
            months = round(holding_days / 30.4, 1)

            asset = holding.asset_class.lower()
            is_equity = asset in ("equity", "stock", "mutual_fund", "equity_mf")
            is_long_term = (holding_days >= 365) if is_equity else (holding_days >= 730)

            gain_type = "LTCG" if is_long_term else "STCG"
            tax_rate = 0.125 if is_long_term else (0.20 if is_equity else slab_rate)
            potential_savings = round(unrealized_loss * tax_rate, 2)

            rec = (
                f"Harvest ₹{unrealized_loss:,.2f} loss to offset taxable {gain_type} gains and save ~₹{potential_savings:,.2f} in taxes."
            )

            harvesting_opportunities.append({
                "id": holding.id or holding.symbol,
                "symbol": holding.symbol,
                "assetClass": holding.asset_class,
                "buyDate": holding.buy_date,
                "investedAmount": holding.invested_amount,
                "currentValue": holding.current_value,
                "unrealizedLoss": unrealized_loss,
                "holdingPeriodMonths": months,
                "gainType": gain_type,
                "potentialTaxSavings": potential_savings,
                "effectiveTaxRate": round(tax_rate * 100, 1),
                "recommendation": rec,
            })
            total_harvestable_loss += unrealized_loss
            total_potential_tax_savings += potential_savings

    # Sort opportunities by potential tax savings descending
    harvesting_opportunities.sort(key=lambda x: x["potentialTaxSavings"], reverse=True)

    advice = []
    if taxable_equity_ltcg > 0:
        advice.append(
            f"Your equity LTCG of ₹{equity_ltcg_gain:,.2f} exceeds the Section 112A ₹1.25L exemption threshold by ₹{taxable_equity_ltcg:,.2f}. Consider harvesting long-term losses before March 31st."
        )
    elif equity_ltcg_gain > 0:
        remaining_exemption = ltcg_exemption - equity_ltcg_gain
        advice.append(
            f"You have ₹{remaining_exemption:,.2f} remaining in tax-free LTCG exemption under Section 112A for AY {payload.assessment_year}."
        )

    if equity_stcg_gain > 0 and total_harvestable_loss > 0:
        advice.append(
            f"You have ₹{equity_stcg_gain:,.2f} in taxable STCG (taxed at 20%). You can harvest available short-term losses to directly neutralize this tax liability."
        )

    return {
        "assessmentYear": payload.assessment_year,
        "taxSlabRate": slab_rate,
        "realized": {
            "equityLtcgGain": round(equity_ltcg_gain, 2),
            "equityLtcgTaxable": round(taxable_equity_ltcg, 2),
            "equityLtcgTax": round(equity_ltcg_tax, 2),
            "equityStcgGain": round(equity_stcg_gain, 2),
            "equityStcgTax": round(equity_stcg_tax, 2),
            "debtGain": round(debt_gain, 2),
            "debtTax": round(debt_tax, 2),
            "bullionLtcgGain": round(bullion_ltcg_gain, 2),
            "bullionLtcgTax": round(bullion_ltcg_tax, 2),
            "bullionStcgGain": round(bullion_stcg_gain, 2),
            "bullionStcgTax": round(bullion_stcg_tax, 2),
            "fnoIncome": round(fno_income, 2),
            "fnoTax": round(fno_tax, 2),
            "totalRealizedGains": total_realized_gains,
            "totalEstimatedTax": total_estimated_tax,
        },
        "harvestingOpportunities": harvesting_opportunities,
        "totalHarvestableLoss": round(total_harvestable_loss, 2),
        "totalPotentialTaxSavings": round(total_potential_tax_savings, 2),
        "advice": advice,
    }

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
