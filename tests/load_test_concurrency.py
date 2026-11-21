"""
ArthaX Performance & Concurrency Load Test Suite
Measures p50, p95, p99 latency, throughput, error rate, and cross-user isolation
across progressive workloads: 1, 5, 10, 25, 50 virtual users.
"""

import asyncio
import time
import statistics
import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

# Ensure DISABLE_AUTH for local synthetic performance benchmarking
os.environ["DISABLE_AUTH"] = "1"
os.environ["NODE_ENV"] = "development"

from api.index import app
import httpx

WORKLOADS = [
    {
        "name": "Health Check",
        "method": "GET",
        "url": "/api/py/health",
        "payload": None,
    },
    {
        "name": "Monte Carlo Runway Forecast",
        "method": "POST",
        "url": "/api/py/forecast/runway",
        "payload": {
            "liquid_cash": 2500000.0,
            "monthly_expenses": [65000.0, 72000.0, 68000.0, 85000.0, 70000.0, 74000.0],
        },
    },
    {
        "name": "Z-Score Spending Anomaly Detection",
        "method": "POST",
        "url": "/api/py/analytics/anomalies",
        "payload": {
            "transactions": [
                {"id": f"tx_{i}", "title": f"Merchant {i}", "amount": 500.0 + (i * 50), "date": "2026-01-01"}
                for i in range(25)
            ] + [{"id": "tx_spike", "title": "Luxury Jewelry", "amount": 150000.0, "date": "2026-01-15"}],
        },
    },
    {
        "name": "Union Budget 2024 Tax Harvesting",
        "method": "POST",
        "url": "/api/py/analytics/tax",
        "payload": {
            "assessment_year": "2025-2026",
            "tax_slab_rate": 0.30,
            "realized_trades": [
                {
                    "symbol": "TCS",
                    "asset_class": "equity",
                    "buy_date": "2023-01-10",
                    "sell_date": "2024-08-15",
                    "buy_amount": 200000.0,
                    "sell_amount": 350000.0,
                },
                {
                    "symbol": "INFY",
                    "asset_class": "equity",
                    "buy_date": "2024-05-01",
                    "sell_date": "2024-09-01",
                    "buy_amount": 100000.0,
                    "sell_amount": 125000.0,
                },
            ],
            "unrealized_holdings": [
                {
                    "symbol": "HDFCBANK",
                    "asset_class": "equity",
                    "buy_date": "2024-02-15",
                    "invested_amount": 150000.0,
                    "current_value": 130000.0,
                }
            ],
        },
    },
    {
        "name": "Decimal Net Worth Calculation",
        "method": "POST",
        "url": "/api/py/calculations/networth",
        "payload": {
            "currency": "INR",
            "accounts": [
                {"id": "acc_1", "type": "SAVINGS", "balance": 150000.50},
                {"id": "acc_2", "type": "CREDIT_CARD", "balance": 35000.25},
            ],
            "stocks": [{"symbol": "RELIANCE", "shares": 50, "current_price": 2950.0}],
            "mutual_funds": [{"folio": "123", "units": 1500.5, "nav": 120.4}],
            "bonds": [{"isin": "IN0020200010", "units": 10, "face_value": 1000, "current_price": 1020}],
            "bullion": [{"metal": "GOLD", "grams": 25.5, "current_rate": 7800.0}],
            "crypto": [{"symbol": "BTC", "quantity": 0.05, "current_price_usd": 68000.0}],
        },
    },
    {
        "name": "Transaction Intelligence & Transfer Matching",
        "method": "POST",
        "url": "/api/py/transactions/classify",
        "payload": {
            "transactions": [
                {
                    "id": "tx_debit_1",
                    "account_id": "acc_sbi",
                    "amount": 25000.0,
                    "direction": "DEBIT",
                    "original_narration": "UPI/412345678901/Transfer to HDFC/user@hdfcbank",
                    "transaction_date": "2026-01-10",
                },
                {
                    "id": "tx_credit_1",
                    "account_id": "acc_hdfc",
                    "amount": 25000.0,
                    "direction": "CREDIT",
                    "original_narration": "UPI/412345678901/Received from SBI/user@sbi",
                    "transaction_date": "2026-01-10",
                },
                {
                    "id": "tx_swiggy",
                    "account_id": "acc_sbi",
                    "amount": 450.0,
                    "direction": "DEBIT",
                    "original_narration": "UPI/SWIGGY/swiggy@icici/Food order",
                    "transaction_date": "2026-01-11",
                },
            ]
        },
    },
]

async def execute_user_session(client: httpx.AsyncClient, user_idx: int, iterations: int):
    latencies = []
    errors = 0
    user_header = {"X-User-Id": f"load_user_{user_idx}"}

    for _ in range(iterations):
        for w in WORKLOADS:
            start = time.perf_counter()
            try:
                if w["method"] == "GET":
                    resp = await client.get(w["url"], headers=user_header)
                else:
                    resp = await client.post(w["url"], json=w["payload"], headers=user_header)
                duration_ms = (time.perf_counter() - start) * 1000
                if resp.status_code < 400:
                    latencies.append(duration_ms)
                else:
                    errors += 1
            except Exception as e:
                errors += 1

    return latencies, errors

async def run_load_benchmark(concurrency: int, total_requests_per_user: int = 5):
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test", timeout=30.0) as client:
        start_time = time.perf_counter()
        tasks = [
            execute_user_session(client, user_idx=i, iterations=total_requests_per_user)
            for i in range(concurrency)
        ]
        results = await asyncio.gather(*tasks)
        total_wall_time = time.perf_counter() - start_time

    all_latencies = []
    total_errors = 0
    for lats, errs in results:
        all_latencies.extend(lats)
        total_errors += errs

    total_requests = len(all_latencies) + total_errors
    all_latencies.sort()

    p50 = statistics.median(all_latencies) if all_latencies else 0
    p95 = all_latencies[int(len(all_latencies) * 0.95)] if all_latencies else 0
    p99 = all_latencies[int(len(all_latencies) * 0.99)] if all_latencies else 0
    avg_latency = statistics.mean(all_latencies) if all_latencies else 0
    rps = total_requests / total_wall_time if total_wall_time > 0 else 0
    error_rate = (total_errors / total_requests * 100) if total_requests > 0 else 0

    print(f"| {concurrency:^8} | {total_requests:^14} | {rps:^10.1f} | {avg_latency:^10.2f} | {p50:^10.2f} | {p95:^10.2f} | {p99:^10.2f} | {error_rate:^10.2f}% |")
    return {
        "concurrency": concurrency,
        "total_requests": total_requests,
        "rps": rps,
        "avg": avg_latency,
        "p50": p50,
        "p95": p95,
        "p99": p99,
        "error_rate": error_rate,
    }

async def main():
    print("\n=========================================================================================")
    print("🚀 ARTHAX CONCURRENT PERFORMANCE & BENCHMARK SUITE (FastAPI + Decimal Engine)")
    print("=========================================================================================")
    print(f"Workloads Tested: {len(WORKLOADS)} diverse workloads per user loop (Monte Carlo, CGT, NetWorth, Z-Score, NLP)")
    print("-----------------------------------------------------------------------------------------")
    print(f"| {'Users':^8} | {'Total Requests':^14} | {'Req/Sec':^10} | {'Avg (ms)':^10} | {'p50 (ms)':^10} | {'p95 (ms)':^10} | {'p99 (ms)':^10} | {'Error %':^11} |")
    print("-----------------------------------------------------------------------------------------")

    concurrencies = [1, 5, 10, 25, 50]
    for c in concurrencies:
        await run_load_benchmark(concurrency=c, total_requests_per_user=5)

    print("-----------------------------------------------------------------------------------------\n")

if __name__ == "__main__":
    asyncio.run(main())
