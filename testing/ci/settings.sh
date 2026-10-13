#!/bin/sh
set -eu
suite=${1:?Expected suite}
case "${CI_EVIDENCE_ID:-}" in ''|*[!a-z0-9-]*) echo 'Set CI_EVIDENCE_ID to a unique lowercase run identifier' >&2;exit 2;;esac
case "$suite" in
 consumer) prefix=cert-prism; report_group=prism; overlay=testing/prism/compose.yaml;;
 checkout) prefix=magic-shop-checkout-fault; report_group=checkout-faults; overlay=infra/checkout-fault.compose.yaml;;
 reporting) prefix=magic-shop-reporting-fault; report_group=reporting-faults; overlay=infra/reporting-fault.compose.yaml;;
 idempotency) prefix=magic-shop-checkout-idempotency; report_group=checkout-idempotency; overlay=infra/checkout-idempotency.compose.yaml;;
 regional) prefix=magic-shop-regional; report_group=regional; overlay=infra/regional.compose.yaml;;
 *) exit 2;;
esac
export LAB_PROJECT="$prefix-ci-$CI_EVIDENCE_ID${CI_FAILURE_PROBE:+-failure}"
report_dir="$PWD/artifacts/$report_group/$LAB_PROJECT"
