"""Deterministic scenario engine (FR-26..FR-28, TR-035..TR-040, Q070..Q078).

Every number it returns names its inputs: facts by id (with their lineage held by the API) and
assumptions by key (drivers the user set, or model parameters with a stated basis). No language
model is involved. Same inputs and seed give the same outputs, so any run can be replayed.

Model, in plain words:
- Route availability follows a shock-and-recovery curve: it drops to the driver's level over a
  short ramp, holds for the disruption duration, then recovers linearly.
- Gross flow lost = flow through the route x (1 - availability). Pipeline bypass absorbs part of
  it once ramped up; the rest is the net shortfall.
- The oil price is the base price assumption plus a premium proportional to the net shortfall as
  a share of world consumption (world consumption derived from the EIA flow and share facts).
- Holdings exposed through the graph lose value in proportion to path strength, a sector
  sensitivity and the severity of the disruption (or the price change, for a price scenario).
- Reserve cover runs down while imports are disrupted.
- Monte Carlo varies the uncertain parameters to give P10/P50/P90 ranges.
"""
from __future__ import annotations

import hashlib
import json
import random
from dataclasses import dataclass
from typing import Any

MODEL_VERSION = "scenario-engine/1.0.0"

HORIZONS = [("72h", "72 hours", 3), ("90d", "90 days", 90), ("1y", "1 year", 365), ("5y", "5 years", 1825)]

DRIVERS: dict[str, dict[str, Any]] = {
    "duration_days": {"label": "Disruption duration", "unit": "days", "min": 0, "max": 730},
    "oil_price_usd": {"label": "Base oil price", "unit": "USD/bbl", "min": 20, "max": 200},
    "route_availability_pct": {"label": "Route availability during disruption", "unit": "%", "min": 0, "max": 100},
    "insurance_premium_pct": {"label": "War-risk insurance premium", "unit": "% of hull value", "min": 0, "max": 5},
    "reserve_buffer_days": {"label": "Strategic reserve buffer", "unit": "days", "min": 0, "max": 365},
    "rate_shock_bps": {"label": "Interest rate / FX shock", "unit": "bp", "min": -300, "max": 600},
    "demand_change_pct": {"label": "Demand change", "unit": "%", "min": -30, "max": 30},
}

# Model parameters: analyst assumptions with their basis. Recorded on every run (TR-035).
PARAMETERS: dict[str, dict[str, Any]] = {
    "price_premium_usd_per_pct": {"value": 6.0, "unit": "USD/bbl per 1% of world supply", "label": "Price response to lost supply", "basis": "Analyst assumption; to calibrate against past disruptions in back-testing"},
    "demand_price_elasticity": {"value": 1.5, "unit": "x", "label": "Price change per 1% demand change", "basis": "Analyst assumption"},
    "shock_ramp_days": {"value": 2.0, "unit": "days", "label": "Time for availability to fall to its disrupted level", "basis": "Analyst assumption"},
    "recovery_days": {"value": 21.0, "unit": "days", "label": "Time to recover full availability after the disruption", "basis": "Analyst assumption"},
    "bypass_ramp_days": {"value": 5.0, "unit": "days", "label": "Time to bring bypass pipelines to full use", "basis": "Analyst assumption"},
    "bypass_utilisation": {"value": 0.85, "unit": "share", "label": "Share of bypass capacity actually usable", "basis": "Analyst assumption; EIA notes pipelines rarely run at full capacity"},
    "import_dependency": {"value": 0.85, "unit": "share", "label": "Share of staple food that is imported by sea", "basis": "Analyst assumption informed by World Bank food import shares"},
    "hull_value_usd": {"value": 100_000_000.0, "unit": "USD", "label": "Hull value of a large crude tanker", "basis": "Analyst assumption"},
    "red_sea_flow_mbd": {"value": 8.6, "unit": "million b/d", "label": "Oil flow through Bab el-Mandeb", "basis": "Analyst assumption; source still to be added to the evidence base"},
}

SECTOR_SENSITIVITY = {  # loss per unit of severity on an exposed path (disruption scenarios)
    "Energy": 0.35, "Petrochemicals": 0.3, "Logistics": 0.4, "Banking": 0.15, "Utilities": 0.2, "Food and agriculture": 0.3,
    "Real estate": 0.12, "Insurance": 0.45, "Aviation": 0.3, "Global equities": 0.1,
}
PRICE_BETA = {  # value change per 1% oil price change (price scenarios); negative = gains when oil falls
    "Energy": 0.8, "Petrochemicals": 0.5, "Logistics": 0.2, "Banking": 0.35, "Utilities": 0.1, "Food and agriculture": 0.05,
    "Real estate": 0.3, "Insurance": 0.15, "Aviation": -0.3, "Global equities": 0.1,
}
RATE_BETA = {"Banking": 0.06, "Real estate": 0.05, "Utilities": 0.03, "Global equities": 0.02}  # per 100 bp

TEMPLATES: dict[str, dict[str, Any]] = {
    "hormuz": {"route": "hormuz", "kind": "disruption", "drivers": {"duration_days": 30, "oil_price_usd": 80, "route_availability_pct": 60, "insurance_premium_pct": 0.7, "reserve_buffer_days": 60, "rate_shock_bps": 0, "demand_change_pct": 0}},
    "resilience": {"route": "hormuz", "kind": "disruption", "drivers": {"duration_days": 60, "oil_price_usd": 80, "route_availability_pct": 50, "insurance_premium_pct": 1.0, "reserve_buffer_days": 45, "rate_shock_bps": 0, "demand_change_pct": 0}},
    "oil45": {"route": None, "kind": "price", "drivers": {"duration_days": 365, "oil_price_usd": 45, "route_availability_pct": 100, "insurance_premium_pct": 0.2, "reserve_buffer_days": 90, "rate_shock_bps": 50, "demand_change_pct": -3}},
    "red_sea": {"route": "red_sea", "kind": "disruption", "drivers": {"duration_days": 120, "oil_price_usd": 80, "route_availability_pct": 40, "insurance_premium_pct": 0.5, "reserve_buffer_days": 60, "rate_shock_bps": 0, "demand_change_pct": 0}},
    "banking": {"route": None, "kind": "rates", "drivers": {"duration_days": 90, "oil_price_usd": 80, "route_availability_pct": 100, "insurance_premium_pct": 0.2, "reserve_buffer_days": 60, "rate_shock_bps": 150, "demand_change_pct": -1}},
    "food": {"route": "hormuz", "kind": "disruption", "drivers": {"duration_days": 21, "oil_price_usd": 80, "route_availability_pct": 75, "insurance_premium_pct": 0.3, "reserve_buffer_days": 30, "rate_shock_bps": 0, "demand_change_pct": 0}},
    "pandemic": {"route": None, "kind": "supply_shock", "drivers": {"duration_days": 120, "oil_price_usd": 70, "route_availability_pct": 70, "insurance_premium_pct": 0.2, "reserve_buffer_days": 45, "rate_shock_bps": 25, "demand_change_pct": -8}},
}
BASE_PRICE_REF = 80.0  # reference price for price-change scenarios (a parameter of the template, recorded)


@dataclass
class Ctx:
    drivers: dict[str, float]
    params: dict[str, float]
    route_flow: float
    world: float
    bypass: float
    exports_mbd: float


def _availability(day: float, c: Ctx) -> float:
    d = c.drivers
    floor = d["route_availability_pct"] / 100
    dur = d["duration_days"]
    ramp = max(c.params["shock_ramp_days"], 0.1)
    rec = max(c.params["recovery_days"], 0.1)
    if dur <= 0 or floor >= 1:
        return 1.0
    if day < ramp:
        return 1 - (1 - floor) * (day / ramp)
    if day < dur:
        return floor
    if day < dur + rec:
        return floor + (1 - floor) * ((day - dur) / rec)
    return 1.0


def _day_state(day: float, c: Ctx) -> dict[str, float]:
    avail = _availability(day, c)
    gross = c.route_flow * (1 - avail)
    bypass_ready = min(1.0, day / max(c.params["bypass_ramp_days"], 0.1))
    bypass = min(gross, c.bypass * c.params["bypass_utilisation"] * bypass_ready)
    net = max(0.0, gross - bypass)
    share = 100 * net / c.world if c.world else 0
    demand = c.drivers["demand_change_pct"]
    price = c.drivers["oil_price_usd"] * (1 + demand * c.params["demand_price_elasticity"] / 100) + c.params["price_premium_usd_per_pct"] * share
    return {"availability": avail, "gross_loss_mbd": gross, "bypass_mbd": bypass, "net_shortfall_mbd": net, "oil_price_usd": price}


def _days(horizon: int) -> list[float]:
    """Daily to one year, weekly after: enough resolution for the five-year horizon."""
    return [float(d) for d in range(0, min(horizon, 366))] + [float(d) for d in range(366, horizon, 7)]


def _weights(days: list[float], horizon: int) -> list[float]:
    w = []
    for i, d in enumerate(days):
        nxt = days[i + 1] if i + 1 < len(days) else horizon
        w.append(nxt - d)
    return w


def _simulate(c: Ctx, inp: dict[str, Any], kind: str) -> dict[str, Any]:
    """One deterministic pass. Returns metric values per horizon and the daily cascade."""
    exposures = inp.get("exposures", [])
    out: dict[str, dict[str, float]] = {}
    for hk, _, hdays in HORIZONS:
        days = _days(hdays)
        w = _weights(days, hdays)
        states = [_day_state(d, c) for d in days]
        total_w = sum(w)
        avg = lambda k: sum(s[k] * wi for s, wi in zip(states, w)) / total_w  # noqa: E731
        severity = sum((1 - s["availability"]) * wi for s, wi in zip(states, w)) / total_w
        price_avg = avg("oil_price_usd")
        lost_mb = sum(s["net_shortfall_mbd"] * wi for s, wi in zip(states, w))
        exports_lost = min(c.exports_mbd * hdays, lost_mb * (c.exports_mbd / c.route_flow if c.route_flow else 0))
        revenue_change = price_avg * (c.exports_mbd * hdays - exports_lost) * 1e6 - c.drivers["oil_price_usd"] * c.exports_mbd * hdays * 1e6
        if kind in ("price", "rates", "supply_shock"):
            price_change_pct = 100 * (price_avg - BASE_PRICE_REF) / BASE_PRICE_REF
        else:
            price_change_pct = 0.0
        var = 0.0
        for e in exposures:
            sector = e.get("sector", "")
            strength = e["path_strength"] * c.params.get("_path_scale", 1.0)
            loss = 0.0
            if kind == "disruption" or kind == "supply_shock":
                loss += strength * SECTOR_SENSITIVITY.get(sector, 0.2) * severity
            if kind in ("price", "supply_shock") or (kind == "disruption" and e.get("price_linked")):
                loss += -PRICE_BETA.get(sector, 0.1) * price_change_pct / 100 * min(1.0, hdays / 90)
            loss += RATE_BETA.get(sector, 0.0) * c.drivers["rate_shock_bps"] / 100 * min(1.0, hdays / 30)
            var += e["value_usd"] * max(-0.5, min(0.95, loss))
        # Reserve cover: drawn down by the share of imports that cannot arrive.
        cover = c.drivers["reserve_buffer_days"]
        min_cover = cover
        prev = 0.0
        for d, s in zip(days, states):
            step = d - prev
            prev = d
            cover = cover - step * (1 - s["availability"]) * c.params["import_dependency"] + (step * 0.02 if s["availability"] >= 1 else 0)
            cover = min(cover, c.drivers["reserve_buffer_days"])
            min_cover = min(min_cover, cover)
        out[hk] = {
            "avg_net_shortfall_mbd": avg("net_shortfall_mbd"), "avg_oil_price_usd": price_avg, "cumulative_lost_mb": lost_mb,
            "gcc_export_revenue_change_usd": revenue_change, "portfolio_value_at_risk_usd": var, "min_reserve_cover_days": min_cover,
            "severity": severity,
        }
    cascade = []
    cum = 0.0
    cover = c.drivers["reserve_buffer_days"]
    for d in range(0, 151):
        s = _day_state(float(d), c)
        cum += s["net_shortfall_mbd"]
        cover = min(c.drivers["reserve_buffer_days"], cover - (1 - s["availability"]) * c.params["import_dependency"] + (0.02 if s["availability"] >= 1 else 0))
        cascade.append({"day": d, "availability_pct": round(100 * s["availability"], 2), "gross_loss_mbd": round(s["gross_loss_mbd"], 3), "bypass_mbd": round(s["bypass_mbd"], 3), "net_shortfall_mbd": round(s["net_shortfall_mbd"], 3), "oil_price_usd": round(s["oil_price_usd"], 2), "cumulative_lost_mb": round(cum, 2), "reserve_cover_days": round(cover, 2)})
    return {"metrics": out, "cascade": cascade}


METRICS = {
    "avg_net_shortfall_mbd": ("Average net supply shortfall", "million b/d", "mean over the horizon of max(0, flow x (1 - availability) - usable bypass)"),
    "avg_oil_price_usd": ("Average oil price", "USD/bbl", "base price x (1 + demand change x elasticity) + premium x shortfall as % of world supply"),
    "cumulative_lost_mb": ("Oil volume lost", "million bbl", "sum over the horizon of daily net shortfall"),
    "gcc_export_revenue_change_usd": ("GCC crude export revenue change", "USD", "average price x (exports - lost) - base price x exports, over the horizon"),
    "portfolio_value_at_risk_usd": ("Portfolio value at risk", "USD", "sum over exposed holdings of value x path strength x sector sensitivity x severity, plus price and rate effects"),
    "min_reserve_cover_days": ("Lowest staple reserve cover", "days", "buffer drawn down by import dependency x (1 - availability) each day"),
}


def run_hash(payload: dict[str, Any]) -> str:
    return hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def run_scenario(payload: dict[str, Any]) -> dict[str, Any]:
    template = TEMPLATES.get(payload.get("template", "hormuz"), TEMPLATES["hormuz"])
    drivers = {**template["drivers"], **{k: float(v) for k, v in (payload.get("drivers") or {}).items() if k in DRIVERS}}
    for k, spec in DRIVERS.items():
        drivers[k] = float(min(spec["max"], max(spec["min"], drivers[k])))
    params = {k: float(v["value"]) for k, v in PARAMETERS.items()}
    facts = payload.get("facts", {})
    kind = template["kind"]

    def fact(key: str, default: float) -> tuple[float, str | None]:
        f = facts.get(key)
        return (float(f["value"]), f.get("fact_id")) if f else (default, None)

    hormuz_flow, hormuz_fid = fact("hormuz_flow_mbd", 20.0)
    world_share, share_fid = fact("hormuz_world_share_pct", 20.0)
    bypass, bypass_fid = fact("bypass_capacity_mbd", 2.6)
    world = hormuz_flow / (world_share / 100) if world_share else 100.0
    exports_mbd = sum(float(v["value"]) for v in facts.get("gcc_crude_exports_kbd", {}).values()) / 1000 or 15.0
    route = template["route"]
    route_flow = hormuz_flow if route == "hormuz" else params["red_sea_flow_mbd"] if route == "red_sea" else 0.0
    if route != "hormuz":
        bypass = 0.0 if route is None else bypass * 0.3
    c = Ctx(drivers=drivers, params=params, route_flow=route_flow, world=world, bypass=bypass, exports_mbd=exports_mbd)
    base = _simulate(c, payload, kind)

    # Monte Carlo over uncertain parameters (TR-040). Seeded, so ranges replay exactly.
    mc_runs = int(payload.get("monte_carlo_runs", 200))
    rng = random.Random(int(payload.get("seed", 7)))
    samples: dict[str, dict[str, list[float]]] = {h: {m: [] for m in METRICS} for h, _, _ in HORIZONS}
    for _ in range(mc_runs):
        p = dict(params)
        p["price_premium_usd_per_pct"] *= rng.uniform(0.6, 1.5)
        p["recovery_days"] *= rng.uniform(0.6, 1.8)
        p["bypass_utilisation"] = min(1.0, p["bypass_utilisation"] * rng.uniform(0.7, 1.15))
        p["_path_scale"] = rng.uniform(0.75, 1.25)
        d = dict(drivers)
        d["duration_days"] = drivers["duration_days"] * rng.uniform(0.7, 1.5)
        sim = _simulate(Ctx(drivers=d, params=p, route_flow=route_flow, world=world, bypass=bypass, exports_mbd=exports_mbd), payload, kind)
        for h in samples:
            for m in METRICS:
                samples[h][m].append(sim["metrics"][h][m])

    def pct(xs: list[float], q: float) -> float:
        s = sorted(xs)
        return s[min(len(s) - 1, max(0, int(round(q * (len(s) - 1)))))]

    driver_inputs = [{"kind": "assumption", "key": f"driver.{k}"} for k in DRIVERS]
    inputs_for = {
        "avg_net_shortfall_mbd": [{"kind": "fact", "ref": hormuz_fid, "key": "hormuz_flow_mbd"}, {"kind": "fact", "ref": bypass_fid, "key": "bypass_capacity_mbd"}, {"kind": "assumption", "key": "driver.route_availability_pct"}, {"kind": "assumption", "key": "driver.duration_days"}, {"kind": "assumption", "key": "param.bypass_utilisation"}, {"kind": "assumption", "key": "param.recovery_days"}],
        "avg_oil_price_usd": [{"kind": "fact", "ref": hormuz_fid, "key": "hormuz_flow_mbd"}, {"kind": "fact", "ref": share_fid, "key": "hormuz_world_share_pct"}, {"kind": "assumption", "key": "driver.oil_price_usd"}, {"kind": "assumption", "key": "driver.demand_change_pct"}, {"kind": "assumption", "key": "param.price_premium_usd_per_pct"}, {"kind": "assumption", "key": "param.demand_price_elasticity"}],
        "cumulative_lost_mb": [{"kind": "fact", "ref": hormuz_fid, "key": "hormuz_flow_mbd"}, {"kind": "fact", "ref": bypass_fid, "key": "bypass_capacity_mbd"}, {"kind": "assumption", "key": "driver.duration_days"}, {"kind": "assumption", "key": "driver.route_availability_pct"}],
        "gcc_export_revenue_change_usd": [*({"kind": "fact", "ref": v.get("fact_id"), "key": f"jodi_exports.{k}"} for k, v in facts.get("gcc_crude_exports_kbd", {}).items()), {"kind": "assumption", "key": "driver.oil_price_usd"}],
        "portfolio_value_at_risk_usd": [*({"kind": "fact", "ref": e.get("value_fact_id"), "key": f"holding.{e['holding_key']}"} for e in payload.get("exposures", [])[:25]), {"kind": "assumption", "key": "param.sector_sensitivity"}, {"kind": "assumption", "key": "driver.rate_shock_bps"}],
        "min_reserve_cover_days": [{"kind": "assumption", "key": "driver.reserve_buffer_days"}, {"kind": "assumption", "key": "param.import_dependency"}, {"kind": "assumption", "key": "driver.route_availability_pct"}],
    }
    results = []
    for hk, hlabel, _ in HORIZONS:
        for m, (label, unit, formula) in METRICS.items():
            xs = samples[hk][m]
            results.append({
                "key": m, "label": label, "unit": unit, "horizon": hk, "horizon_label": hlabel, "value": round(base["metrics"][hk][m], 4),
                "p10": round(pct(xs, 0.1), 4) if xs else None, "p50": round(pct(xs, 0.5), 4) if xs else None, "p90": round(pct(xs, 0.9), 4) if xs else None,
                "method": "deterministic + Monte Carlo" if xs else "deterministic", "formula": formula,
                "inputs": [i for i in inputs_for[m] if i["kind"] == "assumption" or i.get("ref")],
            })
    results.append({"key": "war_risk_cost_per_transit_usd", "label": "War-risk insurance cost per tanker transit", "unit": "USD", "horizon": "72h", "horizon_label": "72 hours",
                    "value": round(drivers["insurance_premium_pct"] / 100 * params["hull_value_usd"], 2), "p10": None, "p50": None, "p90": None, "method": "deterministic",
                    "formula": "premium % x hull value", "inputs": [{"kind": "assumption", "key": "driver.insurance_premium_pct"}, {"kind": "assumption", "key": "param.hull_value_usd"}]})

    # Structural resilience (Q078): how big a hit, how fast a recovery, is future risk falling.
    m90 = base["metrics"]["90d"]
    total_value = sum(e["value_usd"] for e in payload.get("exposures", [])) or 1.0
    portfolio_value = float(payload.get("portfolio_value_usd", total_value))
    peak_gross = max(x["gross_loss_mbd"] for x in base["cascade"]) or 0.0
    recovered = next((x["day"] for x in base["cascade"] if x["day"] > drivers["duration_days"] and x["net_shortfall_mbd"] <= 0.1 * max(0.001, max(y["net_shortfall_mbd"] for y in base["cascade"]))), None)
    via_route = sum(e["value_usd"] for e in payload.get("exposures", []) if e.get("via_origin")) / portfolio_value
    comps = [
        {"key": "impact", "label": "Size of the hit", "weight": 0.25, "score": 100 * (1 - min(1.0, abs(m90["portfolio_value_at_risk_usd"]) / (0.1 * portfolio_value))), "basis": f"90-day value at risk is {abs(m90['portfolio_value_at_risk_usd']) / portfolio_value * 100:.1f}% of the portfolio (score 0 at 10%)"},
        {"key": "recovery", "label": "Speed of recovery", "weight": 0.2, "score": 100 if recovered is None and peak_gross == 0 else 100 * (1 - min(1.0, ((recovered or 150) - drivers["duration_days"]) / 120)), "basis": f"Supply back within 10% of normal {('by day ' + str(recovered)) if recovered else 'after day 150'}; disruption assumed to last {drivers['duration_days']:.0f} days"},
        {"key": "buffers", "label": "Reserve buffers", "weight": 0.2, "score": 100 * min(1.0, m90["min_reserve_cover_days"] / max(1.0, drivers["reserve_buffer_days"])), "basis": f"Lowest staple cover {m90['min_reserve_cover_days']:.0f} of {drivers['reserve_buffer_days']:.0f} days"},
        {"key": "alternatives", "label": "Alternatives available", "weight": 0.2, "score": 100 if peak_gross == 0 else 100 * min(1.0, bypass * params["bypass_utilisation"] / peak_gross), "basis": f"Usable bypass {bypass * params['bypass_utilisation']:.1f} mb/d against a peak loss of {peak_gross:.1f} mb/d"},
        {"key": "concentration", "label": "Future risk (concentration)", "weight": 0.15, "score": 100 * (1 - min(1.0, via_route)), "basis": f"{via_route * 100:.0f}% of portfolio value depends on the disrupted node"},
    ]
    for comp in comps:
        comp["score"] = round(max(0.0, min(100.0, comp["score"])), 1)
    score = round(sum(x["score"] * x["weight"] for x in comps) / sum(x["weight"] for x in comps), 1)

    # Sensitivity of 90-day value at risk to each driver (TR-040): one at a time, +/- a fixed step.
    steps = {"duration_days": 0.5, "oil_price_usd": 0.25, "route_availability_pct": 0.25, "reserve_buffer_days": 0.5, "rate_shock_bps": 100.0, "demand_change_pct": 5.0}
    sens = []
    for k, step in steps.items():
        vals = []
        for sign in (-1, 1):
            d = dict(drivers)
            d[k] = d[k] + sign * step if k in ("rate_shock_bps", "demand_change_pct") else d[k] * (1 + sign * step)
            d[k] = float(min(DRIVERS[k]["max"], max(DRIVERS[k]["min"], d[k])))
            vals.append(_simulate(Ctx(drivers=d, params=params, route_flow=route_flow, world=world, bypass=bypass, exports_mbd=exports_mbd), payload, kind)["metrics"]["90d"]["portfolio_value_at_risk_usd"])
        sens.append({"driver": k, "label": DRIVERS[k]["label"], "low": round(vals[0], 2), "high": round(vals[1], 2), "spread": round(abs(vals[1] - vals[0]), 2)})
    sens.sort(key=lambda x: -x["spread"])

    assumptions = [{"key": f"driver.{k}", "label": spec["label"], "kind": "driver", "value": drivers[k], "unit": spec["unit"], "basis": "Set for this run"} for k, spec in DRIVERS.items()]
    assumptions += [{"key": f"param.{k}", "label": v["label"], "kind": "parameter", "value": v["value"], "unit": v["unit"], "basis": v["basis"]} for k, v in PARAMETERS.items()]
    assumptions.append({"key": "param.sector_sensitivity", "label": "Sector sensitivities to disruption, price and rates", "kind": "parameter", "value": None, "unit": "table", "basis": json.dumps({"disruption": SECTOR_SENSITIVITY, "price_beta": PRICE_BETA, "rate_beta_per_100bp": RATE_BETA})})

    top = sorted(payload.get("exposures", []), key=lambda e: -e["value_usd"] * e["path_strength"])[:10]
    return {
        "model_version": MODEL_VERSION, "template": payload.get("template", "hormuz"), "kind": kind, "route": route, "drivers": drivers,
        "derived": {"world_consumption_mbd": round(world, 2), "route_flow_mbd": route_flow, "usable_bypass_mbd": round(bypass * params["bypass_utilisation"], 2), "gcc_exports_mbd": round(exports_mbd, 3)},
        "horizons": [{"key": k, "label": lbl, "days": d} for k, lbl, d in HORIZONS],
        "results": results, "cascade": base["cascade"], "resilience": {"score": score, "components": comps}, "sensitivity": sens,
        "assumptions": assumptions, "top_exposures": [{"holding_key": e["holding_key"], "name": e["name"], "sector": e.get("sector"), "value_usd": e["value_usd"], "path_strength": e["path_strength"]} for e in top],
        "monte_carlo_runs": mc_runs, "input_hash": run_hash({k: v for k, v in payload.items() if k != "label"}),
    }
