# FinAlly — AI Trading Workstation

An AI-powered trading workstation that streams live market data, lets you trade a simulated
$10,000 portfolio, and includes an LLM chat assistant that can analyze your positions and execute
trades on your behalf through natural language.

Built entirely by coding agents as a capstone project for an agentic AI coding course. See
[`planning/PLAN.md`](planning/PLAN.md) for the original product spec and
[`TECHNICAL_DESIGN.md`](TECHNICAL_DESIGN.md) for how it's actually built.

## Status

Fully implemented: FastAPI backend, SQLite persistence, market data (simulator + optional
Massive/Polygon.io), Next.js frontend with live SSE price streaming, portfolio heatmap and P&L
charts, an AI chat assistant (LiteLLM → OpenRouter → Cerebras), and a single-container Docker
build. See [`TECHNICAL_DESIGN.md`](TECHNICAL_DESIGN.md) for the full architecture.

## Quickstart (Docker)

```bash
cp .env.example .env   # fill in OPENAI_API_KEY
scripts/start.sh       # builds the image (first run) and starts the container
```

Open the URL it prints (defaults to `http://localhost:8001`; see the `PORT` variable in
`scripts/start.sh` if that port is already in use on your machine). Stop it with `scripts/stop.sh`
— your portfolio, watchlist, and chat history persist in `db/finally.db` across restarts.

## Backend Development

```bash
cd backend
uv sync --dev
uv run pytest
```

See [`backend/README.md`](backend/README.md) for structure and commands, and
[`backend/market_data_demo.py`](backend/market_data_demo.py) for a live terminal demo of the
market data simulator.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | Yes | OpenRouter API key, used for the AI chat assistant |
| `MASSIVE_API_KEY` | No | Massive (Polygon.io) key for real market data; omit to use the built-in simulator |
| `LLM_MOCK` | No | Set to `true` for deterministic mock chat responses (used by the E2E test suite) |

## Project Structure

```
finally/
├── backend/     # FastAPI uv project — API, database, market data, LLM chat
├── frontend/    # Next.js trading terminal UI (built as a static export)
├── test/        # Playwright end-to-end tests
├── scripts/     # Docker start/stop scripts
├── planning/    # Project documentation and agent contracts
└── CLAUDE.md    # Entry point for agents working on this repo
```

## License

See [LICENSE](LICENSE).
