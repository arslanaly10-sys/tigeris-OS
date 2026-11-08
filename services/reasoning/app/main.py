"""TIGERIS reasoning service.

Owns deterministic calculations: propagation over the intelligence graph, the four scenario
horizons, Monte Carlo ranges and the structural resilience score. Model-written text never
produces a number here (FR-20, TR-029). Week 1 ships the service contract and health check;
the scenario engine lives in engine.py.
"""
from datetime import datetime, timezone

from fastapi import FastAPI

from typing import Any

from fastapi import Body

from .engine import DRIVERS, MODEL_VERSION, PARAMETERS, TEMPLATES, run_scenario
from .horizons import HORIZONS, horizon_windows

app = FastAPI(title="TIGERIS reasoning service", version="0.1.0")


@app.get("/health")
def health() -> dict:
    return {
        "service": "tigeris-reasoning",
        "status": "healthy",
        "engines": {"scenarios": MODEL_VERSION, "monte_carlo": "seeded", "resilience": "structural score v1"},
        "time": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/horizons")
def horizons(as_of: str | None = None) -> dict:
    """The four fixed horizons (Q070) as explicit date windows from an as-of time (TR-036)."""
    start = datetime.fromisoformat(as_of) if as_of else datetime.now(timezone.utc)
    return {"as_of": start.isoformat(), "horizons": horizon_windows(start), "keys": [h.key for h in HORIZONS]}


@app.get("/scenarios/templates")
def templates() -> dict:
    return {"model_version": MODEL_VERSION, "drivers": DRIVERS, "parameters": PARAMETERS, "templates": {k: {"kind": v["kind"], "route": v["route"], "drivers": v["drivers"]} for k, v in TEMPLATES.items()}}


@app.post("/scenarios/run")
def run(payload: dict[str, Any] = Body(...)) -> dict:
    """Runs one scenario deterministically. The caller persists the result with its lineage."""
    return run_scenario(payload)
