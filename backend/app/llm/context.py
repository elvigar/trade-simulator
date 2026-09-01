"""Builds the compact portfolio context and conversation history sent to
the LLM on every /api/chat call (PLAN.md section 9)."""

from __future__ import annotations

from decimal import Decimal

from app import db
from app.market import PriceCache

HISTORY_LIMIT = 20  # most recent chat_messages rows (~10 back-and-forth turns)
MAX_CONTEXT_ROWS = 50  # guards against unbounded prompt growth as data accumulates


def build_portfolio_context(conn, price_cache: PriceCache) -> str:
    """Compact, human-readable summary: cash, positions with unrealized
    P&L, watchlist with live prices, and total portfolio value.

    A position/watchlist entry with no cached price yet says so explicitly
    rather than being silently omitted, since that's useful context for the
    model (e.g. a just-added ticker).
    """
    cash = db.get_cash_balance(conn)
    positions = db.list_positions(conn)[:MAX_CONTEXT_ROWS]
    watchlist = db.list_watchlist(conn)[:MAX_CONTEXT_ROWS]

    total_value = Decimal(str(cash))
    lines = [f"Cash balance: ${cash:,.2f}", "", "Positions:" if positions else "Positions: none"]

    for pos in positions:
        price = price_cache.get_price(pos["ticker"])
        if price is None:
            lines.append(
                f"- {pos['ticker']}: {pos['quantity']} shares, "
                f"avg cost ${pos['avg_cost']:.2f}, current price unavailable"
            )
            continue
        qty = Decimal(str(pos["quantity"]))
        avg_cost = Decimal(str(pos["avg_cost"]))
        price_dec = Decimal(str(price))
        total_value += qty * price_dec
        pnl = (price_dec - avg_cost) * qty
        pnl_pct = (price_dec - avg_cost) / avg_cost * 100 if avg_cost else Decimal(0)
        sign = "+" if pnl >= 0 else ""
        lines.append(
            f"- {pos['ticker']}: {pos['quantity']} shares, avg cost ${pos['avg_cost']:.2f}, "
            f"current ${price:.2f}, unrealized P&L {sign}${pnl:.2f} ({pnl_pct:+.2f}%)"
        )

    lines.append(f"\nTotal portfolio value: ${total_value:,.2f}")

    lines.append("\nWatchlist (live prices):" if watchlist else "\nWatchlist: none")
    for entry in watchlist:
        price = price_cache.get_price(entry["ticker"])
        price_str = f"${price:.2f}" if price is not None else "price unavailable"
        lines.append(f"- {entry['ticker']}: {price_str}")

    return "\n".join(lines)


def build_history_messages(conn, limit: int = HISTORY_LIMIT) -> list[dict[str, str]]:
    """Prior chat turns as OpenAI-style {"role", "content"} dicts, capped to
    the most recent `limit` rows (chronological order) to bound prompt size.
    """
    rows = db.list_chat_messages(conn, limit=limit)
    return [{"role": row["role"], "content": row["content"]} for row in rows]
