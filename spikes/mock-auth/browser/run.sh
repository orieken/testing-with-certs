#!/bin/sh
set -eu
cd "$(dirname "$0")/../../.."
project="cert-mock-browser-$(date +%s)-$$"
export MOCK_BROWSER_REPORT_DIR="$PWD/artifacts/mock-browser/$project"
mkdir -p "$MOCK_BROWSER_REPORT_DIR"
base=$(docker image inspect magic-shop-runner:03 --format '{{.Id}}')
export MOCK_RUNNER_BASE="cert-mock-browser-base:$project"
docker tag "$base" "$MOCK_RUNNER_BASE"
printf '%s\n' "Base runner: $base" "Host: $(uname -s) $(uname -m); browser containers linux/amd64" > "$MOCK_BROWSER_REPORT_DIR/environment.txt"
compose() { docker compose -p "$project" -f spikes/mock-auth/compose.yaml -f spikes/mock-auth/browser/compose.yaml "$@"; }
cleanup() {
 compose down --volumes --remove-orphans --timeout 5
 docker image rm "$MOCK_RUNNER_BASE" >/dev/null
 test -z "$(docker ps -aq --filter "label=com.docker.compose.project=$project")"
 test -z "$(docker volume ls -q --filter "label=com.docker.compose.project=$project")"
 test -z "$(docker network ls -q --filter "label=com.docker.compose.project=$project")"
 echo "Cleanup verified: $project"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
compose build browser-ui browser-runner
compose run --rm pki
compose run --rm browser-pki
compose up -d oidc browser-ui
compose run --rm browser-runner node /work/spikes/mock-auth/browser/versions.mjs
compose run --rm browser-runner node /work/spikes/mock-auth/browser/tls-boundary.mjs
for browser in ${MOCK_BROWSERS:-chrome msedge}; do
 export LAB_BROWSER="$browser"
 for runner in ${MOCK_RUNNERS:-playwright cucumber}; do
  if [ "$runner" = playwright ]; then
   compose run --rm browser-runner /work/testing/node_modules/.bin/playwright test -c /work/spikes/mock-auth/browser/playwright.config.mjs
  else
   compose run --rm browser-runner /work/testing/node_modules/.bin/cucumber-js /work/spikes/mock-auth/browser/browser.feature --import /work/spikes/mock-auth/browser/steps.mjs --format progress
  fi
 done
 done

if [ "${MOCK_FORCE_FAILURE:-0}" = 1 ]; then compose run --rm browser-runner node --eval "throw new Error('Intentional cleanup verification failure')"; fi

compose run --rm -v "$MOCK_BROWSER_REPORT_DIR:/work/artifacts/mock-browser:ro" browser-runner node /work/testing/container/check-artifacts.mjs /work/artifacts/mock-browser
