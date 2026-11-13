# ArthaX Python Financial Analytics Engine

A lightweight, high-performance FastAPI service designed for advanced financial calculations, forecasting runway models, and spending anomaly detection.

## Quickstart (Local Development)

1. Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   # Windows:
   .\venv\Scripts\activate
   # Linux/macOS:
   source venv/bin/activate
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Run the server:
   ```bash
   uvicorn main:app --reload --port 8000
   ```

4. Interactive API Documentation:
   - OpenAPI Swagger: `http://localhost:8000/docs`
   - Redoc: `http://localhost:8000/redoc`

## API Endpoints

- `GET /health` – Health check for observability
- `POST /forecast/runway` – Calculates liquid burn rate and runway in months
- `POST /categorize` – Suggests categories based on title/merchant
- `POST /anomalies/detect` – Identifies spending outliers via statistical z-score analysis
