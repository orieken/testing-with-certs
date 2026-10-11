#!/bin/sh
set -eu
cd "$(dirname "$0")/../.."
. ./testing/ci/settings.sh
for project in "$prefix-ci-$CI_EVIDENCE_ID" "$prefix-ci-$CI_EVIDENCE_ID-failure";do
 if [ "$suite" = consumer ];then
  PRISM_RUNNER_IMAGE="cert-prism-runner:$project" PRISM_RUNNER_BASE="cert-prism-base:$project" PRISM_REPORT_DIR="$PWD/artifacts/prism/$project" docker compose -p "$project" -f "$overlay" down --volumes --remove-orphans --timeout 10
  for image in "cert-prism-runner:$project" "cert-prism-base:$project";do
   if docker image inspect "$image" >/dev/null 2>&1;then docker image rm "$image" >/dev/null;fi
  done
 else LAB_PROJECT="$project" docker compose -f infra/compose.yaml -f "$overlay" --profile '*' down --volumes --remove-orphans --timeout 10;fi
 test -z "$(docker ps -aq --filter "label=com.docker.compose.project=$project")"
 test -z "$(docker volume ls -q --filter "label=com.docker.compose.project=$project")"
 test -z "$(docker network ls -q --filter "label=com.docker.compose.project=$project")"
done
printf 'PASS: %s success/failure project resources absent\n' "$suite"

if [ "$suite" = reporting ];then
 probe="magic-shop-mokapi-probe-ci-$CI_EVIDENCE_ID"
 if docker container inspect "$probe" >/dev/null 2>&1;then docker rm -f "$probe" >/dev/null;fi
 if docker network inspect "$probe" >/dev/null 2>&1;then docker network rm "$probe" >/dev/null;fi
 if docker volume inspect "$probe" >/dev/null 2>&1;then docker volume rm "$probe" >/dev/null;fi
fi
