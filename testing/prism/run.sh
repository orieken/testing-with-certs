#!/bin/sh
set -eu
case "${1:-}" in compatibility|browser|all) mode=$1;; *) echo 'Usage: testing/prism/run.sh compatibility|browser|all' >&2; exit 2;; esac
cd "$(dirname "$0")/../.."
LAB_PROJECT=${LAB_PROJECT:-cert-prism-$(date -u +%Y%m%dT%H%M%SZ)-$$}
case "$LAB_PROJECT" in cert-prism-*) ;; *) exit 2;; esac
case "$LAB_PROJECT" in *[!a-z0-9_-]*) exit 2;; esac
export LAB_PROJECT
export PRISM_REPORT_DIR="$PWD/artifacts/prism/$LAB_PROJECT"
export PRISM_RUNNER_IMAGE="cert-prism-runner:$LAB_PROJECT"
export PRISM_RUNNER_BASE="cert-prism-base:$LAB_PROJECT"
compose(){ docker compose -p "$LAB_PROJECT" -f testing/prism/compose.yaml "$@"; }
if [ -n "$(docker ps -aq --filter "label=com.docker.compose.project=$LAB_PROJECT")" ] || [ -n "$(docker volume ls -q --filter "label=com.docker.compose.project=$LAB_PROJECT")" ]; then echo 'Refusing existing project' >&2;exit 2;fi
mkdir -p "$PRISM_REPORT_DIR";chmod 0777 "$PRISM_REPORT_DIR"
base=$(docker image inspect magic-shop-runner:03 --format '{{.Id}}')
docker tag "$base" "$PRISM_RUNNER_BASE"
cleanup(){
 result=$?;trap - EXIT
 compose down --volumes --remove-orphans --timeout 5 || result=1
 docker image rm "$PRISM_RUNNER_BASE" >/dev/null || result=1
 if docker image inspect "$PRISM_RUNNER_IMAGE" >/dev/null 2>&1;then docker image rm "$PRISM_RUNNER_IMAGE" >/dev/null || result=1;fi
 for kind in container volume network;do
  case "$kind" in container) left=$(docker ps -aq --filter "label=com.docker.compose.project=$LAB_PROJECT");;volume) left=$(docker volume ls -q --filter "label=com.docker.compose.project=$LAB_PROJECT");;network) left=$(docker network ls -q --filter "label=com.docker.compose.project=$LAB_PROJECT");;esac
  [ -z "$left" ] || result=1
 done
 printf 'Cleanup checked: %s exit %s\n' "$LAB_PROJECT" "$result" | tee "$PRISM_REPORT_DIR/cleanup.txt"
 exit "$result"
}
trap cleanup EXIT;trap 'exit 130' INT;trap 'exit 143' TERM
printf 'Base runner: %s\nHost: %s %s; runner linux/amd64 emulated\n' "$base" "$(uname -s)" "$(uname -m)" > "$PRISM_REPORT_DIR/environment.txt"
compose build runner
compose run --rm --no-deps pki
compose run --rm --no-deps runner node /work/testing/prism/prepare.mjs
compose up -d --wait --wait-timeout 60 catalog-mock customer-mock insights-mock mock-api
compose run --rm --no-deps runner node /work/spikes/mock-auth/browser/versions.mjs
compose run --rm --no-deps runner sh -c 'test -f /work/infra/check-contract-coverage.test.mjs && node --test /work/infra/check-contract-coverage.test.mjs /work/testing/prism/browser/evidence.test.mjs'
docker run --rm --platform linux/amd64 --network none stoplight/prism:5.14.2@sha256:87972b6cf73da2c0339fca18f362b6f93118152d652c970fab93ed13cfd55bae --version > "$PRISM_REPORT_DIR/prism-version.txt"
docker run --rm --platform linux/amd64 --network none stoplight/prism:5.14.2@sha256:87972b6cf73da2c0339fca18f362b6f93118152d652c970fab93ed13cfd55bae proxy --help > "$PRISM_REPORT_DIR/prism-proxy-help.txt"
docker version --format '{{json .}}' > "$PRISM_REPORT_DIR/docker-version.json"
docker compose version > "$PRISM_REPORT_DIR/compose-version.txt"
docker image inspect --format '{{.RepoTags}} {{.Id}}' "$PRISM_RUNNER_IMAGE" stoplight/prism:5.14.2@sha256:87972b6cf73da2c0339fca18f362b6f93118152d652c970fab93ed13cfd55bae > "$PRISM_REPORT_DIR/images.txt"
if [ "$mode" != browser ];then
 compose up -d --wait --wait-timeout 60 upstream proxy-report proxy-errors proxy-insights proxy-tls proxy-bad-ca proxy-bad-name proxy-mtls
 compose run --rm --no-deps runner timeout 180s node /work/testing/prism/compatibility/run.mjs
 compose run --rm --no-deps runner node /work/testing/prism/compatibility/check-evidence.mjs
fi
if [ "$mode" != compatibility ];then
 compose build browser-ui
 compose up -d browser-ui
 docker image inspect --format '{{.RepoTags}} {{.Id}}' cert-mock-browser-ui:01 >> "$PRISM_REPORT_DIR/images.txt"
 compose run --rm --no-deps browser-runner node /work/testing/prism/tls-boundary.mjs
 for browser in ${PRISM_BROWSERS:-chrome msedge};do
  export LAB_BROWSER="$browser"
  for runner in ${PRISM_RUNNERS:-playwright cucumber};do
   if [ "$runner" = playwright ];then
    compose run --rm --no-deps browser-runner timeout 240s /work/testing/node_modules/.bin/playwright test -c /work/testing/prism/browser/playwright.config.mjs
   else
    compose run --rm --no-deps browser-runner timeout 240s /work/testing/node_modules/.bin/cucumber-js /work/testing/prism/browser/browser.feature --import /work/testing/prism/browser/steps.mjs --format progress
   fi
  done
 done
 if [ "${PRISM_DIAGNOSTIC:-0}" = 1 ];then echo 'Diagnostic subset only: full TEST-07 matrix gate not evaluated';else
  compose run --rm --no-deps browser-runner node /work/testing/prism/browser/check-evidence.mjs
 fi
fi
if [ "${PRISM_FORCE_FAILURE:-0}" = 1 ];then echo 'Intentional Prism harness failure after completed phases' >&2;exit 1;fi
compose run --rm --no-deps -v "$PRISM_REPORT_DIR:/work/artifacts/prism:ro" runner node /work/testing/container/check-artifacts.mjs /work/artifacts/prism
printf 'Safe Prism evidence: %s\n' "$PRISM_REPORT_DIR"
