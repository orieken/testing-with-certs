#!/bin/sh
set -eu
suite=${1:-auth-lessons}
case "$suite" in auth-lessons|oidc) ;; *) echo 'Usage: sh testing/run-auth-lessons.sh [oidc]' >&2; exit 2;; esac
case "${LAB_PROJECT:-}" in magic-shop-auth-?*) ;; *) echo 'Set a fresh disposable LAB_PROJECT=magic-shop-auth-NAME' >&2; exit 2;; esac
case "$LAB_PROJECT" in *[!a-z0-9-]*) exit 2;; esac
root_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$root_dir"
export LAB_AUTH_REPORT_DIR="$root_dir/artifacts/auth-lessons/$LAB_PROJECT"
mkdir -p "$LAB_AUTH_REPORT_DIR"
if test "$suite" = oidc; then
  test -z "$(ls -A "$LAB_AUTH_REPORT_DIR")" || { echo 'Focused OIDC requires an empty report directory' >&2; exit 2; }
fi
chmod 0777 "$LAB_AUTH_REPORT_DIR"
compose() { docker compose -f infra/compose.yaml -f infra/auth-lessons.compose.yaml "$@"; }
cleanup() {
  result=$?
  trap - EXIT
  compose exec -T oidc-key-control node /infra/oidc-token-fixture/restore-keys.mjs || result=1
  compose run --rm --no-deps auth-lesson-fixture finish || result=1
  compose run --rm --no-deps auth-lesson-fixture verify || result=1
  compose exec -T oidc-token-fixture node /fixture/verify.mjs || result=1
  compose --profile '*' down --volumes --remove-orphans --timeout 10 || result=1
  exit "$result"
}
for resource in containers volumes networks; do
  case "$resource" in
    containers) found=$(docker ps -aq --filter "label=com.docker.compose.project=$LAB_PROJECT");;
    volumes) found=$(docker volume ls -q --filter "label=com.docker.compose.project=$LAB_PROJECT");;
    networks) found=$(docker network ls -q --filter "label=com.docker.compose.project=$LAB_PROJECT");;
  esac
  test -z "$found" || { echo 'Disposable project resources already exist' >&2; exit 2; }
done
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
sh testing/start-auth-lessons.sh
docker compose -f infra/compose.yaml --profile test build runner-test
compose run --rm --no-deps auth-lesson-tests node /work/testing/teaching/auth-recording-privacy.mjs
if test "$suite" = oidc; then
  for browser in chrome msedge; do
    for phase in baseline lifecycle; do
      for runner in playwright cucumber; do
        fixture=start
        selection=baseline
        feature=oidc
        if test "$phase" = lifecycle; then fixture=start-oidc-lifecycle; selection=oidc-lifecycle; feature=oidc-session; fi
        compose run --rm --no-deps auth-lesson-fixture "$fixture"
        if test "$runner" = playwright; then
          compose run --rm --no-deps -e "LAB_BROWSER=$browser" -e "LAB_AUTH_SUITE=$selection" auth-lesson-tests \
            sh -c 'cd /work/testing && ./node_modules/.bin/playwright test --config playwright.auth-lessons.config.mjs --grep "oidc:"'
        else
          compose run --rm --no-deps -e "LAB_BROWSER=$browser" -e "LAB_AUTH_SUITE=$selection" -e "LAB_OIDC_FEATURE=$feature" auth-lesson-tests \
            sh -c 'cd /work/testing && ./node_modules/.bin/cucumber-js --import cucumber/oidc.mjs "cucumber/features/$LAB_OIDC_FEATURE.feature" --format ./reporting/oidc-cucumber.mjs --order random'
        fi
        compose run --rm --no-deps auth-lesson-fixture finish
        compose run --rm --no-deps auth-lesson-fixture verify
        docker volume rm "${LAB_PROJECT}_auth-lesson-home" "${LAB_PROJECT}_auth-lesson-tmp" >/dev/null
      done
    done
  done
else
for browser in chrome msedge; do
  compose run --rm --no-deps auth-lesson-fixture start
  compose run --rm --no-deps -e "LAB_BROWSER=$browser" auth-lesson-tests \
    sh -c 'cd /work/testing && ./node_modules/.bin/playwright test --config playwright.auth-lessons.config.mjs'
  compose exec -T lesson-kdc sh /app/tickets.sh
  compose run --rm --no-deps -e "LAB_BROWSER=$browser" -e LAB_AUTH_SUITE=kerberos auth-lesson-tests \
    sh -c 'cd /work/testing && ./node_modules/.bin/playwright test --config playwright.auth-lessons.config.mjs'
  compose exec -T lesson-kdc sh /app/tickets.sh
  compose run --rm --no-deps -e "LAB_BROWSER=$browser" auth-lesson-tests \
    sh -c 'cd /work/testing && ./node_modules/.bin/cucumber-js --import cucumber/kerberos.mjs cucumber/features/kerberos.feature --tags "not @disabled" --format ./reporting/kerberos-cucumber.mjs --order random'
  compose run --rm --no-deps auth-lesson-fixture kerberos-disable
  compose run --rm --no-deps -e "LAB_BROWSER=$browser" -e LAB_AUTH_SUITE=kerberos -e LAB_KERBEROS_DISABLED=1 auth-lesson-tests \
    sh -c 'cd /work/testing && ./node_modules/.bin/playwright test --config playwright.auth-lessons.config.mjs'
  compose run --rm --no-deps -e "LAB_BROWSER=$browser" -e LAB_KERBEROS_DISABLED=1 auth-lesson-tests \
    sh -c 'cd /work/testing && ./node_modules/.bin/cucumber-js --import cucumber/kerberos.mjs cucumber/features/kerberos.feature --tags @disabled --format ./reporting/kerberos-cucumber.mjs --order random'
  compose run --rm --no-deps auth-lesson-fixture kerberos-enable
  compose run --rm --no-deps auth-lesson-fixture finish
  compose run --rm --no-deps auth-lesson-fixture verify
  docker volume rm "${LAB_PROJECT}_auth-lesson-home" "${LAB_PROJECT}_auth-lesson-tmp" >/dev/null
  for method in passkeys oidc saml; do
    compose run --rm --no-deps auth-lesson-fixture start
    compose run --rm --no-deps -e "LAB_BROWSER=$browser" -e "LAB_CUCUMBER_METHOD=$method" auth-lesson-tests \
      sh -c 'cd /work/testing && ./node_modules/.bin/cucumber-js --import "cucumber/$LAB_CUCUMBER_METHOD.mjs" "cucumber/features/$LAB_CUCUMBER_METHOD.feature" --format "./reporting/$LAB_CUCUMBER_METHOD-cucumber.mjs" --order random'
    compose run --rm --no-deps auth-lesson-fixture finish
    compose run --rm --no-deps auth-lesson-fixture verify
    docker volume rm "${LAB_PROJECT}_auth-lesson-home" "${LAB_PROJECT}_auth-lesson-tmp" >/dev/null
  done
  for method in passkeys oidc saml kerberos; do
    for runner in playwright cucumber; do
      if test "$method" = kerberos; then compose exec -T lesson-kdc sh /app/tickets.sh; fi
      compose run --rm --no-deps auth-lesson-fixture "start-$method-lifecycle"
      if test "$runner" = playwright; then
        compose run --rm --no-deps -e "LAB_BROWSER=$browser" -e "LAB_AUTH_SUITE=$method-lifecycle" -e "LAB_LIFECYCLE_METHOD=$method" auth-lesson-tests \
          sh -c 'cd /work/testing && ./node_modules/.bin/playwright test --config playwright.auth-lessons.config.mjs'
      else
        compose run --rm --no-deps -e "LAB_BROWSER=$browser" -e "LAB_AUTH_SUITE=$method-lifecycle" -e "LAB_LIFECYCLE_METHOD=$method" auth-lesson-tests \
          sh -c 'cd /work/testing && ./node_modules/.bin/cucumber-js --import "cucumber/$LAB_LIFECYCLE_METHOD.mjs" "cucumber/features/$LAB_LIFECYCLE_METHOD-session.feature" --format "./reporting/$LAB_LIFECYCLE_METHOD-cucumber.mjs" --order random'
      fi
      compose run --rm --no-deps auth-lesson-fixture finish
      compose run --rm --no-deps auth-lesson-fixture verify
      docker volume rm "${LAB_PROJECT}_auth-lesson-home" "${LAB_PROJECT}_auth-lesson-tmp" >/dev/null
    done
  done
done
fi
compose exec -T oidc-key-control node /infra/oidc-token-fixture/verify-keys.mjs
docker run --rm --platform linux/amd64 --network none --entrypoint node \
  -v "$LAB_AUTH_REPORT_DIR:/work/artifacts/auth-lessons:ro" magic-shop-runner:03 \
  /work/testing/reporting/check-auth-matrix.mjs "$suite" /work/artifacts/auth-lessons
docker run --rm --platform linux/amd64 --network none --entrypoint node \
  -v "$LAB_AUTH_REPORT_DIR:/work/artifacts/auth-lessons:ro" magic-shop-runner:03 \
  /work/testing/container/check-artifacts.mjs /work/artifacts/auth-lessons

docker run --rm --platform linux/amd64 --network none --entrypoint node \
  -v "$LAB_AUTH_REPORT_DIR:/work/artifacts/auth-lessons" magic-shop-runner:03 \
  /work/testing/reporting/auth-recording-index.mjs "$suite" /work/artifacts/auth-lessons
docker run --rm --platform linux/amd64 --network none --entrypoint node \
  -v "$LAB_AUTH_REPORT_DIR:/work/artifacts/auth-lessons:ro" magic-shop-runner:03 \
  /work/testing/container/check-artifacts.mjs /work/artifacts/auth-lessons
