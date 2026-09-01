"""Supported display currencies and validation."""

from __future__ import annotations

from app.errors import DomainError

SUPPORTED_CURRENCIES: tuple[str, ...] = ("USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD")

CURRENCY_META: dict[str, str] = {
    "USD": "US Dollar",
    "EUR": "Euro",
    "GBP": "British Pound",
    "JPY": "Japanese Yen",
    "CHF": "Swiss Franc",
    "CAD": "Canadian Dollar",
    "AUD": "Australian Dollar",
}

DEFAULT_DISPLAY_CURRENCY = "USD"


def validate_currency(raw: str) -> str:
    """Trim + uppercase `raw`, then validate against `SUPPORTED_CURRENCIES`.

    Raises DomainError("invalid_request", ..., 400) if `raw` isn't a string
    or isn't one of the supported codes. Mirrors
    `app.validation.normalize_ticker`'s shape.
    """
    if not isinstance(raw, str):
        raise DomainError("invalid_request", "currency must be a string", 400)
    currency = raw.strip().upper()
    if currency not in SUPPORTED_CURRENCIES:
        raise DomainError("invalid_request", f"unsupported currency: {raw!r}", 400)
    return currency
