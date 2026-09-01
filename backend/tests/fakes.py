"""Shared test doubles for the market data source."""

from __future__ import annotations

from app.market import MarketDataSource, PriceCache


class FakeMarketSource(MarketDataSource):
    """In-memory MarketDataSource that seeds a price immediately on
    add_ticker (no waiting), so `ensure_price` resolves instantly in tests."""

    def __init__(self, price_cache: PriceCache, prices: dict[str, float] | None = None) -> None:
        self._cache = price_cache
        self._prices = dict(prices or {})
        self._tickers: set[str] = set()

    async def start(self, tickers: list[str]) -> None:
        for ticker in tickers:
            await self.add_ticker(ticker)

    async def stop(self) -> None:
        pass

    async def add_ticker(self, ticker: str) -> None:
        self._tickers.add(ticker)
        price = self._prices.get(ticker, 100.0)
        self._cache.update(ticker, price)

    async def remove_ticker(self, ticker: str) -> None:
        self._tickers.discard(ticker)
        self._cache.remove(ticker)

    def get_tickers(self) -> list[str]:
        return sorted(self._tickers)


class NoPriceMarketSource(MarketDataSource):
    """A MarketDataSource whose add_ticker never populates the price cache,
    to exercise the price_unavailable timeout path."""

    async def start(self, tickers: list[str]) -> None:
        pass

    async def stop(self) -> None:
        pass

    async def add_ticker(self, ticker: str) -> None:
        pass

    async def remove_ticker(self, ticker: str) -> None:
        pass

    def get_tickers(self) -> list[str]:
        return []
