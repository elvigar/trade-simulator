# Implementation Decisions

This file resolves the open questions in `PLAN.md` so the team can build in
parallel without blocking on each other. It is the shared contract — read it
before writing code that touches another team member's area. If you need to
deviate, update this file first and say why.

## Team & ownership

| Area | Owner | Paths |
|---|---|---|
| Database | database-engineer | `backend/app/db/`, `backend/db/` (if any raw SQL files), `backend/tests/test_db*` |
| Backend API | backend-engineer | `backend/app/main.py`, `backend/app/portfolio/`, `backend/app/watchlist/`, `backend/app/api/` (except `chat.py`), static file serving |
| LLM / Chat | llm-engineer | `backend/app/llm/`, `backend/app/api/chat.py` (backend-engineer only adds one `include_router` line for it) |
| Frontend | frontend-engineer | `frontend/` (entire directory, self-contained) |
| DevOps | devops-engineer | `Dockerfile`, `scripts/`, `.env.example`, `.gitignore` additions, `db/.gitkeep`, `test/docker-compose.test.yml` skeleton |
| E2E tests | integration-tester | `test/*.spec.ts` and supporting Playwright config/fixtures |

Market data (`backend/app/market/`) is already built — do not modify it except
to fix a bug you discover, and flag that in your handoff if you do.

## Market data universe & price availability

- The set of tickers with live prices is **watchlist ∪ open positions**. When
  a ticker is added to the watchlist or traded for the first time, call
  `await market_source.add_ticker(ticker)` before reading its price.
- When removing a ticker from the watchlist, **do not** call
  `market_source.remove_ticker()` if the user still holds an open position in
  it — the position still needs live pricing for portfolio valuation. Only
  remove from the data source when neither the watchlist nor any open
  position references the ticker.
- After registering a new ticker, poll `price_cache.get(ticker)` for up to
  ~1s (e.g. 10 attempts, 100ms apart) waiting for the first price. If still
  unavailable, return `503` with `{"error_code": "price_unavailable", "message": "..."}`
  — retryable by the client.
- Trades are not restricted to tickers on the watchlist; any valid ticker
  symbol can be traded directly.

## Ticker validation

- Normalize: trim whitespace, uppercase.
- Accept `^[A-Z][A-Z0-9.]{0,9}$` (covers symbols like `BRK.B`).
- Unknown symbols may enter the watchlist before the provider confirms them
  — the simulator/Massive client is responsible for producing *some* price
  once registered (a fallback base price if not in the simulator's seed
  table is the market-data layer's concern, not the API layer's).

## Money, precision, and rounding

- Fractional shares are supported (schema already specifies `REAL`).
  Quantity must be `> 0`, max 6 decimal places.
- No short selling: a sell's quantity must not exceed the currently held
  quantity for that ticker.
- Use Python `Decimal` for all arithmetic during trade execution (cash
  delta, average cost, position value). Round money to 2 decimal places
  (`ROUND_HALF_EVEN`) before converting to `float` for storage/JSON.
- If a sell reduces a position's quantity to ~0 (within `1e-9`), delete the
  position row rather than keeping a zero-quantity row.
- Realized P&L is intentionally not tracked in v1 (per plan). Only
  unrealized P&L (current price vs. avg cost) is shown.
- `total_value` = `cash_balance` + sum(`quantity * current_price`) across
  open positions.

## Trade execution: atomicity & concurrency

- Each trade (manual or LLM-issued) runs inside a single SQLite transaction
  (`BEGIN IMMEDIATE`) that updates `users_profile.cash_balance`, upserts the
  `positions` row, inserts a `trades` row, and inserts a `portfolio_snapshots`
  row — all committed together, or rolled back together on any failure.
- A process-wide `threading.Lock` serializes trade execution (manual
  endpoint and LLM-issued trades both go through the same lock) so
  concurrent requests cannot overspend cash or oversell a position.
- API routes that touch the database are plain `def` (not `async def`) so
  Starlette runs them in its threadpool; this keeps SQLite usage simple
  (one connection per call, WAL mode) without an async driver.
- LLM action batches execute **sequentially, not all-or-nothing**: each
  trade/watchlist change in the array is validated and executed
  independently through the exact same service functions manual requests
  use. Collect a per-action result; one failure does not block the rest.

## Trade / watchlist service contract (binding — backend-engineer implements exactly this)

To let the llm-engineer build against a real contract instead of waiting on
the backend-engineer, and so both manual and AI-issued actions provably go
through identical validation, the backend-engineer must expose:

```python
# backend/app/errors.py
class DomainError(Exception):
    """Raised by service functions on any validation/domain failure.
    Never let a raw exception escape a service function — every failure
    mode maps to one of these."""
    def __init__(self, error_code: str, message: str, status_code: int): ...
    # error_code/status_code values come from the "API error shape" table below.

# backend/app/portfolio/service.py
def execute_trade(conn, ticker: str, side: str, quantity: float, user_id=DEFAULT_USER_ID) -> dict:
    """Full trade execution against an OPEN connection the caller commits:
    normalizes/validates ticker and quantity, registers the ticker with the
    market data source if not already tracked and waits for a price (raises
    DomainError("price_unavailable", ..., 503) if none appears), computes
    the cash/position delta with Decimal per the Money section, and performs
    the DB writes (update_cash_balance, upsert_position, insert_trade,
    insert_snapshot) — all inside one BEGIN IMMEDIATE transaction guarded by
    db.TRADE_LOCK. Caller (route handler or llm-engineer's action executor)
    opens the connection, calls this, commits on success / the DomainError
    propagates on failure (connection context manager rolls back).
    Returns the inserted trade record dict on success."""

# backend/app/watchlist/service.py
def add_watchlisted_ticker(conn, ticker: str, user_id=DEFAULT_USER_ID) -> dict:
    """Normalizes ticker, registers it with the market source (waits for a
    price the same way execute_trade does), inserts the watchlist row.
    Raises DomainError("duplicate_ticker", ..., 409) on duplicate."""

def remove_watchlisted_ticker(conn, ticker: str, user_id=DEFAULT_USER_ID) -> dict:
    """Removes the watchlist row. Raises DomainError("not_found", ..., 404)
    if not present. Only calls market_source.remove_ticker() if the ticker
    is not held as an open position (check db.get_position first)."""
```

- Both service modules need a reference to the running `market_source`
  instance (module-level singleton set at app startup, or passed in —
  backend-engineer's call) to register tickers and wait for prices.
- **Sync/async bridge**: these service functions are plain `def` (per the
  "DB-touching routes are plain def" rule), but `market_source.add_ticker`/
  `remove_ticker` are `async def`. Bridge with `asyncio.run(...)` inside the
  service function — threadpool worker threads have no running event loop,
  so this is safe and simple. Don't make the service functions `async def`.
- Route handlers (`POST /api/portfolio/trade`, `POST/DELETE /api/watchlist`)
  and the llm-engineer's chat action executor both call these exact
  functions and catch `DomainError` to build their response (HTTP error body
  for routes, one `action_results` entry for chat).

## Chat response contract

Backend returns to the frontend:

```json
{
  "message": "conversational text from the LLM",
  "trades_requested": [{"ticker": "AAPL", "side": "buy", "quantity": 10}],
  "watchlist_changes_requested": [{"ticker": "PYPL", "action": "add"}],
  "action_results": [
    {"type": "trade", "request": {"ticker": "AAPL", "side": "buy", "quantity": 10},
     "status": "ok", "detail": {"...trade record..."}},
    {"type": "watchlist", "request": {"ticker": "PYPL", "action": "add"},
     "status": "error", "error_code": "duplicate_ticker", "detail": "..."}
  ]
}
```

- No second LLM call to reconcile failures — the frontend renders
  `action_results` as authoritative inline confirmations/errors,
  independent of what `message` says.
- AI authorization: the model decides per-turn whether to include
  trades/watchlist changes based on the full conversation history already
  in its context (loaded per plan section 9). No extra state machine for
  "do it" resolution in v1 — that's handled naturally by including recent
  chat history in the prompt.
- If the LLM backend is unavailable (no usable API key and `LLM_MOCK` is not
  `true`), `/api/chat` returns `503 {"error_code": "llm_unavailable", "message": "..."}`.
  The app still starts and every other feature works — chat is a soft
  dependency, not a startup requirement. `/api/health` reflects process
  liveness + DB readiness only, not LLM availability.

## Environment variables

- Standardize on **`OPENAI_API_KEY`** as the single LLM credential for this
  project (this supersedes an earlier decision to standardize on
  `OPENROUTER_API_KEY`, per `cerebras-inference` skill). The call still goes
  through LiteLLM to OpenRouter/Cerebras (`openrouter/openai/gpt-oss-120b`),
  but since LiteLLM's `openrouter/` model prefix normally authenticates via
  `OPENROUTER_API_KEY`, the code must read `OPENAI_API_KEY` and pass it
  explicitly as the `api_key` argument to `completion()` rather than relying
  on LiteLLM's default env lookup. `MASSIVE_API_KEY` (market data) is a
  separate, unrelated key and is unaffected by this.
- `LLM_MOCK=true` bypasses the LLM call entirely with deterministic fixture
  responses (see LLM engineer brief) — no network call, no key required.

## Docker persistence

- Use a **bind mount** of the repo's top-level `db/` directory to `/app/db`
  in the container (matches the directory-structure section, simpler for
  local dev than a named volume): `docker run -v "$(pwd)/db:/app/db" ...`.
- The backend writes `db/finally.db` relative to that mounted path.

## Database initialization

- Lazy init at FastAPI startup (not first-request): on app startup, create
  any missing tables and seed default data if `users_profile` is empty.
  This is a brand-new project with no existing deployments, so no versioned
  migration system is needed for v1 — if the schema changes before launch,
  deleting the dev `db/finally.db` is an acceptable reset.

## Portfolio snapshots

- Insert one row on every executed trade, plus one row every 30s from a
  background task (only while the app has been running — no catch-up
  writes). No retention/downsampling policy for v1; this is an
  intentional simplification acceptable at course scope, not an oversight.
- Seed one initial snapshot (`total_value = 10000.0`) at first DB init so
  the P&L chart has a baseline point before any trade happens.

## Price metrics semantics

- `PriceUpdate.change` / `change_percent` (in `app/market/`) are tick-over-tick
  (vs. the previous update), already implemented — do not change.
- **Watchlist "daily change %"**: the backend tracks, per ticker, the first
  price observed since the process started (a `session_open_prices: dict[str, float]`
  populated on first cache read per ticker) and computes
  `(current - session_open) / session_open * 100`. This is a session-since-launch
  proxy, not a real market-session open — acceptable for a simulator-driven
  demo; document it as such in code.
- **Positions table "% change"**: unrealized-gain percentage relative to
  cost basis — `(current_price - avg_cost) / avg_cost * 100` — not the
  daily change.

## API error shape

All domain errors return `{"error_code": "...", "message": "human readable"}`.

| Status | error_code | When |
|---|---|---|
| 400 | `invalid_request` | Malformed body, bad ticker syntax, non-positive quantity |
| 404 | `not_found` | DELETE watchlist ticker not present, sell with no position |
| 409 | `duplicate_ticker` | POST watchlist ticker already present |
| 422 | `insufficient_cash` / `insufficient_shares` | Trade fails domain validation |
| 503 | `price_unavailable` | No price available after registering ticker |
| 503 | `llm_unavailable` | Chat called without a usable LLM backend |

## Frontend / static serving

- This is a **true single page** — no client-side routes. FastAPI serves
  `frontend`'s static export at `/`; no SPA catch-all fallback is needed
  beyond normal static file serving. `/api/*` paths are handled entirely by
  API routers and never fall through to static files (mount the API routers
  before the static file mount, or use a path prefix that can't collide).
- Charting library: **Recharts** (SVG-based). The plan's "canvas-based
  preferred" note is stale — Recharts is the pick; performance is fine at
  this data scale (10 tickers, ~2 updates/sec).
- Dev workflow: run the Next.js dev server against the backend on `:8000`
  via a `next.config.js` rewrite/proxy (`/api/*` → `http://localhost:8000/api/*`)
  for local development; the production build is the static export served
  by FastAPI on the same origin as described in the plan.

## Testing

- `LLM_MOCK=true` fixtures should cover at least: a portfolio-question
  prompt (no actions), a buy-trade prompt, a sell-trade prompt, a
  watchlist-add prompt, and an insufficient-cash prompt (to exercise
  `action_results` error rendering). Keep the fixture set small and
  documented in the LLM engineer's module so E2E tests can rely on it.
- Integration tester runs the app via `uv run uvicorn` (backend) +
  built frontend export, or the full Docker image, whichever is faster to
  iterate on — Docker Compose E2E harness is the final gate before calling
  the project done.
