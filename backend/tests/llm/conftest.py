"""Fixtures for llm package tests."""

import sqlite3
from collections.abc import Iterator

import pytest

from app.db import init_db
from app.db.connection import get_connection


@pytest.fixture
def db_path(tmp_path) -> str:
    """A temp-file DB path, initialized with schema + seed data."""
    path = str(tmp_path / "finally-test.db")
    init_db(path)
    return path


@pytest.fixture
def conn(db_path: str) -> Iterator[sqlite3.Connection]:
    """An open connection to an initialized temp-file DB."""
    with get_connection(db_path) as connection:
        yield connection
