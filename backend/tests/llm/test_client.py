from types import SimpleNamespace

import pytest

from app.llm import client
from app.llm.client import LLMResponseError, LLMUnavailableError, get_llm_response


def _fake_completion(content: str):
    def _completion(**kwargs):
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])

    return _completion


def test_mock_mode_bypasses_network_entirely(monkeypatch):
    monkeypatch.setenv("LLM_MOCK", "true")

    def _boom(**kwargs):
        raise AssertionError("completion() should not be called when LLM_MOCK=true")

    monkeypatch.setattr(client, "completion", _boom)

    response = get_llm_response(messages=[], user_message="buy 10 aapl")

    assert response.trades[0].ticker == "AAPL"


def test_raises_unavailable_without_key_or_mock(monkeypatch):
    monkeypatch.delenv("LLM_MOCK", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    with pytest.raises(LLMUnavailableError):
        get_llm_response(messages=[{"role": "user", "content": "hi"}], user_message="hi")


def test_parses_valid_structured_response(monkeypatch):
    monkeypatch.delenv("LLM_MOCK", raising=False)
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setattr(
        client,
        "completion",
        _fake_completion('{"message": "hi there", "trades": [], "watchlist_changes": []}'),
    )

    response = get_llm_response(messages=[{"role": "user", "content": "hi"}], user_message="hi")

    assert response.message == "hi there"


def test_raises_llm_response_error_on_malformed_json(monkeypatch):
    monkeypatch.delenv("LLM_MOCK", raising=False)
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setattr(client, "completion", _fake_completion("not json at all"))

    with pytest.raises(LLMResponseError):
        get_llm_response(messages=[{"role": "user", "content": "hi"}], user_message="hi")


def test_raises_llm_response_error_on_missing_required_field(monkeypatch):
    monkeypatch.delenv("LLM_MOCK", raising=False)
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setattr(client, "completion", _fake_completion('{"trades": []}'))

    with pytest.raises(LLMResponseError):
        get_llm_response(messages=[{"role": "user", "content": "hi"}], user_message="hi")
