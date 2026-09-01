"""Domain error type shared by all service functions.

Per DECISIONS.md -> "Trade / watchlist service contract" and "API error
shape": every validation/domain failure inside a service function raises a
DomainError instead of a raw exception. Route handlers let it propagate —
`app.main` registers a global exception handler that turns it into the
standard `{"error_code": ..., "message": ...}` JSON body at `status_code`.
"""

from __future__ import annotations


class DomainError(Exception):
    """Raised by service functions on any validation/domain failure."""

    def __init__(self, error_code: str, message: str, status_code: int) -> None:
        super().__init__(message)
        self.error_code = error_code
        self.message = message
        self.status_code = status_code
