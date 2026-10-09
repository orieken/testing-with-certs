#!/bin/sh
set -eu

root_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
docker build --platform linux/amd64 --target base -t magic-shop-diagram-node:12 -f "$root_dir/infra/ci/Containerfile" "$root_dir"
docker run --rm --platform linux/amd64 --entrypoint node \
  -v "$root_dir:/work" \
  magic-shop-diagram-node:12 \
  /work/infra/extract-mermaid.mjs
docker run --rm --platform linux/amd64 \
  -v "$root_dir/artifacts/diagrams:/data" \
  -v "$root_dir/infra/mermaid-puppeteer.json:/config.json:ro" \
  --entrypoint sh \
  ghcr.io/mermaid-js/mermaid-cli/mermaid-cli@sha256:a6fb0574dded4086888b5e38476899c9aff8963196f689f11a0f8fceee588ce1 \
  -c 'set -eu; for file in /data/*.mmd; do mmdc -p /config.json -i "$file" -o "${file%.mmd}.svg"; done'
