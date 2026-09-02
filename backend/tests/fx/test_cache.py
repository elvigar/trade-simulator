"""Tests for app.fx.cache.FxRateCache."""

from app.fx.cache import FxRateCache
from app.fx.fallback_rates import FALLBACK_RATES


def test_cache_seeded_from_fallback_rates_at_construction():
    cache = FxRateCache()
    snapshot = cache.snapshot()
    assert snapshot["rates"] == FALLBACK_RATES
    assert snapshot["source"] == "fallback"
    assert snapshot["as_of"] is not None


def test_cache_update_replaces_rates_and_source():
    cache = FxRateCache()
    new_rates = {"USD": 1.0, "EUR": 0.5}
    cache.update(new_rates, source="live")
    snapshot = cache.snapshot()
    assert snapshot["rates"] == new_rates
    assert snapshot["source"] == "live"


def test_cache_snapshot_returns_copy_not_live_reference():
    cache = FxRateCache()
    snapshot = cache.snapshot()
    snapshot["rates"]["USD"] = 999.0
    assert cache.snapshot()["rates"]["USD"] == 1.0


def test_cache_update_bumps_as_of_timestamp():
    cache = FxRateCache()
    first = cache.snapshot()["as_of"]
    cache.update({"USD": 1.0}, source="live")
    second = cache.snapshot()["as_of"]
    assert second >= first
