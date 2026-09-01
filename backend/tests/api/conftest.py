"""Fixtures for full-app API tests.

Uses the real app (app.main.app) with its real lifespan — including the
real SimulatorDataSource, since MASSIVE_API_KEY is unset in test env — but
points FINALLY_DB_PATH at a fresh temp-file DB per test so tests never touch
the dev database and don't interfere with each other.
"""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(tmp_path, monkeypatch) -> Iterator[TestClient]:
    monkeypatch.setenv("FINALLY_DB_PATH", str(tmp_path / "finally-test.db"))
    from app.main import app

    with TestClient(app) as test_client:
        yield test_client
