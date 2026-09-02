import pytest

from app.llm.mock import get_mock_response
from app.llm.schemas import TradeAction, WatchlistChangeAction


def test_buy_trigger():
    response = get_mock_response("please buy some apple stock")
    assert response.watchlist_changes == []
    assert response.trades == [TradeAction(ticker="AAPL", side="buy", quantity=10)]


def test_sell_trigger():
    response = get_mock_response("I want to sell my position")
    assert response.trades[0].ticker == "AAPL"
    assert response.trades[0].side == "sell"
    assert response.trades[0].quantity == 5


def test_insufficient_trigger_takes_priority_over_buy():
    response = get_mock_response("run an insufficient cash buy scenario")
    assert response.trades[0].ticker == "NVDA"
    assert response.trades[0].quantity == 100000
    assert response.trades[0].side == "buy"


def test_watchlist_trigger():
    response = get_mock_response("add pypl to my watchlist please")
    assert response.trades == []
    assert response.watchlist_changes == [WatchlistChangeAction(ticker="PYPL", action="add")]


@pytest.mark.parametrize(
    "prompt",
    ["how is my portfolio doing?", "what's my biggest risk?", "hello there"],
)
def test_default_fixture_has_no_actions(prompt):
    response = get_mock_response(prompt)
    assert response.trades == []
    assert response.watchlist_changes == []
    assert response.message
