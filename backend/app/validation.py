"""Ticker normalization and validation (DECISIONS.md -> "Ticker validation")."""

from __future__ import annotations

import re

from app.errors import DomainError

TICKER_PATTERN = re.compile(r"^[A-Z][A-Z0-9.]{0,9}$")


def normalize_ticker(raw: str) -> str:
    """Trim + uppercase `raw`, then validate against the accepted symbol syntax.

    Raises DomainError("invalid_request", ..., 400) if `raw` isn't a string
    or doesn't match the accepted pattern. Unknown-but-well-formed symbols
    are allowed through — the market-data layer is responsible for producing
    *some* price once registered.
    """
    if not isinstance(raw, str):
        raise DomainError("invalid_request", "ticker must be a string", 400)
    ticker = raw.strip().upper()
    if not TICKER_PATTERN.match(ticker):
        raise DomainError("invalid_request", f"invalid ticker symbol: {raw!r}", 400)
    return ticker
