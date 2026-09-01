"""FastAPI application entrypoint for FinAlly."""

from __future__ import annotations

import asyncio
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app import db, state
from app.api import health, portfolio, watchlist
from app.errors import DomainError
from app.market import create_market_data_source, create_stream_router
from app.portfolio.service import compute_total_value

logger = logging.getLogger(__name__)

# --- DB path resolution ---------------------------------------------------
# database-engineer's default DB path ("db/finally.db") resolves relative to
# the process's cwd, which is fragile: uvicorn may be launched from the repo
# root, from backend/, or from anywhere in Docker. Compute an absolute
# default from *this file's* location instead — backend/app/main.py's
# grandparent directory is the repo root (matches PLAN.md section 4, where
# `db/` and `backend/` are siblings) — so `db/finally.db` resolves
# correctly regardless of launch cwd. FINALLY_DB_PATH, if already set (e.g.
# by Docker or a test), always wins; this only fills in a default.
#
# NOTE for devops-engineer: this assumes the Docker image preserves
# `backend/` as a subdirectory of the app root (e.g. WORKDIR /app;
# COPY backend/ /app/backend/; run uvicorn from /app/backend or as
# `app.main:app` with cwd=/app/backend) so that `db/` remains backend's
# sibling. If the image instead flattens backend/'s contents to the
# workdir, set FINALLY_DB_PATH explicitly in the container env — this
# default-fill is skipped whenever the variable is already set.
if "FINALLY_DB_PATH" not in os.environ:
    _repo_root = Path(__file__).resolve().parents[2]
    os.environ["FINALLY_DB_PATH"] = str(_repo_root / "db" / "finally.db")

SNAPSHOT_INTERVAL_SECONDS = 30

# Frontend static export is served from here if present (conditional mount
# so the backend still runs standalone before the frontend is built).
# NOTE for frontend-engineer/devops-engineer: target `backend/static/` as
# the build output copy destination.
STATIC_DIR = Path(__file__).resolve().parent.parent / "static"

_snapshot_task: asyncio.Task | None = None


async def _snapshot_loop() -> None:
    """Insert a portfolio_snapshots row every 30s while the app runs (no
    catch-up writes), per DECISIONS.md -> "Portfolio snapshots"."""
    while True:
        await asyncio.sleep(SNAPSHOT_INTERVAL_SECONDS)
        try:
            with db.get_connection() as conn:
                total_value = compute_total_value(conn)
                db.insert_snapshot(conn, total_value)
                conn.commit()
        except Exception:
            logger.exception("background portfolio snapshot failed")


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _snapshot_task

    db.init_db()

    state.market_source = create_market_data_source(state.price_cache)
    with db.get_connection() as conn:
        watchlist_tickers = {row["ticker"] for row in db.list_watchlist(conn)}
        position_tickers = {row["ticker"] for row in db.list_positions(conn)}
    initial_tickers = sorted(watchlist_tickers | position_tickers)
    await state.market_source.start(initial_tickers)

    _snapshot_task = asyncio.create_task(_snapshot_loop())

    try:
        yield
    finally:
        if _snapshot_task is not None:
            _snapshot_task.cancel()
            try:
                await _snapshot_task
            except asyncio.CancelledError:
                pass
            _snapshot_task = None
        if state.market_source is not None:
            await state.market_source.stop()


app = FastAPI(title="FinAlly", lifespan=lifespan)


@app.exception_handler(DomainError)
async def domain_error_handler(request: Request, exc: DomainError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error_code": exc.error_code, "message": exc.message},
    )


@app.exception_handler(RequestValidationError)
async def validation_error_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    return JSONResponse(
        status_code=400,
        content={"error_code": "invalid_request", "message": str(exc)},
    )


# API routers mounted before static files so /api/* never falls through to
# the static file handler.
app.include_router(health.router)
app.include_router(portfolio.router)
app.include_router(watchlist.router)
app.include_router(create_stream_router(state.price_cache))

try:
    from app.api.chat import router as chat_router
except ImportError:
    chat_router = None

if chat_router is not None:
    app.include_router(chat_router)

if STATIC_DIR.is_dir():
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")
