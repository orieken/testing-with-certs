#!/bin/sh
set -eu
case "${LAB_PROJECT:-}" in magic-shop-otp-?*) ;; *) echo 'Set a fresh disposable LAB_PROJECT=magic-shop-otp-NAME' >&2; exit 2;; esac
case "$LAB_PROJECT" in *[!a-z0-9-]*) exit 2;; esac
root_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$root_dir"
export LAB_OTP_REPORT_DIR="$root_dir/artifacts/password-otp/$LAB_PROJECT"
mkdir -p "$LAB_OTP_REPORT_DIR"
chmod 0777 "$LAB_OTP_REPORT_DIR"
compose() { docker compose -f infra/compose.yaml -f infra/otp.compose.yaml "$@"; }
cleanup() {
  result=$?
  trap - EXIT
  compose run --rm --no-deps otp-fixture finish || result=1
  compose run --rm --no-deps otp-fixture verify || result=1
  compose --profile '*' down --volumes --remove-orphans --timeout 10 || result=1
  exit "$result"
}
test -z "$(docker ps -aq --filter "label=com.docker.compose.project=$LAB_PROJECT")"
test -z "$(docker volume ls -q --filter "label=com.docker.compose.project=$LAB_PROJECT")"
test -z "$(docker network ls -q --filter "label=com.docker.compose.project=$LAB_PROJECT")"
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
./lab up
docker compose -f infra/compose.yaml --profile test build runner-test
for browser in chrome msedge; do
  compose run --rm --no-deps otp-fixture start
  compose run --rm --no-deps -e "LAB_BROWSER=$browser" otp-tests \
    sh -c 'cd /work/testing && ./node_modules/.bin/playwright test --config playwright.otp.config.mjs'
  compose run --rm --no-deps otp-fixture finish
  compose run --rm --no-deps otp-fixture verify
  docker volume rm "${LAB_PROJECT}_otp-home" "${LAB_PROJECT}_otp-tmp" >/dev/null
done
docker run --rm --platform linux/amd64 --network none --entrypoint node \
  -v "$LAB_OTP_REPORT_DIR:/work/artifacts/password-otp:ro" magic-shop-runner:03 \
  /work/testing/container/check-artifacts.mjs /work/artifacts/password-otp
