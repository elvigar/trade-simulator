"""Lazy startup database initialization and seeding (PLAN.md section 7)."""

import sqlite3
import uuid

from app.market.seed_prices import SEED_PRICES

from .connection import get_connection
from .schema import (
    DEFAULT_CASH_BALANCE,
    DEFAULT_USER_ID,
    INDEX_STATEMENTS,
    SCHEMA_STATEMENTS,
)
from .util import utcnow_iso


def init_db(db_path: str | None = None) -> None:
    """Create missing tables and seed default data, if not already present.

    Idempotent — safe to call on every app startup. Creates the six tables
    from PLAN.md section 7 (and their indexes) if missing. Then, only if
    `users_profile` is empty, seeds: one default user profile with
    $10,000 cash, the ten default watchlist tickers (from
    `app.market.seed_prices.SEED_PRICES`), and one initial portfolio
    snapshot at $10,000 so the P&L chart has a baseline point. Calling this
    twice never wipes or duplicates existing data.
    """
    with get_connection(db_path) as conn:
        for statement in SCHEMA_STATEMENTS:
            conn.execute(statement)
        for statement in INDEX_STATEMENTS:
            conn.execute(statement)
        conn.commit()
        _run_column_migrations(conn)
        conn.commit()
        _seed_if_empty(conn)
        conn.commit()


def _add_column_if_missing(conn: sqlite3.Connection, table: str, column: str, ddl: str) -> None:
    existing = {row["name"] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()}
    if column not in existing:
        conn.execute(ddl)


def _run_column_migrations(conn: sqlite3.Connection) -> None:
    """Add columns to already-existing tables (CREATE TABLE IF NOT EXISTS
    above only covers fresh DBs). Idempotent — safe on every startup."""
    _add_column_if_missing(
        conn,
        "users_profile",
        "display_currency",
        "ALTER TABLE users_profile ADD COLUMN display_currency TEXT NOT NULL DEFAULT 'USD'",
    )


def _seed_if_empty(conn: sqlite3.Connection) -> None:
    existing = conn.execute(
        "SELECT 1 FROM users_profile WHERE id = ?", (DEFAULT_USER_ID,)
    ).fetchone()
    if existing is not None:
        return

    now = utcnow_iso()
    conn.execute(
        "INSERT INTO users_profile (id, cash_balance, created_at) VALUES (?, ?, ?)",
        (DEFAULT_USER_ID, DEFAULT_CASH_BALANCE, now),
    )
    for ticker in SEED_PRICES:
        conn.execute(
            "INSERT INTO watchlist (id, user_id, ticker, added_at) VALUES (?, ?, ?, ?)",
            (str(uuid.uuid4()), DEFAULT_USER_ID, ticker, now),
        )
    conn.execute(
        "INSERT INTO portfolio_snapshots (id, user_id, total_value, recorded_at) VALUES (?, ?, ?, ?)",
        (str(uuid.uuid4()), DEFAULT_USER_ID, DEFAULT_CASH_BALANCE, now),
    )
