from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "healthy"


def test_four_fixed_horizons_with_explicit_windows():
    r = client.get("/horizons", params={"as_of": "2026-11-06T00:00:00+00:00"})
    body = r.json()
    assert [h["key"] for h in body["horizons"]] == ["72h", "90d", "1y", "5y"]
    assert body["horizons"][0]["end"].startswith("2026-11-09")
    assert body["horizons"][1]["end"].startswith("2027-02-04")
    assert body["horizons"][3]["end"].startswith("2031-11-06")
