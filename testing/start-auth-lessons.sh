#!/bin/sh
set -eu
root_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$root_dir"
compose() { docker compose -f infra/compose.yaml -f infra/auth-lessons.compose.yaml "$@"; }
compose build realm-bootstrap
compose up -d --build --wait --wait-timeout 240 gateway lesson-provider
compose run --rm --no-deps realm-bootstrap
compose run --rm --no-deps auth-lesson-setup
echo 'Authentication lessons configured at https://shop.magic.test:8543/teaching inside the lab network.'
