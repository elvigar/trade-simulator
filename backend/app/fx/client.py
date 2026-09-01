"""Frankfurter API client for live FX rates (no API key required)."""

from __future__ import annotations

import httpx

from .currencies import SUPPORTED_CURRENCIES

FRANKFURTER_URL = "https://api.frankfurter.dev/v1/latest"
REQUEST_TIMEOUT_SECONDS = 5.0


class FrankfurterClient:
    """Fetches USD-based exchange rates from the Frankfurter API (ECB daily rates)."""

    def fetch_rates(self) -> dict[str, float]:
        """Fetch current rates for all non-USD supported currencies, USD-based.

        One synchronous GET request. Raises on any HTTP/network failure or
        malformed response — callers are responsible for catching. This is
        the mockable network seam, same idiom as
        `MassiveDataSource._fetch_snapshots`.
        """
        targets = [code for code in SUPPORTED_CURRENCIES if code != "USD"]
        response = httpx.get(
            FRANKFURTER_URL,
            params={"base": "USD", "symbols": ",".join(targets)},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        payload = response.json()
        rates = {code: float(payload["rates"][code]) for code in targets}
        rates["USD"] = 1.0
        return rates
