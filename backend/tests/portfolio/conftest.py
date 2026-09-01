"""Fixtures for portfolio service tests."""

from collections.abc import Iterator
from typing import Any

import pytest

from app import db, state
from app.db.connection import get_connection
from tests.fakes import FakeMarketSource

DEFAULT_PRICES = {"AAPL": 190.0, "TSLA": 250.0, "GOOGL": 175.0}


@pytest.fixture
def db_path(tmp_path) -> str:
    path = str(tmp_path / "finally-test.db")
    db.init_db(path)
    return path


@pytest.fixture
def conn(db_path: str) -> Iterator[Any]:
    with get_connection(db_path) as connection:
        yield connection


@pytest.fixture(autouse=True)
def fake_market(monkeypatch):
    cache = state.price_cache
    monkeypatch.setattr(state, "market_source", FakeMarketSource(cache, dict(DEFAULT_PRICES)))
    yield state.market_source
