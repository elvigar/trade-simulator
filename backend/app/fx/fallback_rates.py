"""Static USD-based reference exchange rates.

Used to seed `FxRateCache` at construction (so it is never empty) and as
the permanent floor whenever a live fetch from Frankfurter fails — the
feature degrades gracefully offline and stays deterministic in tests.
Approximate rates; not updated automatically. USD is the implicit base
(1 USD = rate[CCY] units of CCY).
"""

from __future__ import annotations

FALLBACK_RATES: dict[str, float] = {
    "USD": 1.0,
    "EUR": 0.92,
    "GBP": 0.79,
    "JPY": 149.50,
    "CHF": 0.88,
    "CAD": 1.36,
    "AUD": 1.53,
}
