"""Database layer for FinAlly.

Owns SQLite schema, connection management, startup initialization/seeding,
the process-wide trade lock, and row-level data-access helpers for the six
tables in PLAN.md section 7.

Public API:
    init_db(db_path=None)         - Create tables + seed default data (idempotent)
    get_connection(db_path=None)  - Context manager yielding one sqlite3.Connection
    get_db_path()                 - Resolve the configured DB file path
    TRADE_LOCK                    - threading.Lock serializing trade transactions
    DEFAULT_USER_ID               - "default", the single-user id used everywhere

    Row-level helpers (each takes an open connection as its first arg):
        get_cash_balance, update_cash_balance
        get_position, list_positions, upsert_position
        insert_trade, list_trades
        insert_snapshot, list_snapshots
        list_watchlist, is_watchlisted, add_watchlist_ticker, remove_watchlist_ticker
        insert_chat_message, list_chat_messages
"""

from .connection import get_connection, get_db_path
from .init import init_db
from .locks import TRADE_LOCK
from .repository import (
    add_watchlist_ticker,
    get_cash_balance,
    get_position,
    insert_chat_message,
    insert_snapshot,
    insert_trade,
    is_watchlisted,
    list_chat_messages,
    list_positions,
    list_snapshots,
    list_trades,
    list_watchlist,
    remove_watchlist_ticker,
    update_cash_balance,
    upsert_position,
)
from .schema import DEFAULT_CASH_BALANCE, DEFAULT_USER_ID

__all__ = [
    "init_db",
    "get_connection",
    "get_db_path",
    "TRADE_LOCK",
    "DEFAULT_USER_ID",
    "DEFAULT_CASH_BALANCE",
    "get_cash_balance",
    "update_cash_balance",
    "get_position",
    "list_positions",
    "upsert_position",
    "insert_trade",
    "list_trades",
    "insert_snapshot",
    "list_snapshots",
    "list_watchlist",
    "is_watchlisted",
    "add_watchlist_ticker",
    "remove_watchlist_ticker",
    "insert_chat_message",
    "list_chat_messages",
]
