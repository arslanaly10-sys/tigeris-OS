#!/usr/bin/env bash
# Local development helper: starts the PostgreSQL 16 cluster if it is not running.
set -e
if ! pg_lsclusters 2>/dev/null | grep -q "16 *main.*online"; then
  pg_ctlcluster 16 main start
  until pg_isready -q; do sleep 1; done
fi
