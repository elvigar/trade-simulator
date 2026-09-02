"""Tests for app.fx.refresher.FxRefresher (direct analogue of
tests/market/test_massive.py)."""

from unittest.mock import MagicMock

import pytest

from app.fx.cache import FxRateCache
from app.fx.fallback_rates import FALLBACK_RATES
from app.fx.refresher import FxRefresher


@pytest.mark.asyncio
class TestFxRefresher:
    async def test_start_does_immediate_poll(self):
        cache = FxRateCache()
        client = MagicMock()
        client.fetch_rates.return_value = {"USD": 1.0, "EUR": 0.5}
        refresher = FxRefresher(cache, client=client)

        await refresher.start()

        assert cache.snapshot()["rates"] == {"USD": 1.0, "EUR": 0.5}
        assert cache.snapshot()["source"] == "live"

        await refresher.stop()

    async def test_failed_fetch_leaves_cache_untouched(self):
        cache = FxRateCache()
        client = MagicMock()
        client.fetch_rates.side_effect = Exception("network error")
        refresher = FxRefresher(cache, client=client)

        await refresher._poll_once()

        assert cache.snapshot()["rates"] == FALLBACK_RATES
        assert cache.snapshot()["source"] == "fallback"

    async def test_failed_fetch_after_successful_one_keeps_last_good_snapshot(self):
        cache = FxRateCache()
        client = MagicMock()
        client.fetch_rates.return_value = {"USD": 1.0, "EUR": 0.5}
        refresher = FxRefresher(cache, client=client)
        await refresher._poll_once()

        client.fetch_rates.side_effect = Exception("network error")
        await refresher._poll_once()

        assert cache.snapshot()["rates"] == {"USD": 1.0, "EUR": 0.5}
        assert cache.snapshot()["source"] == "live"

    async def test_stop_is_idempotent(self):
        cache = FxRateCache()
        client = MagicMock()
        client.fetch_rates.return_value = {"USD": 1.0}
        refresher = FxRefresher(cache, client=client)

        await refresher.stop()
        await refresher.stop()

    async def test_stop_cancels_task(self):
        cache = FxRateCache()
        client = MagicMock()
        client.fetch_rates.return_value = {"USD": 1.0}
        refresher = FxRefresher(cache, client=client)
        refresher._interval = 10.0

        await refresher.start()
        assert refresher._task is not None
        assert not refresher._task.done()

        await refresher.stop()
        assert refresher._task is None

    async def test_default_interval_read_from_env(self, monkeypatch):
        monkeypatch.setenv("FX_REFRESH_INTERVAL_SECONDS", "120")
        cache = FxRateCache()
        client = MagicMock()
        client.fetch_rates.return_value = {"USD": 1.0}
        refresher = FxRefresher(cache, client=client)

        assert refresher._interval == 120.0
