"""Watchlist add/remove.

Binding contract from DECISIONS.md -> "Trade / watchlist service contract":
both the manual watchlist routes (`app.api.watchlist`) and the
llm-engineer's chat action executor call these exact functions.
"""

from __future__ import annotations

import asyncio
import sqlite3

from app import db, state
from app.errors import DomainError
from app.pricing import ensure_price
from app.validation import normalize_ticker


def add_watchlisted_ticker(conn, ticker: str, user_id: str = db.DEFAULT_USER_ID) -> dict:
    """Normalize `ticker`, register it with the market source (waits for a
    price the same way execute_trade does), insert the watchlist row.

    Raises DomainError("duplicate_ticker", ..., 409) if already present.
    """
    ticker = normalize_ticker(ticker)
    ensure_price(ticker)
    try:
        entry = db.add_watchlist_ticker(conn, ticker, user_id)
    except sqlite3.IntegrityError as exc:
        conn.rollback()
        raise DomainError(
            "duplicate_ticker", f"{ticker} is already on the watchlist", 409
        ) from exc
    conn.commit()
    return entry


def remove_watchlisted_ticker(conn, ticker: str, user_id: str = db.DEFAULT_USER_ID) -> dict:
    """Remove the watchlist row for `ticker`.

    Raises DomainError("not_found", ..., 404) if not present. Only calls
    market_source.remove_ticker() if the ticker is not held as an open
    position — the position still needs live pricing for valuation.
    """
    ticker = normalize_ticker(ticker)
    removed = db.remove_watchlist_ticker(conn, ticker, user_id)
    if not removed:
        conn.rollback()
        raise DomainError("not_found", f"{ticker} is not on the watchlist", 404)

    position = db.get_position(conn, ticker, user_id)
    conn.commit()

    if position is None and state.market_source is not None:
        asyncio.run(state.market_source.remove_ticker(ticker))

    return {"ticker": ticker}
