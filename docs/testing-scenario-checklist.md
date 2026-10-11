# Prioritized testing work and agent handoffs

Implementation backlog from the [scenario audit](testing-scenario-audit.md). TEST-01, TEST-03, TEST-05, TEST-06, TEST-07, TEST-08, TEST-09 and TEST-10 are completed with local container evidence; TEST-02 is completed with native evidence. TEST-04 has actual native PR-base evidence; TEST-11 has complete native independent-suite evidence. The user prioritized the separate FEATURE-01–03 learning examples ahead of these items; their acceptance evidence is recorded below. Follow each testing item's dependencies when resuming this backlog. Checking a box requires recorded acceptance evidence, not merely code or a successful mock response.

## Shared instructions for every handoff

The mock learning examples FEATURE-01–03 in [TODO](TODO.md#learning-examples--mocking-for-tests) demonstrate test techniques in isolated consumers. They must not change the app's behavior or authentication. Product expansion ideas FEATURE-04–06 are separate future scope.

Append these instructions to each prompt below:

> Work in `/Users/oscarrieken/Projects/Rieken/testing-with-certs`. Read `docs/README.md`, `docs/architecture.md`, `docs/workflows.md`, `docs/authentication.md`, `docs/api-contracts.md`, `docs/test-plan.md`, `docs/testing-scenario-audit.md` and relevant completion notes before editing. Extend existing coverage. Run builds, provisioning, certificates and tests in containers; keep secrets and browser profiles in Docker volumes. Keep TLS verification enabled, both exact HTTPS origins, HAProxy auth passthrough, PKCE, selected-certificate identity and gateway/API comparison intact. The shop remains certificate-only; the separate teaching view requires certificate and Keycloak password with no password-only fallback. Use real Chrome/Edge and both Playwright Test/Cucumber where browser journeys apply. Keep live-provider, mock-consumer and fault evidence distinct. Update affected diagrams and record exact commands, environment, observed results, limitations and next dependency in a new completion note. Check only completed acceptance criteria. Do not modify the Saturday checkout, publish, deploy, or claim unrun Linux evidence.

## High priority — handle first

- [x] **TEST-01 — Strengthen operation/status coverage enforcement.** Dependencies: none.

  **Handoff prompt:** Extend the canonical OpenAPI coverage gate to require applicable documented response statuses, beyond success/400/401/403. Inventory existing tests first. Use explicit, reviewed exclusions with reasons for deferred cases; never silently exempt all uncommon errors. Correct the stale scaffold label. Keep mock observations out of live coverage.

  **Evidence:** [Completion 19](completion/19-checkout-dependency-faults.md): 100 live requirements, 21 explicit exclusions, passing 23-operation gate and 409/422 removal controls. Local container evidence; no new native run.

  **Done when:** Removing an existing 409 or 422 observation fails a meaningful gate test; all operations retain coverage; uncovered statuses or exclusions are visible; the live suite passes with its recorded exclusions.

- [x] **TEST-02 — Put certificate-plus-password coverage into native CI.** Dependencies: none; closes the corresponding native-CI item in TODO section 15.

  **Handoff prompt:** Wire the existing certificate-password runner into native Linux CI using disposable resources. Run all nine scenarios in Chrome/Edge and Playwright/Cucumber, including the certificate-only shop regression. Preserve interactive provisioning for the human demo; CI credentials stay temporary and container-held. Integrate scanned text reports and reliable cleanup on success, failure and cancellation.

  **Done when:** A native run supplies all 36 passing cases, readable scanned reports and cleanup evidence. Exercise a failure path to verify cleanup. Prior push results or local emulation do not satisfy native acceptance.

- [x] **TEST-03 — Prove checkout dependency failure and recovery.** Dependencies: TEST-01; TEST-06 if using Mokapi, otherwise an isolated verified fault harness.

  **Handoff prompt:** Test the real Node checkout consumer against unavailable, delayed and malformed catalog quote responses. Assert bounded 503 responses, no persisted order or successful idempotency result, then restore the dependency and retry. Use contract validation and the real database; do not count a mock checkout endpoint as provider evidence.

  **Evidence:** [Completion 19](completion/19-checkout-dependency-faults.md): two fresh 22/22 runs, measured 503 bounds, real database zero-persistence/recovery assertions, verified TLS and mandatory separate fault gate; recorded output and deliberate failure cleanup.

  **Done when:** Each fault has a deterministic passing test, measured timeout bound, database assertions and successful recovery; TLS remains verified; 503 is accounted for in the coverage gate.

- [x] **TEST-04 — Reconcile evidence and exercise PR-base contract checks.** Dependencies: none.

  **Handoff prompt:** Reconcile stale coverage/TODO statements against completion notes and actual CI results, preserving historical context. Exercise the real pull-request base comparison for unchanged, additive and breaking contracts. Use a draft PR or authorized test branch without merging; attach any created PR to this task. Keep temporary mutations out of the final implementation.

  **Done when:** Actual PR-event results demonstrate acceptance/rejection against the committed base, documentation cites the evidence, and deferred checks remain unchecked. Mutation unit tests alone do not satisfy this item.

TEST-04 evidence: [completion 25](completion/25-pr-base-contract-evidence.md): actual native PR-event steps accepted unchanged and additive schemas and rejected the changed Item schema against committed main. Experimental PRs were closed unmerged and both branch trees restored; current versus historical platform claims reconciled.

TEST-02 evidence: [completion 18](completion/18-native-certificate-password-ci.md), [passing native run 38027680587](https://github.com/orieken/testing-with-certs/actions/runs/38027680587), and [deliberately cancelled cleanup probe 38028333657](https://github.com/orieken/testing-with-certs/actions/runs/38028333657). All 36 cases and text upload passed; credential/resource cleanup passed after success, intentional failure and the recorded cancellation boundary.

## Medium priority — establish tool compatibility, then scenarios

- [x] **TEST-05 — Prove Prism compatibility in a bounded container experiment.** Dependencies: TEST-01.

  **Handoff prompt:** Pin Prism and its container image digest. Load read-only canonical bundles and compare its behavior with existing Ajv fixtures for tuple/date constraints, headers, 204, error schemas and invalid requests. Test validation-proxy enforcement and upstream 501 behavior. Prove CA/hostname verification and client-certificate forwarding before routing authenticated traffic; document incompatibilities rather than disabling TLS.

  **Done when:** A reproducible compatibility report names the exact version/digest, passing and unsupported cases, and a concrete decision on mock-only versus proxy use. No default public route changes.

  **Evidence:** [Completion 21](completion/21-prism-compatibility.md): pinned Prism 5.14.2/digest, 27 observed compatibility probes, positive/error/header/204/request and tuple/date checks, proxy warning/enforcement and 501 fallback, verified synthetic TLS negatives and absent client-certificate forwarding. Explicit mock-only decision; no real route changes or native evidence.

- [x] **TEST-06 — Prove Mokapi sequence and TLS compatibility.** Dependencies: a concrete requirement from TEST-03 or TEST-09.

  **Handoff prompt:** Pin Mokapi and its image digest. Build one deterministic scripted sequence for quote outage/recovery or reporting revision change. Verify required OpenAPI schema behavior, reset isolation, TLS boundary and cleanup. Redact or disable request dashboards/logging. Use a verified TLS wrapper only if needed and explain its trust boundary.

  **Done when:** The selected sequence is repeatable in independent disposable projects, exact compatibility limitations are recorded, and no credentials escape volumes/artifact scanning.

  **Evidence:** [Completion 23](completion/23-mokapi-reporting-sequences.md): pinned Mokapi 0.52.0/digest, 14 compatibility observations with independent Ajv checks, deterministic reporting revision/conflict sequences, verified TLS/identity and real Node token authorization before credential-free mocking, two fresh disposable 19-case consumer runs, separate fault gate and cleanup. Scripted invalid responses are explicitly invalid; no native or live-provider coverage claim.

- [x] **TEST-07 — Add contract-derived consumer and UI failure scenarios.** Dependencies: TEST-05.

  **Handoff prompt:** Create a separately named Prism consumer suite using deterministic, Ajv-validated examples for populated/empty catalog and checkout 409/422/503 states. Add explicitly labelled malformed JSON, wrong-type, oversized, delay, disconnect and 403 fault cases. Exercise Vue recovery and absence of stale success or duplicate checkout through shared Playwright/Cucumber journeys. Evaluate runtime response validation only if evidence justifies the implementation cost.

  **Done when:** Applicable journeys pass in real Chrome and Edge under both runners; valid fixtures pass contract validation; deliberate faults have specific behavior assertions; reports cannot satisfy live-provider coverage.

  **Evidence:** [Completion 22](completion/22-prism-browser-failures.md): two full 44-case Chrome/Edge × Playwright/Cucumber matrices, actual recordings, canonical Ajv/Prism examples, typed catalog and JSON/size/transport checkout faults, bounded manual same-key recovery and independent mock evidence gate. Final combined wrapper and intentional failure cleanup verified; no real-provider, native or arbitrary checkout-schema rejection claim.

- [x] **TEST-08 — Verify concurrent idempotency and lost-response retry.** Dependencies: none; can follow high-priority work without mock tooling.

  **Handoff prompt:** Against the real isolated provider/database, race identical checkout requests using one key, race different bodies using one key, and simulate a response lost after persistence followed by retry. Verify one persisted order, stable replay and the documented conflict behavior. Avoid timing-only assertions.

  **Done when:** Database and API evidence show one winner/order, stable identical replay and 409 for conflicting bodies; the lost-response retry creates no duplicate. Fixtures clean up safely.

  **Evidence:** [Completion 20](completion/20-checkout-idempotency.md): two fresh 21/21 container runs; four/two database-observed insert waiters, one order/revision increment, canonical 201/409 replay and a real committed response discarded before client headers. Separate evidence gate, TLS/auth controls, recorded output and intentional failure cleanup. Local emulation only; no new native evidence.

- [x] **TEST-09 — Verify insights pagination failure without mixed totals.** Dependencies: TEST-06 for scripted dependency sequences.

  **Handoff prompt:** Exercise the real insights consumer with page one revision r1 followed by 409, revision r2, outage, repeated cursor or an empty intermediate page. Test maximum page bounds and documented recovery. Extend existing reporting unit and provider tests; prove the whole consumer path never returns mixed or partial totals.

  **Done when:** Deterministic sequences prove bounded termination, correct error/recovery behavior and no partial aggregate; applicable response contracts pass and live/fault evidence remains distinguishable.

  **Evidence:** [Completion 23](completion/23-mokapi-reporting-sequences.md): real insights HTTP paths for sales/customers/orders reject second-page 409/r2/outage/repeated cursors without partial results, recover explicitly, continue across an empty intermediate page, succeed at 10,000 records and stop over-record/endless-page feeds on page 101. Python boundary tests, canonical response validation, exact request counters, elapsed bounds and mutation-tested separate evidence gate passed; recorded output is labelled browserless consumer evidence.

- [x] **TEST-10 — Complete regional reporting boundary scenarios.** Dependencies: none.

  **Handoff prompt:** Extend REGION-02 using deterministic fixtures: exact date-window boundaries, customer moves after an order, historical order region versus current profile location, and totals across multiple pages. Preserve the existing September oracle and empty-region checks. Resolve expected semantics from contracts/domain design before adding assertions.

  **Done when:** Each boundary has a concrete expected result and passing provider tests; applicable browser map/table journeys agree; REGION-02 is checked only when its complete requirements are observed.

  **Evidence:** [Completion 24](completion/24-regional-reporting-boundaries.md): five live provider acceptance cases and a separately labelled timestamp limitation probe; 110 exact order identities over seven public/two private pages; genuine profile move with historical Waterdeep totals; preserved September/empty-region oracles; 16 recorded real-auth Chrome/Edge Playwright/Cucumber journeys. UI rows retain the current first-25 limit. Mixed-precision query endpoints remain an explicit production gap.

- [x] **TEST-11 — Integrate separate consumer/fault CI gates and reports.** Dependencies: TEST-05–07 and at least one completed dependency-fault scenario (TEST-03 or TEST-09).

  **Handoff prompt:** Add separately named contract-derived consumer and fault-injection CI jobs/reports while retaining the live-provider gate and its ordering. Reuse pinned containers and explicit disposable project isolation. Scan artifacts, verify readability, and prove cleanup for failing jobs. Document which job proves which boundary.

  **Done when:** Native CI passes the new suites and existing live/security/browser checks; reports identify evidence type; a mock pass cannot conceal a failing or missing live-provider result.

TEST-11 evidence: [completion 26](completion/26-independent-ci-evidence.md): complete native push 38115515064 and PR 38115518115 passed all 13 jobs, including the existing live/security/browser and certificate/password jobs, five independent suite/probe/cleanup/report selections and the final aggregate. Deliberate-red run 38115560267 failed checkout as requested, cleaned resources, uploaded an explicit failed report and was rejected by the aggregate.

## Completed isolated learning examples

Observed 2026-10-09 on Apple Silicon Docker Desktop; Prism ran with amd64 emulation.
See [completion 16](completion/16-mocking-examples.md) and [commands and boundaries](../spikes/mock-auth/README.md).

- [x] FEATURE-01: standalone signed JWT consumer accepts valid and rejects expired, wrong audience and altered signature; ephemeral credentials remain container-held.
- [x] FEATURE-02: dedicated consumer exercises native-TLS discovery/JWKS/token handling, ten negative cases and recovery against a pinned OIDC mock; fresh-project reset and cleanup observed.
- [x] FEATURE-03: Prism mock-only consumer uses canonical/Ajv-checked fixtures; structured errors, bounded delay, labelled invalid data and recovery observed; verified TLS to the test adapter.
- [x] Shared example isolation: no published ports or live-app network, credential volumes removed after successful and deliberately failing runs; text reports scanned.

This does **not** complete TEST-05: the bounded Prism experiment established selected mock-only response/request behavior and the TLS adapter boundary. Prism tuple/date generation, validation-proxy enforcement, upstream 501 and authenticated client-certificate forwarding were not exercised. TEST-01/03 now have separate local evidence in completion 19; TEST-02 has its separate native evidence. TEST-04–11 remain open.

## Completed isolated browser mock consumers

See [completion 17](completion/17-browser-mock-consumers.md) and [copyable commands](../spikes/mock-auth/browser/README.md).

- [x] Unchanged Vue build tested with intercepted authentication/API dependencies: customer/admin behavior, rejected callbacks/claims, refresh failure, checkout faults and manual recovery.
- [x] Dedicated OIDC browser consumer tests discovery, code exchange, matching S256 parameters, JWKS verification, dependency/signature faults and recovery.
- [x] Fourteen shared scenarios pass in Chrome and Edge under both Playwright and Cucumber (56 executions); each has an actual browser recording labelled as mock evidence.
- [x] Verified TLS/mTLS test boundary, canonical Ajv fixture validation, private network, volume-held credentials/profiles, fresh contexts, exported artifact scan and successful/failing cleanup observed.

These mock-consumer criteria do not close live login/provider requirements, production certificate identity pairing, provider PKCE enforcement or native Linux-host evidence. TEST-02 is closed by its separate live native CI run; TEST-01/03 have their separate local evidence in completion 19. TEST-04–11 remain open.

## Handoff tracking

For each assigned item, record the agent/task, branch or PR, completion-note path and acceptance result beneath the item. Shared files such as the coverage gate, CI workflow and evidence map need coordinated ownership. An agent should report a blocked dependency explicitly rather than checking the item or weakening its criteria.
