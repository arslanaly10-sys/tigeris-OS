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

from . import llm
from .backtest import MODEL_VERSION as BACKTEST_VERSION, run_backtest
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


@app.get("/llm/status")
def llm_status() -> dict:
    """Local model presence, hash and load state. Weights stay on this host."""
    return llm.status()


@app.post("/llm/chat")
def llm_chat(payload: dict[str, Any] = Body(...)) -> dict:
    """Bounded local completion for the API gateway. The gateway enforces policy before calling."""
    return llm.chat(payload.get("messages", []), int(payload.get("max_tokens", 256)), payload.get("json_schema"))


@app.get("/embed/status")
def embed_status() -> dict:
    return llm.embed_status()


@app.post("/embed")
def embed(payload: dict[str, Any] = Body(...)) -> dict:
    """Local embeddings for memory search. Input texts never leave this host."""
    return llm.embed([str(t) for t in payload.get("texts", [])][:64])


@app.post("/backtest/run")
def backtest(payload: dict[str, Any] = Body(...)) -> dict:
    """Fits the price response on historical episodes; deterministic for the same input."""
    return run_backtest(payload)
