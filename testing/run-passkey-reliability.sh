#!/bin/sh
set -eu
root_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$root_dir"
: "${LAB_PROJECT:?Set a fresh disposable magic-shop-auth-* project}"
case "$LAB_PROJECT" in magic-shop-auth-?*) ;; *) exit 2;; esac
case "$LAB_PROJECT" in *[!a-z0-9-]*) exit 2;; esac
export LAB_PROJECT
base_dir="$root_dir/artifacts/auth-lessons/$LAB_PROJECT"
export LAB_AUTH_REPORT_DIR="$base_dir/setup"
mkdir -p "$LAB_AUTH_REPORT_DIR"
chmod 0777 "$LAB_AUTH_REPORT_DIR"
compose() { docker compose -f infra/compose.yaml -f infra/auth-lessons.compose.yaml "$@"; }
for kind in containers volumes networks; do
  case "$kind" in
    containers) existing=$(docker ps -aq --filter "label=com.docker.compose.project=$LAB_PROJECT");;
    volumes) existing=$(docker volume ls -q --filter "label=com.docker.compose.project=$LAB_PROJECT");;
    networks) existing=$(docker network ls -q --filter "label=com.docker.compose.project=$LAB_PROJECT");;
  esac
  test -z "$existing" || { echo 'Disposable project already exists' >&2; exit 2; }
done
cleanup() {
  result=$?
  trap - EXIT
  compose run --rm --no-deps auth-lesson-fixture finish || result=1
  compose run --rm --no-deps auth-lesson-fixture verify || result=1
  compose --profile '*' down --volumes --remove-orphans --timeout 10 || result=1
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
sh testing/start-auth-lessons.sh
docker compose -f infra/compose.yaml --profile test build runner-test
for round in 1 2; do
  export LAB_AUTH_REPORT_DIR="$base_dir/round-$round"
  mkdir -p "$LAB_AUTH_REPORT_DIR"
  chmod 0777 "$LAB_AUTH_REPORT_DIR"
  for browser in chrome msedge; do
    for runner in playwright cucumber; do
      compose run --rm --no-deps auth-lesson-fixture start
      if [ "$runner" = playwright ]; then
        compose run --rm --no-deps -e "LAB_BROWSER=$browser" auth-lesson-tests \
          sh -c 'cd /work/testing && ./node_modules/.bin/playwright test --config playwright.auth-lessons.config.mjs --grep "passkeys:"'
      else
        compose run --rm --no-deps -e "LAB_BROWSER=$browser" auth-lesson-tests \
          sh -c 'cd /work/testing && ./node_modules/.bin/cucumber-js --import cucumber/passkeys.mjs cucumber/features/passkeys.feature --format ./reporting/passkeys-cucumber.mjs --order random'
      fi
      compose run --rm --no-deps auth-lesson-fixture finish
      compose run --rm --no-deps auth-lesson-fixture verify
      docker volume rm "${LAB_PROJECT}_auth-lesson-home" "${LAB_PROJECT}_auth-lesson-tmp" >/dev/null
    done
  done
  compose run --rm --no-deps auth-lesson-tests node /work/testing/container/check-artifacts.mjs /work/artifacts/auth-lessons
done
node testing/reporting/check-passkey-reliability.mjs "$base_dir"
