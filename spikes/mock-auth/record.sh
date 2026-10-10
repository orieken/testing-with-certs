#!/bin/sh
set -eu
case "${1:-all}" in jwt|oidc|api|all) mode=${1:-all};; *) echo 'Usage: ./spikes/mock-auth/record.sh jwt|oidc|api|all' >&2; exit 2;; esac
cd "$(dirname "$0")/../.."
root_dir=$PWD
run_id="$(date -u +%Y%m%dT%H%M%SZ)-$$"
record_root="$root_dir/artifacts/mock-consumers/videos/$run_id"
recorder_image=$(docker image inspect magic-shop-runner:03 --format '{{.Id}}')
profile="cert-mock-video-$run_id-profile"
temporary="cert-mock-video-$run_id-tmp"
container="cert-mock-video-$run_id"
cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
  docker volume rm "$profile" "$temporary" >/dev/null
  echo "Recorder profiles removed: $profile $temporary"
}
docker volume create "$profile" >/dev/null
docker volume create "$temporary" >/dev/null
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
if [ "$mode" = all ]; then selections='jwt oidc api'; else selections=$mode; fi
for selection in $selections; do
  output="$record_root/$selection"
  mkdir -p "$output"
  : > "$output/execution.txt"
  docker run --rm --name "$container" --platform linux/amd64 --network none --user 1000:1000 \
    --entrypoint node -e HOME=/home/runner \
    --mount "type=volume,src=$profile,target=/home/runner" \
    --mount "type=volume,src=$temporary,target=/tmp" \
    --mount "type=bind,src=$root_dir/spikes/mock-auth/record.mjs,target=/example/record.mjs,readonly" \
    --mount "type=bind,src=$output,target=/recordings" \
    "$recorder_image" /example/record.mjs "$selection" > "$output/recorder.txt" 2>&1 &
  recorder_pid=$!
  attempts=0
  while [ ! -f "$output/ready" ]; do
    attempts=$((attempts+1))
    if [ "$attempts" -gt 60 ]; then cat "$output/recorder.txt"; exit 1; fi
    sleep 1
  done
  result=0
  ./spikes/mock-auth/run.sh "$selection" > "$output/execution.txt" 2>&1 || result=$?
  printf '%s\n' "$result" > "$output/exit-code"
  wait "$recorder_pid"
  cat "$output/recorder.txt"
  printf 'Video: %s/%s.webm\n' "$output" "$selection"
  [ "$result" -eq 0 ] || exit "$result"
done
printf 'Recorder image: %s\nRecordings: %s\n' "$recorder_image" "$record_root"
