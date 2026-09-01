"""Tests for app.db.init: schema creation, idempotency, seeding."""

from app.db import init_db
from app.db.connection import get_connection
from app.db.schema import DEFAULT_CASH_BALANCE, DEFAULT_USER_ID
from app.market.seed_prices import SEED_PRICES

TABLES = (
    "users_profile",
    "watchlist",
    "positions",
    "trades",
    "portfolio_snapshots",
    "chat_messages",
)


def _table_names(path: str) -> set[str]:
    with get_connection(path) as conn:
        rows = conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'").fetchall()
        return {row["name"] for row in rows}


def test_init_creates_all_tables_from_empty(tmp_path):
    path = str(tmp_path / "finally.db")
    init_db(path)
    names = _table_names(path)
    for table in TABLES:
        assert table in names


def test_init_seeds_default_user_profile(tmp_path):
    path = str(tmp_path / "finally.db")
    init_db(path)
    with get_connection(path) as conn:
        row = conn.execute(
            "SELECT * FROM users_profile WHERE id = ?", (DEFAULT_USER_ID,)
        ).fetchone()
    assert row is not None
    assert row["cash_balance"] == DEFAULT_CASH_BALANCE
    assert row["created_at"]


def test_init_seeds_ten_default_watchlist_tickers(tmp_path):
    path = str(tmp_path / "finally.db")
    init_db(path)
    with get_connection(path) as conn:
        rows = conn.execute(
            "SELECT ticker FROM watchlist WHERE user_id = ?", (DEFAULT_USER_ID,)
        ).fetchall()
    tickers = {row["ticker"] for row in rows}
    assert tickers == set(SEED_PRICES.keys())
    assert len(tickers) == 10


def test_init_seeds_one_initial_snapshot_at_default_cash(tmp_path):
    path = str(tmp_path / "finally.db")
    init_db(path)
    with get_connection(path) as conn:
        rows = conn.execute(
            "SELECT * FROM portfolio_snapshots WHERE user_id = ?", (DEFAULT_USER_ID,)
        ).fetchall()
    assert len(rows) == 1
    assert rows[0]["total_value"] == DEFAULT_CASH_BALANCE


def test_init_is_idempotent_does_not_duplicate_seed_data(tmp_path):
    path = str(tmp_path / "finally.db")
    init_db(path)
    init_db(path)
    init_db(path)
    with get_connection(path) as conn:
        profile_rows = conn.execute("SELECT * FROM users_profile").fetchall()
        watchlist_rows = conn.execute("SELECT * FROM watchlist").fetchall()
        snapshot_rows = conn.execute("SELECT * FROM portfolio_snapshots").fetchall()
    assert len(profile_rows) == 1
    assert len(watchlist_rows) == 10
    assert len(snapshot_rows) == 1


def test_init_does_not_wipe_existing_trades_or_positions(tmp_path):
    path = str(tmp_path / "finally.db")
    init_db(path)
    with get_connection(path) as conn:
        conn.execute(
            "INSERT INTO positions (id, user_id, ticker, quantity, avg_cost, updated_at) "
            "VALUES ('p1', 'default', 'AAPL', 5, 190.0, 'x')"
        )
        conn.commit()

    init_db(path)

    with get_connection(path) as conn:
        rows = conn.execute("SELECT * FROM positions").fetchall()
    assert len(rows) == 1
    assert rows[0]["ticker"] == "AAPL"


def test_init_creates_parent_directory_if_missing(tmp_path):
    path = str(tmp_path / "nested" / "sub" / "finally.db")
    init_db(path)
    with get_connection(path) as conn:
        row = conn.execute("SELECT 1 FROM users_profile").fetchone()
    assert row is not None


def test_init_fresh_db_has_display_currency_defaulted_to_usd(tmp_path):
    path = str(tmp_path / "finally.db")
    init_db(path)
    with get_connection(path) as conn:
        row = conn.execute(
            "SELECT display_currency FROM users_profile WHERE id = ?", (DEFAULT_USER_ID,)
        ).fetchone()
    assert row["display_currency"] == "USD"


def test_init_migrates_old_shape_users_profile_and_backfills_usd(tmp_path):
    path = str(tmp_path / "finally.db")
    with get_connection(path) as conn:
        conn.execute(
            """
            CREATE TABLE users_profile (
                id TEXT PRIMARY KEY DEFAULT 'default',
                cash_balance REAL NOT NULL DEFAULT 10000.0,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            "INSERT INTO users_profile (id, cash_balance, created_at) VALUES (?, ?, ?)",
            (DEFAULT_USER_ID, DEFAULT_CASH_BALANCE, "2026-01-01T00:00:00+00:00"),
        )
        conn.commit()

    init_db(path)

    with get_connection(path) as conn:
        row = conn.execute(
            "SELECT display_currency FROM users_profile WHERE id = ?", (DEFAULT_USER_ID,)
        ).fetchone()
    assert row["display_currency"] == "USD"


def test_init_column_migration_is_idempotent(tmp_path):
    path = str(tmp_path / "finally.db")
    init_db(path)
    init_db(path)
    init_db(path)
    with get_connection(path) as conn:
        row = conn.execute(
            "SELECT display_currency FROM users_profile WHERE id = ?", (DEFAULT_USER_ID,)
        ).fetchone()
    assert row["display_currency"] == "USD"
