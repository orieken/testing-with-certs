#!/bin/sh
set -eu
cd "$(dirname "$0")/../../.."
root_dir=$PWD
LAB_PROJECT=${LAB_PROJECT:-magic-shop-reporting-fault-recorded-$(date -u +%Y%m%dT%H%M%SZ)-$$}
case "$LAB_PROJECT" in magic-shop-reporting-fault-*) ;; *) exit 2;; esac
case "$LAB_PROJECT" in *[!a-z0-9_-]*) exit 2;; esac
export LAB_PROJECT
output="$root_dir/artifacts/reporting-faults/$LAB_PROJECT/video"
mkdir -p "$output"
chmod 0777 "$output"
recorder_image=$(docker image inspect magic-shop-runner:03 --format '{{.Id}}')
profile="$LAB_PROJECT-recorder-home"
temporary="$LAB_PROJECT-recorder-tmp"
container="$LAB_PROJECT-recorder"
cleanup() {
  result=$?
  trap - EXIT
  docker rm -f "$container" >/dev/null 2>&1 || true
  if ! docker volume rm "$profile" "$temporary" >/dev/null; then result=1; fi
  echo 'Recorder profile and temporary volume cleanup verified'
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
docker volume create "$profile" >/dev/null
docker volume create "$temporary" >/dev/null
: > "$output/execution.txt"
docker run --rm --name "$container" --platform linux/amd64 --network none --user 1000:1000 --entrypoint node -e HOME=/home/runner \
  --mount "type=volume,src=$profile,target=/home/runner" --mount "type=volume,src=$temporary,target=/tmp" \
  --mount "type=bind,src=$root_dir/testing/faults/reporting/record.mjs,target=/example/record.mjs,readonly" \
  --mount "type=bind,src=$output,target=/recordings" "$recorder_image" /example/record.mjs > "$output/recorder.txt" 2>&1 &
recorder_pid=$!
attempts=0
while [ ! -f "$output/ready" ]; do
  attempts=$((attempts+1)); if [ "$attempts" -gt 60 ]; then cat "$output/recorder.txt"; exit 1; fi
  sleep 1
done
result=0
./testing/faults/reporting/run.sh > "$output/execution.txt" 2>&1 || result=$?
printf '%s\n' "$result" > "$output/exit-code"
wait "$recorder_pid"
cat "$output/recorder.txt"
printf 'Recorder image: %s\nVideo: %s/reporting.webm\n' "$recorder_image" "$output"
[ "$result" -eq 0 ] || exit "$result"
docker run --rm --platform linux/amd64 --network none --user 1000:1000 --entrypoint node \
  --mount "type=bind,src=$root_dir/artifacts,target=/work/artifacts,readonly" "$recorder_image" \
  /work/testing/container/check-artifacts.mjs "/work/artifacts/reporting-faults/$LAB_PROJECT"
