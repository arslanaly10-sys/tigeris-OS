#!/usr/bin/env bash
# Local development helper: restarts the Python reasoning service on :8000.
set -e
pkill -f "uvicorn app.main:app" || true
cd "$(dirname "$0")/../services/reasoning"
nohup .venv/bin/uvicorn app.main:app --port 8000 > "${REASONING_LOG:-/tmp/tigeris-reasoning.log}" 2>&1 &
until curl -s localhost:8000/health | grep -q healthy; do sleep 1; done
echo "reasoning restarted"
