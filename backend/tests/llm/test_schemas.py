import pytest
from pydantic import ValidationError

from app.llm.schemas import ChatResponse, LLMChatResponse, TradeAction, WatchlistChangeAction


def test_llm_chat_response_defaults_to_empty_actions():
    response = LLMChatResponse(message="hello")
    assert response.trades == []
    assert response.watchlist_changes == []


def test_trade_action_rejects_invalid_side():
    with pytest.raises(ValidationError):
        TradeAction(ticker="AAPL", side="short", quantity=1)


def test_watchlist_change_rejects_invalid_action():
    with pytest.raises(ValidationError):
        WatchlistChangeAction(ticker="AAPL", action="delete")


def test_llm_chat_response_parses_valid_json():
    parsed = LLMChatResponse.model_validate_json(
        '{"message": "ok", "trades": [{"ticker": "AAPL", "side": "buy", "quantity": 10}], '
        '"watchlist_changes": []}'
    )
    assert parsed.trades[0].ticker == "AAPL"
    assert parsed.trades[0].quantity == 10


def test_llm_chat_response_rejects_malformed_json():
    with pytest.raises(ValidationError):
        LLMChatResponse.model_validate_json("{not valid json")


def test_llm_chat_response_rejects_missing_required_field():
    with pytest.raises(ValidationError):
        LLMChatResponse.model_validate_json('{"trades": []}')


def test_chat_response_round_trips_action_result_shape():
    response = ChatResponse(
        message="hi",
        trades_requested=[TradeAction(ticker="AAPL", side="buy", quantity=1)],
        watchlist_changes_requested=[],
        action_results=[
            {
                "type": "trade",
                "request": {"ticker": "AAPL", "side": "buy", "quantity": 1},
                "status": "ok",
                "detail": {"id": "t1"},
            }
        ],
    )
    dumped = response.model_dump()
    assert dumped["action_results"][0]["status"] == "ok"
    assert dumped["action_results"][0]["error_code"] is None
