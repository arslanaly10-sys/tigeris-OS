"""Local model runtime contract (Q066). Runs without the model file: it must report, not crash."""
from pathlib import Path

from app import llm


def test_status_reports_missing_model(monkeypatch):
    monkeypatch.setattr(llm, "MODEL_PATH", Path("/nonexistent/model.gguf"))
    monkeypatch.setattr(llm, "_model", None)
    s = llm.status()
    assert s["present"] is False and s["provider"] == "local"
    assert "local disk" in s["network"]


def test_chat_without_model_returns_error_not_exception(monkeypatch):
    monkeypatch.setattr(llm, "MODEL_PATH", Path("/nonexistent/model.gguf"))
    monkeypatch.setattr(llm, "_model", None)
    r = llm.chat([{"role": "user", "content": "hello"}], max_tokens=10)
    assert r["ok"] is False and "not found" in r["error"]


def test_embed_without_model_returns_error(monkeypatch):
    monkeypatch.setattr(llm, "EMBED_PATH", Path("/nonexistent/embed.gguf"))
    monkeypatch.setattr(llm, "_embedder", None)
    r = llm.embed(["hello"])
    assert r["ok"] is False and "not found" in r["error"]
