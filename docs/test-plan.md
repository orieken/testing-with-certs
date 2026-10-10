# Test strategy and acceptance matrix

Current per-ID evidence and gaps are tracked in [teaching coverage](teaching-coverage.md). The Prompt 11 shared teaching increment passes under both runners and both browser brands on Apple Silicon emulation; concurrent two-worker jobs pass with separate reports. Signed JWT-01 failures passed across all three live APIs in a disposable realm. Prompt 12's local CI-equivalent gates pass; native Linux execution and remaining partial matrix rows stay open.

## Structure

```text
testing/
  site/                  # shared Saturday BaseSite/Page/Element/Flow models
  fixtures/              # composite Saturday + local Keycloak fixtures
  playwright/            # native Playwright Test examples
  cucumber/features/     # Gherkin business scenarios
  cucumber/steps/
  cucumber/support/
  api/contracts/         # browserless Playwright tests against canonical OpenAPI
  api/                   # shared API clients, permission and service tests
  security/              # TLS, proxy boundary and certificate lifecycle tests
  data/                  # synthetic identities and deterministic fixtures
  consumer/              # isolated package installation verification
  container/             # UBI9 runner, manual desktop, entrypoints
  playwright.config.ts
  cucumber.config.ts
```

Use Saturday's site-centric `BaseSite`, `BasePage`, `BaseElement`, and `BaseFlow` abstraction. Both runners call shared domain interactions but keep their assertions readable. The user's request for both runners governs the examples. Attach a minimal local OpenTelemetry span per Cucumber scenario through hooks/adapters; domain/page logic does not own instrumentation. No external telemetry upload is required.

All required browser scenarios run with Playwright channels `chrome` and `msedge`; neither Firefox nor bundled Chromium is part of the matrix. Run at least one real certificate-login scenario per runner per browser. Reuse authenticated state only for scenarios that are not testing login, always with matching certificate identity and isolated context.

## OpenAPI contract coverage

All three APIs must pass the dedicated Playwright `contracts` project described in [API contract requirements](api-contracts.md). It uses authenticated API request contexts against real providers and the checked-in expected specifications. It validates operations, requests, exact expected statuses, headers, media types, response/error schemas and relevant business assertions. Public routes go through HAProxy; private routes use service credentials on the private network. Schema validation does not replace role, ownership or certificate tests.

Run these tests once per API build without launching Chrome/Edge. Add each service's tests while implementing that service, then complete the cross-service matrix in prompt 11. Missing operation coverage, deployed spec drift and contract violations fail CI.

| ID | Scenario | Required result | Level |
| --- | --- | --- | --- |
| CONTRACT-01 | Each documented operation receives a valid authenticated request | Expected status, headers/media type and response schema conform to canonical OpenAPI | Playwright API contract, all three services |
| CONTRACT-02 | Applicable invalid inputs and authorization failures | Documented error status/schema; invalid input actually reaches provider | Playwright API contract |
| CONTRACT-03 | Deployed spec changes or generated transport artifacts become stale | Expected bundle/digest and reproducibility checks detect drift | Build + Playwright API contract |
| CONTRACT-04 | New operation has no successful scenario or required negatives | Operation coverage gate fails with missing IDs | Contract coverage |
| CONTRACT-05 | Deliberately malformed response samples | Validator rejects missing fields, wrong types and unexpected status/media type | Contract harness validation |
| AUTH-01 | Valid customer certificate, fresh context | Keycloak login without password; correct user and own orders | UI, both runners/browsers |
| AUTH-02 | Valid admin certificate | Users, all orders, sales and map visible | UI, both runners/browsers |
| AUTH-03 | No client certificate | Shop TLS gate denies access before UI data | TLS + browser smoke |
| AUTH-04 | Wrong CA, expired, not-yet-valid certificate | Rejected; no password fallback | TLS + Keycloak integration |
| AUTH-05 | Trusted certificate with unknown/disabled user | No authenticated shop data | Keycloak + UI |
| AUTH-06 | Renew certificate | New key/serial works; identity and permissions remain stable | Integration + browser smoke |
| AUTH-07 | Revoke certificate and publish CRL | New handshakes/login denied within documented bound | TLS + integration |
| AUTH-08 | Log out, then revisit with installed certificate | Session ends; fresh certificate login can occur; no promise of uninstall | UI |
| AUTH-09 | Change selected manual user | Fresh home/context; no prior tokens, cookies or certificates survive | Manual automation + check |
| AUTH-10 | User A certificate plus user B token | API rejects identity mismatch | API |
| AUTH-11 | User A certificate plus user B saved Keycloak cookies | Cannot obtain B-authorized application access | UI + API |
| JWT-01 | Missing, altered, expired token; wrong issuer/audience/algorithm; ID token | API rejects each at token validation | API, all languages |
| JWT-02 | Signing key rotation and unknown key | Valid rotation succeeds after refresh; unknown key fails closed | Integration |
| JWT-03 | Disable user/session with existing token | Measured residual access matches stated TTL policy; refresh denied | Integration |
| ROLE-01 | Customer calls admin endpoints directly | 403 regardless of hidden buttons | API, all exposed admin routes |
| ROLE-02 | Customer requests another customer's order/profile/layout | 404 for hidden owned resources; no leaked content | API |
| ROLE-03 | Shopkeeper changes item; customer tries same | Shopkeeper allowed, customer rejected | UI + API |
| MTLS-01 | Missing/wrong/revoked service certificate | Backend rejects TLS/caller before business handler | Service integration |
| MTLS-02 | Correct cert, token from different service | Rejected even when both credentials separately validate | Service integration |
| MTLS-03 | Correct caller/token but wrong audience or scope | Rejected | Service integration |
| EDGE-01 | Spoof identity/forwarding/certificate headers | Stripped or ignored; cannot authenticate as chosen user | Proxy integration |
| EDGE-02 | Browser tries private reporting route or backend port | No public route; human cert/token cannot use service-only routes | Network + API |
| SHOP-01 | Browse, detail, add/remove cart line, checkout | Correct items, server-computed total, recorded own order | UI, shared flow |
| SHOP-02 | Tamper price/total, invalid quantity/item, duplicate submission | Reject bad input; duplicate idempotency key does not duplicate order | API |
| WIDGET-01 | Add/remove own dashboard widgets and reload | Preference persists and role restrictions hold | UI + API |
| REGION-01 | Admin selects region on map/table | Same filter, expected users/orders and sales; completed-order rule | UI + API |
| REGION-02 | Empty region, date boundary, customer moved regions | Correct documented historical-order grouping | Unit + API |
| MAP-01 | Offline network, markers/layers, geolocation allowed/denied | Map/table remain usable; no external tiles required | UI |
| FOLLOW-01 | Admin records follow-up note/status | Persisted for synthetic customer; no outbound message | UI + API |
| TRUST-01 | Unknown server CA or wrong hostname | Client fails; no ignoreHTTPS setting masks it | Browser + service integration |
| PKG-01 | Install packed package outside workspace | Both adapters work without shop-specific imports | Consumer integration |
| OPS-01 | Clean checkout/volumes, then repeated startup | Deterministic setup; repeat does not destroy existing data | Compose smoke |
| OPS-02 | Run parallel test workers | No cross-user data, cert, or report collision | E2E repeat/isolation |

## Fixtures and reports

- Use explicit immutable identity mappings and synthetic fixtures. Certificate failure tests must not alter the host clock; generate certificates with controlled validity windows.
- Automated jobs receive only the named identity/negative-fixture set needed for their scenarios; tests involving two identities use a dedicated fixture set. They do not mount the complete PKI output. Manual mode always receives exactly one selected user identity. Rotate jobs/volumes for the broader role matrix.
- Region tests use local GeoJSON, fixed coordinates, a known UTC interval, and expected sums computed independently of the API implementation.
- HTTP validation: 401 for missing/invalid token, 403 for inadequate capability, 404 for inaccessible owned objects. TLS failures are not HTTP 401 responses.
- JWT rotation tests and destructive bootstrap/revocation tests run in a dedicated project/realm. Do not destabilize concurrent happy-path scenarios.
- Make reset helpers available only to the operator/test control plane. Never expose unauthenticated browser-accessible reset APIs.
- Produce Playwright HTML and JUnit, Cucumber JSON/JUnit, failure screenshots, and safe browser/version/container metadata under `artifacts/<run-id>/`.
- Traces and videos can contain tokens in redirects/headers or synthetic personal details. Keep authentication traces off by default unless a verified redaction/retention policy exists. Do not upload raw storageState, HARs, PKCS#12 files, private keys, or credentials to CI artifacts. Add a fixture-secret scan to the upload list.
- The observed `./lab record` Playwright Test browser examples save passing and failing WebM videos plus HTML/JUnit reports under a local, gitignored run directory. They run real certificate login in Chrome or Edge. The fixture-backed UI case is explicitly separate from live business API and contract evidence. Recorded videos are local review artifacts, not CI upload artifacts.
- Use bounded framework polling and explicit network timeouts. No arbitrary sleeps to make startup or login pass.

## Completion criteria

The implementation is complete only after all required matrix cases pass at the appropriate layer, both browser channels pass the two runner smoke suites on Linux amd64, and selected-user manual Chrome/Edge operation has been demonstrated on Apple Silicon or a documented remote amd64 development runner. Do not mark emulated local execution as working based solely on a successful image build.

All three live APIs must also pass the browserless Playwright contract suite against their canonical OpenAPI artifacts, with every business operation covered and no unexplained specification drift.

The test report records any fallback base image, actual browser versions, and the environment on which each result was observed. Apply inherited coverage/complexity checks to authored source with a documented denominator; exclude vendored assets/generated files rather than inventing low-value tests for them.

## Separate certificate + password matrix

`LAB_PROJECT=magic-shop-password-15 sh testing/run-certificate-password.sh` runs nine shared checks under Playwright
Test and Cucumber in real Chrome and Edge: signed token identity after both
factors, wrong password, missing certificate, wrong-CA service certificate,
disabled user, trusted unmapped user, account without a password, saved-cookie/replaced-certificate attempts,
and certificate-only shop login/logout. TLS verification is enabled everywhere.
Temporary random test passwords remain in a Docker volume, refuse existing
operator passwords and are removed with fixture sessions on completion. Start that disposable project with `LAB_PROJECT=magic-shop-password-15 ./lab up`
first. The wrapper refuses the retained default project; existing operator
passwords also cause the fixture to fail safely.
The full matrix has no video, screenshot, trace or storageState export; test
output is status/assertions only. A separate opt-in recorder saves only a new
passing login’s viewport video with password input masked; it reuses the
successful identity checks. See [recording instructions](../testing/README.md#certificate--password-lesson). Completion 15 distinguishes runtime results.
