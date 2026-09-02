"""Watchlist REST endpoints (PLAN.md section 8).

    GET    /api/watchlist            -> tickers with latest price/change
    POST   /api/watchlist            -> add a ticker
    DELETE /api/watchlist/{ticker}   -> remove a ticker
"""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from app import db, state
from app.watchlist.service import add_watchlisted_ticker, remove_watchlisted_ticker

router = APIRouter(prefix="/api/watchlist", tags=["watchlist"])


class WatchlistAddRequest(BaseModel):
    ticker: str


def _daily_change_percent(ticker: str, current_price: float) -> float:
    """Session-since-launch proxy for "daily change %" — see DECISIONS.md ->
    "Price metrics semantics". Locks in `current_price` as the session-open
    reference the first time this ticker is read here."""
    open_price = state.session_open_prices.setdefault(ticker, current_price)
    if open_price == 0:
        return 0.0
    return round((current_price - open_price) / open_price * 100, 4)


@router.get("")
def get_watchlist_route() -> dict:
    with db.get_connection() as conn:
        entries = db.list_watchlist(conn)
    items = []
    for entry in entries:
        ticker = entry["ticker"]
        update = state.price_cache.get(ticker)
        items.append(
            {
                "ticker": ticker,
                "added_at": entry["added_at"],
                "price": update.price if update else None,
                "change": update.change if update else None,
                "change_percent": update.change_percent if update else None,
                "daily_change_percent": (
                    _daily_change_percent(ticker, update.price) if update else None
                ),
            }
        )
    return {"watchlist": items}


@router.post("")
def post_watchlist_route(payload: WatchlistAddRequest) -> dict:
    with db.get_connection() as conn:
        return add_watchlisted_ticker(conn, payload.ticker)


@router.delete("/{ticker}")
def delete_watchlist_route(ticker: str) -> dict:
    with db.get_connection() as conn:
        return remove_watchlisted_ticker(conn, ticker)
