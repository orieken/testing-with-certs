#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
mode=${1:-all}
case "$mode" in build|test|all) ;; *) echo 'Usage: sh testing/run-all.sh build|test|all' >&2; exit 2;; esac
docker version >/dev/null
docker compose version >/dev/null

# Building these images executes all three providers' unit tests as well.
docker build --platform linux/amd64 --target workspace -t magic-shop-all-workspace:local -f infra/ci/Containerfile .
docker build --platform linux/amd64 --target spike -t magic-shop-all-spike:local -f infra/ci/Containerfile .
docker compose -f infra/compose.yaml --profile '*' config --quiet
docker compose -f infra/compose.yaml --profile test build
sh testing/check-service-units.sh
docker build --platform linux/amd64 -t magic-shop-all-quality:local -f infra/quality/Containerfile .
docker run --rm --platform linux/amd64 --network none -v "$PWD:/work:ro" magic-shop-all-quality:local
docker compose -f infra/compose.yaml --profile '*' config --format json |
  docker run -i --rm --platform linux/amd64 --network none --entrypoint node -v "$PWD:/work:ro" magic-shop-all-workspace:local /work/infra/check-architecture.mjs
echo 'PASS: workspace, infrastructure, and all three service builds/unit checks'
[ "$mode" != build ] || exit 0

# Never adopt the caller's retained LAB_PROJECT or an existing resource set.
LAB_PROJECT=magic-shop-all-$(date -u +%Y%m%d%H%M%S)-$$
export LAB_PROJECT
for kind in containers networks volumes; do
  case "$kind" in
    containers) remaining=$(docker ps -aq --filter "label=com.docker.compose.project=$LAB_PROJECT");;
    networks) remaining=$(docker network ls -q --filter "label=com.docker.compose.project=$LAB_PROJECT");;
    volumes) remaining=$(docker volume ls -q --filter "label=com.docker.compose.project=$LAB_PROJECT");;
  esac
  [ -z "$remaining" ] || { echo 'Disposable project already exists' >&2; exit 2; }
done
printf 'Disposable all-service project: %s\n' "$LAB_PROJECT"
trap 'result=$?; trap - EXIT; sh testing/cleanup-certificate-password.sh || result=1; exit "$result"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
./lab up
./lab pki verify
./lab db verify
./lab test --runner playwright --suite package
./lab test --runner playwright --suite contracts
./lab test --runner playwright --suite security
for runner in playwright cucumber; do
  for browser in chrome msedge; do
    for user in customer-waterdeep shop-admin; do
      ./lab test --runner "$runner" --browser "$browser" --user "$user"
    done
  done
done
for browser in chrome msedge; do
  ./lab test --runner playwright --browser "$browser" --user shopkeeper
done
LAB_PASSWORD_REPORTS=1 sh testing/run-certificate-password.sh
echo 'PASS: all-service live contracts, security, browser journeys, package, and 36-case lesson'
