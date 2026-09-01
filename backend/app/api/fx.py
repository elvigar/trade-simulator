"""FX rate / display-currency REST endpoints.

    GET  /api/fx/currencies   -> supported currencies + default
    GET  /api/fx/rates        -> current USD-based conversion rates
    GET  /api/fx/preference   -> the user's preferred display currency
    PUT  /api/fx/preference   -> set the user's preferred display currency

Display/conversion overlay only — the ledger (cash_balance, avg_cost,
trades.price) stays USD-only. See planning/DECISIONS.md and the
multi-currency plan for the full contract.
"""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from app import db, state
from app.fx import CURRENCY_META, DEFAULT_DISPLAY_CURRENCY, SUPPORTED_CURRENCIES, validate_currency

router = APIRouter(prefix="/api/fx", tags=["fx"])


class DisplayCurrencyRequest(BaseModel):
    display_currency: str


@router.get("/currencies")
def get_currencies_route() -> dict:
    return {
        "currencies": [
            {"code": code, "name": CURRENCY_META[code]} for code in SUPPORTED_CURRENCIES
        ],
        "default": DEFAULT_DISPLAY_CURRENCY,
    }


@router.get("/rates")
def get_rates_route() -> dict:
    return state.fx_cache.snapshot()


@router.get("/preference")
def get_preference_route() -> dict:
    with db.get_connection() as conn:
        return {"display_currency": db.get_display_currency(conn)}


@router.put("/preference")
def put_preference_route(payload: DisplayCurrencyRequest) -> dict:
    currency = validate_currency(payload.display_currency)
    with db.get_connection() as conn:
        db.set_display_currency(conn, currency)
        conn.commit()
    return {"display_currency": currency}
