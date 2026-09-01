"""AI chat assistant integration (PLAN.md section 9).

Submodules:
    schemas  - Pydantic models for the LLM structured output and the
               /api/chat request/response contract
    context  - portfolio + chat history summarization for the prompt
    prompts  - system prompt and message assembly
    client   - the actual LLM call (LiteLLM/OpenRouter/Cerebras), plus
               LLM_MOCK bypass
    mock     - deterministic fixture responses for LLM_MOCK=true
    actions  - executes LLM-requested trades/watchlist changes via
               app.portfolio.service / app.watchlist.service

Kept import-light: only `actions` (and `app.api.chat`, which uses it) reach
into app.errors / app.portfolio.service / app.watchlist.service.
"""
