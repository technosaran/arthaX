"""
ArthaX Python Service Runner
Consolidated runner re-exporting the canonical FastAPI application from api.index
Ensures single source of truth across Vercel serverless and local/container environments.
"""

import uvicorn
from api.index import app

if __name__ == "__main__":
    uvicorn.run("api.index:app", host="0.0.0.0", port=8000, reload=True)
