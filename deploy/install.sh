#!/usr/bin/env bash
# Installs and starts TIGERIS from this package. Works without internet access.
#   ./install.sh            laptop: http://localhost:3000
#   ./install.sh vm         VM: https://$TIGERIS_DOMAIN (set it first)
set -euo pipefail
cd "$(dirname "$0")"
echo "== checking files"; sha256sum --quiet -c SHA256SUMS
echo "== loading images"; gunzip -c images.tar.gz | docker load
if [ "${1:-laptop}" = "vm" ]; then
  : "${TIGERIS_DOMAIN:?Set TIGERIS_DOMAIN to the DNS name of this VM}"
  docker compose -f docker-compose.yml -f docker-compose.vm.yml up -d --no-build
  echo "== TIGERIS is starting at https://${TIGERIS_DOMAIN}"
else
  docker compose up -d --no-build
  echo "== TIGERIS is starting at http://localhost:${WEB_PORT:-3000}"
fi
echo "   Seeding the demo takes about a minute on first start: docker compose logs -f seed"
