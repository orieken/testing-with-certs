#!/bin/sh
set -eu
cd "$(dirname "$0")/../.."
export CI_FAILURE_PROBE=1
. ./testing/ci/settings.sh
log_file=$(mktemp)
trap 'rm -f "$log_file"' EXIT
set +e
./testing/ci/run-isolated.sh "$suite" > "$log_file" 2>&1
result=$?
set -e
cat "$log_file"
test "$result" -eq 1
case "$suite" in
 consumer) marker='Intentional Prism harness failure after completed phases';;
 *) marker='Intentional checkout harness failure after authenticated-stack provisioning';;
esac
grep -Fx "$marker" "$log_file"
test -r "$report_dir/cleanup.txt"
./testing/ci/cleanup-isolated.sh "$suite"
printf 'PASS: intentional %s failure and independent resource absence\n' "$suite"
