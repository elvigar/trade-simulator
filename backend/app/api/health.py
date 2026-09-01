"""GET /api/health — process liveness + DB readiness (not LLM availability,
per DECISIONS.md -> "Chat response contract")."""

from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app import db

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health")
def get_health() -> JSONResponse:
    try:
        with db.get_connection() as conn:
            db.get_cash_balance(conn)
        return JSONResponse(status_code=200, content={"status": "ok", "db_ready": True})
    except Exception:
        return JSONResponse(
            status_code=503, content={"status": "degraded", "db_ready": False}
        )
