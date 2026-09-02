"""SQLite connection helper.

One connection per call, opened as a context manager, with WAL mode and
row_factory = sqlite3.Row. The database path is configurable via the
FINALLY_DB_PATH environment variable so tests can point at a temp file or
":memory:" without touching the default on-disk database.
"""

import os
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

DEFAULT_DB_PATH = "db/finally.db"
DB_PATH_ENV_VAR = "FINALLY_DB_PATH"


def get_db_path() -> str:
    """Return the configured SQLite database path.

    Reads the FINALLY_DB_PATH env var if set, else falls back to
    "db/finally.db" relative to the process's working directory (the
    repo-root-level `db/` directory per PLAN.md section 4).
    """
    return os.environ.get(DB_PATH_ENV_VAR, DEFAULT_DB_PATH)


@contextmanager
def get_connection(db_path: str | None = None) -> Iterator[sqlite3.Connection]:
    """Open a new SQLite connection as a context manager.

    Enables WAL mode (skipped for ":memory:") and sets row_factory to
    sqlite3.Row so query results support both index and key access.
    Callers own transaction boundaries (commit/rollback); the connection is
    always closed on exit.

    Note: each call opens a distinct connection. An ":memory:" database is
    private to its own connection, so a test that needs data written on one
    connection to be visible on another must use a real temp-file path
    instead (e.g. pytest's tmp_path fixture).
    """
    path = db_path if db_path is not None else get_db_path()
    if path != ":memory:":
        Path(path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    if path != ":memory:":
        conn.execute("PRAGMA journal_mode = WAL")
    try:
        yield conn
    finally:
        conn.close()
