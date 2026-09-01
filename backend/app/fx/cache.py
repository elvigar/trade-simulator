"""Thread-safe in-memory FX rate cache."""

from __future__ import annotations

import time
from threading import Lock

from .fallback_rates import FALLBACK_RATES


class FxRateCache:
    """Thread-safe cache of the latest USD-based FX rates.

    Writers: FxRefresher (one at a time). Readers: the /api/fx/rates route.
    Seeded from FALLBACK_RATES at construction, so it is never empty even
    before the first successful live fetch.
    """

    def __init__(self) -> None:
        self._rates: dict[str, float] = dict(FALLBACK_RATES)
        self._as_of: float = time.time()
        self._source: str = "fallback"
        self._lock = Lock()

    def update(self, rates: dict[str, float], source: str = "live") -> None:
        """Replace the cached rates (e.g. after a successful live fetch)."""
        with self._lock:
            self._rates = dict(rates)
            self._as_of = time.time()
            self._source = source

    def snapshot(self) -> dict:
        """Return the current rates, as-of timestamp, and source."""
        with self._lock:
            return {
                "rates": dict(self._rates),
                "as_of": self._as_of,
                "source": self._source,
            }
