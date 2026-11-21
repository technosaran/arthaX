"""
ArthaX Python Service Runner
Consolidated runner re-exporting the canonical FastAPI application from api.index
Ensures single source of truth across Vercel serverless and local/container environments.
"""

import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

import uvicorn
from api.index import app

if __name__ == "__main__":
    uvicorn.run("api.index:app", host="0.0.0.0", port=8000, reload=True, app_dir=BASE_DIR)
