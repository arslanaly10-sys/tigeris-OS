"""Local open-weight model runtime (Q066, TR-021).

Runs a quantised instruction model on this machine with llama.cpp. Nothing leaves the host: the
weights are read from disk and there is no network call. The model only writes text; the API's
gateway decides whether it may be called, checks citations and records the trace (FR-20).
Greedy decoding with a fixed seed makes the same prompt give the same text, so replay works.
"""
from __future__ import annotations

import hashlib
import os
import threading
import time
from pathlib import Path
from typing import Any

DEFAULT_PATH = Path(__file__).resolve().parents[3] / "data" / "models" / "qwen2.5-1.5b-instruct-q4_k_m.gguf"
MODEL_PATH = Path(os.environ.get("LOCAL_MODEL_PATH", str(DEFAULT_PATH)))
MODEL_NAME = os.environ.get("LOCAL_MODEL_NAME", "Qwen2.5 1.5B Instruct (Q4_K_M, Apache-2.0)")
THREADS = int(os.environ.get("LOCAL_MODEL_THREADS", str(min(8, os.cpu_count() or 4))))

_lock = threading.Lock()
_model: Any = None
_load_error: str | None = None
_file_hash: str | None = None


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _load() -> Any:
    global _model, _load_error, _file_hash
    if _model is not None:
        return _model
    if not MODEL_PATH.exists():
        _load_error = f"Model file not found at {MODEL_PATH.name}. Import it with the air-gap model package."
        return None
    try:
        from llama_cpp import Llama  # imported lazily so the scenario engine runs without it
    except ImportError:
        _load_error = "llama.cpp runtime is not installed in this service."
        return None
    _model = Llama(model_path=str(MODEL_PATH), n_ctx=4096, n_threads=THREADS, seed=7, verbose=False)
    _file_hash = _sha256(MODEL_PATH)
    _load_error = None
    return _model


def status() -> dict:
    present = MODEL_PATH.exists()
    return {
        "provider": "local",
        "model": MODEL_NAME,
        "file": MODEL_PATH.name,
        "present": present,
        "size_bytes": MODEL_PATH.stat().st_size if present else None,
        "loaded": _model is not None,
        "sha256": _file_hash,
        "threads": THREADS,
        "error": _load_error,
        "network": "none: weights read from local disk",
    }


def chat(messages: list[dict], max_tokens: int = 256, json_schema: dict | None = None) -> dict:
    """One bounded completion. Serialised: one generation at a time on this host."""
    with _lock:
        model = _load()
        if model is None:
            return {"ok": False, "error": _load_error}
        t0 = time.time()
        kwargs: dict[str, Any] = {"messages": messages, "temperature": 0.0, "top_k": 1, "seed": 7, "max_tokens": max(16, min(max_tokens, 700))}
        if json_schema is not None:
            kwargs["response_format"] = {"type": "json_object", "schema": json_schema}
        r = model.create_chat_completion(**kwargs)
        return {
            "ok": True,
            "model": MODEL_NAME,
            "text": r["choices"][0]["message"]["content"] or "",
            "finish_reason": r["choices"][0].get("finish_reason"),
            "tokens_in": r["usage"]["prompt_tokens"],
            "tokens_out": r["usage"]["completion_tokens"],
            "latency_ms": int((time.time() - t0) * 1000),
            "sha256": _file_hash,
        }


# ---- Embeddings for institutional memory search (Q103) ----
EMBED_PATH = Path(os.environ.get("EMBED_MODEL_PATH", str(DEFAULT_PATH.parent / "bge-small-en-v1.5-q8_0.gguf")))
EMBED_NAME = os.environ.get("EMBED_MODEL_NAME", "bge-small-en-v1.5 (Q8_0, MIT, 384 dimensions)")
_embedder: Any = None
_embed_lock = threading.Lock()


def embed_status() -> dict:
    return {"model": EMBED_NAME, "file": EMBED_PATH.name, "present": EMBED_PATH.exists(), "dimensions": 384, "network": "none: weights read from local disk"}


def embed(texts: list[str]) -> dict:
    """Normalised sentence embeddings, so cosine distance is 1 minus the dot product."""
    global _embedder
    with _embed_lock:
        if _embedder is None:
            if not EMBED_PATH.exists():
                return {"ok": False, "error": f"Embedding model not found at {EMBED_PATH.name}."}
            try:
                from llama_cpp import Llama
            except ImportError:
                return {"ok": False, "error": "llama.cpp runtime is not installed in this service."}
            _embedder = Llama(model_path=str(EMBED_PATH), embedding=True, n_ctx=512, n_threads=THREADS, verbose=False)
        vecs = _embedder.embed([t[:2000] for t in texts], normalize=True)
        return {"ok": True, "model": EMBED_NAME, "dimensions": len(vecs[0]) if vecs else 384, "vectors": vecs}
