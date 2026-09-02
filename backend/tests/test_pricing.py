"""Tests for app.pricing.ensure_price."""

import pytest

from app import state
from app.errors import DomainError
from app.market import PriceCache
from app.pricing import ensure_price
from tests.fakes import FakeMarketSource, NoPriceMarketSource


@pytest.fixture(autouse=True)
def _reset_state(monkeypatch):
    monkeypatch.setattr(state, "price_cache", PriceCache())
    monkeypatch.setattr(state, "market_source", None)
    yield


def test_ensure_price_registers_and_returns_price():
    state.price_cache = PriceCache()
    state.market_source = FakeMarketSource(state.price_cache, {"AAPL": 190.0})
    assert ensure_price("AAPL") == 190.0
    assert "AAPL" in state.market_source.get_tickers()


def test_ensure_price_uses_existing_cache_entry_without_reregistering():
    state.price_cache = PriceCache()
    state.price_cache.update("AAPL", 190.0)
    fake = FakeMarketSource(state.price_cache)
    fake._tickers.add("AAPL")  # already tracked
    state.market_source = fake
    assert ensure_price("AAPL") == 190.0


def test_ensure_price_raises_when_market_source_not_started():
    state.market_source = None
    with pytest.raises(DomainError) as exc_info:
        ensure_price("AAPL")
    assert exc_info.value.error_code == "price_unavailable"
    assert exc_info.value.status_code == 503


def test_ensure_price_times_out_when_no_price_appears(monkeypatch):
    import app.pricing as pricing_module

    monkeypatch.setattr(pricing_module, "PRICE_WAIT_ATTEMPTS", 2)
    monkeypatch.setattr(pricing_module, "PRICE_WAIT_INTERVAL_SECONDS", 0.01)
    state.price_cache = PriceCache()
    state.market_source = NoPriceMarketSource()
    with pytest.raises(DomainError) as exc_info:
        ensure_price("ZZZZ")
    assert exc_info.value.error_code == "price_unavailable"
    assert exc_info.value.status_code == 503
