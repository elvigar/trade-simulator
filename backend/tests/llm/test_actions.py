"""Unit tests for the action executor. `execute_trade` /
`add_watchlisted_ticker` / `remove_watchlisted_ticker` are mocked here
because they have their own dedicated test suites (tests/portfolio,
tests/watchlist) — these tests verify only that `actions.py` calls them
with the right arguments and maps success/DomainError into ActionResult
correctly, including running the full batch sequentially rather than
stopping at the first failure.
"""

from unittest.mock import patch

import pytest

from app.errors import DomainError
from app.llm import actions
from app.llm.schemas import TradeAction, WatchlistChangeAction


@pytest.fixture(autouse=True)
def isolate_db_path(monkeypatch, tmp_path):
    """execute_trade/add_watchlisted_ticker are mocked below, but
    `db.get_connection()` itself still opens a real sqlite file at whatever
    FINALLY_DB_PATH resolves to — point it at a temp file so these tests
    never touch the dev database."""
    monkeypatch.setenv("FINALLY_DB_PATH", str(tmp_path / "actions-test.db"))


def test_trade_success_produces_ok_result():
    with patch(
        "app.llm.actions.execute_trade", return_value={"id": "t1", "ticker": "AAPL"}
    ) as mock_exec:
        results = actions.execute_actions([TradeAction(ticker="AAPL", side="buy", quantity=1)], [])

    assert len(results) == 1
    assert results[0].type == "trade"
    assert results[0].status == "ok"
    assert results[0].detail == {"id": "t1", "ticker": "AAPL"}
    assert results[0].error_code is None
    mock_exec.assert_called_once()
    args = mock_exec.call_args.args
    assert args[1:] == ("AAPL", "buy", 1)


def test_trade_domain_error_produces_error_result():
    with patch(
        "app.llm.actions.execute_trade",
        side_effect=DomainError("insufficient_cash", "not enough cash", 422),
    ):
        results = actions.execute_actions(
            [TradeAction(ticker="AAPL", side="buy", quantity=999999)], []
        )

    assert results[0].status == "error"
    assert results[0].error_code == "insufficient_cash"
    assert results[0].detail == "not enough cash"


def test_watchlist_add_and_remove_success():
    with patch("app.llm.actions.add_watchlisted_ticker", return_value={"ticker": "PYPL"}):
        results = actions.execute_actions([], [WatchlistChangeAction(ticker="PYPL", action="add")])
    assert results[0].type == "watchlist"
    assert results[0].status == "ok"

    with patch("app.llm.actions.remove_watchlisted_ticker", return_value={"ticker": "PYPL"}):
        results = actions.execute_actions(
            [], [WatchlistChangeAction(ticker="PYPL", action="remove")]
        )
    assert results[0].status == "ok"


def test_watchlist_domain_error_produces_error_result():
    with patch(
        "app.llm.actions.add_watchlisted_ticker",
        side_effect=DomainError("duplicate_ticker", "already watched", 409),
    ):
        results = actions.execute_actions([], [WatchlistChangeAction(ticker="AAPL", action="add")])

    assert results[0].status == "error"
    assert results[0].error_code == "duplicate_ticker"


def test_batch_runs_sequentially_not_all_or_nothing():
    with patch(
        "app.llm.actions.execute_trade",
        side_effect=[DomainError("insufficient_cash", "no cash", 422), {"id": "t2"}],
    ):
        results = actions.execute_actions(
            [
                TradeAction(ticker="AAPL", side="buy", quantity=999999),
                TradeAction(ticker="MSFT", side="buy", quantity=1),
            ],
            [],
        )

    assert results[0].status == "error"
    assert results[1].status == "ok"
    assert results[1].detail == {"id": "t2"}


def test_trades_execute_before_watchlist_changes():
    with (
        patch("app.llm.actions.execute_trade", return_value={"id": "t1"}) as mock_trade,
        patch("app.llm.actions.add_watchlisted_ticker", return_value={"ticker": "PYPL"}) as mock_wl,
    ):
        results = actions.execute_actions(
            [TradeAction(ticker="AAPL", side="buy", quantity=1)],
            [WatchlistChangeAction(ticker="PYPL", action="add")],
        )

    assert [r.type for r in results] == ["trade", "watchlist"]
    mock_trade.assert_called_once()
    mock_wl.assert_called_once()
