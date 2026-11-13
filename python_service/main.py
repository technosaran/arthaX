"""
ArthaX Python Financial Analytics & Machine Learning Service (FastAPI)
Provides financial runway modeling, machine-learning categorization, and anomaly detection.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
import math

app = FastAPI(
    title="ArthaX Financial Analytics Engine",
    version="1.0.0",
    description="Python microservice for forecasting, runway simulation, and spending anomaly detection."
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
class HistoricalExpense(BaseModel):
    amount: float
    category: str
    expense_date: str

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

class AnomalyItem(BaseModel):
    id: str
    title: str
    amount: float
    date: str
    z_score: float
    is_anomaly: bool

class AnomalyDetectionRequest(BaseModel):
    transactions: List[dict]

# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "arthax-python-analytics",
        "version": "1.0.0"
    }

@app.post("/forecast/runway", response_model=RunwayResponse)
def calculate_runway(payload: RunwayRequest):
    """
    Calculates the financial runway (how many months liquid savings will last)
    based on average monthly burn rate and spending velocity.
    """
    if not payload.monthly_expenses:
        raise HTTPException(status_code=400, detail="At least one monthly expense figure is required.")

    burn_rate = sum(payload.monthly_expenses) / len(payload.monthly_expenses)
    if burn_rate <= 0:
        return RunwayResponse(
            average_monthly_burn=0.0,
            runway_months=999.0,
            status="infinite",
            burn_trend="stable"
        )

    runway = round(payload.liquid_cash / burn_rate, 1)

    # Trend calculation
    trend = "stable"
    if len(payload.monthly_expenses) >= 2:
        recent = payload.monthly_expenses[-1]
        previous = payload.monthly_expenses[-2]
        if recent > previous * 1.15:
            trend = "accelerating_burn"
        elif recent < previous * 0.85:
            trend = "decelerating_burn"

    status = "healthy" if runway >= 6 else ("warning" if runway >= 3 else "critical")

    return RunwayResponse(
        average_monthly_burn=round(burn_rate, 2),
        runway_months=runway,
        status=status,
        burn_trend=trend
    )

@app.post("/categorize", response_model=CategorizationResponse)
def categorize_transaction(payload: TransactionToCategorize):
    """
    NLP and rule-based heuristic categorization fallback for unassigned transactions.
    """
    text = payload.title.lower()

    rules = {
        "Food & Dining": ["swiggy", "zomato", "restaurant", "cafe", "coffee", "pizza", "burger", "dinner", "lunch", "starbucks"],
        "Groceries & Essentials": ["blinkit", "zepto", "instamart", "bigbasket", "supermarket", "grocery", "vegetables", "milk"],
        "Transport & Fuel": ["fuel", "petrol", "diesel", "uber", "ola", "rapido", "metro", "auto", "parking", "toll"],
        "Utilities & Bills": ["electricity", "wifi", "broadband", "airtel", "jio", "water bill", "gas bill", "cylinder"],
        "Housing & Rent": ["rent", "maintenance", "society", "flat rent"],
        "Subscriptions & SaaS": ["netflix", "prime", "spotify", "chatgpt", "openai", "github", "cursor", "icloud"],
        "Health & Medical": ["hospital", "clinic", "doctor", "pharmacy", "medicine", "apollo", "1mg"],
        "Investments & Wealth": ["zerodha", "groww", "sip", "mutual fund", "stocks", "gold"],
    }

    best_category = "Other & Contingency"
    best_score = 0

    for cat, keywords in rules.items():
        score = sum(1 for kw in keywords if kw in text)
        if score > best_score:
            best_score = score
            best_category = cat

    confidence = 0.9 if best_score >= 2 else (0.75 if best_score == 1 else 0.3)

    return CategorizationResponse(
        category=best_category,
        confidence=confidence,
        method="heuristic_pattern_matcher"
    )

@app.post("/anomalies/detect")
def detect_anomalies(payload: AnomalyDetectionRequest):
    """
    Identifies statistical spending anomalies using standard deviation / z-score calculation.
    """
    txs = payload.transactions
    if len(txs) < 3:
        return {"anomalies": []}

    amounts = [float(t.get("amount", 0)) for t in txs if float(t.get("amount", 0)) > 0]
    if not amounts:
        return {"anomalies": []}

    mean = sum(amounts) / len(amounts)
    variance = sum((x - mean) ** 2 for x in amounts) / len(amounts)
    std_dev = math.sqrt(variance) if variance > 0 else 1.0

    results = []
    for t in txs:
        amt = float(t.get("amount", 0))
        z = round((amt - mean) / std_dev, 2)
        if z >= 2.5: # 2.5 standard deviations above normal
            results.append({
                "id": t.get("id"),
                "title": t.get("title"),
                "amount": amt,
                "z_score": z,
                "is_anomaly": True,
                "reason": f"Amount is {z} standard deviations above your historical average (₹{round(mean, 2)})."
            })

    return {"count": len(results), "anomalies": results}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
