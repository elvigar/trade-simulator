"""Tests for app.validation.normalize_ticker."""

import pytest

from app.errors import DomainError
from app.validation import normalize_ticker


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("aapl", "AAPL"),
        (" AAPL ", "AAPL"),
        ("brk.b", "BRK.B"),
        ("a", "A"),
        ("A1", "A1"),
    ],
)
def test_normalize_ticker_accepts_valid_symbols(raw, expected):
    assert normalize_ticker(raw) == expected


@pytest.mark.parametrize(
    "raw",
    [
        "",
        "   ",
        "1AAPL",
        "-AAPL",
        "AAPL!",
        "TOOLONGTICKER",
        "AAPL BB",
    ],
)
def test_normalize_ticker_rejects_invalid_symbols(raw):
    with pytest.raises(DomainError) as exc_info:
        normalize_ticker(raw)
    assert exc_info.value.error_code == "invalid_request"
    assert exc_info.value.status_code == 400


def test_normalize_ticker_rejects_non_string():
    with pytest.raises(DomainError) as exc_info:
        normalize_ticker(123)
    assert exc_info.value.error_code == "invalid_request"
