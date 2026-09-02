from app.db import insert_chat_message, list_watchlist, remove_watchlist_ticker, upsert_position
from app.llm.context import build_history_messages, build_portfolio_context
from app.market import PriceCache


def test_portfolio_context_includes_cash_positions_and_watchlist(conn):
    # init_db already seeds the default watchlist (AAPL, GOOGL, ... 10 tickers).
    upsert_position(conn, "AAPL", 10, 180.0)
    conn.commit()

    cache = PriceCache()
    cache.update("AAPL", 190.0)
    cache.update("GOOGL", 175.0)

    text = build_portfolio_context(conn, cache)

    assert "Cash balance: $10,000.00" in text
    assert "AAPL: 10.0 shares, avg cost $180.00, current $190.00" in text
    assert "unrealized P&L +$100.00 (+5.56%)" in text
    assert "GOOGL: $175.00" in text
    assert "Total portfolio value: $11,900.00" in text


def test_portfolio_context_calls_out_missing_price(conn):
    upsert_position(conn, "TSLA", 1, 200.0)
    conn.commit()

    text = build_portfolio_context(conn, PriceCache())

    assert "TSLA" in text
    assert "current price unavailable" in text


def test_portfolio_context_handles_no_positions_or_watchlist(conn):
    for entry in list_watchlist(conn):
        remove_watchlist_ticker(conn, entry["ticker"])
    conn.commit()

    text = build_portfolio_context(conn, PriceCache())

    assert "Positions: none" in text
    assert "Watchlist: none" in text


def test_history_messages_map_role_and_content(conn):
    insert_chat_message(conn, role="user", content="hello")
    insert_chat_message(conn, role="assistant", content="hi there")
    conn.commit()

    history = build_history_messages(conn)

    assert history == [
        {"role": "user", "content": "hello"},
        {"role": "assistant", "content": "hi there"},
    ]


def test_history_messages_respects_limit_and_stays_chronological(conn):
    for i in range(5):
        insert_chat_message(conn, role="user", content=f"msg{i}")
    conn.commit()

    history = build_history_messages(conn, limit=2)

    assert [m["content"] for m in history] == ["msg3", "msg4"]
