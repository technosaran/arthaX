"""
ArthaX Python Financial Analytics & Machine Learning Service (FastAPI)
Deployed as a Vercel Serverless Function under /api/py/
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
import math

app = FastAPI(
    title="ArthaX Financial Analytics Engine",
    version="1.0.0",
    description="Python microservice for forecasting, runway simulation, and spending anomaly detection.",
    docs_url="/api/py/docs",
    openapi_url="/api/py/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Data Models
# ---------------------------------------------------------------------------
class RunwayRequest(BaseModel):
    liquid_cash: float = Field(..., ge=0, description="Total liquid assets in bank accounts and cash")
    monthly_expenses: List[float] = Field(..., min_items=1, description="List of monthly total expenses")

class RunwayResponse(BaseModel):
    average_monthly_burn: float
    runway_months: float
    status: str
    burn_trend: str

class TransactionToCategorize(BaseModel):
    title: str
    amount: Optional[float] = None

class CategorizationResponse(BaseModel):
    category: str
    confidence: float
    method: str

class AnomalyDetectionRequest(BaseModel):
    transactions: List[dict]

# ---------------------------------------------------------------------------
# Core Logic Helper Functions
# ---------------------------------------------------------------------------
def calculate_runway_logic(liquid_cash: float, monthly_expenses: List[float]) -> RunwayResponse:
    if not monthly_expenses:
        raise HTTPException(status_code=400, detail="At least one monthly expense figure is required.")

    burn_rate = sum(monthly_expenses) / len(monthly_expenses)
    if burn_rate <= 0:
        return RunwayResponse(
            average_monthly_burn=0.0,
            runway_months=999.0,
            status="infinite",
            burn_trend="stable"
        )

    runway = round(liquid_cash / burn_rate, 1)

    trend = "stable"
    if len(monthly_expenses) >= 2:
        recent = monthly_expenses[-1]
        previous = monthly_expenses[-2]
        if recent > previous * 1.15:
            trend = "increasing_burn"
        elif recent < previous * 0.85:
            trend = "decreasing_burn"

    if runway < 3.0:
        status = "critical"
    elif runway < 6.0:
        status = "caution"
    else:
        status = "healthy"

    return RunwayResponse(
        average_monthly_burn=round(burn_rate, 2),
        runway_months=runway,
        status=status,
        burn_trend=trend
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

def detect_anomalies_logic(transactions: List[dict]):
    if not transactions or len(transactions) < 4:
        return {
            "total_analyzed": len(transactions),
            "anomalies_found": 0,
            "threshold_z_score": 2.5,
            "items": []
        }

    amounts = []
    for tx in transactions:
        try:
            amt = float(tx.get("amount", 0))
            if amt > 0:
                amounts.append(amt)
        except (ValueError, TypeError):
            continue

    if len(amounts) < 4:
        return {"total_analyzed": len(transactions), "anomalies_found": 0, "threshold_z_score": 2.5, "items": []}

    mean = sum(amounts) / len(amounts)
    variance = sum((x - mean) ** 2 for x in amounts) / len(amounts)
    std_dev = math.sqrt(variance)

    threshold = 2.5
    results = []
    anomalies_count = 0

    for tx in transactions:
        try:
            amt = float(tx.get("amount", 0))
            z_score = round((amt - mean) / std_dev, 2) if std_dev > 0 else 0.0
            is_anomaly = z_score >= threshold
            if is_anomaly:
                anomalies_count += 1
            results.append({
                "id": str(tx.get("id", "")),
                "title": str(tx.get("title", "")),
                "amount": amt,
                "date": str(tx.get("date", tx.get("expense_date", ""))),
                "z_score": z_score,
                "is_anomaly": is_anomaly
            })
        except Exception:
            continue

    return {
        "total_analyzed": len(transactions),
        "anomalies_found": anomalies_count,
        "mean_amount": round(mean, 2),
        "std_deviation": round(std_dev, 2),
        "threshold_z_score": threshold,
        "items": [r for r in results if r["is_anomaly"]]
    }

# ---------------------------------------------------------------------------
# API Endpoints (both /api/py/ and standard root routes supported)
# ---------------------------------------------------------------------------
@app.get("/api/py/health")
@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "arthax-python-analytics",
        "runtime": "vercel-serverless-python",
        "version": "1.0.0"
    }

@app.post("/api/py/forecast/runway", response_model=RunwayResponse)
@app.post("/forecast/runway", response_model=RunwayResponse)
def calculate_runway(payload: RunwayRequest):
    return calculate_runway_logic(payload.liquid_cash, payload.monthly_expenses)

@app.post("/api/py/categorize", response_model=CategorizationResponse)
@app.post("/categorize", response_model=CategorizationResponse)
def categorize_transaction(payload: TransactionToCategorize):
    return categorize_transaction_logic(payload.title)

@app.post("/api/py/analytics/anomalies")
@app.post("/analytics/anomalies")
def detect_anomalies(payload: AnomalyDetectionRequest):
    return detect_anomalies_logic(payload.transactions)
