"""Background task that periodically refreshes FX rates into an FxRateCache."""

from __future__ import annotations

import asyncio
import logging
import os

from .cache import FxRateCache
from .client import FrankfurterClient

logger = logging.getLogger(__name__)

DEFAULT_REFRESH_INTERVAL_SECONDS = 45 * 60


class FxRefresher:
    """Slimmed-down `MassiveDataSource`-style start()/stop() background task.

    `start()` does an immediate poll so the cache reflects live rates as
    soon as possible, then schedules a poll loop on
    FX_REFRESH_INTERVAL_SECONDS (inline env read, matching the
    no-central-settings convention in `app/market/factory.py`).
    """

    def __init__(self, cache: FxRateCache, client: FrankfurterClient | None = None) -> None:
        self._cache = cache
        self._client = client or FrankfurterClient()
        self._interval = float(
            os.environ.get("FX_REFRESH_INTERVAL_SECONDS", DEFAULT_REFRESH_INTERVAL_SECONDS)
        )
        self._task: asyncio.Task | None = None

    async def start(self) -> None:
        await self._poll_once()
        self._task = asyncio.create_task(self._poll_loop(), name="fx-refresher")
        logger.info("FX refresher started: %.0fs interval", self._interval)

    async def stop(self) -> None:
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        self._task = None
        logger.info("FX refresher stopped")

    async def _poll_loop(self) -> None:
        """Poll on interval. First poll already happened in start()."""
        while True:
            await asyncio.sleep(self._interval)
            await self._poll_once()

    async def _poll_once(self) -> None:
        """Fetch live rates and update the cache. Never touches the cache on
        failure — it already holds either the fallback seed or the last good
        live snapshot, both better than reverting to stale defaults."""
        try:
            rates = await asyncio.to_thread(self._client.fetch_rates)
            self._cache.update(rates, source="live")
        except Exception as e:
            logger.error("FX refresh failed: %s", e)
