"""
Integration Tests: FastAPI Calculation Endpoints
Verifies end-to-end HTTP request processing, response validation, audit history, and health.
"""

import pytest
from fastapi.testclient import TestClient
from api.index import app


@pytest.fixture
def client():
    return TestClient(app)


def test_health_endpoint(client):
    res = client.get("/api/calculations/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert "ExpenseEngine" in data["active_modules"]


def test_expenses_api(client):
    payload = {
        "user_id": "test_user_1",
        "transactions": [
            {"id": "t-1", "title": "Coffee", "amount": 250.0, "category": "Food"},
            {"id": "t-2", "title": "Fuel", "amount": 1500.0, "category": "Transport"},
        ],
    }
    res = client.post("/api/calculations/expenses", json=payload)
    assert res.status_code == 200
    json_data = res.json()
    assert "data" in json_data
    assert "metadata" in json_data
    assert json_data["data"]["total_net_expense"] == "1750.00"
    assert json_data["metadata"]["calculation_type"] == "EXPENSE"
    assert json_data["metadata"]["status"] == "SUCCESS"


def test_networth_api(client):
    payload = {
        "user_id": "test_user_1",
        "accounts": [
            {"id": "acc-1", "name": "Savings", "balance": 100000.0, "classification": "asset"},
            {"id": "acc-2", "name": "Loan", "balance": 15000.0, "classification": "liability"},
        ],
    }
    res = client.post("/api/calculations/networth", json=payload)
    assert res.status_code == 200
    json_data = res.json()
    assert json_data["data"]["net_worth"] == "85000.00"


def test_validation_dashboard_and_history_api(client):
    # Validation metrics
    val_res = client.get("/api/calculations/validation")
    assert val_res.status_code == 200
    val_data = val_res.json()
    assert "total_calculations_executed" in val_data
    assert val_data["total_calculations_executed"] > 0
    assert val_data["validation_pass_rate_percent"] == 100.0

    # History audit trail
    hist_res = client.get("/api/calculations/history?limit=10")
    assert hist_res.status_code == 200
    hist_data = hist_res.json()
    assert "history" in hist_data
    assert len(hist_data["history"]) > 0
    first_event = hist_data["history"][0]
    assert "calculation_id" in first_event
    assert "calculation_type" in first_event
