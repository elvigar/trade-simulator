"""LLM call wrapper: LiteLLM via OpenRouter with Cerebras as the inference
provider (see the `cerebras-inference` skill), plus the LLM_MOCK bypass.
"""

from __future__ import annotations

import os

from dotenv import load_dotenv
from litellm import completion
from pydantic import ValidationError

from . import mock
from .schemas import LLMChatResponse

load_dotenv()

MODEL = "openrouter/openai/gpt-oss-120b"
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}


class LLMUnavailableError(Exception):
    """No usable LLM backend: LLM_MOCK is not true and OPENAI_API_KEY is unset."""


class LLMResponseError(Exception):
    """The LLM backend returned a response that didn't parse as LLMChatResponse."""


def _mock_enabled() -> bool:
    return os.environ.get("LLM_MOCK", "").strip().lower() == "true"


def get_llm_response(messages: list[dict[str, str]], user_message: str) -> LLMChatResponse:
    """Return a structured LLMChatResponse for the given conversation.

    Bypasses the network entirely when LLM_MOCK=true, matching
    `user_message` against the fixtures in `mock.py`. Otherwise calls
    Cerebras via OpenRouter/LiteLLM with structured outputs.

    Raises LLMUnavailableError if LLM_MOCK isn't true and OPENAI_API_KEY
    is unset/empty, and LLMResponseError if the model's response doesn't
    parse against the schema.
    """
    if _mock_enabled():
        return mock.get_mock_response(user_message)

    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise LLMUnavailableError("OPENAI_API_KEY is not set and LLM_MOCK is not true")

    try:
        response = completion(
            model=MODEL,
            messages=messages,
            response_format=LLMChatResponse,
            reasoning_effort="low",
            extra_body=EXTRA_BODY,
            api_key=api_key,
        )
    except Exception as exc:
        raise LLMUnavailableError(f"LLM request failed: {type(exc).__name__}") from exc

    try:
        content = response.choices[0].message.content
    except (AttributeError, IndexError, TypeError) as exc:
        raise LLMResponseError("LLM response did not include message content") from exc
    if not isinstance(content, str):
        raise LLMResponseError("LLM response content was not text")

    try:
        return LLMChatResponse.model_validate_json(content)
    except ValidationError as exc:
        raise LLMResponseError(f"LLM response did not match schema: {exc}") from exc
