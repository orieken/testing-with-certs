#!/bin/sh
set -eu
cd "$(dirname "$0")/../../.."
project=${LAB_PROJECT:-magic-shop-mokapi-probe-$(date -u +%Y%m%dT%H%M%SZ)-$$}
case "$project" in magic-shop-mokapi-probe-*) ;; *) exit 2;; esac
case "$project" in *[!a-z0-9_-]*) exit 2;; esac
report="$PWD/artifacts/reporting-faults/$project"
mkdir -p "$report";chmod 0777 "$report"
cleanup(){
 result=$?;trap - EXIT
 docker rm -f "$project" >/dev/null 2>&1 || result=1
 docker network rm "$project" >/dev/null || result=1
 docker volume rm "$project" >/dev/null || result=1
 printf 'Mokapi compatibility cleanup verified: %s exit %s\n' "$project" "$result" | tee "$report/cleanup.txt"
 exit "$result"
}
if [ -n "$(docker ps -aq --filter name="^/$project$")" ] || [ -n "$(docker volume ls -q --filter name="^$project$")" ] || [ -n "$(docker network ls -q --filter name="^$project$")" ];then exit 2;fi
trap cleanup EXIT
docker network create --internal "$project" >/dev/null
docker volume create "$project" >/dev/null
docker run --rm --network none --platform linux/amd64 --user 0:0 --entrypoint sh -v "$project:/fault-state" magic-shop-runner:03 -c 'chown 1000:1000 /fault-state'
docker run --rm --network none --platform linux/amd64 --user 1000:1000 --entrypoint node -v "$project:/fault-state" -v "$PWD/testing/faults/reporting:/work/testing/faults/reporting:ro" magic-shop-runner:03 /work/testing/faults/reporting/prepare.mjs
docker run -d --name "$project" --network "$project" --network-alias reporting-mock --user 1000:1000 -v "$project:/fault-state:ro" mokapi/mokapi:0.52.0@sha256:ba936c3c88db3f95674cbb7b7c790193de1a7e5b6f638efa6adcb89fc6f19be8 /fault-state/mock.json /fault-state/sequence.js --api-dashboard=false --mcp-server-enabled=false --health-enabled=false --api-port=0 --event-store-default-size=0 --log-level=error >/dev/null
docker run --rm --platform linux/amd64 --network "$project" --user 1000:1000 --entrypoint sh -v "$PWD/testing/faults/reporting:/work/testing/faults/reporting:ro" -v "$report:/reports" magic-shop-runner:03 -c 'sleep 2; timeout 90s node /work/testing/faults/reporting/compatibility.mjs'
docker run --rm --network none mokapi/mokapi:0.52.0@sha256:ba936c3c88db3f95674cbb7b7c790193de1a7e5b6f638efa6adcb89fc6f19be8 --version > "$report/mokapi-version.txt"
docker run --rm --network none mokapi/mokapi:0.52.0@sha256:ba936c3c88db3f95674cbb7b7c790193de1a7e5b6f638efa6adcb89fc6f19be8 --help > "$report/mokapi-help.txt"
