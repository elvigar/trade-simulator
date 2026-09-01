"""Portfolio REST endpoints (PLAN.md section 8).

    GET  /api/portfolio          -> positions, cash, total value, unrealized P&L
    POST /api/portfolio/trade    -> execute a market order
    GET  /api/portfolio/history  -> portfolio_snapshots for the P&L chart
"""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from app import db
from app.portfolio.service import execute_trade, get_portfolio
from app.validation import normalize_ticker

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])


class TradeRequest(BaseModel):
    ticker: str
    side: str
    quantity: float


@router.get("")
def get_portfolio_route() -> dict:
    with db.get_connection() as conn:
        return get_portfolio(conn)


@router.post("/trade")
def post_trade_route(payload: TradeRequest) -> dict:
    with db.get_connection() as conn:
        trade = execute_trade(conn, payload.ticker, payload.side, payload.quantity)
        ticker = normalize_ticker(payload.ticker)
        cash_balance = db.get_cash_balance(conn)
        position = db.get_position(conn, ticker)
    return {"trade": trade, "cash_balance": cash_balance, "position": position}


@router.get("/history")
def get_history_route() -> dict:
    with db.get_connection() as conn:
        snapshots = db.list_snapshots(conn)
    return {"snapshots": snapshots}
