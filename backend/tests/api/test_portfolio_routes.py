def test_get_portfolio_initial_state(client):
    response = client.get("/api/portfolio")
    assert response.status_code == 200
    body = response.json()
    assert body["cash_balance"] == 10000.0
    assert body["positions"] == []
    assert body["total_value"] == 10000.0
    assert body["total_unrealized_pnl"] == 0.0


def test_buy_trade_via_route(client):
    response = client.post(
        "/api/portfolio/trade", json={"ticker": "AAPL", "side": "buy", "quantity": 5}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["trade"]["ticker"] == "AAPL"
    assert body["trade"]["side"] == "buy"
    assert body["trade"]["quantity"] == 5.0
    assert body["position"]["quantity"] == 5.0
    assert body["cash_balance"] == 10000.0 - (body["trade"]["price"] * 5)

    portfolio = client.get("/api/portfolio").json()
    assert len(portfolio["positions"]) == 1
    assert portfolio["positions"][0]["ticker"] == "AAPL"


def test_sell_more_than_held_returns_422(client):
    response = client.post(
        "/api/portfolio/trade", json={"ticker": "AAPL", "side": "sell", "quantity": 1}
    )
    assert response.status_code == 422
    assert response.json()["error_code"] == "insufficient_shares"


def test_buy_with_insufficient_cash_returns_422(client):
    response = client.post(
        "/api/portfolio/trade", json={"ticker": "AAPL", "side": "buy", "quantity": 1_000_000}
    )
    assert response.status_code == 422
    assert response.json()["error_code"] == "insufficient_cash"


def test_invalid_side_returns_400(client):
    response = client.post(
        "/api/portfolio/trade", json={"ticker": "AAPL", "side": "hold", "quantity": 1}
    )
    assert response.status_code == 400
    assert response.json()["error_code"] == "invalid_request"


def test_malformed_trade_body_returns_400(client):
    response = client.post("/api/portfolio/trade", json={"ticker": "AAPL"})
    assert response.status_code == 400
    assert response.json()["error_code"] == "invalid_request"


def test_portfolio_history_has_seed_snapshot(client):
    response = client.get("/api/portfolio/history")
    assert response.status_code == 200
    snapshots = response.json()["snapshots"]
    assert len(snapshots) >= 1
    assert snapshots[0]["total_value"] == 10000.0


def test_portfolio_history_grows_after_trade(client):
    before = client.get("/api/portfolio/history").json()["snapshots"]
    client.post("/api/portfolio/trade", json={"ticker": "AAPL", "side": "buy", "quantity": 1})
    after = client.get("/api/portfolio/history").json()["snapshots"]
    assert len(after) == len(before) + 1
