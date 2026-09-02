# FinAlly — Technical Design

This document describes how FinAlly is actually built: the runtime architecture, the backend's
internal modules, the frontend's data flow, and the deployment shape. It reflects the code in
this repository, not just the plan it was built from — see `planning/PLAN.md` for the original
product spec and `planning/DECISIONS.md` for the design decisions that resolved ambiguities in
that spec across the agents that built each subsystem.

## 1. Runtime shape

One Docker container, one process, one port.

```
┌───────────────────────────────────────────────────────────────┐
│ Container (port 8000)                                         │
│                                                                 │
│  uvicorn → FastAPI app (backend/app/main.py)                   │
│    ├── /api/*            REST routers (health/portfolio/       │
│    │                      watchlist/chat)                      │
│    ├── /api/stream/prices  SSE endpoint                        │
│    └── /*                 StaticFiles mount → Next.js export   │
│                                                                 │
│  In-process background tasks (asyncio, same event loop):       │
│    ├── market data source (simulator or Massive poller)        │
│    └── 30s portfolio-snapshot loop                              │
│                                                                 │
│  SQLite file at db/finally.db (bind-mounted volume)             │
└───────────────────────────────────────────────────────────────┘
```

There is no separate frontend server and no message broker. The Next.js app is built once (as a
static export) at Docker image build time and served as static files by the same FastAPI process
that serves the API — one origin, no CORS. The frontend never talks to anything but `same-origin
/api/*`.

## 2. Backend

### 2.1 App wiring and lifecycle (`backend/app/main.py`)

`app = FastAPI(title="FinAlly", lifespan=lifespan)`. The `lifespan` async context manager is
where everything gets wired up on startup:

1. `db.init_db()` — creates tables and seeds default data if missing (idempotent, safe to call
   every boot).
2. `create_market_data_source(state.price_cache)` builds either the simulator or the Massive
   client (see §2.3) and stores it on the module-level `state.market_source` singleton, then
   `await market_source.start(initial_tickers)` where `initial_tickers` is the union of the
   current watchlist and any open positions (per `DECISIONS.md` — the "market data universe").
3. An `asyncio.create_task` starts `_snapshot_loop()`, which sleeps 30s, computes total portfolio
   value, and inserts a `portfolio_snapshots` row, forever, until cancelled on shutdown.
4. On shutdown (the `finally` block), the snapshot task is cancelled and awaited, then
   `market_source.stop()` is called.

Two process-wide singletons live in `backend/app/state.py`: `price_cache: PriceCache` (created
eagerly, valid immediately) and `market_source: MarketDataSource | None` (only becomes non-`None`
once `lifespan` runs). Every module that needs either reads `state.price_cache` /
`state.market_source` at call time via `from app import state` — never `from app.state import
market_source`, since that would bind the pre-startup `None`.

Errors: every service function raises `app.errors.DomainError(error_code, message, status_code)`
instead of a raw exception. `main.py` registers one global `@app.exception_handler(DomainError)`
that converts it into `{"error_code": ..., "message": ...}` at the right status code, plus a
handler for FastAPI's own `RequestValidationError` (mapped to 400 `invalid_request`). Route
handlers therefore never do their own try/except for domain failures — they just let
`DomainError` propagate.

Routing order matters: API routers (`health`, `portfolio`, `watchlist`, the SSE stream router,
and `chat` if importable) are all registered with `app.include_router()` *before* the
`StaticFiles` mount at `/`, so `/api/*` can never fall through to the static file handler. The
chat router is imported inside a `try/except ImportError` so the app still starts (missing chat
route, but everything else intact) if the `llm` package or its dependencies aren't present — chat
is a soft dependency by design (see §2.5).

The static directory is resolved as `backend/static/` and only mounted `if STATIC_DIR.is_dir()`,
so the backend runs standalone (API only, no `/`) before the frontend has been built — useful for
backend-only development.

The DB path is computed defensively: `FINALLY_DB_PATH` env var wins if set; otherwise `main.py`
computes an absolute default from *its own file location* (`Path(__file__).resolve().parents[2]
/ "db" / "finally.db"`) rather than trusting the process's working directory, since uvicorn can
be launched from the repo root, from `backend/`, or from Docker's `/app/backend` — a
cwd-relative default would silently break depending on launch context.

### 2.2 Database (`backend/app/db/`)

SQLite, one file (`db/finally.db`), six tables, all keyed by a hardcoded `user_id = "default"`
(single-user today, schema-ready for multi-user later): `users_profile`, `watchlist`,
`positions`, `trades`, `portfolio_snapshots`, `chat_messages`. The schema in
`backend/app/db/schema.py` matches `PLAN.md` §7 exactly, plus three indexes
(`idx_trades_user`, `idx_snapshots_user`, `idx_chat_user`) all on `(user_id, timestamp-ish
column)` for the common "list mine, ordered by time" query pattern.

**Initialization is lazy and idempotent** (`db/init.py`): on every app startup, `init_db()` runs
every `CREATE TABLE IF NOT EXISTS` and index statement, then seeds the default user
($10,000 cash), the ten default watchlist tickers (from `market/seed_prices.py`), and one
baseline `portfolio_snapshots` row — but only if `users_profile` is currently empty. Calling it
twice never duplicates or wipes data. There is no migration system; per `DECISIONS.md`, that's an
accepted simplification for a pre-launch, single-deployment project.

**Connections** (`db/connection.py`): every call to `db.get_connection()` opens a *brand new*
`sqlite3.connect()` as a context manager — no pooling, no long-lived connection. Each connection
gets `row_factory = sqlite3.Row`, `PRAGMA foreign_keys = ON`, and (for on-disk paths)
`PRAGMA journal_mode = WAL`. Callers own the transaction boundary (`commit()`/`rollback()`); the
connection always closes on exit regardless. This is deliberately simple because API routes are
plain `def` (not `async def`) — FastAPI/Starlette runs sync route handlers in a threadpool, so
"one connection per call" avoids any need for an async SQLite driver or connection pool, at the
cost of a fresh `sqlite3.connect()` per request (acceptable at this scale).

**Concurrency control** (`db/locks.py`): SQLite's own locking isn't enough to prevent two
concurrent trade requests from both reading a stale cash balance and both succeeding when only
one should. `TRADE_LOCK = threading.Lock()` is a process-wide lock acquired around every
trade-writing transaction (`BEGIN IMMEDIATE` touching `cash_balance`, `positions`, `trades`,
`portfolio_snapshots`) — both the manual trade route and LLM-issued trades go through the same
lock, so they serialize against each other and can't overspend cash or oversell a position.

**Repository layer** (`db/repository.py`): thin, single-purpose functions — one read or write per
function, no transaction management, rows returned as plain `dict`s (JSON-serializable directly,
no `sqlite3.Row` leaking upward). Callers (the `portfolio`/`watchlist` service modules) compose
these inside their own `BEGIN IMMEDIATE`/`commit`/`rollback` boundary. Notably,
`upsert_position()` deletes the position row instead of writing a zero-quantity row whenever the
resulting quantity is within `1e-9` of zero — there are never stale zero-share position rows.

### 2.3 Market data (`backend/app/market/`)

An abstract `MarketDataSource` (`interface.py`) defines the lifecycle every provider implements:
`start(tickers)`, `stop()`, `add_ticker(ticker)`, `remove_ticker(ticker)`, `get_tickers()`.
Downstream code never queries a provider directly for a price — it always reads from the shared
`PriceCache`.

**`create_market_data_source()`** (`factory.py`) is the single decision point: if
`MASSIVE_API_KEY` is set and non-empty, it returns a `MassiveDataSource`; otherwise a
`SimulatorDataSource`. Nothing else in the codebase branches on this env var.

**`PriceCache`** (`cache.py`) is a `threading.Lock`-guarded `dict[str, PriceUpdate]` with a
monotonically increasing `version` counter bumped on every `update()`. `PriceUpdate`
(`models.py`) is a frozen dataclass (`ticker`, `price`, `previous_price`, `timestamp`) with
computed properties `change`, `change_percent`, and `direction` ("up"/"down"/"flat") — all derived
at read time, not stored.

**Simulator** (`simulator.py`) — `GBMSimulator` runs true geometric Brownian motion:
`S(t+dt) = S(t) * exp((mu - sigma²/2)·dt + sigma·sqrt(dt)·Z)`, stepped every 500ms with `dt ≈
8.48e-8` (500ms expressed as a fraction of a 252-day, 6.5h/day trading year). Per-ticker `mu`
(drift) and `sigma` (volatility) come from `seed_prices.TICKER_PARAMS` (e.g. TSLA `sigma=0.50`,
JPM `sigma=0.18`); unknown tickers fall back to `DEFAULT_PARAMS`. Correlated moves across tickers
are produced by drawing one independent standard-normal vector per tick and multiplying it by the
**Cholesky decomposition** of a correlation matrix built from sector grouping — tech stocks
correlate at 0.6, finance at 0.5, TSLA is pinned to 0.3 with everything ("does its own thing"),
cross-sector/unknown pairs are 0.3. The Cholesky matrix is rebuilt (O(n²), n < 50 so cheap)
whenever a ticker is added or removed. On top of the GBM step, each ticker independently has a
0.1%-per-tick chance of a ±2–5% "event" shock, for visible drama roughly every ~50 seconds across
a 10-ticker watchlist. `SimulatorDataSource` wraps this in an `asyncio.create_task` loop that
steps every `update_interval` (default 0.5s) and writes results into the shared `PriceCache`;
`start()` also seeds the cache immediately so SSE has data before the first tick.

**Massive client** (`massive_client.py`) — `MassiveDataSource` polls
`GET /v2/snapshot/locale/us/markets/stocks/tickers` for the full watched-ticker set in one call
via the `massive` (Polygon.io) REST SDK, on a configurable interval (default 15s, matched to the
free tier's 5 req/min limit). Since the SDK client is synchronous, each poll runs via
`asyncio.to_thread()` to avoid blocking the event loop; a failed poll is logged and swallowed
(next interval retries) rather than crashing the loop. Massive's millisecond Unix timestamps are
converted to seconds before writing to the cache, keeping `PriceUpdate.timestamp` uniform across
both providers.

**SSE endpoint** (`stream.py`, factory-created via `create_stream_router(price_cache)` so the
cache is injected rather than imported as a global) — `GET /api/stream/prices` returns a
`StreamingResponse` over an async generator. The generator first yields `retry: 1000\n\n` (tells
`EventSource` to retry after 1s on drop), then loops: check `request.is_disconnected()` (exits the
loop if the client is gone), compare `price_cache.version` against the last-seen version, and only
if it changed, serialize *all* current prices as one JSON object (`{ticker: PriceUpdate.to_dict(),
...}`) and `yield f"data: {payload}\n\n"`. Sleeps 0.5s between checks either way. This
version-counter check means an SSE tick is skipped entirely if nothing changed since the last one
— no redundant frames.

### 2.4 Portfolio & watchlist services

**Trade execution** (`portfolio/service.py::execute_trade`) is the single choke point both the
manual `POST /api/portfolio/trade` route and every LLM-issued trade call — this is a binding
contract (`DECISIONS.md` → "Trade / watchlist service contract") specifically so manual and
AI-issued trades can never diverge in validation. Flow:

1. Normalize the ticker (`validation.normalize_ticker`) and validate quantity/side.
2. `pricing.ensure_price(ticker)` — registers the ticker with `state.market_source` if not
   already tracked (bridging into the async `add_ticker()` via `asyncio.run()`, safe here because
   this runs on a threadpool worker with no event loop of its own), then polls the price cache up
   to 10× at 100ms intervals; raises `DomainError("price_unavailable", ..., 503)` if no price
   appears within ~1s.
3. Acquire `db.TRADE_LOCK`, re-read the now-guaranteed-available price, open `BEGIN IMMEDIATE`.
4. All money math uses Python `Decimal` — cash delta, average cost, position value — converted to
   `float` only at the end via `ROUND_HALF_EVEN` to 2 decimal places. Buys check
   `new_cash >= 0` (else `insufficient_cash`, 422); sells check `quantity <= held + 1e-9` (else
   `insufficient_shares`, 422, i.e. no short selling). A buy recomputes weighted average cost as
   `((current_qty·current_avg_cost) + trade_value) / new_qty`; a sell leaves average cost
   unchanged (realized P&L isn't tracked in v1 — only unrealized P&L is shown).
5. On success: `update_cash_balance`, `upsert_position`, `insert_trade`, and
   `insert_snapshot(compute_total_value(...))` all happen inside the same transaction, then
   commit. Any exception rolls back and re-raises.

`get_portfolio()` marks every open position to market using the live price cache (falling back to
`avg_cost` if a held ticker's price is momentarily missing, so valuation never 500s), and returns
`cash_balance`, per-position `market_value`/`unrealized_pnl`/`unrealized_pnl_percent`,
`total_value`, and `total_unrealized_pnl`. `compute_total_value()` is just
`get_portfolio()["total_value"]`, reused by both the post-trade snapshot and the 30s background
snapshot loop.

**Watchlist** (`watchlist/service.py`) mirrors the same pattern: `add_watchlisted_ticker` also
calls `ensure_price()` before inserting (so a ticker never appears on the watchlist without at
least attempting to have a live price), and maps the schema's `UNIQUE(user_id, ticker)`
`sqlite3.IntegrityError` to `DomainError("duplicate_ticker", ..., 409)`.
`remove_watchlisted_ticker` only calls `market_source.remove_ticker()` if the ticker isn't also
held as an open position — a sold-off-the-watchlist-but-still-held ticker keeps streaming so
portfolio valuation stays live.

### 2.5 LLM chat (`backend/app/llm/`)

Chat is a **soft dependency** — the app runs fully without a usable LLM backend; only `/api/chat`
degrades (503 `llm_unavailable`). `/api/health` checks only process liveness + DB readiness, never
LLM availability.

`POST /api/chat` (`api/chat.py`) flow: load the last 20 `chat_messages` rows
(`llm/context.py::build_history_messages`) plus a compact, human-readable portfolio/watchlist
summary with live prices and unrealized P&L (`build_portfolio_context`) → persist the incoming
user message → assemble `[system_prompt + portfolio_context, ...history, user_message]`
(`llm/prompts.py::build_messages`) → call `llm/client.py::get_llm_response()` → run every
returned trade/watchlist action through `llm/actions.py::execute_actions()` → persist the
assistant's reply (with the executed actions serialized into the `actions` JSON column) → return
the full `ChatResponse` to the frontend.

The LLM call itself (`llm/client.py`) goes through **LiteLLM → OpenRouter → Cerebras**:
`model="openrouter/openai/gpt-oss-120b"`, `extra_body={"provider": {"order": ["cerebras"]}}`,
`response_format=LLMChatResponse` (a Pydantic model, i.e. real structured outputs, not
prompt-engineered JSON), `reasoning_effort="low"`. Per `DECISIONS.md`, the credential is read from
`OPENAI_API_KEY` (not LiteLLM's default `OPENROUTER_API_KEY` lookup) and passed explicitly as
`api_key=` to `completion()`. `LLM_MOCK=true` short-circuits the entire network call — `get_llm_response()`
routes straight to `llm/mock.py::get_mock_response()`, which does a case-insensitive substring
match against the user's message (`"insufficient"` → an oversized NVDA buy that deliberately fails
cash validation; `"sell"` → sell 5 AAPL; `"buy"` → buy 10 AAPL; `"watchlist"` → add PYPL; anything
else → an analysis-only response with no actions) — a small, fixed fixture set the E2E suite is
built against.

The structured output schema (`llm/schemas.py::LLMChatResponse`) is `{message: str, trades:
list[TradeAction], watchlist_changes: list[WatchlistChangeAction]}`. The system prompt
(`llm/prompts.py`) explicitly instructs the model to execute trades **only** on an explicit
request or unambiguous agreement to a trade it just proposed, and to leave `trades`/
`watchlist_changes` empty otherwise — there's no separate confirmation step or state machine; the
"did the user agree" judgment is made per-turn by the model using the conversation history already
in its context.

**Auto-execution** (`llm/actions.py::execute_actions`) runs every requested trade, then every
requested watchlist change, **sequentially and independently** — one failure doesn't block the
rest of the batch. Each action opens its own DB connection and calls the exact same
`portfolio.service.execute_trade` / `watchlist.service.add_watchlisted_ticker` /
`remove_watchlisted_ticker` functions the manual REST routes use, catching `DomainError` into a
per-action `ActionResult {type, request, status: "ok"|"error", detail, error_code}`. The frontend
renders `action_results` as the authoritative outcome, independent of whatever the model's
`message` text claims happened — there's no second LLM call to reconcile a failed action against
the reply text.

### 2.6 API surface

| Method | Path | Handler | Notes |
|---|---|---|---|
| GET | `/api/health` | `api/health.py` | `{status, db_ready}`; 503 if the DB read fails |
| GET | `/api/stream/prices` | `market/stream.py` | SSE, `text/event-stream` |
| GET | `/api/portfolio` | `api/portfolio.py` | positions marked-to-market, cash, totals |
| POST | `/api/portfolio/trade` | `api/portfolio.py` | `{ticker, side, quantity}` → `{trade, cash_balance, position}` |
| GET | `/api/portfolio/history` | `api/portfolio.py` | `{snapshots: [...]}` for the P&L chart |
| GET | `/api/watchlist` | `api/watchlist.py` | tickers + live price/change/session-daily-change |
| POST | `/api/watchlist` | `api/watchlist.py` | `{ticker}` |
| DELETE | `/api/watchlist/{ticker}` | `api/watchlist.py` | |
| POST | `/api/chat` | `api/chat.py` | `{message}` → `ChatResponse` |

This matches `PLAN.md` §8 exactly — no added or missing endpoints. One implementation detail not
spelled out in the plan: the watchlist route computes a **session-since-launch "daily change %"**
(`state.session_open_prices`, a per-ticker dict populated with the first price observed since the
process started) rather than a true market-session open, since the simulator has no real trading
day boundary — documented in `DECISIONS.md` as an intentional proxy for demo purposes. This is
distinct from a position's "% change" in the positions table, which is unrealized-gain-on-cost
(`(current_price - avg_cost) / avg_cost`), and from `PriceUpdate.change_percent`, which is
tick-over-tick.

All domain errors return `{"error_code": "...", "message": "..."}` at a status chosen by the
failure: 400 `invalid_request`, 404 `not_found`, 409 `duplicate_ticker`, 422
`insufficient_cash`/`insufficient_shares`, 503 `price_unavailable`/`llm_unavailable`.

## 3. Frontend (`frontend/`)

Next.js (App Router) built with `output: 'export'` into `frontend/out/`, copied verbatim into
`backend/static/` at Docker build time — no server-side Next.js runtime ships in the container.
`frontend/app/page.tsx` renders a single client component, `TradingTerminal`; there is no
client-side routing, matching the "true single page" decision in `DECISIONS.md`.

**State management is all local React hooks — no Redux/Zustand/context store.**
`TradingTerminal.tsx` owns UI-only state (`selectedTicker`, `chatOpen`) and composes six data
hooks, each independently responsible for one slice of server state:

- **`usePriceStream()`** opens one `EventSource('/api/stream/prices')` for the component's
  lifetime. On each message it merges the payload into a `prices: Record<ticker, PriceUpdate>`
  state map and also appends each ticker's `{t, price}` into an in-memory, capped
  (400-point) ring buffer (`historyRef`) — this is the client-side accumulation that powers both
  the watchlist sparklines and the main chart, entirely from the SSE stream since page load (per
  `PLAN.md` — there's no backend "get price history" endpoint). Connection status is a small state
  machine: `connected` while messages keep arriving; `reconnecting` if either `EventSource.onerror`
  fires while still `CONNECTING`, or a 1s-interval watchdog notices >3s of silence (covers a stall
  the browser hasn't itself noticed); `disconnected` only once `EventSource.readyState ===
  CLOSED` (browser has given up retrying). `EventSource`'s native auto-reconnect does the actual
  reconnection work — the hook only reflects its state.
- **`usePortfolio()` / `useWatchlist()` / `usePortfolioHistory()`** each fetch once on mount and
  expose a `refresh()` — there's no polling; they're re-fetched explicitly after a trade, a
  watchlist edit, or an LLM-executed action (`TradingTerminal`'s `refreshAfterActions` callback,
  passed into `useChat`).
- **`useChat()`** manages the message list locally: pushes an optimistic user message plus a
  `pending: true` assistant placeholder immediately, calls `api.sendChatMessage`, then replaces
  the placeholder with the real response (or an error state) in place. Triggers
  `onActionsExecuted` (which refreshes portfolio/watchlist/history) only if `action_results` came
  back non-empty.
- **`usePriceFlash(price)`** is a small per-ticker hook: tracks the previous price in a ref, and
  for 550ms after the price changes returns `'up'`/`'down'` (else `'flat'`), which callers map to
  a CSS flash animation class.

**`frontend/lib/api.ts`** centralizes every backend call behind `fetch('/api${path}')` with a
shared `ApiError` class (carries `errorCode`/`status` from the backend's `{error_code, message}`
body) so every hook handles failures uniformly. **`frontend/lib/types.ts`** hand-mirrors the
backend's response shapes (with a comment pointing at the source-of-truth Python model for each,
e.g. `PriceUpdate` ↔ `market/models.py`) — there's no shared schema codegen between the two
languages.

**Charts**: all four visualizations (`MainChart`, `PnLChart`, `PortfolioHeatmap`, `Sparkline`) use
**Recharts** (SVG-based) — `PLAN.md`'s "canvas-based preferred" note was superseded per
`DECISIONS.md`, since Recharts performs fine at this data scale (10 tickers, ~2 updates/sec).
`PortfolioHeatmap` uses Recharts' `Treemap`; `MainChart`/`PnLChart`/`Sparkline` all use
`LineChart`. Component tree: `Header` (total value, cash, connection dot) → `WatchlistPanel`
(rows with flash + sparkline, add/remove) → `MainChart` (selected ticker detail) →
`PortfolioHeatmap` + `PnLChart` side by side → `PositionsTable` → `TradeBar` (buy/sell form) →
`ChatPanel` (collapsible sidebar). All styled with Tailwind using the dark palette from `PLAN.md`
§2.

Local dev note (`DECISIONS.md`): the Next.js dev server proxies `/api/*` to `localhost:8000` via a
`next.config.js` rewrite, so frontend development doesn't require rebuilding the static export on
every change — only the production build gets baked into the Docker image.

## 4. Docker & deployment

Multi-stage `Dockerfile`:

1. **`frontend-builder`** (`node:20-slim`) — `npm ci`, `npm run build` → static export at
   `frontend/out/`.
2. **`runtime`** (`python:3.12-slim`) — copies the pinned `uv` static binary (no curl installer,
   no build toolchain needed in this stage), copies `backend/` to `/app/backend/` (preserving it
   as a sibling of the `db/` mount point, which `main.py`'s DB-path resolution depends on), runs
   `uv sync --locked --no-dev` **at build time** to materialize the virtualenv from the committed
   lockfile, then copies the frontend's static export into `backend/static/`.

The container's `CMD` is `uv run --no-sync uvicorn app.main:app --host 0.0.0.0 --port 8000`. The
`--no-sync` flag is load-bearing: without it, `uv run` re-validates the project environment on
every container start and will attempt to rebuild/resync the local `backend` package (fetching its
build backend, `hatchling`, from PyPI) even though the venv was already correctly built into the
image — which fails outright in any environment where the running container has no network
egress. `--no-sync` tells `uv run` to just execute inside the already-built `.venv` as-is.

A `HEALTHCHECK` polls `GET /api/health` every 30s (45s start period, 3 retries) via a plain
`urllib` one-liner, so no extra HTTP client dependency is needed just for the health probe.

`db/` is a **bind mount** (not a named volume) of the repo's top-level `db/` directory to
`/app/db` — chosen for local-dev simplicity over a named volume. `scripts/start.sh` /
`scripts/start.ps1` build the image if missing, `mkdir -p db`, and run the container with
`-v "$ROOT/db:/app/db" -p 8001:8000 --env-file .env` (host port `8001` — bumped from the plan's
default `8000`, which is reserved by an unrelated container on the dev machine this was set up on;
see the `PORT` variable in `scripts/start.sh`/`start.ps1`); idempotent (no-ops if already running, and
removes a stale stopped/created container before re-running so a rebuilt image or edited `.env`
takes effect). `scripts/stop.sh` stops and removes the container without touching the volume, so
portfolio/watchlist/chat state persists across restarts.

## 5. Testing

- **Backend** (`backend/tests/`, pytest): mirrors the app's module structure —
  `api/`, `db/`, `market/`, `llm/`, `portfolio/`, `watchlist/`, plus top-level `test_pricing.py`
  and `test_validation.py`. Uses `backend/tests/fakes.py` for test doubles (e.g. a fake market
  source) so service-layer tests don't depend on the real simulator's timing.
- **Frontend** (`frontend/__tests__/`, Vitest + React Testing Library): component- and hook-level
  tests (`WatchlistPanel`, `ChatPanel`, `PositionsTable`, `usePriceFlash`, plus pure-function tests
  for `lib/portfolio.ts`).
- **E2E** (`test/`, Playwright + `docker-compose.test.yml`): six numbered specs covering fresh
  start, watchlist CRUD, trading, portfolio visualization, chat (against `LLM_MOCK=true`
  fixtures), and SSE reconnection resilience — run against the built Docker image so browser
  dependencies stay out of the production image.
