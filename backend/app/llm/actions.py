"""Executes LLM-requested trades and watchlist changes through the shared
domain services (DECISIONS.md -> "Trade / watchlist service contract").

Each action opens its own connection and runs independently — one failure
does not block the rest of the batch (DECISIONS.md: "sequentially, not
all-or-nothing"). `execute_trade` / `add_watchlisted_ticker` /
`remove_watchlisted_ticker` commit or roll back their own transaction
internally, so callers here never call conn.commit()/rollback() themselves.
"""

from __future__ import annotations

from app import db
from app.errors import DomainError
from app.portfolio.service import execute_trade
from app.watchlist.service import add_watchlisted_ticker, remove_watchlisted_ticker

from .schemas import ActionResult, TradeAction, WatchlistChangeAction


def execute_actions(
    trades: list[TradeAction], watchlist_changes: list[WatchlistChangeAction]
) -> list[ActionResult]:
    """Run every requested trade, then every requested watchlist change,
    collecting one ActionResult per action (success or DomainError)."""
    results = [_run_trade(trade) for trade in trades]
    results += [_run_watchlist_change(change) for change in watchlist_changes]
    return results


def _run_trade(trade: TradeAction) -> ActionResult:
    request = trade.model_dump()
    try:
        with db.get_connection() as conn:
            detail = execute_trade(conn, trade.ticker, trade.side, trade.quantity)
        return ActionResult(type="trade", request=request, status="ok", detail=detail)
    except DomainError as exc:
        return ActionResult(
            type="trade",
            request=request,
            status="error",
            error_code=exc.error_code,
            detail=exc.message,
        )


def _run_watchlist_change(change: WatchlistChangeAction) -> ActionResult:
    request = change.model_dump()
    try:
        with db.get_connection() as conn:
            if change.action == "add":
                detail = add_watchlisted_ticker(conn, change.ticker)
            else:
                detail = remove_watchlisted_ticker(conn, change.ticker)
        return ActionResult(type="watchlist", request=request, status="ok", detail=detail)
    except DomainError as exc:
        return ActionResult(
            type="watchlist",
            request=request,
            status="error",
            error_code=exc.error_code,
            detail=exc.message,
        )
