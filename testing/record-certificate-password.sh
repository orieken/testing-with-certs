#!/bin/sh
set -eu
: "${LAB_PROJECT:?Set LAB_PROJECT to a disposable recording project}"
case "$LAB_PROJECT" in
  magic-shop-lab|''|*[!a-z0-9_-]*) echo 'Use a named disposable project, not the retained lab' >&2; exit 2;;
esac
browser=${1:-chrome}
case "$browser" in chrome|msedge) ;; *) echo 'Use chrome or msedge' >&2; exit 2;; esac
[ "$#" -le 1 ] || exit 2
root_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
compose_file="$root_dir/infra/compose.yaml"
overlay_file="$root_dir/infra/teaching.compose.yaml"
run_id="$(date -u +%Y%m%dT%H%M%SZ)-$browser-$$"
record_dir="$root_dir/artifacts/certificate-password/$run_id"
mkdir -p "$record_dir"
docker compose -f "$compose_file" --profile test build runner-test
docker compose -f "$compose_file" run --rm --no-deps realm-bootstrap
docker compose -f "$compose_file" -f "$overlay_file" run --rm --no-deps teaching-fixture start
cleanup() {
  docker compose -f "$compose_file" -f "$overlay_file" run --rm --no-deps teaching-fixture finish
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
docker compose -f "$compose_file" -f "$overlay_file" run --rm --no-deps \
  -e "LAB_BROWSER=$browser" -v "$record_dir:/recordings" teaching-tests \
  sh -c 'cd /work/testing && ./node_modules/.bin/playwright test --config playwright.password-recording.config.mjs'
printf 'Passing viewport video: %s/certificate-password-%s.webm\n' "$record_dir" "$browser"
