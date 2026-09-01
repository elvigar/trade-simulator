"""Small shared helpers for the db package."""

from datetime import UTC, datetime


def utcnow_iso() -> str:
    """Return the current UTC time as an ISO-8601 string, for *_at columns."""
    return datetime.now(UTC).isoformat()
