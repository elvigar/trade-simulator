"""Process-wide singletons shared across API routes and service modules.

`market_source` is None until `app.main`'s startup lifespan creates and
starts it. Importers must do `from app import state` and read `state.market_source`
/ `state.price_cache` at call time (not `from app.state import market_source`),
since the latter binds the name to whatever value was present at import
time — which is None before startup runs.
"""

from __future__ import annotations

from app.fx import FxRateCache, FxRefresher
from app.market import MarketDataSource, PriceCache

price_cache: PriceCache = PriceCache()
market_source: MarketDataSource | None = None

# Per-ticker first-price-observed-this-process, for the watchlist's "daily
# change %" proxy metric. See DECISIONS.md -> "Price metrics semantics".
session_open_prices: dict[str, float] = {}

# FX rate cache: seeded from fallback rates at import time (never empty),
# refreshed periodically by fx_refresher once app.main's lifespan starts it.
fx_cache: FxRateCache = FxRateCache()
fx_refresher: FxRefresher | None = None
