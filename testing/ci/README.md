# Independent native CI evidence

The existing live-provider contracts/security/browser gate and separate real
certificate/password job retain their ordering and reports. New jobs use existing
bounded pinned-container suites, private disposable projects, verified TLS and
volume-held keys/secrets/profiles:

| CI suite | Dependency boundary | Separate report source |
| --- | --- | --- |
| consumer | Prism-generated fixtures, browser-only synthetic authentication | `prism-mock-browser-consumer` (44 UI journeys plus 27 compatibility observations) |
| checkout | Real Node checkout, authenticated dependency faults | `real-checkout-dependency-faults` |
| reporting | Real insights, Mokapi pages behind verified TLS/real authorization | `real-insights-scripted-dependency-faults` (19 cases plus Mokapi compatibility) |
| idempotency | Real providers/database, bounded races and response loss | `real-provider-checkout-idempotency` |
| regional | Real auth/providers and deterministic historical-region fixtures | `live-regional-provider` (five acceptance cases, one known limitation and 16 UI journeys) |

Mock/fault reports cannot satisfy the existing live-provider coverage gate.
A final independently named job rejects any missing/skipped/failed/cancelled live,
lesson, consumer, fault-matrix or regional job. Fault matrix uses fail-fast false;
a failure does not cancel the other evidence selections or become a green result.

Copyable local commands from repository root (choose a fresh ID each time):

```sh
CI_EVIDENCE_ID=local-example ./testing/ci/run-isolated.sh consumer
CI_EVIDENCE_ID=local-example ./testing/ci/probe-failure.sh consumer
CI_EVIDENCE_ID=local-example ./testing/ci/cleanup-isolated.sh consumer
```

Replace `consumer` with `checkout`, `reporting`, `idempotency` or `regional`.
The failure probe expects precisely exit 1 and the intentional-failure marker,
then independently checks both projects' resources are absent. Other failures do
not count as successful probes. An always-running workflow cleanup step separately
removes both known projects even if startup/tests/probes are interrupted.

CI exports only allowlisted JSON/JSONL/text files, including explicit provenance,
actual suite/failure-probe outcomes, versions/image IDs and disposal receipts.
Credential scanning and host readability checks precede upload. Actual videos are
required by applicable suite gates but are not uploaded by CI; local recording
commands remain in the individual suite docs. Raw logs, HTML, HAR, traces,
storage state, certificates, keys, tokens and browser profiles are not exported.
The manifest distinguishes actual GitHub CI from local container staging.
A failed job may upload a clearly failed/partial manifest; uploading is not success.

After the workflow exists on a branch, an explicit negative native job can be
requested without modifying app code:

```sh
gh workflow run ci.yml --ref YOUR_BRANCH -f evidence_failure_suite=checkout
```

This deliberately makes that job and the final aggregate red. Use only as a
cleanup/gating control; never credit it as a passing regression workflow. Actual
native results belong in completion 26; until recorded, implementation alone does
not close TEST-11.
