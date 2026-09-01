"""Tests for app.portfolio.service.execute_trade and get_portfolio."""

import threading

import pytest

from app import db
from app.db.connection import get_connection
from app.errors import DomainError
from app.portfolio.service import execute_trade, get_portfolio


def test_buy_trade_updates_cash_and_creates_position(conn, db_path):
    trade = execute_trade(conn, "aapl", "buy", 10)

    assert trade["ticker"] == "AAPL"
    assert trade["side"] == "buy"
    assert trade["quantity"] == 10.0
    assert trade["price"] == 190.0

    assert db.get_cash_balance(conn) == pytest.approx(10000.0 - 1900.0)
    position = db.get_position(conn, "AAPL")
    assert position["quantity"] == pytest.approx(10.0)
    assert position["avg_cost"] == pytest.approx(190.0)

    snapshots = db.list_snapshots(conn)
    assert len(snapshots) == 2  # seed snapshot + post-trade snapshot
    assert snapshots[-1]["total_value"] == pytest.approx(10000.0)


def test_buy_trade_computes_weighted_average_cost(conn, db_path):
    execute_trade(conn, "AAPL", "buy", 10)  # 10 @ 190 = 1900
    # bump the price for the second buy
    from app import state

    state.price_cache.update("AAPL", 210.0)
    execute_trade(conn, "AAPL", "buy", 10)  # 10 @ 210 = 2100

    position = db.get_position(conn, "AAPL")
    assert position["quantity"] == pytest.approx(20.0)
    # (1900 + 2100) / 20 = 200.0
    assert position["avg_cost"] == pytest.approx(200.0)


def test_sell_trade_reduces_position_and_increases_cash(conn, db_path):
    execute_trade(conn, "AAPL", "buy", 10)
    trade = execute_trade(conn, "AAPL", "sell", 4)

    assert trade["side"] == "sell"
    position = db.get_position(conn, "AAPL")
    assert position["quantity"] == pytest.approx(6.0)
    assert position["avg_cost"] == pytest.approx(190.0)  # unchanged on partial sell
    assert db.get_cash_balance(conn) == pytest.approx(10000.0 - 1900.0 + 760.0)


def test_selling_entire_position_deletes_the_row(conn, db_path):
    execute_trade(conn, "AAPL", "buy", 10)
    execute_trade(conn, "AAPL", "sell", 10)
    assert db.get_position(conn, "AAPL") is None


def test_buy_with_insufficient_cash_raises_domain_error(conn, db_path):
    with pytest.raises(DomainError) as exc_info:
        execute_trade(conn, "AAPL", "buy", 1000)  # 1000 * 190 = 190000 > 10000
    assert exc_info.value.error_code == "insufficient_cash"
    assert exc_info.value.status_code == 422
    # nothing persisted from the failed trade
    assert db.get_cash_balance(conn) == pytest.approx(10000.0)
    assert db.get_position(conn, "AAPL") is None


def test_sell_with_no_position_raises_insufficient_shares(conn, db_path):
    with pytest.raises(DomainError) as exc_info:
        execute_trade(conn, "AAPL", "sell", 1)
    assert exc_info.value.error_code == "insufficient_shares"
    assert exc_info.value.status_code == 422


def test_sell_more_than_held_raises_insufficient_shares(conn, db_path):
    execute_trade(conn, "AAPL", "buy", 5)
    with pytest.raises(DomainError) as exc_info:
        execute_trade(conn, "AAPL", "sell", 6)
    assert exc_info.value.error_code == "insufficient_shares"


def test_invalid_side_raises_invalid_request(conn, db_path):
    with pytest.raises(DomainError) as exc_info:
        execute_trade(conn, "AAPL", "hold", 1)
    assert exc_info.value.error_code == "invalid_request"
    assert exc_info.value.status_code == 400


@pytest.mark.parametrize("quantity", [0, -5, "not-a-number"])
def test_invalid_quantity_raises_invalid_request(conn, db_path, quantity):
    with pytest.raises(DomainError) as exc_info:
        execute_trade(conn, "AAPL", "buy", quantity)
    assert exc_info.value.error_code == "invalid_request"


def test_quantity_with_too_many_decimals_rejected(conn, db_path):
    with pytest.raises(DomainError) as exc_info:
        execute_trade(conn, "AAPL", "buy", 1.1234567)
    assert exc_info.value.error_code == "invalid_request"


def test_unregistered_ticker_gets_registered_and_traded(conn, db_path):
    trade = execute_trade(conn, "ZZZZ", "buy", 1)
    assert trade["ticker"] == "ZZZZ"
    assert trade["price"] == 100.0  # FakeMarketSource default price


def test_get_portfolio_reports_cash_positions_and_totals(conn, db_path):
    execute_trade(conn, "AAPL", "buy", 10)  # cost basis 1900, price 190 -> flat
    from app import state

    state.price_cache.update("AAPL", 200.0)

    result = get_portfolio(conn)
    assert result["cash_balance"] == pytest.approx(10000.0 - 1900.0)
    assert len(result["positions"]) == 1
    position = result["positions"][0]
    assert position["ticker"] == "AAPL"
    assert position["current_price"] == pytest.approx(200.0)
    assert position["market_value"] == pytest.approx(2000.0)
    assert position["unrealized_pnl"] == pytest.approx(100.0)
    assert position["unrealized_pnl_percent"] == pytest.approx(round((100.0 / 1900.0) * 100, 4))
    assert result["total_value"] == pytest.approx((10000.0 - 1900.0) + 2000.0)
    assert result["total_unrealized_pnl"] == pytest.approx(100.0)


def test_concurrent_buys_do_not_overspend_cash(db_path):
    """Two threads each buying $6,000 worth of AAPL (price 190) against a
    $10,000 cash balance must not both succeed — only one can afford it."""

    results: list[str] = []
    errors: list[Exception] = []

    def worker():
        with get_connection(db_path) as thread_conn:
            try:
                execute_trade(thread_conn, "AAPL", "buy", 31)  # 31 * 190 = 5890
                results.append("ok")
            except DomainError as exc:
                errors.append(exc)

    threads = [threading.Thread(target=worker) for _ in range(2)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert len(results) == 1
    assert len(errors) == 1
    assert errors[0].error_code == "insufficient_cash"

    with get_connection(db_path) as check_conn:
        cash = db.get_cash_balance(check_conn)
    assert cash == pytest.approx(10000.0 - 5890.0)
