"""Fixtures for full-app API tests.

Uses the real app (app.main.app) with its real lifespan — including the
real SimulatorDataSource, since MASSIVE_API_KEY is unset in test env — but
points FINALLY_DB_PATH at a fresh temp-file DB per test so tests never touch
the dev database and don't interfere with each other.
"""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

MOCK_FX_RATES = {
    "USD": 1.0,
    "EUR": 0.9,
    "GBP": 0.8,
    "JPY": 150.0,
    "CHF": 0.85,
    "CAD": 1.35,
    "AUD": 1.5,
}


@pytest.fixture(autouse=True)
def mock_fx_client(monkeypatch) -> None:
    """FxRefresher runs unconditionally at app startup (unlike
    MassiveDataSource, which only activates when MASSIVE_API_KEY is set —
    never in tests). Without this, every full-app TestClient test would hit
    the real Frankfurter API. Patch the network seam directly."""
    from app.fx.client import FrankfurterClient

    monkeypatch.setattr(FrankfurterClient, "fetch_rates", lambda self: dict(MOCK_FX_RATES))


@pytest.fixture
def client(tmp_path, monkeypatch) -> Iterator[TestClient]:
    monkeypatch.setenv("FINALLY_DB_PATH", str(tmp_path / "finally-test.db"))
    from app.main import app

    with TestClient(app) as test_client:
        yield test_client
