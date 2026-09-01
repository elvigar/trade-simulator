"""FX rate subsystem for FinAlly — a display/conversion overlay only.

The ledger (cash_balance, avg_cost, trades.price, market data) stays
USD-only; this module supplies live USD-based conversion rates so the
frontend can render a secondary currency alongside USD figures.

Public API:
    SUPPORTED_CURRENCIES      - Tuple of supported currency codes
    CURRENCY_META             - code -> display name
    DEFAULT_DISPLAY_CURRENCY  - "USD"
    validate_currency         - Normalize + validate a currency code
    FALLBACK_RATES            - Static USD-based reference rates
    FxRateCache               - Thread-safe in-memory rate store
    FrankfurterClient         - Live rate fetcher (Frankfurter API)
    FxRefresher               - Background task that refreshes the cache
"""

from .cache import FxRateCache
from .client import FrankfurterClient
from .currencies import (
    CURRENCY_META,
    DEFAULT_DISPLAY_CURRENCY,
    SUPPORTED_CURRENCIES,
    validate_currency,
)
from .fallback_rates import FALLBACK_RATES
from .refresher import FxRefresher

__all__ = [
    "SUPPORTED_CURRENCIES",
    "CURRENCY_META",
    "DEFAULT_DISPLAY_CURRENCY",
    "validate_currency",
    "FALLBACK_RATES",
    "FxRateCache",
    "FrankfurterClient",
    "FxRefresher",
]
