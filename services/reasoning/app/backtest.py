"""Back-test of the price response parameter (TR-039, Q050).

For each historical disruption the observed Brent move is the average of the first three trading days
from the event date (the 72-hour horizon) against the average of the ten trading days before it. The
model's response is r x (supply lost / world demand, in %), so r is fitted by least squares through the
origin. Leave-one-out error says how well r carries to an episode it was not fitted on. The engine
uses r as a relative response: premium in USD per 1% of world supply = r / 100 x base oil price.
"""
from __future__ import annotations

import hashlib
import json
from statistics import mean
from typing import Any

MODEL_VERSION = "backtest/1.0.0"
PRIOR_PREMIUM_USD = 6.0  # analyst assumption before calibration, at the reference price below
REFERENCE_PRICE = 80.0


def _window(prices: list[dict], date: str, pre: int, post: int) -> tuple[list[dict], list[dict]]:
    ordered = sorted(prices, key=lambda p: p["date"])
    i = next((k for k, p in enumerate(ordered) if p["date"] >= date), len(ordered))
    return ordered[max(0, i - pre):i], ordered[i:i + post]


def run_backtest(payload: dict[str, Any]) -> dict[str, Any]:
    pre_n = int(payload.get("pre_days", 10))
    post_n = int(payload.get("post_days", 3))
    rows = []
    for e in payload["episodes"]:
        before, after = _window(e["prices"], e["date"], pre_n, post_n)
        _, after10 = _window(e["prices"], e["date"], pre_n, 10)
        if len(before) < pre_n or len(after) < post_n:
            continue
        pre = mean(p["value"] for p in before)
        post = mean(p["value"] for p in after)
        post10 = mean(p["value"] for p in after10)
        share = e["loss_mbd"] / e["world_mbd"] * 100
        rows.append({
            "key": e["key"], "name": e["name"], "date": e["date"], "share_pct": round(share, 3),
            "pre_avg": round(pre, 3), "post_avg": round(post, 3), "post10_avg": round(post10, 3),
            "observed_pct": round((post / pre - 1) * 100, 3), "observed10_pct": round((post10 / pre - 1) * 100, 3),
            "fact_ids": [p.get("fact_id") for p in before + after if p.get("fact_id")],
            "assumption_fact_ids": e.get("fact_ids", []),
        })
    if len(rows) < 2:
        raise ValueError("At least two complete episodes are needed")
    sxy = sum(r["observed_pct"] * r["share_pct"] for r in rows)
    sxx = sum(r["share_pct"] ** 2 for r in rows)
    fitted = sxy / sxx
    prior = PRIOR_PREMIUM_USD / REFERENCE_PRICE * 100
    for r in rows:
        r["predicted_pct"] = round(fitted * r["share_pct"], 3)
        r["prior_pct"] = round(prior * r["share_pct"], 3)
        others = [x for x in rows if x is not r]
        r_loo = sum(x["observed_pct"] * x["share_pct"] for x in others) / sum(x["share_pct"] ** 2 for x in others)
        r["loo_predicted_pct"] = round(r_loo * r["share_pct"], 3)
    mae = mean(abs(r["observed_pct"] - r["predicted_pct"]) for r in rows)
    loo = mean(abs(r["observed_pct"] - r["loo_predicted_pct"]) for r in rows)
    prior_mae = mean(abs(r["observed_pct"] - r["prior_pct"]) for r in rows)
    clean = {k: v for k, v in payload.items() if k != "label"}
    return {
        "model_version": MODEL_VERSION,
        "method": f"Average of first {post_n} trading days from the event vs average of the {pre_n} before; least squares through the origin on share of world supply lost.",
        "episodes": rows,
        "fitted": {"response_pct_per_pct": round(fitted, 4), "premium_usd_per_pct_at_80": round(fitted / 100 * REFERENCE_PRICE, 3)},
        "prior": {"response_pct_per_pct": round(prior, 4), "premium_usd_per_pct_at_80": PRIOR_PREMIUM_USD},
        "metrics": {"episodes": len(rows), "mae_pp": round(mae, 3), "loo_mae_pp": round(loo, 3), "prior_mae_pp": round(prior_mae, 3)},
        "input_hash": hashlib.sha256(json.dumps(clean, sort_keys=True, separators=(",", ":")).encode()).hexdigest(),
    }
