"""Trade execution and portfolio valuation.

`execute_trade` is the binding contract from DECISIONS.md -> "Trade /
watchlist service contract": both the manual trade route
(`app.api.portfolio`) and the llm-engineer's chat action executor call this
exact function so manual and AI-issued trades go through identical
validation and the same DB transaction. Do not change its signature or
return shape without updating DECISIONS.md first.
"""

from __future__ import annotations

from decimal import ROUND_HALF_EVEN, Decimal
from typing import Any

from app import db, state
from app.errors import DomainError
from app.pricing import ensure_price
from app.validation import normalize_ticker

TWO_PLACES = Decimal("0.01")
ZERO = Decimal("0")


def _round_money(value: Decimal) -> float:
    return float(value.quantize(TWO_PLACES, rounding=ROUND_HALF_EVEN))


def _validate_side(side: str) -> None:
    if side not in ("buy", "sell"):
        raise DomainError("invalid_request", f"side must be 'buy' or 'sell', got {side!r}", 400)


def _validate_quantity(quantity: Any) -> Decimal:
    try:
        qty = Decimal(str(quantity))
    except Exception as exc:
        raise DomainError("invalid_request", "quantity must be a number", 400) from exc
    if qty <= ZERO:
        raise DomainError("invalid_request", "quantity must be positive", 400)
    exponent = qty.as_tuple().exponent
    if isinstance(exponent, int) and exponent < -6:
        raise DomainError(
            "invalid_request", "quantity supports at most 6 decimal places", 400
        )
    return qty


def execute_trade(
    conn, ticker: str, side: str, quantity: float, user_id: str = db.DEFAULT_USER_ID
) -> dict:
    """Full trade execution against an OPEN connection.

    Normalizes/validates `ticker` and `quantity`, registers the ticker with
    the market data source if not already tracked and waits for a price
    (DomainError("price_unavailable", ..., 503) if none appears), computes
    the cash/position delta with Decimal, and performs the DB writes
    (update_cash_balance, upsert_position, insert_trade, insert_snapshot) —
    all inside one BEGIN IMMEDIATE transaction guarded by db.TRADE_LOCK,
    committed here on success or rolled back here on any failure. Returns
    the inserted trade record dict on success.
    """
    ticker = normalize_ticker(ticker)
    _validate_side(side)
    qty = _validate_quantity(quantity)
    ensure_price(ticker)  # registers with market source, waits for first price

    with db.TRADE_LOCK:
        price = state.price_cache.get_price(ticker)
        if price is None:
            raise DomainError("price_unavailable", f"no price available for {ticker}", 503)
        price_dec = Decimal(str(price))

        conn.execute("BEGIN IMMEDIATE")
        try:
            cash_dec = Decimal(str(db.get_cash_balance(conn, user_id)))
            position = db.get_position(conn, ticker, user_id)
            current_qty = Decimal(str(position["quantity"])) if position else ZERO
            current_avg_cost = Decimal(str(position["avg_cost"])) if position else ZERO
            trade_value = qty * price_dec

            if side == "buy":
                new_cash_dec = cash_dec - trade_value
                if new_cash_dec < ZERO:
                    raise DomainError(
                        "insufficient_cash",
                        f"insufficient cash: trade costs {trade_value}, have {cash_dec}",
                        422,
                    )
                new_qty = current_qty + qty
                new_avg_cost = ((current_qty * current_avg_cost) + trade_value) / new_qty
            else:
                if qty > current_qty:
                    raise DomainError(
                        "insufficient_shares",
                        f"insufficient shares: trying to sell {qty}, hold {current_qty}",
                        422,
                    )
                new_cash_dec = cash_dec + trade_value
                new_qty = current_qty - qty
                new_avg_cost = current_avg_cost

            new_cash = _round_money(new_cash_dec)
            db.update_cash_balance(conn, new_cash, user_id)
            db.upsert_position(conn, ticker, float(new_qty), _round_money(new_avg_cost), user_id)
            trade_record = db.insert_trade(
                conn, ticker, side, float(qty), _round_money(price_dec), user_id
            )
            total_value = compute_total_value(conn, user_id)
            db.insert_snapshot(conn, total_value, user_id)
        except Exception:
            conn.rollback()
            raise
        else:
            conn.commit()
        return trade_record


def get_portfolio(conn, user_id: str = db.DEFAULT_USER_ID) -> dict:
    """Current positions (marked to market), cash balance, total value, and
    unrealized P&L for `user_id`. Response shape documented in the backend
    handoff notes."""
    cash_balance = db.get_cash_balance(conn, user_id)
    cash_dec = Decimal(str(cash_balance))
    positions_out: list[dict] = []
    total_market_value = ZERO
    total_pnl = ZERO

    for position in db.list_positions(conn, user_id):
        ticker = position["ticker"]
        qty_dec = Decimal(str(position["quantity"]))
        avg_cost_dec = Decimal(str(position["avg_cost"]))
        price = state.price_cache.get_price(ticker)
        # Fall back to avg_cost if the price cache momentarily lacks a
        # price for a held ticker (should be rare: watchlist ∪ open
        # positions are always registered) so valuation never 500s.
        price_dec = Decimal(str(price)) if price is not None else avg_cost_dec

        market_value = qty_dec * price_dec
        cost_basis = qty_dec * avg_cost_dec
        unrealized_pnl = market_value - cost_basis
        unrealized_pnl_percent = (
            float((unrealized_pnl / cost_basis) * 100) if cost_basis != 0 else 0.0
        )

        total_market_value += market_value
        total_pnl += unrealized_pnl
        positions_out.append(
            {
                "ticker": ticker,
                "quantity": position["quantity"],
                "avg_cost": position["avg_cost"],
                "current_price": float(price_dec),
                "market_value": _round_money(market_value),
                "unrealized_pnl": _round_money(unrealized_pnl),
                "unrealized_pnl_percent": round(unrealized_pnl_percent, 4),
            }
        )

    return {
        "cash_balance": cash_balance,
        "positions": positions_out,
        "total_value": _round_money(cash_dec + total_market_value),
        "total_unrealized_pnl": _round_money(total_pnl),
    }


def compute_total_value(conn, user_id: str = db.DEFAULT_USER_ID) -> float:
    """cash_balance + sum(quantity * current_price) across open positions.

    Used for the post-trade snapshot inside execute_trade and for the 30s
    background snapshot task in app.main.
    """
    return get_portfolio(conn, user_id)["total_value"]
