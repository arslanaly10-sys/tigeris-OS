from app.engine import TEMPLATES, run_scenario

FACTS = {
    "hormuz_flow_mbd": {"value": 20, "fact_id": "f-flow"},
    "hormuz_world_share_pct": {"value": 20, "fact_id": "f-share"},
    "bypass_capacity_mbd": {"value": 2.6, "fact_id": "f-bypass"},
    "gcc_crude_exports_kbd": {"SAU": {"value": 6000, "fact_id": "f-sau"}, "ARE": {"value": 3000, "fact_id": "f-are"}},
}
EXPOSURES = [
    {"holding_key": "h1", "name": "Energy A", "sector": "Energy", "value_usd": 1e9, "path_strength": 0.6, "via_origin": True, "value_fact_id": "f-h1"},
    {"holding_key": "h2", "name": "Logistics B", "sector": "Logistics", "value_usd": 5e8, "path_strength": 0.4, "via_origin": True, "value_fact_id": "f-h2"},
]


def payload(**over):
    return {"template": "hormuz", "facts": FACTS, "exposures": EXPOSURES, "portfolio_value_usd": 5e9, "monte_carlo_runs": 60, "seed": 3, **over}


def metric(r, key, horizon):
    return next(x for x in r["results"] if x["key"] == key and x["horizon"] == horizon)


def test_deterministic_replay():
    a, b = run_scenario(payload()), run_scenario(payload())
    assert a["results"] == b["results"] and a["input_hash"] == b["input_hash"]


def test_four_horizons_with_ranges_and_lineage():
    r = run_scenario(payload())
    assert [h["key"] for h in r["horizons"]] == ["72h", "90d", "1y", "5y"]
    m = metric(r, "avg_net_shortfall_mbd", "90d")
    assert m["p10"] <= m["p50"] <= m["p90"]
    refs = {i.get("ref") for i in m["inputs"] if i["kind"] == "fact"}
    assert {"f-flow", "f-bypass"} <= refs
    assert any(i["key"] == "driver.route_availability_pct" for i in m["inputs"])


def test_shortfall_is_flow_lost_minus_usable_bypass():
    r = run_scenario(payload(monte_carlo_runs=0, drivers={"duration_days": 200, "route_availability_pct": 60}))
    day30 = r["cascade"][30]
    assert abs(day30["gross_loss_mbd"] - 8.0) < 1e-6  # 20 x (1 - 0.6)
    assert abs(day30["net_shortfall_mbd"] - (8.0 - 2.6 * 0.85)) < 1e-6


def test_disruption_raises_price_and_worsens_with_duration():
    short = run_scenario(payload(monte_carlo_runs=0, drivers={"duration_days": 10}))
    long = run_scenario(payload(monte_carlo_runs=0, drivers={"duration_days": 120}))
    assert metric(short, "avg_oil_price_usd", "90d")["value"] > 80
    assert metric(long, "cumulative_lost_mb", "1y")["value"] > metric(short, "cumulative_lost_mb", "1y")["value"]
    assert long["resilience"]["score"] < short["resilience"]["score"]


def test_cascade_runs_to_day_150_and_recovers():
    r = run_scenario(payload(monte_carlo_runs=0, drivers={"duration_days": 30}))
    assert len(r["cascade"]) == 151
    assert r["cascade"][150]["availability_pct"] == 100


def test_oil_45_lowers_export_revenue_without_volume_loss():
    r = run_scenario(payload(template="oil45", monte_carlo_runs=0))
    assert metric(r, "cumulative_lost_mb", "1y")["value"] == 0
    assert metric(r, "gcc_export_revenue_change_usd", "1y")["value"] < 0
    assert metric(r, "portfolio_value_at_risk_usd", "1y")["value"] > 0


def test_every_template_runs():
    for t in TEMPLATES:
        r = run_scenario(payload(template=t, monte_carlo_runs=5))
        assert len(r["results"]) == 25 and r["resilience"]["score"] >= 0
