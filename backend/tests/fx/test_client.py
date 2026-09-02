"""Tests for app.fx.client.FrankfurterClient (mocked httpx.get)."""

from unittest.mock import MagicMock, patch

import httpx
import pytest

from app.fx.client import FrankfurterClient
from app.fx.currencies import SUPPORTED_CURRENCIES


def _mock_response(rates: dict) -> MagicMock:
    response = MagicMock()
    response.raise_for_status = MagicMock()
    response.json.return_value = {"amount": 1, "base": "USD", "date": "2026-01-01", "rates": rates}
    return response


def test_fetch_rates_returns_dict_including_usd():
    rates = {"EUR": 0.9, "GBP": 0.8, "JPY": 150.0, "CHF": 0.85, "CAD": 1.35, "AUD": 1.5}
    with patch("httpx.get", return_value=_mock_response(rates)) as mock_get:
        result = FrankfurterClient().fetch_rates()

    assert result["USD"] == 1.0
    for code in SUPPORTED_CURRENCIES:
        assert code in result
    mock_get.assert_called_once()


def test_fetch_rates_requests_only_non_usd_supported_currencies():
    rates = {"EUR": 0.9, "GBP": 0.8, "JPY": 150.0, "CHF": 0.85, "CAD": 1.35, "AUD": 1.5}
    with patch("httpx.get", return_value=_mock_response(rates)) as mock_get:
        FrankfurterClient().fetch_rates()

    _, kwargs = mock_get.call_args
    requested = set(kwargs["params"]["symbols"].split(","))
    assert requested == set(SUPPORTED_CURRENCIES) - {"USD"}


def test_fetch_rates_raises_on_http_error():
    response = MagicMock()
    response.raise_for_status.side_effect = httpx.HTTPStatusError(
        "error", request=MagicMock(), response=MagicMock()
    )
    with patch("httpx.get", return_value=response):
        with pytest.raises(httpx.HTTPStatusError):
            FrankfurterClient().fetch_rates()


def test_fetch_rates_raises_on_network_error():
    with patch("httpx.get", side_effect=httpx.ConnectError("no network")):
        with pytest.raises(httpx.ConnectError):
            FrankfurterClient().fetch_rates()
