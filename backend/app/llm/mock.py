"""Deterministic mock LLM responses for LLM_MOCK=true.

(PLAN.md section 9 -> "LLM Mock Mode"; DECISIONS.md -> "Testing".)

Trigger rules — checked in the order below against the incoming user
message, case-insensitive substring match, first match wins. This mapping
is the contract the integration-tester's E2E scenarios drive off of:

    1. "insufficient" -> oversized buy: 100,000 shares of NVDA. Real cash is
       $10,000 at signup, so executing this for real fails with
       insufficient_cash — this fixture exists specifically to exercise
       that action_results error path, not to represent a plausible trade.
    2. "sell"          -> sell 5 shares of AAPL
    3. "buy"           -> buy 10 shares of AAPL
    4. "watchlist"     -> add PYPL to the watchlist
    5. (no match)      -> portfolio-question response: analysis text only,
                          no trades/watchlist_changes

Only these five fixtures are supported; any prompt not matching rules 1-4
falls through to the portfolio-question fixture (rule 5).
"""

from __future__ import annotations

from .schemas import LLMChatResponse, TradeAction, WatchlistChangeAction

_INSUFFICIENT_CASH_RESPONSE = LLMChatResponse(
    message="Buying 100,000 shares of NVDA as requested.",
    trades=[TradeAction(ticker="NVDA", side="buy", quantity=100000)],
)

_SELL_RESPONSE = LLMChatResponse(
    message="Selling 5 shares of AAPL.",
    trades=[TradeAction(ticker="AAPL", side="sell", quantity=5)],
)

_BUY_RESPONSE = LLMChatResponse(
    message="Buying 10 shares of AAPL.",
    trades=[TradeAction(ticker="AAPL", side="buy", quantity=10)],
)

_WATCHLIST_ADD_RESPONSE = LLMChatResponse(
    message="Added PYPL to your watchlist.",
    watchlist_changes=[WatchlistChangeAction(ticker="PYPL", action="add")],
)

_PORTFOLIO_QUESTION_RESPONSE = LLMChatResponse(
    message=(
        "Your portfolio looks reasonably diversified with no single position "
        "dominating risk right now. Let me know if you'd like a trade or "
        "watchlist change."
    ),
)


def get_mock_response(user_message: str) -> LLMChatResponse:
    """Return the fixture matching `user_message` per the trigger rules
    documented in this module's docstring."""
    lowered = user_message.lower()
    if "insufficient" in lowered:
        return _INSUFFICIENT_CASH_RESPONSE
    if "sell" in lowered:
        return _SELL_RESPONSE
    if "buy" in lowered:
        return _BUY_RESPONSE
    if "watchlist" in lowered:
        return _WATCHLIST_ADD_RESPONSE
    return _PORTFOLIO_QUESTION_RESPONSE
