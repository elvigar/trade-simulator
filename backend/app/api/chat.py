"""POST /api/chat — the FinAlly AI trading assistant endpoint (PLAN.md
section 9, DECISIONS.md -> "Chat response contract").

Owned by the llm-engineer. Wiring for `app.main` is a single line:
`app.include_router(router)` — `state.price_cache` / `state.market_source`
are read at call time via `app.state`, same pattern as `app.api.portfolio`
and `app.api.watchlist`.
"""

from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app import db, state
from app.llm import actions, context, prompts
from app.llm.client import LLMResponseError, LLMUnavailableError, get_llm_response
from app.llm.schemas import ChatRequestBody, ChatResponse

router = APIRouter(prefix="/api", tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
def post_chat_route(payload: ChatRequestBody) -> ChatResponse | JSONResponse:
    message = payload.message.strip()
    if not message:
        return JSONResponse(
            status_code=400,
            content={"error_code": "invalid_request", "message": "message must not be empty"},
        )

    with db.get_connection() as conn:
        history = context.build_history_messages(conn)
        portfolio_context = context.build_portfolio_context(conn, state.price_cache)
        db.insert_chat_message(conn, role="user", content=message, actions=None)
        conn.commit()

    llm_messages = prompts.build_messages(portfolio_context, history, message)

    try:
        llm_response = get_llm_response(llm_messages, message)
    except LLMUnavailableError as exc:
        return JSONResponse(
            status_code=503, content={"error_code": "llm_unavailable", "message": str(exc)}
        )
    except LLMResponseError as exc:
        return JSONResponse(
            status_code=502, content={"error_code": "llm_error", "message": str(exc)}
        )

    action_results = actions.execute_actions(llm_response.trades, llm_response.watchlist_changes)

    response = ChatResponse(
        message=llm_response.message,
        trades_requested=llm_response.trades,
        watchlist_changes_requested=llm_response.watchlist_changes,
        action_results=action_results,
    )

    with db.get_connection() as conn:
        db.insert_chat_message(
            conn,
            role="assistant",
            content=llm_response.message,
            actions=response.model_dump_json(
                include={"trades_requested", "watchlist_changes_requested", "action_results"}
            ),
        )
        conn.commit()

    return response
