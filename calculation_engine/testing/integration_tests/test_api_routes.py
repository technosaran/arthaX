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


def test_networth_api_with_internal_service_key(client, monkeypatch):
    test_key = "test-service-key-999"
    monkeypatch.setenv("INTERNAL_SERVICE_KEY", test_key)
    payload = {
        "user_id": "test_user_1",
        "accounts": [
            {"id": "acc-1", "name": "Savings", "balance": 100000.0, "classification": "asset"},
            {"id": "acc-2", "name": "Loan", "balance": 15000.0, "classification": "liability"},
        ],
    }
    res = client.post(
        "/api/calculations/networth",
        json=payload,
        headers={"X-Internal-Service-Key": test_key},
    )
    assert res.status_code == 200
    json_data = res.json()
    assert json_data["data"]["net_worth"] == "85000.00"


def test_tax_api(client):
    payload = {
        "user_id": "test_user_1",
        "assessment_year": "2025-2026",
        "tax_slab_rate": 0.30,
        "transactions": [
            {"symbol": "TCS", "type": "BUY", "quantity": 10, "price": 3000.0, "date": "2023-01-01", "asset_class": "equity"},
            {"symbol": "TCS", "type": "SELL", "quantity": 10, "price": 4000.0, "date": "2024-05-01", "asset_class": "equity"},
        ],
    }
    res = client.post("/api/calculations/tax", json=payload)
    assert res.status_code == 200
    json_data = res.json()
    assert "data" in json_data
    assert json_data["data"]["realized"]["equityLtcgGain"] == 10000.00
    assert json_data["metadata"]["calculation_type"] == "TAX"


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


def test_statement_parse_api(client):
    import base64
    sbi_csv = b"""Account Name : Tech Pro
Account Number : 00000012345678901
IFS Code : SBIN0001234
Txn Date,Value Date,Description,Ref No./Cheque No.,Branch Code,Debit,Credit,Balance
01/11/2026,01/11/2026,TRANSFER TO UPI/SWIGGY/swiggy@icici,UPI/112233,0,500.00,,49500.00
05/11/2026,05/11/2026,SALARY CREDIT NOV 2026 CMS/998877,CMS/998877,0,,100000.00,149500.00
"""
    b64_payload = base64.b64encode(sbi_csv).decode("utf-8")
    payload = {
        "user_id": "test_user_1",
        "filename": "sbi_statement.csv",
        "content_base64": b64_payload,
    }
    res = client.post("/api/statements/parse", json=payload)
    assert res.status_code == 200
    json_data = res.json()
    assert json_data["success"] is True
    result = json_data["result"]
    assert result["bank_name"] == "SBI"
    assert len(result["transactions"]) == 2
    # Verify enrichment
    tx_swiggy = result["transactions"][0]
    assert tx_swiggy["merchant_name"] == "Swiggy"
    assert tx_swiggy["category"] == "Food & Dining"
    tx_sal = result["transactions"][1]
    assert tx_sal["category"] == "Salary"
    assert tx_sal["transaction_type"] == "SALARY"


def test_transactions_classify_batch_api(client):
    payload = {
        "user_id": "test_user_1",
        "transactions": [
            {
                "id": "tx-1",
                "account_id": "acc-sbi",
                "amount": 25000.0,
                "direction": "DEBIT",
                "date": "2026-11-01",
                "original_narration": "TRANSFER TO HDFC INTER ACCOUNT",
            },
            {
                "id": "tx-2",
                "account_id": "acc-hdfc",
                "amount": 25000.0,
                "direction": "CREDIT",
                "date": "2026-11-01",
                "original_narration": "TRANSFER FROM SBI SAVINGS",
            },
            {
                "id": "tx-3",
                "account_id": "acc-sbi",
                "amount": 499.0,
                "direction": "DEBIT",
                "date": "2026-11-03",
                "original_narration": "UPI/P2M/12345/ZOMATO/zomato@axis/ORDER",
            },
        ],
    }
    res = client.post("/api/transactions/classify", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["transfers_detected"] == 1
    classified = data["classified_transactions"]
    assert len(classified) == 3
    # Zomato check
    assert classified[2]["merchant_name"] == "Zomato"
    assert classified[2]["category"] == "Food & Dining"
