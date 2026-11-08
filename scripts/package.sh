#!/usr/bin/env bash
# Builds the offline package for a laptop or a VM (ADR-0003, SCOPE §14).
# Output: dist/tigeris-<version>/ with images, compose files, models, data packages and checksums.
#   scripts/package.sh [version]
set -euo pipefail
cd "$(dirname "$0")/.."
VERSION="${1:-demo}"
OUT="dist/tigeris-${VERSION}"
rm -rf "$OUT" && mkdir -p "$OUT/data/models" "$OUT/data/packages" "$OUT/deploy" "$OUT/db" "$OUT/docker/certs"
for f in data/models/qwen2.5-1.5b-instruct-q4_k_m.gguf data/models/bge-small-en-v1.5-q8_0.gguf; do
  [ -f "$f" ] || { echo "missing $f (see README: Models)"; exit 1; }
done
echo "== saving images (tag ${VERSION})"
for i in tigeris-api tigeris-web tigeris-reasoning; do docker image inspect "$i:${VERSION}" >/dev/null || { echo "build $i:${VERSION} first: TIGERIS_VERSION=${VERSION} docker compose build"; exit 1; }; done
docker image inspect pgvector/pgvector:pg16 >/dev/null 2>&1 || docker pull pgvector/pgvector:pg16
docker save "tigeris-api:${VERSION}" "tigeris-web:${VERSION}" "tigeris-reasoning:${VERSION}" pgvector/pgvector:pg16 | gzip -1 > "$OUT/images.tar.gz"
cp docker-compose.yml docker-compose.vm.yml "$OUT/"
cp -r db/init "$OUT/db/"
cp deploy/Caddyfile "$OUT/deploy/"
cp data/models/*.gguf "$OUT/data/models/"
cp data/packages/*.tigpkg "$OUT/data/packages/"
cp deploy/install.sh deploy/README-package.md "$OUT/"
chmod +x "$OUT/install.sh"
echo "TIGERIS_VERSION=${VERSION}" > "$OUT/.env"
(cd "$OUT" && find . -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS)
du -sh "$OUT"
echo "== package ready: $OUT"
