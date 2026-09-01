def test_get_watchlist_returns_seeded_tickers(client):
    response = client.get("/api/watchlist")
    assert response.status_code == 200
    body = response.json()
    tickers = {item["ticker"] for item in body["watchlist"]}
    assert "AAPL" in tickers
    assert len(body["watchlist"]) == 10
    # the simulator seeds prices synchronously on start(), so every seeded
    # ticker should already have a price by the time the app finished startup
    for item in body["watchlist"]:
        assert item["price"] is not None


def test_add_ticker_to_watchlist(client):
    response = client.post("/api/watchlist", json={"ticker": "pypl"})
    assert response.status_code == 200
    assert response.json()["ticker"] == "PYPL"

    listing = client.get("/api/watchlist").json()
    assert "PYPL" in {item["ticker"] for item in listing["watchlist"]}


def test_add_duplicate_ticker_returns_409(client):
    client.post("/api/watchlist", json={"ticker": "PYPL"})
    response = client.post("/api/watchlist", json={"ticker": "PYPL"})
    assert response.status_code == 409
    assert response.json()["error_code"] == "duplicate_ticker"


def test_add_invalid_ticker_returns_400(client):
    response = client.post("/api/watchlist", json={"ticker": "!!!"})
    assert response.status_code == 400
    assert response.json()["error_code"] == "invalid_request"


def test_remove_ticker(client):
    client.post("/api/watchlist", json={"ticker": "PYPL"})
    response = client.delete("/api/watchlist/PYPL")
    assert response.status_code == 200

    listing = client.get("/api/watchlist").json()
    assert "PYPL" not in {item["ticker"] for item in listing["watchlist"]}


def test_remove_nonexistent_ticker_returns_404(client):
    response = client.delete("/api/watchlist/NOPE")
    assert response.status_code == 404
    assert response.json()["error_code"] == "not_found"


def test_malformed_watchlist_body_returns_400(client):
    response = client.post("/api/watchlist", json={})
    assert response.status_code == 400
    assert response.json()["error_code"] == "invalid_request"
