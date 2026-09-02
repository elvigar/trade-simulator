"""Tests for app.db.connection."""

import os
import sqlite3

import pytest

from app.db.connection import DB_PATH_ENV_VAR, DEFAULT_DB_PATH, get_connection, get_db_path


def test_get_db_path_defaults_when_env_unset(monkeypatch):
    monkeypatch.delenv(DB_PATH_ENV_VAR, raising=False)
    assert get_db_path() == DEFAULT_DB_PATH


def test_get_db_path_reads_env_var(monkeypatch):
    monkeypatch.setenv(DB_PATH_ENV_VAR, "/tmp/somewhere/custom.db")
    assert get_db_path() == "/tmp/somewhere/custom.db"


def test_get_connection_creates_parent_dir_for_file_path(tmp_path):
    nested = tmp_path / "nested" / "dir" / "test.db"
    assert not nested.parent.exists()
    with get_connection(str(nested)) as conn:
        assert isinstance(conn, sqlite3.Connection)
    assert nested.parent.exists()


def test_get_connection_row_factory_is_sqlite_row(tmp_path):
    path = str(tmp_path / "test.db")
    with get_connection(path) as conn:
        conn.execute("CREATE TABLE t (a TEXT, b TEXT)")
        conn.execute("INSERT INTO t VALUES ('x', 'y')")
        conn.commit()
        row = conn.execute("SELECT * FROM t").fetchone()
        assert row["a"] == "x"
        assert row["b"] == "y"
        assert tuple(row) == ("x", "y")


def test_get_connection_closes_on_exit(tmp_path):
    path = str(tmp_path / "test.db")
    with get_connection(path) as conn:
        pass
    with pytest.raises(sqlite3.ProgrammingError):
        conn.execute("SELECT 1")


def test_memory_db_is_isolated_per_connection():
    with get_connection(":memory:") as conn:
        conn.execute("CREATE TABLE t (a TEXT)")
        conn.execute("INSERT INTO t VALUES ('x')")
        conn.commit()
        assert conn.execute("SELECT * FROM t").fetchall()

    # A fresh :memory: connection does not see the previous connection's data.
    with get_connection(":memory:") as conn2:
        with pytest.raises(sqlite3.OperationalError):
            conn2.execute("SELECT * FROM t")


def test_wal_mode_enabled_for_file_db(tmp_path):
    path = str(tmp_path / "test.db")
    with get_connection(path) as conn:
        mode = conn.execute("PRAGMA journal_mode").fetchone()[0]
        assert mode.lower() == "wal"


def test_env_var_overrides_default(monkeypatch, tmp_path):
    path = tmp_path / "env-configured.db"
    monkeypatch.setenv(DB_PATH_ENV_VAR, str(path))
    with get_connection() as conn:
        conn.execute("CREATE TABLE t (a TEXT)")
        conn.commit()
    assert path.exists()
    os.environ.pop(DB_PATH_ENV_VAR, None)
