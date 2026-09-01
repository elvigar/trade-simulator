"""End-to-end tests for POST /api/chat against the real app (real DB init,
real SimulatorDataSource) via tests/api/conftest.py's `client` fixture.

LLM_MOCK=true is set for all tests here except the llm_unavailable case, so
these exercise app.llm.mock's documented fixtures end-to-end through the
real trade/watchlist services.
"""

import pytest


@pytest.fixture(autouse=True)
def llm_mock_mode(monkeypatch):
    monkeypatch.setenv("LLM_MOCK", "true")


def test_chat_rejects_empty_message(client):
    response = client.post("/api/chat", json={"message": "   "})
    assert response.status_code == 400
    assert response.json()["error_code"] == "invalid_request"


def test_chat_portfolio_question_has_no_actions(client):
    response = client.post("/api/chat", json={"message": "how is my portfolio doing?"})
    assert response.status_code == 200
    body = response.json()
    assert body["trades_requested"] == []
    assert body["watchlist_changes_requested"] == []
    assert body["action_results"] == []
    assert body["message"]


def test_chat_buy_trade_executes_and_updates_portfolio(client):
    response = client.post("/api/chat", json={"message": "please buy 10 shares of aapl"})
    assert response.status_code == 200
    body = response.json()
    assert body["trades_requested"] == [{"ticker": "AAPL", "side": "buy", "quantity": 10}]
    assert len(body["action_results"]) == 1
    result = body["action_results"][0]
    assert result["type"] == "trade"
    assert result["status"] == "ok"
    assert result["detail"]["ticker"] == "AAPL"

    portfolio = client.get("/api/portfolio").json()
    assert portfolio["cash_balance"] < 10000.0
    assert any(p["ticker"] == "AAPL" for p in portfolio["positions"])


def test_chat_sell_without_position_returns_error_result(client):
    response = client.post("/api/chat", json={"message": "sell some aapl please"})
    assert response.status_code == 200
    result = response.json()["action_results"][0]
    assert result["type"] == "trade"
    assert result["status"] == "error"
    assert result["error_code"] == "insufficient_shares"


def test_chat_watchlist_add(client):
    response = client.post("/api/chat", json={"message": "add pypl to my watchlist"})
    assert response.status_code == 200
    body = response.json()
    assert body["watchlist_changes_requested"] == [{"ticker": "PYPL", "action": "add"}]
    result = body["action_results"][0]
    assert result["type"] == "watchlist"
    assert result["status"] == "ok"

    watchlist = client.get("/api/watchlist").json()["watchlist"]
    assert any(item["ticker"] == "PYPL" for item in watchlist)


def test_chat_insufficient_cash_fixture_produces_error_result(client):
    response = client.post("/api/chat", json={"message": "run an insufficient cash scenario"})
    assert response.status_code == 200
    result = response.json()["action_results"][0]
    assert result["status"] == "error"
    assert result["error_code"] == "insufficient_cash"


def test_chat_persists_messages_for_later_turns(client):
    first = client.post("/api/chat", json={"message": "add pypl to my watchlist"})
    assert first.status_code == 200
    second = client.post("/api/chat", json={"message": "how is my portfolio doing?"})
    assert second.status_code == 200
    assert second.json()["action_results"] == []


def test_chat_llm_unavailable_without_mock_or_key(client, monkeypatch):
    monkeypatch.setenv("LLM_MOCK", "false")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    response = client.post("/api/chat", json={"message": "hello"})

    assert response.status_code == 503
    assert response.json()["error_code"] == "llm_unavailable"
