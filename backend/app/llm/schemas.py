"""Pydantic schemas for the LLM structured output and the /api/chat contract.

`LLMChatResponse` is the schema requested from the model via structured
outputs (PLAN.md section 9). `ChatRequestBody` / `ChatResponse` /
`ActionResult` are the HTTP contract for POST /api/chat (DECISIONS.md ->
"Chat response contract").
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class TradeAction(BaseModel):
    """A single trade requested by the LLM."""

    ticker: str
    side: Literal["buy", "sell"]
    quantity: float


class WatchlistChangeAction(BaseModel):
    """A single watchlist modification requested by the LLM."""

    ticker: str
    action: Literal["add", "remove"]


class LLMChatResponse(BaseModel):
    """Structured output schema the LLM is asked to produce."""

    message: str
    trades: list[TradeAction] = Field(default_factory=list)
    watchlist_changes: list[WatchlistChangeAction] = Field(default_factory=list)


class ChatRequestBody(BaseModel):
    """POST /api/chat request body."""

    message: str


class ActionResult(BaseModel):
    """One entry in the chat response's `action_results` array."""

    type: Literal["trade", "watchlist"]
    request: dict[str, Any]
    status: Literal["ok", "error"]
    detail: Any = None
    error_code: str | None = None


class ChatResponse(BaseModel):
    """POST /api/chat response body (DECISIONS.md -> "Chat response contract")."""

    message: str
    trades_requested: list[TradeAction]
    watchlist_changes_requested: list[WatchlistChangeAction]
    action_results: list[ActionResult]
