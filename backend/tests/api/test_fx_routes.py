from tests.api.conftest import MOCK_FX_RATES


def test_get_currencies_returns_supported_list_and_default(client):
    response = client.get("/api/fx/currencies")
    assert response.status_code == 200
    body = response.json()
    codes = {c["code"] for c in body["currencies"]}
    assert codes == {"USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD"}
    assert body["default"] == "USD"
    for currency in body["currencies"]:
        assert currency["name"]


def test_get_rates_reflects_mocked_live_refresh(client):
    response = client.get("/api/fx/rates")
    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "live"
    assert body["rates"] == MOCK_FX_RATES
    assert body["as_of"] is not None


def test_get_preference_defaults_to_usd(client):
    response = client.get("/api/fx/preference")
    assert response.status_code == 200
    assert response.json() == {"display_currency": "USD"}


def test_put_preference_round_trip(client):
    response = client.put("/api/fx/preference", json={"display_currency": "eur"})
    assert response.status_code == 200
    assert response.json() == {"display_currency": "EUR"}

    follow_up = client.get("/api/fx/preference")
    assert follow_up.json() == {"display_currency": "EUR"}


def test_put_preference_invalid_currency_returns_400(client):
    response = client.put("/api/fx/preference", json={"display_currency": "XXX"})
    assert response.status_code == 400
    assert response.json()["error_code"] == "invalid_request"


def test_put_preference_malformed_body_returns_400(client):
    response = client.put("/api/fx/preference", json={})
    assert response.status_code == 400
    assert response.json()["error_code"] == "invalid_request"
