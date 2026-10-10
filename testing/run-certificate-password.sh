#!/bin/sh
set -eu
: "${LAB_PROJECT:?Set LAB_PROJECT to a disposable teaching test project}"
case "$LAB_PROJECT" in
  magic-shop-lab|''|*[!a-z0-9_-]*) echo 'Use a named disposable project, not the retained lab' >&2; exit 2;;
esac
root_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
compose_file="$root_dir/infra/compose.yaml"
overlay_file="$root_dir/infra/teaching.compose.yaml"
docker compose -f "$compose_file" build realm-bootstrap
docker compose -f "$compose_file" --profile test build runner-test
docker compose -f "$compose_file" run --rm --no-deps realm-bootstrap
docker compose -f "$compose_file" -f "$overlay_file" run --rm --no-deps teaching-fixture start
cleanup() {
  docker compose -f "$compose_file" -f "$overlay_file" run --rm --no-deps teaching-fixture finish
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
for browser in chrome msedge; do
  docker compose -f "$compose_file" -f "$overlay_file" run --rm --no-deps -e "LAB_BROWSER=$browser" teaching-tests \
    sh -c 'cd /work/testing && ./node_modules/.bin/playwright test --config playwright.password.config.mjs'
  docker compose -f "$compose_file" -f "$overlay_file" run --rm --no-deps -e "LAB_BROWSER=$browser" teaching-tests \
    sh -c 'cd /work/testing && ./node_modules/.bin/cucumber-js --import cucumber/certificate-password.mjs cucumber/features/certificate-password.feature --format summary'
done
