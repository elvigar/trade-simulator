"""Tests for app.watchlist.service."""

import pytest

from app import db
from app.errors import DomainError
from app.portfolio.service import execute_trade
from app.watchlist.service import add_watchlisted_ticker, remove_watchlisted_ticker


def test_add_watchlisted_ticker_inserts_row_and_registers_price(conn, db_path, fake_market):
    entry = add_watchlisted_ticker(conn, "pypl")
    assert entry["ticker"] == "PYPL"
    assert db.is_watchlisted(conn, "PYPL")
    assert "PYPL" in fake_market.get_tickers()


def test_add_duplicate_ticker_raises_domain_error(conn, db_path):
    add_watchlisted_ticker(conn, "PYPL")
    with pytest.raises(DomainError) as exc_info:
        add_watchlisted_ticker(conn, "PYPL")
    assert exc_info.value.error_code == "duplicate_ticker"
    assert exc_info.value.status_code == 409


def test_remove_watchlisted_ticker_deletes_row(conn, db_path):
    add_watchlisted_ticker(conn, "PYPL")
    result = remove_watchlisted_ticker(conn, "PYPL")
    assert result == {"ticker": "PYPL"}
    assert not db.is_watchlisted(conn, "PYPL")


def test_remove_nonexistent_ticker_raises_not_found(conn, db_path):
    with pytest.raises(DomainError) as exc_info:
        remove_watchlisted_ticker(conn, "NOPE")
    assert exc_info.value.error_code == "not_found"
    assert exc_info.value.status_code == 404


def test_remove_ticker_still_held_as_position_keeps_market_source_tracking(
    conn, db_path, fake_market
):
    # AAPL is already on the default seeded watchlist; buy a position in it
    # directly rather than re-adding it.
    execute_trade(conn, "AAPL", "buy", 1)

    remove_watchlisted_ticker(conn, "AAPL")

    assert not db.is_watchlisted(conn, "AAPL")
    # still held as a position -> market source must keep tracking it
    assert "AAPL" in fake_market.get_tickers()


def test_remove_ticker_not_held_stops_market_source_tracking(conn, db_path, fake_market):
    add_watchlisted_ticker(conn, "PYPL")
    remove_watchlisted_ticker(conn, "PYPL")
    assert "PYPL" not in fake_market.get_tickers()
