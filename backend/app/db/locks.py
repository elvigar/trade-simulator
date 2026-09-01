"""Process-wide lock for serializing trade-writing transactions."""

import threading

TRADE_LOCK = threading.Lock()
"""Acquire before running a trade transaction (BEGIN IMMEDIATE) that touches
users_profile.cash_balance, positions, trades, or portfolio_snapshots.

Both the manual trade endpoint and LLM-issued trades must acquire this lock
around their transaction so concurrent requests cannot overspend cash or
oversell a position. See DECISIONS.md -> "Trade execution: atomicity &
concurrency".
"""
