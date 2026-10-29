#!/bin/sh
set -eu
case "${LAB_PROJECT:-}" in magic-shop-mtls-?*) ;; *) echo 'Set a fresh LAB_PROJECT=magic-shop-mtls-NAME' >&2; exit 2;; esac
case "$LAB_PROJECT" in *[!a-z0-9-]*) exit 2;; esac
export LAB_PROJECT
mode=${1:-baseline}
case "$mode" in baseline|rfc8705) ;; *) echo 'Usage: run-oidc-mtls.sh [rfc8705]' >&2; exit 2;; esac
root_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$root_dir"
if test "$mode" = rfc8705; then
  export LAB_RFC8705_REPORT_DIR="$root_dir/artifacts/rfc8705/$LAB_PROJECT"
  test ! -e "$LAB_RFC8705_REPORT_DIR" || { echo 'Use a fresh RFC 8705 report directory' >&2; exit 2; }
  mkdir -p "$LAB_RFC8705_REPORT_DIR"
  chmod 0777 "$LAB_RFC8705_REPORT_DIR"
  node testing/reporting/rfc8705-provenance.mjs
  sh operator/build.sh
fi
compose() {
  if test "$mode" = rfc8705; then
    docker compose -f infra/compose.yaml -f infra/rfc8705.compose.yaml "$@"
  else
    docker compose -f infra/compose.yaml "$@"
  fi
}
# Query failures must not be mistaken for absence.
assert_empty() {
  containers=$(docker ps -aq --filter "label=com.docker.compose.project=$LAB_PROJECT") || return 1
  volumes=$(docker volume ls -q --filter "label=com.docker.compose.project=$LAB_PROJECT") || return 1
  networks=$(docker network ls -q --filter "label=com.docker.compose.project=$LAB_PROJECT") || return 1
  test -z "$containers$volumes$networks"
}
assert_empty || { echo 'Cannot establish an empty disposable project' >&2; exit 2; }
cleanup() {
  result=$?
  trap - EXIT
  compose --profile '*' down --volumes --remove-orphans --timeout 10 || result=1
  cleanup_status=failed
  if assert_empty; then
    echo 'PASS: owned project containers, volumes and networks absent'
    cleanup_status=passed
  else result=1; fi
  if test "$mode" = rfc8705; then
    # Linux bind mounts retain the container UID and private desktop umask.
    # Hand only the report directory back to its host owner before indexing.
    docker run --rm --platform linux/amd64 --network none --user 0:0 --entrypoint chown \
      -v "$LAB_RFC8705_REPORT_DIR:/report" magic-shop-runner:03 \
      -R "$(id -u):$(id -g)" /report || result=1
    LAB_CLEANUP_STATUS="$cleanup_status" node --input-type=module -e 'import{writeFileSync}from"node:fs";writeFileSync(`${process.env.LAB_RFC8705_REPORT_DIR}/cleanup.json`,JSON.stringify({status:process.env.LAB_CLEANUP_STATUS,containersAbsent:process.env.LAB_CLEANUP_STATUS==="passed",volumesAbsent:process.env.LAB_CLEANUP_STATUS==="passed",networksAbsent:process.env.LAB_CLEANUP_STATUS==="passed"}));' || result=1
    node testing/reporting/rfc8705-report.mjs "$LAB_RFC8705_REPORT_DIR" artifacts/operator/bin/magic-shop-operator || result=1
    if test -d "$LAB_RFC8705_REPORT_DIR/site"; then
      docker run --rm --platform linux/amd64 --network none --user "$(id -u):$(id -g)" -e HOME=/tmp --entrypoint node \
        -v "$LAB_RFC8705_REPORT_DIR:/work/artifacts/rfc8705" magic-shop-runner:03 \
        /work/testing/reporting/check-rfc8705-playback.mjs /work/artifacts/rfc8705 || result=1
    fi
  fi
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
./lab up
compose --profile test build runner-test
if test "$mode" = rfc8705; then node testing/reporting/rfc8705-provenance.mjs; fi
compose run --rm --no-deps \
  -v "$root_dir/skills/oidc-testing/scripts:/skill:ro" \
  -v "$root_dir/testing/container/oidc-mtls.mjs:/probe/oidc-mtls.mjs:ro" \
  runner-security node /probe/oidc-mtls.mjs
if test "$mode" = baseline; then
  compose run --rm --no-deps -e LAB_BROWSER=chrome -e LAB_USER=customer-waterdeep runner-test node /work/testing/container/login.mjs
fi
./lab test --runner playwright --suite security
if test "$mode" = rfc8705; then
  compose run --rm --no-deps pki binding-pair
  for browser in chrome msedge; do
    compose run --rm --no-deps --service-ports --name "${LAB_PROJECT}-viewer" -e "LAB_BROWSER=$browser" rfc8705-tests
  done
fi
echo "PASS: focused OIDC and mTLS workflow ($mode; not full federation/browser acceptance)"
