# FinAlly — AI Trading Workstation

An AI-powered trading workstation that will stream live market data, simulate portfolio trading, and let an LLM chat assistant analyze positions and execute trades via natural language.

Built entirely by coding agents as a capstone project for an agentic AI coding course. See [`planning/PLAN.md`](planning/PLAN.md) for the full target architecture and design.

## Status

Only the **market data subsystem** is implemented so far (`backend/app/market/`): a GBM-based price simulator, an optional Massive/Polygon.io client, an in-memory price cache, and an SSE streaming endpoint — see [`planning/MARKET_DATA_SUMMARY.md`](planning/MARKET_DATA_SUMMARY.md). The FastAPI app, database, frontend, AI chat, and Docker packaging described in the plan are not yet built.

## Backend Development

```bash
cd backend
uv sync --dev
uv run pytest
```

See [`backend/README.md`](backend/README.md) for structure and commands, and [`backend/market_data_demo.py`](backend/market_data_demo.py) for a live terminal demo of the simulator.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `MASSIVE_API_KEY` | No | Massive (Polygon.io) key for real market data; omit to use the built-in simulator |

`OPENAI_API_KEY` and `LLM_MOCK` will be needed once the AI chat assistant is built (see the plan).

## Project Structure

```
finally/
├── backend/     # FastAPI uv project (market data subsystem implemented; rest pending)
├── planning/    # Project documentation and agent contracts
└── CLAUDE.md    # Entry point for agents working on this repo
```

## License

See [LICENSE](LICENSE).
