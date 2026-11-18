#!/bin/sh
set -eu
: "${LAB_PROJECT:?Set LAB_PROJECT to a disposable teaching test project}"
case "$LAB_PROJECT" in
  magic-shop-lab|''|*[!a-z0-9_-]*) echo 'Use a named disposable project, not the retained lab' >&2; exit 2;;
esac
root_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
compose_file="$root_dir/infra/compose.yaml"
overlay_file="$root_dir/infra/teaching.compose.yaml"
compose() {
  if [ "${LAB_PASSWORD_REPORTS:-0}" = 1 ]; then
    if [ "${SATURDAY_AUTH_PILOT:-0}" = 1 ]; then
      docker compose -f "$compose_file" -f "$overlay_file" -f "$root_dir/infra/teaching-ci.compose.yaml" -f "$root_dir/infra/saturday-reporting-pilot.compose.yaml" "$@"
    else
      docker compose -f "$compose_file" -f "$overlay_file" -f "$root_dir/infra/teaching-ci.compose.yaml" "$@"
    fi
  else
    docker compose -f "$compose_file" -f "$overlay_file" "$@"
  fi
}
if [ "${LAB_PASSWORD_REPORTS:-0}" = 1 ]; then
  export LAB_PASSWORD_REPORT_DIR="$root_dir/artifacts/certificate-password-ci/$LAB_PROJECT"
  mkdir -p "$LAB_PASSWORD_REPORT_DIR"
  chmod 0777 "$LAB_PASSWORD_REPORT_DIR"
fi
remove_profiles() { docker volume rm "${LAB_PROJECT}_teaching-home" "${LAB_PROJECT}_teaching-tmp" >/dev/null; }
cleanup() {
  result=$?
  trap - EXIT
  if ! compose run --rm --no-deps teaching-fixture finish; then result=1; fi
  if ! compose run --rm --no-deps teaching-fixture verify; then result=1; fi
  if ! remove_profiles; then result=1; fi
  exit "$result"
}
docker compose -f "$compose_file" build realm-bootstrap
docker compose -f "$compose_file" --profile test build runner-test
docker compose -f "$compose_file" run --rm --no-deps realm-bootstrap
# Install the trap before provisioning: a partially started fixture must be cleaned.
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
compose run --rm --no-deps teaching-fixture start
if [ "${LAB_PASSWORD_FORCE_FAILURE:-0}" = 1 ]; then
  set +e
  compose run --rm --no-deps teaching-tests node --eval "throw new Error('Intentional teaching runner cleanup failure')"
  failure_result=$?
  set -e
  test "$failure_result" -eq 1
  echo "Intentional teaching runner failure observed"
  exit 1
fi
for browser in chrome msedge; do
  if [ "${SATURDAY_AUTH_PILOT:-0}" = 1 ]; then
    compose run --rm --no-deps -e "LAB_BROWSER=$browser" -e "LAB_RECORDING_PRIVACY_DIR=/work/artifacts/saturday-auth-pilot/privacy-$browser" teaching-tests \
      node /work/testing/teaching/auth-recording-privacy.mjs
    compose run --rm --no-deps -e "LAB_BROWSER=$browser" -e "SATURDAY_REPORT_DIR=/work/artifacts/saturday-auth-pilot/$browser-playwright" teaching-tests \
      sh -c 'cd /work/testing && ./node_modules/.bin/playwright test --config playwright.password.config.mjs'
    remove_profiles
    compose run --rm --no-deps -e "LAB_BROWSER=$browser" -e "SATURDAY_REPORT_DIR=/work/artifacts/saturday-auth-pilot/$browser-cucumber" teaching-tests \
      sh -c 'cd /work/testing && ./node_modules/.bin/cucumber-js --config cucumber.saturday.mjs'
    if [ "$browser" = chrome ]; then remove_profiles; fi
    continue
  fi
  compose run --rm --no-deps -e "LAB_BROWSER=$browser" teaching-tests \
    sh -c 'cd /work/testing && ./node_modules/.bin/playwright test --config playwright.password.config.mjs'
  remove_profiles
  compose run --rm --no-deps -e "LAB_BROWSER=$browser" teaching-tests \
    sh -c 'cd /work/testing && ./node_modules/.bin/cucumber-js --import cucumber/certificate-password.mjs cucumber/features/certificate-password.feature --format ./reporting/password-cucumber.mjs'
  # Keep the final volumes for the exit trap; other selections get a fresh HOME/tmp.
  if [ "$browser" = chrome ]; then remove_profiles; fi
done

if [ "${LAB_PASSWORD_REPORTS:-0}" = 1 ]; then
  docker run --rm --platform linux/amd64 --network none --entrypoint node \
    -v "$LAB_PASSWORD_REPORT_DIR:/work/artifacts/certificate-password-ci" magic-shop-runner:03 \
    /work/testing/reporting/auth-recording-index.mjs certificate-password /work/artifacts/certificate-password-ci
fi
if [ "${SATURDAY_AUTH_PILOT:-0}" = 1 ]; then
  compose run --rm --no-deps teaching-tests node /work/testing/reporting-packages/check-auth-pilot.mjs \
    /work/artifacts/saturday-auth-pilot /work/artifacts/certificate-password-ci
fi
