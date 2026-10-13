#!/bin/sh
set -eu
: "${LAB_PROJECT:?Set disposable project}"
case "$LAB_PROJECT" in magic-shop-lab|''|*[!a-z0-9_-]*) exit 2;; esac
root_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$root_dir"
docker compose -f infra/compose.yaml -f infra/teaching.compose.yaml --profile '*' down --volumes --remove-orphans --timeout 10
# --rm one-shot jobs may leave volumes not attached to a retained container.
for volume in $(docker volume ls -q --filter "label=com.docker.compose.project=$LAB_PROJECT"); do
  case "$volume" in "$LAB_PROJECT"_*) docker volume rm "$volume";; *) exit 1;; esac
done
test -z "$(docker ps -aq --filter "label=com.docker.compose.project=$LAB_PROJECT")"
test -z "$(docker volume ls -q --filter "label=com.docker.compose.project=$LAB_PROJECT")"
test -z "$(docker network ls -q --filter "label=com.docker.compose.project=$LAB_PROJECT")"
echo "Teaching project cleanup verified: $LAB_PROJECT"
