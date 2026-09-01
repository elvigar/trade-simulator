"""Tests for app.db.repository row-level helpers."""

import sqlite3

import pytest

from app.db import repository as repo
from app.db.schema import DEFAULT_CASH_BALANCE, DEFAULT_USER_ID

# --- users_profile -----------------------------------------------------


def test_get_cash_balance_returns_seeded_default(conn):
    assert repo.get_cash_balance(conn) == DEFAULT_CASH_BALANCE


def test_update_cash_balance_sets_absolute_value(conn):
    repo.update_cash_balance(conn, 9500.25)
    assert repo.get_cash_balance(conn) == 9500.25


def test_get_cash_balance_raises_for_unknown_user(conn):
    with pytest.raises(LookupError):
        repo.get_cash_balance(conn, user_id="nobody")


# --- positions -----------------------------------------------------------


def test_get_position_returns_none_when_absent(conn):
    assert repo.get_position(conn, "AAPL") is None


def test_upsert_position_inserts_then_updates(conn):
    repo.upsert_position(conn, "AAPL", quantity=10, avg_cost=190.0)
    pos = repo.get_position(conn, "AAPL")
    assert pos is not None
    assert pos["quantity"] == 10
    assert pos["avg_cost"] == 190.0
    assert pos["user_id"] == DEFAULT_USER_ID

    repo.upsert_position(conn, "AAPL", quantity=15, avg_cost=195.0)
    pos = repo.get_position(conn, "AAPL")
    assert pos["quantity"] == 15
    assert pos["avg_cost"] == 195.0

    all_rows = conn.execute("SELECT * FROM positions WHERE ticker = 'AAPL'").fetchall()
    assert len(all_rows) == 1


def test_upsert_position_deletes_row_at_near_zero_quantity(conn):
    repo.upsert_position(conn, "AAPL", quantity=10, avg_cost=190.0)
    repo.upsert_position(conn, "AAPL", quantity=1e-10, avg_cost=190.0)
    assert repo.get_position(conn, "AAPL") is None


def test_list_positions_orders_by_ticker(conn):
    repo.upsert_position(conn, "TSLA", quantity=1, avg_cost=250.0)
    repo.upsert_position(conn, "AAPL", quantity=2, avg_cost=190.0)
    tickers = [p["ticker"] for p in repo.list_positions(conn)]
    assert tickers == ["AAPL", "TSLA"]


# --- trades ----------------------------------------------------------------


def test_insert_trade_returns_row_and_persists(conn):
    trade = repo.insert_trade(conn, "AAPL", "buy", quantity=10, price=190.0)
    assert trade["ticker"] == "AAPL"
    assert trade["side"] == "buy"
    assert trade["quantity"] == 10
    assert trade["price"] == 190.0
    assert trade["id"]
    assert trade["executed_at"]

    rows = repo.list_trades(conn)
    assert len(rows) == 1
    assert rows[0]["id"] == trade["id"]


def test_list_trades_chronological(conn):
    repo.insert_trade(conn, "AAPL", "buy", 1, 190.0)
    repo.insert_trade(conn, "TSLA", "buy", 1, 250.0)
    trades = repo.list_trades(conn)
    assert [t["ticker"] for t in trades] == ["AAPL", "TSLA"]


# --- portfolio_snapshots -----------------------------------------------


def test_insert_snapshot_and_list_snapshots(conn):
    # One snapshot already seeded by init_db.
    repo.insert_snapshot(conn, 10500.0)
    snapshots = repo.list_snapshots(conn)
    assert len(snapshots) == 2
    assert snapshots[-1]["total_value"] == 10500.0


def test_list_snapshots_limit_returns_latest_rows_in_chronological_order(conn):
    conn.execute("DELETE FROM portfolio_snapshots")
    for i in range(5):
        conn.execute(
            """
            INSERT INTO portfolio_snapshots (id, user_id, total_value, recorded_at)
            VALUES (?, ?, ?, ?)
            """,
            (f"snapshot-{i}", DEFAULT_USER_ID, 10000.0 + i, f"2026-01-01T00:00:0{i}+00:00"),
        )

    snapshots = repo.list_snapshots(conn, limit=2)

    assert [row["id"] for row in snapshots] == ["snapshot-3", "snapshot-4"]
    assert [row["total_value"] for row in snapshots] == [10003.0, 10004.0]


# --- watchlist ---------------------------------------------------------


def test_list_watchlist_returns_seeded_defaults(conn):
    entries = repo.list_watchlist(conn)
    assert len(entries) == 10


def test_is_watchlisted(conn):
    assert repo.is_watchlisted(conn, "AAPL") is True
    assert repo.is_watchlisted(conn, "PYPL") is False


def test_add_watchlist_ticker(conn):
    entry = repo.add_watchlist_ticker(conn, "PYPL")
    assert entry["ticker"] == "PYPL"
    assert repo.is_watchlisted(conn, "PYPL") is True
    assert len(repo.list_watchlist(conn)) == 11


def test_add_watchlist_ticker_duplicate_raises_integrity_error(conn):
    with pytest.raises(sqlite3.IntegrityError):
        repo.add_watchlist_ticker(conn, "AAPL")


def test_remove_watchlist_ticker(conn):
    assert repo.remove_watchlist_ticker(conn, "AAPL") is True
    assert repo.is_watchlisted(conn, "AAPL") is False
    assert len(repo.list_watchlist(conn)) == 9


def test_remove_watchlist_ticker_missing_returns_false(conn):
    assert repo.remove_watchlist_ticker(conn, "PYPL") is False


# --- chat_messages -------------------------------------------------------


def test_insert_and_list_chat_messages(conn):
    repo.insert_chat_message(conn, "user", "What's my portfolio worth?")
    repo.insert_chat_message(
        conn, "assistant", "You're up 2% today.", actions='{"trades": []}'
    )
    messages = repo.list_chat_messages(conn)
    assert [m["role"] for m in messages] == ["user", "assistant"]
    assert messages[0]["actions"] is None
    assert messages[1]["actions"] == '{"trades": []}'


def test_list_chat_messages_respects_limit_but_stays_chronological(conn):
    for i in range(5):
        repo.insert_chat_message(conn, "user", f"message {i}")
    limited = repo.list_chat_messages(conn, limit=2)
    assert [m["content"] for m in limited] == ["message 3", "message 4"]
