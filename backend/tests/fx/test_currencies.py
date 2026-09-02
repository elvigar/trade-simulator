"""Tests for app.fx.currencies."""

import pytest

from app.errors import DomainError
from app.fx.currencies import (
    CURRENCY_META,
    DEFAULT_DISPLAY_CURRENCY,
    SUPPORTED_CURRENCIES,
    validate_currency,
)


def test_default_display_currency_is_usd():
    assert DEFAULT_DISPLAY_CURRENCY == "USD"


def test_supported_currencies_all_have_metadata():
    for code in SUPPORTED_CURRENCIES:
        assert code in CURRENCY_META
        assert isinstance(CURRENCY_META[code], str)


def test_validate_currency_accepts_supported_code():
    assert validate_currency("EUR") == "EUR"


def test_validate_currency_trims_and_uppercases():
    assert validate_currency("  eur  ") == "EUR"


def test_validate_currency_rejects_unsupported_code():
    with pytest.raises(DomainError) as exc_info:
        validate_currency("XXX")
    assert exc_info.value.error_code == "invalid_request"
    assert exc_info.value.status_code == 400


def test_validate_currency_rejects_non_string():
    with pytest.raises(DomainError) as exc_info:
        validate_currency(123)
    assert exc_info.value.error_code == "invalid_request"
