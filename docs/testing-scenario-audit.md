# Testing scenario and contract tooling audit

Execution backlog: [prioritized checklist with agent handoff prompts](testing-scenario-checklist.md).

Audited 2026-10-09 (America/Chicago), at commit `1c9970c`, on macOS arm64. This is a source and documentation audit, not a new execution result. No tools were installed, containers changed, or Linux evidence inferred. Existing completion notes remain the source for observed runs.

## Existing foundation

The repository already has canonical OpenAPI 3.1 contracts for 23 operations across Go, Node and Python, generated bundles/types and digests, provider equivalence checks, strict Ajv 2020-12 request/response validation, authenticated deployed-spec comparison, live Playwright contracts and an operation/status gate. CI runs contracts before security and the real Chrome/Edge Playwright/Cucumber matrix. This is provider conformance testing; generated types alone do not prove that consumers handle responses correctly.

Several less common responses already have live tests: owned-order 404, checkout 409/422, widget 422, reporting revision 409, and catalog quote 422. Empty regional sales and pagination also exist. These should be extended, not rebuilt as new capabilities.

## Prioritized gaps

| Priority | Finding and evidence | Buildable acceptance scenario |
| --- | --- | --- |
| High | `infra/check-contract-coverage.mjs` enforces one success plus 400/401/403 per operation. Other documented responses can lose coverage while the gate passes. The manifest's `scaffold-only-no-live-provider-coverage` label is stale. | Require applicable documented statuses, with explicit reasoned exclusions for scenarios not yet executable. Prove removing an existing 409/422 observation fails the gate. Keep mock and live results separate. |
| High | `testing/api/contracts/*.contract.spec.ts` contains no asserted 503 provider response. Service timeouts and dependency rejection paths exist. | Node checkout: quote dependency unavailable, slow, or malformed; return bounded 503 and persist no order/idempotency success. Insights: feed outage or incomplete pagination; return an error without partial totals. Restore dependency and verify recovery. |
| High | `.github/workflows/ci.yml` does not invoke `testing/run-certificate-password.sh`. The new flow has local 36-case evidence, not native CI coverage. | Run the separate flow in disposable CI resources across both browsers and runners; retain scanned text reports, clean temporary passwords/sessions even on failure, and retain the certificate-only shop regression. |
| Medium | Vue `src/api/http.ts` has a ten-second abort, size bounds and JSON parsing, but returns a TypeScript cast without response schema validation. Recorded UI tests use hand-authored route fixtures. | Contract-check valid mock fixtures, then separately inject malformed JSON, wrong types, oversized bodies, delay, disconnect, 403 and 503. Assert visible recovery, no stale success and no duplicate checkout. Deliberately invalid fixtures must be identified as fault cases. |
| Medium | Checkout tests cover sequential idempotency replay and changed-body conflict; they do not establish simultaneous checkout retry behavior. | Send concurrent identical requests with one key: one persisted order and stable replay result. Race different bodies with the same key: one winner and one 409. Simulate a lost response after persistence and retry. Use a real database/provider for this invariant. |
| Medium | Python reporting unit tests cover changed revision; live customer contracts cover feed 409. The complete live insights-consumer recovery path is not established by those checks. | Script page one r1, then page two 409 or r2. Assert no mixed aggregate and documented error/retry behavior. Test repeated cursor, empty intermediate page and maximum page bounds. |
| Medium | `docs/teaching-coverage.md` explicitly leaves REGION-02 partly covered. Fixed September oracle and empty-region coverage do exist. | Check exact date-window boundaries, customer moves after an order, historical order region versus current profile location, and totals across pages. Use deterministic fixtures and the existing oracle. |
| Medium | PR-base comparison is wired only for pull requests; prior push success cannot demonstrate that branch. Coverage documentation also retains older Linux limitations. | Exercise a real PR comparison with unchanged/additive/breaking contracts; reconcile evidence by completion-note reference. Do not mark the PR case complete from mutation tests or push CI. |

## Where Prism and Mokapi fit

[Prism's official repository](https://github.com/stoplightio/prism) advertises OpenAPI 3.1 mock and validation-proxy support. It is the smaller first experiment for specification-derived consumer fixtures. Its [validation-proxy guide](https://github.com/stoplightio/prism/blob/main/docs/guides/03-validation-proxy.md) describes `--errors` enforcement and automatic mocking when upstream returns 501. Consequently, proxy output must not be counted as untouched provider evidence; explicitly test validation failures and 501 behavior before using it as a gate.

[Mokapi's official repository](https://github.com/marle3003/mokapi) documents JavaScript response customization, errors, delays, configuration patches and Docker operation. It is a candidate for dependency scenarios that change across calls, such as reporting revisions and recovery after an outage. Its advertised support does not establish compatibility with this project's schema features or service mTLS; both need a pinned-container spike.

| Layer | Preferred approach | Evidence it supplies |
| --- | --- | --- |
| Real providers | Keep existing Ajv/Playwright contracts | Actual provider responses, authentication and persistence |
| Consumer success/error states | Prism with canonical bundles and deterministic examples | Consumer behavior against contract-derived responses |
| Stateful dependency failures | Mokapi scripts with deterministic reset | Consumer handling of faults and changing response sequences |
| Database races/security | Real isolated stack | Transaction, ownership, TLS and certificate/token guarantees |

Neither tool substitutes for Keycloak, certificate selection, issuer/signature checks or live API identity comparisons. Mock security schemes are not evidence that production authentication is enforced.

## Smallest useful next increment

1. Correct the coverage gate and evidence labels before introducing another tool.
2. Pin a Prism version/image digest in a disposable container experiment. Mount canonical bundles read-only. Verify the project's 2020-12 tuple/date constraints, headers, bodyless 204, error responses and invalid-request behavior against the existing Ajv fixtures; document differences.
3. Add a separate mock suite with catalog populated/empty and failure states, plus checkout 409/422/503. Share browser journeys between Playwright and Cucumber where applicable. Deterministic examples should pass existing contract validation.
4. Add Mokapi only for a demonstrated sequence requirement: reporting page revision change or quote-dependency outage/recovery. Prove bounded time, no partial persistence/aggregation, reset isolation and cleanup.
5. Wire separately named live-provider, mock-consumer and fault-injection jobs/reports into CI. A passing mock suite must never satisfy live operation coverage.

Use an isolated Compose overlay/private test network and explicitly selected disposable project. Preserve the two public HTTPS origins, HAProxy authentication passthrough, PKCE and gateway/API pairing. Before forwarding authenticated traffic, prove upstream CA/hostname verification and client-certificate support; if the tool cannot provide them, use a verified TLS wrapper with a documented boundary. Do not disable TLS verification. Keep secrets and profiles in Docker volumes, disable or redact mock request dashboards/logs, and scan exported artifacts. No public mock endpoint or password-only route is proposed.

## Audit method and limits

Read the CI workflow, contracts/testing package definitions, coverage manifest/checker, live contract tests, provider reporting and checkout paths, Vue HTTP client, test plan, TODO/evidence map and completion 15. Used repository text/file searches for response statuses, timeout/retry paths and browser fixtures. Consulted the primary Prism and Mokapi sources linked above. Only documentation was changed; no new runtime tests, mock compatibility results or native CI results are claimed. The next dependency is the pinned-container compatibility experiment and selection of its first consumer scenario.

## Subsequent isolated learning examples

The historical audit above remains a source review. [Completion 16](completion/16-mocking-examples.md) records later observed FEATURE-01–03 execution: ephemeral signed JWT fixtures, NAV OIDC over native verified TLS, and a bounded Prism mock-only catalog consumer with canonical/Ajv-checked examples and a private TLS/fault adapter. This supplies separate mock-consumer evidence, not provider/login evidence, and does not close TEST-01–11 or the full TEST-05 compatibility matrix. The user prioritized these standalone examples before the other backlog items.

## Subsequent browser mock consumer evidence

[Completion 17](completion/17-browser-mock-consumers.md) records 56 passing isolated browser executions across Chrome/Edge and Playwright/Cucumber, with actual recordings. The unchanged Vue build uses intercepted authentication/API responses; a separate OIDC browser consumer uses the pinned NAV mock with verified TLS and JWKS validation. This adds consumer/UI evidence only. Live login, production certificate/account pairing, API authorization and native Linux-host criteria remain open.
