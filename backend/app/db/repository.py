"""Row-level data-access helpers.

Every function here takes an open `sqlite3.Connection` and performs a single
read or write against it — no transaction management. Callers (e.g. the
backend engineer's trade service) compose these inside their own
`BEGIN IMMEDIATE` transaction boundary, guarded by `app.db.locks.TRADE_LOCK`
for anything that writes cash, positions, trades, or snapshots.

Rows are returned as plain `dict`s (JSON-serializable as-is) rather than
`sqlite3.Row`, so callers don't need to import sqlite3 themselves.
"""

import sqlite3
import uuid
from typing import Any

from .schema import DEFAULT_USER_ID
from .util import utcnow_iso

ZERO_QUANTITY_EPSILON = 1e-9


def _row_to_dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    return dict(row) if row is not None else None


# --- users_profile -----------------------------------------------------


def get_cash_balance(conn: sqlite3.Connection, user_id: str = DEFAULT_USER_ID) -> float:
    """Return the user's current cash balance.

    Raises LookupError if no users_profile row exists for user_id (should
    not happen after init_db() has run).
    """
    row = conn.execute(
        "SELECT cash_balance FROM users_profile WHERE id = ?", (user_id,)
    ).fetchone()
    if row is None:
        raise LookupError(f"no users_profile row for user_id={user_id!r}")
    return row["cash_balance"]


def update_cash_balance(
    conn: sqlite3.Connection, new_balance: float, user_id: str = DEFAULT_USER_ID
) -> None:
    """Set cash_balance to `new_balance` (an absolute value, not a delta)."""
    conn.execute(
        "UPDATE users_profile SET cash_balance = ? WHERE id = ?", (new_balance, user_id)
    )


def get_display_currency(conn: sqlite3.Connection, user_id: str = DEFAULT_USER_ID) -> str:
    """Return the user's preferred display currency (e.g. "USD", "EUR").

    Raises LookupError if no users_profile row exists for user_id.
    """
    row = conn.execute(
        "SELECT display_currency FROM users_profile WHERE id = ?", (user_id,)
    ).fetchone()
    if row is None:
        raise LookupError(f"no users_profile row for user_id={user_id!r}")
    return row["display_currency"]


def set_display_currency(
    conn: sqlite3.Connection, currency: str, user_id: str = DEFAULT_USER_ID
) -> None:
    """Set the user's preferred display currency."""
    conn.execute(
        "UPDATE users_profile SET display_currency = ? WHERE id = ?", (currency, user_id)
    )


# --- positions -----------------------------------------------------------


def get_position(
    conn: sqlite3.Connection, ticker: str, user_id: str = DEFAULT_USER_ID
) -> dict[str, Any] | None:
    """Return the position row for `ticker`, or None if the user holds none."""
    row = conn.execute(
        "SELECT * FROM positions WHERE user_id = ? AND ticker = ?", (user_id, ticker)
    ).fetchone()
    return _row_to_dict(row)


def list_positions(conn: sqlite3.Connection, user_id: str = DEFAULT_USER_ID) -> list[dict[str, Any]]:
    """Return all open position rows for the user, ordered by ticker."""
    rows = conn.execute(
        "SELECT * FROM positions WHERE user_id = ? ORDER BY ticker", (user_id,)
    ).fetchall()
    return [dict(row) for row in rows]


def upsert_position(
    conn: sqlite3.Connection,
    ticker: str,
    quantity: float,
    avg_cost: float,
    user_id: str = DEFAULT_USER_ID,
) -> None:
    """Insert or update the position row for `ticker` to `quantity`/`avg_cost`.

    If `quantity` is ~0 (within 1e-9), deletes the row instead of leaving a
    zero-quantity position, per DECISIONS.md's no-zero-quantity-rows rule.
    """
    if abs(quantity) < ZERO_QUANTITY_EPSILON:
        conn.execute(
            "DELETE FROM positions WHERE user_id = ? AND ticker = ?", (user_id, ticker)
        )
        return
    conn.execute(
        """
        INSERT INTO positions (id, user_id, ticker, quantity, avg_cost, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT (user_id, ticker) DO UPDATE SET
            quantity = excluded.quantity,
            avg_cost = excluded.avg_cost,
            updated_at = excluded.updated_at
        """,
        (str(uuid.uuid4()), user_id, ticker, quantity, avg_cost, utcnow_iso()),
    )


# --- trades ----------------------------------------------------------------


def insert_trade(
    conn: sqlite3.Connection,
    ticker: str,
    side: str,
    quantity: float,
    price: float,
    user_id: str = DEFAULT_USER_ID,
) -> dict[str, Any]:
    """Insert an append-only trade row and return it as a dict."""
    trade_id = str(uuid.uuid4())
    executed_at = utcnow_iso()
    conn.execute(
        """
        INSERT INTO trades (id, user_id, ticker, side, quantity, price, executed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (trade_id, user_id, ticker, side, quantity, price, executed_at),
    )
    return {
        "id": trade_id,
        "user_id": user_id,
        "ticker": ticker,
        "side": side,
        "quantity": quantity,
        "price": price,
        "executed_at": executed_at,
    }


def list_trades(conn: sqlite3.Connection, user_id: str = DEFAULT_USER_ID) -> list[dict[str, Any]]:
    """Return all trades for the user, oldest first."""
    rows = conn.execute(
        "SELECT * FROM trades WHERE user_id = ? ORDER BY executed_at", (user_id,)
    ).fetchall()
    return [dict(row) for row in rows]


# --- portfolio_snapshots -----------------------------------------------


def insert_snapshot(
    conn: sqlite3.Connection, total_value: float, user_id: str = DEFAULT_USER_ID
) -> dict[str, Any]:
    """Insert a portfolio_snapshots row and return it as a dict."""
    snapshot_id = str(uuid.uuid4())
    recorded_at = utcnow_iso()
    conn.execute(
        "INSERT INTO portfolio_snapshots (id, user_id, total_value, recorded_at) VALUES (?, ?, ?, ?)",
        (snapshot_id, user_id, total_value, recorded_at),
    )
    return {
        "id": snapshot_id,
        "user_id": user_id,
        "total_value": total_value,
        "recorded_at": recorded_at,
    }


def list_snapshots(
    conn: sqlite3.Connection, user_id: str = DEFAULT_USER_ID, limit: int | None = None
) -> list[dict[str, Any]]:
    """Return portfolio snapshots for the user, oldest first.

    If `limit` is provided, returns the most recent `limit` snapshots while
    preserving chronological order for charting.
    """
    if limit is None:
        rows = conn.execute(
            "SELECT * FROM portfolio_snapshots WHERE user_id = ? ORDER BY recorded_at",
            (user_id,),
        ).fetchall()
        return [dict(row) for row in rows]
    rows = conn.execute(
        """
        SELECT *
        FROM (
            SELECT *
            FROM portfolio_snapshots
            WHERE user_id = ?
            ORDER BY recorded_at DESC
            LIMIT ?
        )
        ORDER BY recorded_at
        """,
        (user_id, limit),
    ).fetchall()
    return [dict(row) for row in rows]


# --- watchlist ---------------------------------------------------------


def list_watchlist(conn: sqlite3.Connection, user_id: str = DEFAULT_USER_ID) -> list[dict[str, Any]]:
    """Return all watchlist rows for the user, in the order they were added."""
    rows = conn.execute(
        "SELECT * FROM watchlist WHERE user_id = ? ORDER BY added_at", (user_id,)
    ).fetchall()
    return [dict(row) for row in rows]


def is_watchlisted(
    conn: sqlite3.Connection, ticker: str, user_id: str = DEFAULT_USER_ID
) -> bool:
    """Return True if `ticker` is on the user's watchlist."""
    row = conn.execute(
        "SELECT 1 FROM watchlist WHERE user_id = ? AND ticker = ?", (user_id, ticker)
    ).fetchone()
    return row is not None


def add_watchlist_ticker(
    conn: sqlite3.Connection, ticker: str, user_id: str = DEFAULT_USER_ID
) -> dict[str, Any]:
    """Insert a watchlist row for `ticker` and return it as a dict.

    Raises sqlite3.IntegrityError if the ticker is already on the
    watchlist (UNIQUE(user_id, ticker)) — callers should map this to the
    `duplicate_ticker` API error.
    """
    entry_id = str(uuid.uuid4())
    added_at = utcnow_iso()
    conn.execute(
        "INSERT INTO watchlist (id, user_id, ticker, added_at) VALUES (?, ?, ?, ?)",
        (entry_id, user_id, ticker, added_at),
    )
    return {"id": entry_id, "user_id": user_id, "ticker": ticker, "added_at": added_at}


def remove_watchlist_ticker(
    conn: sqlite3.Connection, ticker: str, user_id: str = DEFAULT_USER_ID
) -> bool:
    """Delete the watchlist row for `ticker`. Returns True if a row was deleted."""
    cursor = conn.execute(
        "DELETE FROM watchlist WHERE user_id = ? AND ticker = ?", (user_id, ticker)
    )
    return cursor.rowcount > 0


# --- chat_messages -------------------------------------------------------


def insert_chat_message(
    conn: sqlite3.Connection,
    role: str,
    content: str,
    actions: str | None = None,
    user_id: str = DEFAULT_USER_ID,
) -> dict[str, Any]:
    """Insert a chat_messages row and return it as a dict.

    `actions` is a pre-serialized JSON string describing executed trades /
    watchlist changes (or None for user messages / no actions taken) — this
    layer does not interpret it.
    """
    message_id = str(uuid.uuid4())
    created_at = utcnow_iso()
    conn.execute(
        """
        INSERT INTO chat_messages (id, user_id, role, content, actions, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (message_id, user_id, role, content, actions, created_at),
    )
    return {
        "id": message_id,
        "user_id": user_id,
        "role": role,
        "content": content,
        "actions": actions,
        "created_at": created_at,
    }


def list_chat_messages(
    conn: sqlite3.Connection, user_id: str = DEFAULT_USER_ID, limit: int | None = None
) -> list[dict[str, Any]]:
    """Return chat messages in chronological order.

    If `limit` is given, returns only the most recent `limit` messages
    (still in chronological order) — useful for capping conversation
    history sent to the LLM.
    """
    if limit is None:
        rows = conn.execute(
            "SELECT * FROM chat_messages WHERE user_id = ? ORDER BY created_at", (user_id,)
        ).fetchall()
        return [dict(row) for row in rows]
    rows = conn.execute(
        "SELECT * FROM chat_messages WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
        (user_id, limit),
    ).fetchall()
    return [dict(row) for row in reversed(rows)]
