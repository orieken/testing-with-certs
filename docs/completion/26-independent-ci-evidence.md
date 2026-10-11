# TEST-11 — Independent consumer/fault CI gates and reports

Completed and verified, 2026-10-11 America/Chicago.
The intermediate observations below retain the failed/cancelled attempts; final
acceptance and exact native results are recorded in the last section. No deployment, publishing, merging or Saturday checkout change.

TEST-04 documentation was committed as `a6fd3f1`. TEST-11 implementation is
`54ef7dd68d72eddb8d185d72ec9ab8018d06d1ec`, pushed to the existing draft PR branch.
The initial native verification runs are push 38115105116 and PR 38115107333.
Their existing integration job retains live contract-before-security-before-browser
ordering, and the real certificate/password job remains independently required.

New jobs reuse the pinned isolated consumer/fault/regional suites. Consumer Prism
compatibility and 44 browser selections are independent of checkout, reporting
and idempotency fault matrix selections. Reporting also runs the bounded Mokapi
compatibility probe. Real regional boundaries add five provider acceptance cases,
one explicit timestamp limitation probe and 16 real-auth browser journeys.
No synthetic authentication reaches a real API; the shop and lesson flows are
unchanged. The final always-running gate rejects any missing, skipped, cancelled
or failed required live, lesson, consumer, fault-matrix or regional result.

Each new job runs its existing completeness gate, performs a separate intentional
runner-failure probe, then independently disposes/verifies both known projects in
an always-running step. Fault matrix fail-fast is false; no continue-on-error
suppresses failure. An explicit workflow-dispatch input can make one actual job
fail for a negative cleanup/aggregate-gating control without editing app code.

Reports are separate artifacts `evidence-<suite>-<run>-<attempt>`, retained seven
days. The allowlist includes only sanitized results/provenance, versions/image
IDs and cleanup receipts. Videos are required by browser gates but excluded from
native uploads, along with raw logs, HTML, HAR/traces, storage state, keys and
credentials. The scan and host readability check precede upload. Failed/partial
manifests retain actual failed outcomes and receive no live-provider gate credit.
Existing live coverage/artifacts are not replaced or merged with these reports.

Primary documentation verified: [GitHub job dependencies/matrix failure semantics](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax),
[always at step level](https://docs.github.com/en/actions/reference/workflows-and-actions/expressions),
and [workflow artifacts](https://docs.github.com/en/actions/concepts/workflows-and-actions/workflow-artifacts).
Pinned checkout `d23441a48e516b6c34aea4fa41551a30e30af803`, upload-artifact
`ea165f8d65b6e75b540449e92b4886f43607fa02`, and container/tool pins remain the
existing reviewed versions; dependency pins are recorded in completion 21–24.

## Local preflight evidence (not native evidence)

```sh
CI_EVIDENCE_ID=26-local ./testing/ci/run-isolated.sh checkout
CI_EVIDENCE_ID=26-local ./testing/ci/probe-failure.sh checkout
docker run --rm --platform linux/amd64 --network none --entrypoint node \
  --mount type=bind,source="$PWD",target=/work magic-shop-runner:03 \
  /work/testing/ci/report.mjs checkout 26-local success success
docker run --rm --platform linux/amd64 --network none --entrypoint node \
  --mount type=bind,source="$PWD",target=/work,readonly magic-shop-runner:03 \
  /work/testing/container/check-artifacts.mjs /work/artifacts/ci-evidence/checkout
```

The checkout suite passed all existing live contract cases plus five bounded
fault/recovery/TLS cases and its own gate. The intentional probe returned exactly
1 with the expected marker; both scoped resource sets were independently absent.
Report staging succeeded, safe scan passed 12 entries, host manifest was readable
and execution was correctly `local-container`, not native.

Three containerized evidence mutation tests passed: missing/skipped/failed/cancelled
required jobs, forged provenance and failed outcomes, and report staging rejecting
missing/wrong-source/failed rows and symlinks while excluding videos/credential
files. Pinned YAML parsing and workflow-isolation checks passed. A first YAML
lookup used the pnpm symlink path and failed to resolve the dependency; resolving
its real package path succeeded. Quality preflight passed 168 authored files /962
functions with only the two existing capped transport baselines. `git diff --check`
and the protected app/security/contracts diff were clean.

Copyable adoption/local commands and evidence boundaries: [CI suite guide](../../testing/ci/README.md).

## Explicit negative native control (pending result)

A separate identical-tree branch avoids cancelling either normal run:

```sh
probe_commit=$(git commit-tree 54ef7dd^{tree} -p 54ef7dd \
  -m 'test: isolated native CI failure control [skip ci]')
git branch codex/test-11-negative "$probe_commit"
git push origin codex/test-11-negative
gh workflow run ci.yml --ref codex/test-11-negative -f evidence_failure_suite=checkout
```

Commit `a67c42fb49a75c2e228a8473c7e005c458621544` has the same tree as `54ef7dd`.
Dispatch created run 38115331250. This is deliberately expected to be red: the
checkout suite uses its existing early forced-failure control after real stack
provisioning, always cleanup still executes, the failed manifest may upload, and
the final aggregate must reject the fault-matrix failure. No new PR or mutation
of application/authentication behavior is involved. Acceptance remains pending
until the actual failed step, cleanup/upload and aggregate outcomes are inspected.

## First native failures and bounded corrections

At `54ef7dd`, push 38115105116 and PR 38115107333 exposed Linux-only report-staging
EACCES: the container UID could not create files under the GitHub-owned checkout.
Regional and idempotency suites completed their tests and intentional-failure
cleanup probes before this export error; those jobs are not credited as green.
Reporting also failed before its suite: the local overlay requested linux/arm64
on the amd64 host after the compatibility probe pulled the same multiarch digest
for amd64, producing `cannot overwrite digest`. No reporting acceptance is inferred
from that attempt. Existing wrapper and independent always cleanup ran.

Correction `20272cf24a3a80431a9842cab04f78075b23c34e` mounts the source read-only,
creates only the fresh CI report directory writable to the non-root container UID,
and explicitly selects linux/amd64 for the pinned Mokapi image in CI. The local
arm64 default and digest remain unchanged. Narrow-output-mount report staging
passed locally with explicit UID 1000. No TLS/authentication/pin downgrade occurred.
Fresh verification: push 38115515064 and PR 38115518115. The first negative-control
run 38115331250 was cancelled as obsolete, not credited as intentional-red proof;
its new-job cleanup steps are inspected separately. A fresh identical-tree negative
branch control uses the corrected code. Native acceptance is still pending.

Corrected deliberate-red control: run **38115560267** at identical-tree commit
`7b22e854e0883c3e9828fb413f46e9e468687c47` (same tree as `20272cf`).
Completed checkout job **114399814489** failed at the exact intentional provisioning
marker, exit 1, at 05:45:51Z. Independent always cleanup, report scan/readability
and upload all succeeded. Its downloaded manifest explicitly records
`execution: native-github-ci`, `runOutcome: failure`,
`failureCleanupOutcome: skipped`, `liveProviderGateCredit: false` and no exported
videos. The skipped field refers to the *secondary* failure-probe step: the primary
job itself was deliberately failed. Always cleanup still passed and the receipt
verifies the forced-failure project was disposed. Safe scan passed six entries.
The final aggregate result is still pending other jobs; no green claim is made.

```sh
gh api --allow-escape-sequences repos/orieken/testing-with-certs/actions/jobs/114399814489/logs \
  > /tmp/test11-negative-checkout.log
gh run download 38115560267 --name evidence-checkout-38115560267-1 \
  --dir artifacts/ci-native/38115560267-checkout
```

## Final native acceptance

At tested implementation **20272cf24a3a80431a9842cab04f78075b23c34e**,
[push 38115515064](https://github.com/orieken/testing-with-certs/actions/runs/38115515064)
and [PR 38115518115](https://github.com/orieken/testing-with-certs/actions/runs/38115518115)
completed with success: **all 13 jobs** (nine job definitions with expanded matrices).
The unchanged committed-base PR comparison passed. Existing live contracts,
security, all eight customer/admin browser selections, 36 certificate/password
cases, scans/readability/uploads and disposal passed. Each new job's primary suite,
intentional-failure probe, independent resource verification, scan/readability and
separate report upload passed. The final aggregate passed.

| Separate suite | Observed native report contents | Successful job |
| --- | --- | --- |
| Prism consumer | 27 compatibility observations and 44 actual Chrome/Edge Playwright/Cucumber journeys | [114399808870](https://github.com/orieken/testing-with-certs/actions/runs/38115515064/job/114399808870) |
| Checkout dependency faults | 22 report cases: existing 17 contract cases plus 5 fault/TLS cases; no-persistence/same-key recovery gate | [114399808863](https://github.com/orieken/testing-with-certs/actions/runs/38115515064/job/114399808863) |
| Scripted reporting | 14 Mokapi compatibility observations plus 19 real insights/scripted dependency cases | [114399808853](https://github.com/orieken/testing-with-certs/actions/runs/38115515064/job/114399808853) |
| Real idempotency/response loss | 21 report cases: existing 17 contract cases plus 4 race/loss/TLS cases; database invariants gate | [114399808866](https://github.com/orieken/testing-with-certs/actions/runs/38115515064/job/114399808866) |
| Real regional boundaries | 6 provider checks (5 acceptance +1 unsupported-precision probe) and 16 recorded real-auth browser journeys | [114399808841](https://github.com/orieken/testing-with-certs/actions/runs/38115515064/job/114399808841) |

Counts are per report, not a sum of unique tests: the existing 17 cases repeat in
two fault suites. Browser gates verified actual videos in the native job; only
text observations were uploaded, not native videos or raw failure diagnostics.
All five uploaded manifests identify native CI, correct source, successful run and
secondary failure-probe outcome, no live-provider gate credit and no video export.
Independent containerized review verified canonical digest equality, 16 passing
regional browser observations with TLS/no mocks/no external requests, 27 Prism
and 14 Mokapi compatibility entries. Downloaded artifact scanning passed 91 entries
before final additional job/artifact metadata was saved.

[Deliberate-red run 38115560267](https://github.com/orieken/testing-with-certs/actions/runs/38115560267)
completed with **failure as intended**. All static, live/security/browser, lesson,
consumer, reporting, idempotency and regional jobs passed. Only checkout and the
final aggregate failed. [Aggregate job 114401347892](https://github.com/orieken/testing-with-certs/actions/runs/38115560267/job/114401347892)
rejected `dependency-faults` with the explicit missing/unsuccessful required-gate
assertion, exit 1. Actual checkout cleanup, report scan/readability and upload
succeeded; the uploaded failed manifest remains failed. This proves failing jobs
retain cleanup/reporting without making the overall workflow green. Unit mutations
also independently reject absent/skipped/cancelled/failed live requirements.

Exact evidence retrieval from repository root:

```sh
gh run view 38115515064 --json status,conclusion,url,jobs
gh run view 38115518115 --json status,conclusion,url,jobs
gh run view 38115560267 --json status,conclusion,url,jobs
gh run download 38115515064 --pattern 'evidence-*' --dir artifacts/ci-native/38115515064
gh api repos/orieken/testing-with-certs/actions/runs/38115515064/artifacts \
  --jq '[.artifacts[]|{id,name,size_in_bytes,digest,expired}]'
gh api --allow-escape-sequences repos/orieken/testing-with-certs/actions/jobs/114401347892/logs \
  > /tmp/test11-negative-gate.log
```

Native environment observed from job logs and uploaded runtime metadata: Ubuntu
24.04 runner image **20261004.327.1**, Linux x86_64; kernel **6.17.0-1022-azure**,
Debian 12 runner, Node **24.19.0**, Playwright **1.61.0**, Cucumber **12.9.0**,
Ajv **8.20.0**, pg **8.23.1**, Chrome **155.0.8059.39**, Edge **154.0.4258.62**,
Compose **v2.38.2**. The legacy runtime object's `local-container-runtime` string
describes its container metadata; native provenance is independently established
by actual GitHub jobs and the CI manifests, not that string alone. Docker daemon
version JSON was produced by wrappers but is outside the exported allowlist; no
unobserved daemon version is inferred. Native image IDs are in each report.
Representative reporting job exact built image IDs:

```text
[magic-shop-runner:03] sha256:cfe4e33bc4e887e8563a2c457d9848fd94dc4e055e33d3ded8caa11fc590cdde
[magic-shop-customer-api:03] sha256:440ae2c39b494818ea0e85531595d88277f529e5c4395b1c7aee9f7802ae6a50
[magic-shop-catalog-api:03] sha256:d5976e28fd22b59e9d55ac19afa6dc36af93a6b7c25d5ccd07b1a6a953979467
[magic-shop-insights-api:03] sha256:8135e95c57d9620a3e273a8375c04fbfee3a7a1e0276e164bbe3cec26d05052d
[magic-shop-keycloak:03] sha256:181a51bb0b4aecbe176af2751e1c65bc643fef95b97e1cecf92f14a536cb42f0
[magic-shop-gateway:03] sha256:df071cfb17c79c2699de6f4b3b15c34acca15078ed08e5db4610698c8e41c74b
[magic-shop-postgres:03] sha256:5dfef9c459f5b7755a16fc2796a976fbdfc4a1bd30a8f75fe5cd87e9bccc0069
[] sha256:51cd6eaab164e32da5afd0a04e3c6956796169cd2df9325bee0c3d632063fe42
```

Mokapi retains index digest `ba936c3c88db3f95674cbb7b7c790193de1a7e5b6f638efa6adcb89fc6f19be8`,
with native amd64 image ID above. Prism retains digest
`87972b6cf73da2c0339fca18f362b6f93118152d652c970fab93ed13cfd55bae`.
The mock platform correction follows [Compose platform selection](https://docs.docker.com/reference/compose-file/services/#platform).
Final quality passed **168 authored files /970 functions** with the two unchanged
capped transport baselines; new runtime helpers have CCN ≤5 and NLOC ≤6.
Protected application/security/contracts source remains unchanged.

Retained limitations: conservative compatibility checks are not a complete semantic
breaking-change analyzer; Mokapi script outputs still need independent Ajv checks;
Prism remains mock-only for authenticated routing; full checkout runtime schema
validation and fractional timestamp endpoint support remain unfixed. Manual Linux
viewer/operator and literal clean-checkout/repeat startup remain unverified.
Standalone JWT/OIDC examples outside these named jobs retain their original
evidence; no blanket native claim is made for every teaching example.
Artifacts expire after seven days; this committed note and job links preserve the
observations. No app behavior, TLS/PKCE/certificate identity or API authorization
was weakened, no mock auth reached real APIs, and no PR was merged or app deployed.

Final documentation validation passed 170 local links in the pinned offline
workspace container; final downloaded-native-artifact scan passed 93 entries.
`git diff --check` passed. Comparing `d637aa7` with the tested implementation shows
no changes to apps/packages/services/canonical contracts, production Compose,
HAProxy, Keycloak or dependency lockfile. Only test/CI harness and documentation
changed. The draft PR description was rewritten around the completed final scope.
Final evidence-only documentation is committed with skip-ci to avoid repeating
unchanged implementation tests; the native acceptance commit remains `20272cf`.
