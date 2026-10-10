#!/bin/sh
set -eu
case "${1:-}" in jwt|oidc|api|all) mode=$1;; *) echo 'Usage: ./spikes/mock-auth/run.sh jwt|oidc|api|all' >&2; exit 2;; esac
cd "$(dirname "$0")/../.."
project="cert-mock-$(date +%s)-$$"
compose() { docker compose -p "$project" -f spikes/mock-auth/compose.yaml "$@"; }
cleanup() {
  compose down --volumes --remove-orphans --timeout 5
  test -z "$(docker ps -aq --filter "label=com.docker.compose.project=$project")"
  test -z "$(docker volume ls -q --filter "label=com.docker.compose.project=$project")"
  test -z "$(docker network ls -q --filter "label=com.docker.compose.project=$project")"
  echo "Cleanup verified: $project"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
compose build consumer
compose run --rm pki
if [ "$mode" = jwt ] || [ "$mode" = all ]; then compose run --rm consumer /work/spikes/mock-auth/run.mjs jwt; fi
if [ "$mode" = oidc ] || [ "$mode" = all ]; then
  compose up -d oidc
  compose run --rm consumer /work/spikes/mock-auth/run.mjs oidc
fi
if [ "$mode" = api ] || [ "$mode" = all ]; then
  compose run --rm consumer /work/spikes/mock-auth/run.mjs prepare
  compose up -d prism api
  compose run --rm consumer /work/spikes/mock-auth/run.mjs api
fi

if [ "${MOCK_FORCE_FAILURE:-0}" = 1 ]; then
  compose run --rm consumer --eval "throw new Error('Intentional cleanup verification failure')"
fi
