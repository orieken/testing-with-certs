#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
: "${LAB_PROJECT:?Use a fresh magic-shop-authentik-* project}"
case "$LAB_PROJECT" in magic-shop-authentik-?*) ;; *) exit 2;; esac
case "$LAB_PROJECT" in *[!a-z0-9-]*) exit 2;; esac
export LAB_PROJECT
compose(){ docker compose -f infra/compose.yaml -f infra/auth-lessons.compose.yaml -f infra/authentik.compose.yaml "$@"; }
for kind in containers volumes networks; do
 case "$kind" in
  containers) found=$(docker ps -aq --filter "label=com.docker.compose.project=$LAB_PROJECT");;
  volumes) found=$(docker volume ls -q --filter "label=com.docker.compose.project=$LAB_PROJECT");;
  networks) found=$(docker network ls -q --filter "label=com.docker.compose.project=$LAB_PROJECT");;
 esac
 test -z "$found" || { echo 'Refusing to adopt existing provider resources' >&2;exit 2; }
done
export LAB_AUTH_REPORT_DIR="$PWD/artifacts/authentik/$LAB_PROJECT"
test ! -e "$LAB_AUTH_REPORT_DIR" || { echo 'Refusing to reuse provider evidence' >&2;exit 2; }
mkdir -p "$LAB_AUTH_REPORT_DIR"
chmod 0777 "$LAB_AUTH_REPORT_DIR"
cleanup(){
 result=$?;trap - EXIT
 compose --profile '*' down --volumes --remove-orphans --timeout 10 || result=1
 for kind in containers volumes networks;do
  case "$kind" in
   containers) remaining=$(docker ps -aq --filter "label=com.docker.compose.project=$LAB_PROJECT");;
   volumes) remaining=$(docker volume ls -q --filter "label=com.docker.compose.project=$LAB_PROJECT");;
   networks) remaining=$(docker network ls -q --filter "label=com.docker.compose.project=$LAB_PROJECT");;
  esac
  if [ -n "$remaining" ];then echo "Provider cleanup failed: $kind" >&2;result=1;fi
 done
 if [ "$result" -eq 0 ];then echo 'Disposable authentik users, keys, database and project resources removed and verified.' | tee "$LAB_AUTH_REPORT_DIR/cleanup.txt";fi
 exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
sh testing/start-auth-lessons.sh
compose up -d --wait --wait-timeout 300 authentik-server authentik-worker
ready=0
for attempt in $(seq 1 30);do
 if compose exec -T authentik-worker ak shell -c "exec(open('/fixtures/ready.py').read())" >/dev/null 2>&1;then ready=1;break;fi
 sleep 5
done
test "$ready" -eq 1 || { echo 'Authentik blueprint readiness failed' >&2;exit 1; }
if ! compose exec -T authentik-worker ak shell -c "exec(open('/fixtures/configure.py').read())" >/dev/null 2>&1;then echo "Authentik owned fixture provisioning failed" >&2;exit 1;fi
compose run --rm --no-deps authentik-setup
docker compose -f infra/compose.yaml --profile test build runner-test
compose run --rm --no-deps authentik-tests node /work/testing/teaching/authentik-versions.mjs
compose run --rm --no-deps authentik-tests node /work/testing/teaching/auth-recording-privacy.mjs
for browser in chrome msedge;do
 compose run --rm --no-deps -e "LAB_BROWSER=$browser" authentik-tests sh -c 'cd /work/testing && ./node_modules/.bin/playwright test --config playwright.authentik.config.mjs'
 docker volume rm "${LAB_PROJECT}_auth-lesson-home" "${LAB_PROJECT}_auth-lesson-tmp" >/dev/null
 compose run --rm --no-deps -e "LAB_BROWSER=$browser" authentik-tests sh -c 'cd /work/testing && ./node_modules/.bin/cucumber-js --import cucumber/authentik.mjs cucumber/features/authentik.feature --format ./reporting/authentik-cucumber.mjs --order random'
 docker volume rm "${LAB_PROJECT}_auth-lesson-home" "${LAB_PROJECT}_auth-lesson-tmp" >/dev/null
done
compose run --rm --no-deps authentik-tests node /work/testing/reporting/check-authentik.mjs /work/artifacts/auth-lessons
compose run --rm --no-deps authentik-tests node /work/testing/container/check-artifacts.mjs /work/artifacts/auth-lessons
