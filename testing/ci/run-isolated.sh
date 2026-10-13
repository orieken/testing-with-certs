#!/bin/sh
set -eu
cd "$(dirname "$0")/../.."
if [ "${CI_FORCE_FAILURE_SUITE:-none}" = "${1:-}" ];then export CI_FAILURE_PROBE=1;fi
. ./testing/ci/settings.sh
# Existing wrappers retain private projects, verified TLS, evidence gates and traps.
case "$suite" in
 consumer)
  docker compose -f infra/compose.yaml --profile test build runner-test
  if [ -n "${CI_FAILURE_PROBE:-}" ];then PRISM_FORCE_FAILURE=1 ./testing/prism/run.sh compatibility;else ./testing/prism/run.sh all;fi;;
 checkout) CHECKOUT_FORCE_FAILURE=${CI_FAILURE_PROBE:-0} ./testing/faults/checkout/run.sh;;
 reporting)
  docker compose -f infra/compose.yaml --profile test build runner-test
  if [ -z "${CI_FAILURE_PROBE:-}" ];then LAB_PROJECT="magic-shop-mokapi-probe-ci-$CI_EVIDENCE_ID" ./testing/faults/reporting/compatibility.sh;fi
  REPORTING_FORCE_FAILURE=${CI_FAILURE_PROBE:-0} ./testing/faults/reporting/run.sh;;
 idempotency) IDEMPOTENCY_FORCE_FAILURE=${CI_FAILURE_PROBE:-0} ./testing/faults/idempotency/run.sh;;
 regional) REGIONAL_FORCE_FAILURE=${CI_FAILURE_PROBE:-0} ./testing/regional/run.sh;;
esac
