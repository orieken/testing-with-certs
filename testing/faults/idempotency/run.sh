#!/bin/sh
set -eu
root_dir=$(CDPATH= cd -- "$(dirname -- "$0")/../../.." && pwd)
cd "$root_dir"
LAB_PROJECT=${LAB_PROJECT:-magic-shop-checkout-idempotency-$(date -u +%Y%m%dT%H%M%SZ)-$$}
case "$LAB_PROJECT" in magic-shop-checkout-idempotency-*) ;; *) echo 'Use a disposable magic-shop-checkout-idempotency-* project' >&2; exit 2;; esac
case "$LAB_PROJECT" in *[!a-z0-9_-]*) exit 2;; esac
export LAB_PROJECT
compose() { docker compose -f infra/compose.yaml -f infra/checkout-idempotency.compose.yaml "$@"; }
# Never adopt an existing stack: each run starts with independent keys and DB.
if [ -n "$(docker ps -aq --filter "label=com.docker.compose.project=$LAB_PROJECT")" ] || [ -n "$(docker volume ls -q --filter "label=com.docker.compose.project=$LAB_PROJECT")" ]; then
  echo 'Project already exists; choose a new disposable project' >&2; exit 2
fi
report="$root_dir/artifacts/checkout-idempotency/$LAB_PROJECT"
mkdir -p "$report"
chmod 0777 "$report"
cleanup() {
  result=$?
  trap - EXIT
  cleanup_failed=0
  if ! compose --profile '*' down --volumes --remove-orphans --timeout 10; then result=1; cleanup_failed=1; fi
  for kind in containers networks volumes; do
    case "$kind" in
      containers) remaining=$(docker ps -aq --filter "label=com.docker.compose.project=$LAB_PROJECT");;
      networks) remaining=$(docker network ls -q --filter "label=com.docker.compose.project=$LAB_PROJECT");;
      volumes) remaining=$(docker volume ls -q --filter "label=com.docker.compose.project=$LAB_PROJECT");;
    esac
    if [ -n "$remaining" ]; then echo "Cleanup failed: $kind remain" >&2; result=1; cleanup_failed=1; fi
  done
  if [ "$cleanup_failed" -eq 0 ]; then printf 'Disposable project cleanup verified: %s\n' "$LAB_PROJECT" | tee "$report/cleanup.txt"; else echo "Disposable cleanup finished with run status $result"; fi
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
compose --profile test build runner-test
compose up -d --build --wait --wait-timeout 120 gateway
compose build realm-bootstrap
compose run --rm --no-deps realm-bootstrap
# Only the disposable response-loss receipt volume needs initialization.
compose run --rm --no-deps --user 0:0 --entrypoint sh checkout-loss -c 'chown 1000:1000 /loss-state'
compose up -d --no-deps --wait --wait-timeout 30 checkout-loss
docker version --format '{{json .}}' > "$report/docker-version.json"
docker compose version > "$report/compose-version.txt"
docker image inspect --format '{{.RepoTags}} {{.Id}}' magic-shop-runner:03 magic-shop-customer-api:03 magic-shop-catalog-api:03 magic-shop-insights-api:03 magic-shop-keycloak:03 magic-shop-gateway:03 magic-shop-postgres:03 > "$report/images.txt"
compose run --rm --no-deps runner-checkout-idempotency node /work/testing/faults/checkout/versions.mjs
if [ "${IDEMPOTENCY_FORCE_FAILURE:-0}" = 1 ]; then echo 'Intentional checkout harness failure after authenticated-stack provisioning' >&2; exit 1; fi
compose run --rm --no-deps runner-checkout-idempotency sh -c 'cd /work/testing && timeout 180s sh -c "./node_modules/.bin/tsc --noEmit && node --test /work/infra/check-contract-coverage.test.mjs /work/testing/faults/idempotency/evidence.test.mjs && ./node_modules/.bin/playwright test --config faults/idempotency/playwright.config.mjs"'
compose run --rm --no-deps runner-checkout-idempotency node /work/infra/check-contract-coverage.mjs --report /home/runner/live-artifacts/contract-coverage.json
compose run --rm --no-deps runner-checkout-idempotency node /work/testing/faults/idempotency/check-evidence.mjs
compose run --rm --no-deps runner-checkout-idempotency sh -c 'cp /home/runner/live-artifacts/contract-coverage.json "$LAB_FAULT_REPORT_DIR/live-coverage.json"'
compose run --rm --no-deps runner-checkout-idempotency node /work/testing/container/check-artifacts.mjs "/work/artifacts/checkout-idempotency/$LAB_PROJECT"
printf 'Local checkout evidence: %s\n' "$report"
