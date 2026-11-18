#!/bin/sh
set -eu
: "${LAB_PROJECT:?Set a fresh LAB_PROJECT=magic-shop-saturday-NAME}"
case "$LAB_PROJECT" in magic-shop-saturday-?*) ;; *) echo 'Use a fresh magic-shop-saturday project' >&2; exit 2;; esac
case "$LAB_PROJECT" in *[!a-z0-9-]*) exit 2;; esac
root_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$root_dir"
export LAB_PROJECT LAB_PASSWORD_REPORTS=1 SATURDAY_AUTH_PILOT=1
SATURDAY_PILOT_REPORT_DIR="$root_dir/artifacts/saturday-auth-pilot/$LAB_PROJECT"
LAB_PASSWORD_REPORT_DIR="$root_dir/artifacts/certificate-password-ci/$LAB_PROJECT"
export SATURDAY_PILOT_REPORT_DIR LAB_PASSWORD_REPORT_DIR
assert_empty() {
  containers=$(docker ps -aq --filter "label=com.docker.compose.project=$LAB_PROJECT") || return 1
  networks=$(docker network ls -q --filter "label=com.docker.compose.project=$LAB_PROJECT") || return 1
  volumes=$(docker volume ls -q --filter "label=com.docker.compose.project=$LAB_PROJECT") || return 1
  test -z "$containers$networks$volumes"
}
assert_empty || { echo 'Cannot establish an empty disposable project' >&2; exit 2; }
test ! -e "$SATURDAY_PILOT_REPORT_DIR" && test ! -e "$LAB_PASSWORD_REPORT_DIR" || { echo 'Use fresh report directories' >&2; exit 2; }
mkdir -p "$SATURDAY_PILOT_REPORT_DIR" "$LAB_PASSWORD_REPORT_DIR"
chmod 0777 "$SATURDAY_PILOT_REPORT_DIR" "$LAB_PASSWORD_REPORT_DIR"
cleanup() {
  result=$?
  trap - EXIT
  sh testing/cleanup-certificate-password.sh || result=1
  state=failed
  if assert_empty; then state=passed; else result=1; fi
  # Hand back only the owned evidence, never identity or secret volumes.
  if docker image inspect magic-shop-runner:03 >/dev/null 2>&1; then
    docker run --rm --platform linux/amd64 --network none --user 0:0 --entrypoint chown \
      -v "$SATURDAY_PILOT_REPORT_DIR:/report" -v "$LAB_PASSWORD_REPORT_DIR:/legacy" magic-shop-runner:03 \
      -R "$(id -u):$(id -g)" /report /legacy || result=1
  fi
  printf '{"status":"%s","containersAbsent":%s,"networksAbsent":%s,"volumesAbsent":%s}\n' \
    "$state" "$([ "$state" = passed ] && echo true || echo false)" "$([ "$state" = passed ] && echo true || echo false)" "$([ "$state" = passed ] && echo true || echo false)" > "$SATURDAY_PILOT_REPORT_DIR/cleanup.json" || result=1
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
printf 'Disposable Saturday authentication pilot: %s\n' "$LAB_PROJECT"
printf '{"project":"%s","sourceCommit":"%s","dirty":%s}\n' "$LAB_PROJECT" "$(git rev-parse HEAD)" "$([ -n "$(git status --porcelain)" ] && echo true || echo false)" > "$SATURDAY_PILOT_REPORT_DIR/provenance.json"
./lab up
sh testing/run-certificate-password.sh
echo 'PASS: all 36 live cases match both reporters; all attached recordings play; fixture cleanup verified'
