#!/usr/bin/env bash
# Local development helper: restarts the API server in the background.
set -e
pkill -f "apps/api/node_modules/.bin/../tsx" || true
pkill -f "tsx/dist/loader.mjs src/index.ts" || true
cd "$(dirname "$0")/../apps/api"
nohup pnpm start > "${API_LOG:-/tmp/tigeris-api.log}" 2>&1 &
until curl -s localhost:4000/health | grep -q healthy; do sleep 1; done
echo "api restarted"
