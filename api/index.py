"""
FastAPI entry point — Vercel Python serverless.

Local dev:  uvicorn api.index:app --reload --port 8000  (run from project root)
Vercel:     api/index.py is auto-detected; vercel.json routes /api/* here.
"""

import logging
from pathlib import Path

from dotenv import load_dotenv
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

# Load backend secrets from api/.env (local dev only — no-op on Vercel)
# Must happen BEFORE importing routers so env vars are set when modules load.
_api_dir = Path(__file__).parent
load_dotenv(_api_dir / ".env")                   # api/.env  — backend secrets
load_dotenv(_api_dir.parent / ".env")            # root .env — shared Firebase/Claude/OpenAI vars

# ---------------------------------------------------------------------------
# Logging configuration — structured output for all "archepal.*" loggers
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("archepal.api")

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from api.middleware.logging_middleware import LoggingMiddleware
from api.routers import pdf, export, notify
from api.limiter import limiter
from api.services.crashvault import log_warning

app = FastAPI(title="ArchePal API", version="1.0.0")

# Rate limiter state + 429 handler
app.state.limiter = limiter


async def _on_rate_limit_exceeded(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    log_warning(
        f"Rate limit exceeded: {request.method} {request.url.path}",
        tags=["rate-limit"],
        context={"path": request.url.path, "client": request.client.host if request.client else "unknown", "limit": str(exc.detail)},
        source="api.index",
    )
    return JSONResponse(
        status_code=429,
        content={"detail": f"Rate limit exceeded. {exc.detail}"},
    )


app.add_exception_handler(RateLimitExceeded, _on_rate_limit_exceeded)

# Request/response logging + CrashVault error reporting
app.add_middleware(LoggingMiddleware)

# CORS — allow Vite dev server and production Vercel URL
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",   # Vite dev (this project)
        "http://localhost:5173",   # Vite dev (default)
        "http://localhost:4173",   # Vite preview
        "https://*.vercel.app",    # Vercel deployments
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(pdf.router, prefix="/api")
app.include_router(export.router, prefix="/api")
app.include_router(notify.router, prefix="/api")

logger.info("ArchePal API initialized — routers: pdf, export, notify")


@app.get("/api/health")
async def health():
    return {"status": "ok"}
