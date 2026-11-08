"""Back-test arithmetic is checkable by hand (TR-039)."""
from app.backtest import run_backtest
from app.engine import run_scenario


def _ep(key, date, loss, world, pre, post):
    prices = [{"date": f"2000-01-{d:02d}", "value": pre} for d in range(1, 11)] + [{"date": f"2000-01-{d:02d}", "value": post} for d in range(11, 21)]
    return {"key": key, "name": key, "date": "2000-01-11", "loss_mbd": loss, "world_mbd": world, "prices": prices}


def test_fit_through_origin_recovers_a_known_response():
    # 5% of supply lost -> +25% move; 2% -> +10%: exactly 5% per 1%.
    r = run_backtest({"episodes": [_ep("a", "", 5, 100, 80, 100), _ep("b", "", 2, 100, 50, 55)]})
    assert abs(r["fitted"]["response_pct_per_pct"] - 5.0) < 1e-9
    assert r["metrics"]["mae_pp"] < 1e-9
    assert r["fitted"]["premium_usd_per_pct_at_80"] == 4.0


def test_calibration_changes_the_engine_parameter_and_its_basis():
    base = run_scenario({"template": "hormuz"})
    cal = run_scenario({"template": "hormuz", "calibration": {"id": "abc12345", "response_pct_per_pct": 2.5, "episodes": 4, "mae_pp": 1.0, "loo_mae_pp": 1.5}})
    a = {x["key"]: x for x in cal["assumptions"]}
    assert abs(a["param.price_premium_usd_per_pct"]["value"] - 2.0) < 1e-9  # 2.5% of USD 80
    assert a["param.price_premium_usd_per_pct"]["basis"].startswith("Calibrated by back-test abc12345")
    assert cal["input_hash"] != base["input_hash"]
