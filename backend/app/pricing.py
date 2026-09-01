"""Shared "register ticker + wait for first price" helper.

Used by both `app.portfolio.service.execute_trade` and
`app.watchlist.service.add_watchlisted_ticker` per DECISIONS.md -> "Market
data universe & price availability".
"""

from __future__ import annotations

import asyncio
import time

from app import state
from app.errors import DomainError

PRICE_WAIT_ATTEMPTS = 10
PRICE_WAIT_INTERVAL_SECONDS = 0.1


def ensure_price(ticker: str) -> float:
    """Register `ticker` with the market source if not already tracked, then
    poll the price cache for up to ~1s for its first price.

    `ticker` must already be normalized. Returns the price. Raises
    DomainError("price_unavailable", ..., 503) if no price appears in time —
    retryable by the client.
    """
    if state.market_source is None:
        raise DomainError("price_unavailable", "market data source is not running", 503)

    if ticker not in state.market_source.get_tickers():
        asyncio.run(state.market_source.add_ticker(ticker))

    for _ in range(PRICE_WAIT_ATTEMPTS):
        price = state.price_cache.get_price(ticker)
        if price is not None:
            return price
        time.sleep(PRICE_WAIT_INTERVAL_SECONDS)

    raise DomainError("price_unavailable", f"no price available for {ticker}", 503)
