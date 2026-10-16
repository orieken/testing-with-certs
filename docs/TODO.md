# Implementation todo list

## Additional authentication methods — 2026-10-15

Current coverage: X.509/mTLS user login with OIDC Authorization Code + PKCE, a separate certificate + password lesson, and OAuth client credentials with service mTLS are implemented. Certificate/password has a recorded 36-case native Chrome/Edge × Playwright/Cucumber matrix; see [authentication details](authentication.md), [coverage matrix](teaching-coverage.md), and [completion 18](completion/18-native-certificate-password-ci.md). Standalone mocked OIDC journeys do not establish real external-provider federation coverage.

Implement the remaining methods as separate teaching clients/routes. Preserve the certificate-required shop and its API certificate/token pairing checks. Provide a separate gateway entry point for certificate-free lessons; lesson tokens must remain excluded from business APIs unless that access is explicitly designed and tested.

2026-10-16 live progress: all five method implementations are present. Fresh disposable runs passed 60/60 real Chrome/Edge cases locally on Apple Silicon with Linux amd64 browser emulation. Credential-safe report scans and complete project cleanup passed. [Completion 30](completion/30-authentication-lessons.md) records commands, versions, fixes, reports, and limits. Independent native CI and additional acceptance cases below remain open; the implementation items are no longer a request to build the flows from scratch.

| Delivered method | Local browser evidence | Remaining acceptance |
| --- | --- | --- |
| Password + TOTP | 14/14 passed | Native CI and shared follow-ups |
| Passkey enrollment/login | 14/14 passed | Native CI; physical devices remain outside virtual-authenticator evidence |
| Controlled external OIDC | 10/10 passed | Native CI; organizational-provider compatibility is not established |
| SAML | 14/14 passed | Independently signed wrong-audience/recipient/expired assertions; native CI |
| Kerberos/SPNEGO | 8/8 passed | Wrong-service-principal tickets; native CI |


- [ ] **AUTH-NEXT-01 — Password + TOTP.** Add a dedicated Keycloak flow, isolated test users, and controlled OTP enrollment. Generate codes from test-only secrets inside the runner; cover successful login, incorrect password, incorrect/expired OTP, disabled users, logout, and session isolation in Playwright. Keep secrets out of reports and recordings.
- [ ] **AUTH-NEXT-02 — WebAuthn/passkeys.** Add a separate registration/login lesson and Chromium virtual-authenticator fixtures for Chrome and Edge. Cover registration, successful login, missing/wrong credentials, disabled users, logout, and fresh-context credential/session isolation. Explicitly distinguish virtual-authenticator evidence from physical key or biometric verification; document supported browser scope.
- [ ] **AUTH-NEXT-03 — External OIDC federation.** Add a controlled second identity-provider container and configure Keycloak brokering. Exercise real browser redirects, identity mapping, successful/rejected login, disabled users, callback/state failures, logout behavior, and session isolation. Keep live federation evidence separate from existing mocked OIDC examples.
- [ ] **AUTH-NEXT-04 — SAML 2.0 SSO.** Add a controlled SAML identity provider, metadata/signing-certificate provisioning, and a separate Keycloak broker/client lesson. Exercise successful/rejected login, identity/role mapping, invalid signature/audience/recipient and expired assertion rejection, logout behavior, and session isolation. Use protocol-level fixtures where browser interaction alone cannot produce invalid assertions.
- [ ] **AUTH-NEXT-05 — Kerberos/SPNEGO.** Add a containerized KDC, deterministic DNS/hostnames, test principals, runner ticket provisioning, and narrowly scoped browser integrated-auth policies. Cover valid ticket login, absent/expired/wrong-principal tickets, disabled-user behavior, and fresh-profile isolation. Record Linux Chrome/Edge support and any platform limitations explicitly.
- [ ] **AUTH-NEXT-06 — Shared acceptance and CI.** For every new lesson, verify token identity and intended audience, reject lesson tokens at business APIs, test applicable authorization failures, and publish scanned Playwright HTML/JUnit/video evidence with reliable cleanup. Add native CI jobs and update the authentication guide and coverage matrix only after observed passes. Add Cucumber parity using shared models where the method supports the existing runner pattern.

The requested implementation order is complete through Kerberos. The unchecked acceptance items retain their original full requirements until remaining negative fixtures and native CI evidence are observed.

Status reconciled by TEST-04 on 2026-10-10 (America/Chicago): Prompts 01–13 retain their recorded local evidence. Native run [38097316475](https://github.com/orieken/testing-with-certs/actions/runs/38097316475) passed the complete existing workflow, including live contracts/security, all eight customer/admin browser selections, the separate 36-case certificate/password job, scanned/readable text uploads and cleanup. [Completion 25](completion/25-pr-base-contract-evidence.md) records actual unchanged/additive/breaking PR-base acceptance/rejection against committed main; temporary probe mutations were reverted and their draft PRs closed without merging. TEST-03/05–10 now also have their named native consumer/fault/regional scenarios observed under TEST-11 in [completion 26](completion/26-independent-ci-evidence.md), separately from the required live-provider gate. Native manual viewer/operator and literal clean-checkout/repeat-startup remain unverified. Historical failures and limitations remain in their original completion notes.

## Planning baseline

- [x] Capture the user's nine clarification answers and original widget requirement.
- [x] Inspect the magic shop, existing certificate helpers and UBI9 browser recipe.
- [x] Separate user certificate issuance from Keycloak authentication.
- [x] Define topology, three language responsibilities, package boundary and manual mode.
- [x] Write sequenced prompts and a test/acceptance matrix.
- [x] Add planned Mermaid diagrams for infrastructure, provisioning, login, service requests, reporting, runner modes and certificate lifecycle.
- [x] Specify canonical OpenAPI inputs and live Playwright contract testing for all three business APIs.

## 01 — Feasibility gate

- [x] Pin compatible browser, Playwright, Saturday, Cucumber and Keycloak versions.
- [x] Confirm published package availability or reproducible packed-source fallback.
- [x] Build and launch actual Chrome and Edge in the documented supported Bookworm fallback image; verified UBI9 package gaps prevented its browser use.
- [ ] Exercise native Linux amd64 and Apple Silicon emulation; automated real Chrome/Edge login passed on both, while a native manual selected-user viewer remains unverified.
- [x] Observe a human selected-user login through the loopback manual viewer; customer identity and role were visible in remote Chrome.
- [x] Choose and document any justified base-image/remote-runner fallback.
- [x] Prove certificate login through both origins with no TLS bypass on Apple Silicon emulation.
- [x] Prove native certificate installation/auto-selection in each manual browser on Apple Silicon emulation.
- [x] Prove wrong/no/unknown certificates, mismatched cookies and identity claims fail safely on Apple Silicon emulation.
- [x] Prove initial CRL reload and new-connection rejection on Apple Silicon emulation.
- [x] Update workflow diagrams with the verified compatibility and authentication decisions.

Observed partial work (does not close the runtime checks above):

- [x] Record published Saturday availability and a licensed, content-hashed certificate-helper tarball.
- [x] Resolve signed Chrome/Edge metadata and pin the browser package dependency closure.
- [x] Verify isolated UBI9 issuance, initial CRL, offline revocation rejection and server hostname validation.
- [x] Add spike-specific architecture/workflow overlays and distinguish them from the planned full stack.

## 02 — Workspace and imported foundation

- [x] Scaffold app, package, testing, three services and infrastructure directories.
- [x] Copy useful UI/data/assets/test models with file hashes and notices.
- [x] Exclude mock auth, plaintext credentials and nested framework-source dependencies from the imported UI and testing tree.
- [x] Define domain dictionary, planned OpenAPI operation inventory, ownership and role/scope matrix (canonical YAML still pending).
- [x] Define seed identities, regions, dates and independently known totals (fixtures validated offline; bootstrap remains pending).
- [x] Author three canonical OpenAPI specs, shared schemas and public/private operation metadata (static validation passed; live providers pending).
- [x] Pin OpenAPI lint/bundle/code-generation tools and scaffold the Playwright contract validator and coverage manifest (five offline validator tests pass; live provider coverage remains open).

## 03 — Containers and PKI

- [x] Implement pinned images, Compose profiles/networks/health dependencies.
- [x] Generate user/service/server trust domains and leaves in containers.
- [x] Isolate signing keys, service keys and selected-user volumes.
- [x] Implement issuance/renewal/revocation/CRL publication with persistent serial state.
- [x] Configure HAProxy shop mTLS, auth passthrough, backend mTLS and exact origins.
- [x] Configure private PostgreSQL databases/grants and verified TLS.
- [x] Add the host-runtime-free `lab` wrapper and explicit project reset.
- [x] Verify no unplanned published ports, TLS bypasses or image-baked secrets.
- [x] Reconcile infrastructure/provisioning diagrams with Compose networks, ports, volumes and startup dependencies.

## 04 — Keycloak

- [x] Add idempotent realm, users, roles, clients, audiences and scopes.
- [x] Configure certificate-required login and protected unique identity mapping.
- [x] Keep operator bootstrap privileges separate from shop-admin.
- [x] Issue paired service credentials with explicit audience/scope restrictions.
- [x] Exercise disabled/unknown user, cookie reuse, refresh and session disable.
- [x] Document and test token TTL/revocation residual lifetime.

## 05 — Local Saturday package

- [x] Implement core types, file/issuer-command providers and Keycloak adapters.
- [x] Add multiple exact-origin certificate mapping and arbitrary identities.
- [x] Add Playwright and Cucumber adapters using shared resolution.
- [x] Add manual-browser manifest and explicit lifecycle CLI.
- [x] Test redaction, path/key validation and namespace-restricted cleanup.
- [x] Pack/install in an independent consumer and scan package contents.
- [x] Exercise the package issuer adapter and lifecycle CLI against an isolated live CA; verify renewal, CRL revocation and rejected leaf.
- [x] Wire the manual manifest into the lab's native Chrome/Edge import path and repeat selected-user sign-in.

## 06–08 — Three business APIs

- [x] Go: catalog browse/detail, item maintenance and private quotes.
- [x] Go: validate JWT and certificate identity, enforce roles and scoped service caller, persist seeded items in its own database, and serve the authenticated bundled OpenAPI artifact.
- [x] Go: pass service-specific live Playwright contracts and six-operation coverage gate on Apple Silicon amd64 emulation.
- [x] Node: owned profiles/orders, server-computed checkout and idempotency.
- [x] Node: persistent role-valid widgets and admin user/order lists.
- [x] Node: paginated/revision-aware service-only reporting feed.
- [x] Node: JWT/certificate pairing, own-database migration/seed, authenticated OpenAPI artifact, and ten-operation live Playwright contract coverage on Apple Silicon emulation.
- [x] Python: admin-only regional sales, customer lists and GeoJSON.
- [x] Python: internal follow-up notes/status with no outbound messaging.
- [x] All APIs: JWT issuer/audience/signature/lifetime/capability validation.
- [x] All APIs: transport identity allowlists and certificate/token pairing checks.
- [x] All APIs: contract tests, migrations/seeds, bounded queries and timeouts.
- [x] All APIs: derive or equivalence-check transport types/validation from canonical OpenAPI; package and expose authenticated internal spec artifacts.
- [x] Go, Node and Python: pass service-specific live Playwright contract suites as each service is implemented.

## 09 — Vue and Leaflet

- [x] Replace localStorage/mock auth with Keycloak PKCE and memory-held tokens.
- [x] Restore shop, details, cart, simulated checkout and own account/orders; live customer runs passed in Chrome and Edge.
- [x] Build admin users/orders/sales view and synchronized map/table filters; live admin runs passed in Chrome and Edge.
- [x] Add/remove authorized widgets and persist layouts; live customer toggle survived a fresh sign-in.
- [x] Add synthetic follow-up note/status UI; live admin create/update survived reload in both browsers.
- [x] Provide local map assets, accessible table controls and error/empty states.
- [x] Test API-enforced authorization as well as visible UI behavior; customer browser direct admin request returned 403 and provider contracts passed.

## 10 — Manual browser

- [x] Start selected-user Chrome/Edge using the same runner image.
- [x] Import certificate/trust into a fresh browser HOME and verify loaded policies.
- [x] Expose credential-protected noVNC on loopback only.
- [x] Verify user switching cannot retain old certificates/cookies/tokens.
- [x] Demonstrate renewal/revocation and document fresh-connection behavior.
- [x] Validate local Apple Silicon operation; native GitHub Linux manual-viewer operation remains unverified.
- [x] Confirm a human click-through in the current Compose viewer for both customer Chrome and admin Edge; the user confirmed shop-admin in Edge and `customer-waterdeep` in Chrome on Apple Silicon emulation.

## 11 — Teaching suites and security evidence

- [x] Record local Playwright Test Chrome/Edge UI slice with per-test WebM video and HTML/JUnit report; keep fixture-backed UI evidence distinct from live API evidence.
- [x] Share Saturday site/page/element/flow models across both runners.
- [x] Run Chrome and Edge examples under both Cucumber and Playwright Test.
- [x] Cover login, roles, orders, widgets and regional map flows in the core teaching examples.
- [x] Map every required test-plan ID to observed, partial or open evidence in `docs/teaching-coverage.md`.
- [x] Verify token/cert failures, spoofing, direct access, service pairing and ownership; JWT-01 signed negatives returned 401 at all three live APIs in a disposable realm.
- [x] Verify parallel isolation, package consumption and offline-map determinism.
- [x] Export local Playwright HTML/JUnit/WebM, Cucumber JSON/JUnit and scenario telemetry; enforce a credential-artifact scan.
- [x] Complete browserless Playwright contract coverage for every public/private business operation and applicable failure responses on Apple Silicon emulation.
- [x] Demonstrate malformed responses fail validation and one-byte deployed contract drift is detected.

## 12 — CI and handoff

- [x] Build/run isolated Compose stack in Linux amd64 CI; the second GitHub push passed startup, live contracts/security and all eight real-browser selections, plus cleanup.
- [x] Gate CI on OpenAPI validity, generated/spec drift, conservative breaking changes and live contract coverage before browser suites: native workflow 38097316475 and actual PR unchanged/additive/rejection steps in completion 25. Separate consumer/fault CI jobs and their native outcomes are recorded in completion 26.
- [x] Implement the conservative OpenAPI base-bundle comparison and test its unchanged, additive and changed cases in a pinned container; actual committed-base PR acceptance/rejection is recorded in completion 25.
- [x] Pass a disposable Apple Silicon CI-equivalent stack through live contracts, security, and all Chrome/Edge × Playwright/Cucumber × customer/admin selections; scan reports and remove only that project's volumes.
- [x] Add architecture/mount/TLS checks, the 23-operation/92-status contract coverage gate, and a measured Go/TypeScript/Python complexity cap over authored source; two existing transport handlers have explicit non-increasing baselines.
- [x] Verify a fresh project with new volumes and repeat startup without reset: the existing realm and a customer database marker survived; database TLS/isolation and PKI/CRLs re-verified. A literal clean Git checkout remains untested after the initial commit.
- [x] Write teaching guide and operational troubleshooting steps.
- [x] Reconcile architecture/workflow diagrams with implemented behavior and observed/planned CI status; link them from the teaching guide.
- [x] Render all 20 Mermaid blocks from the Markdown sources with a digest-pinned container; inspect the topology, infrastructure and CI layouts, and simplify the two crowded overviews.
- [x] Demonstrate zero host certificate installation/management in the audited Apple Silicon run; user/admin trust settings and login/System keychain fingerprints were unchanged before/after containerized PKI and security tests.
- [x] Record historical Chrome 154.0.8037.97 and refreshed Chrome 155.0.8059.39, Edge 154.0.4258.62, Node 24.10.0 and pinned base/container versions with Apple Silicon and native GitHub browser results; the updated runner also passed existing native workflow 38097316475; this does not establish native evidence for separate local-only scenarios.
- [x] Document limitations and possible package upstreaming in the teaching guide and completion note; no package was published.

## 13 — Operator CLI/TUI (after the core lab)

- [x] Build a Go operator CLI/TUI with the Charm stack: Bubble Tea for interaction, Bubbles for status/list components, and Lip Gloss for display. Pin compatible versions and build the host-specific binary in a container; the `lab` wrapper must not require host Go.
- [x] Let the operator start/stop the named Compose services and profiles, show dependencies and current state, and require an explicit confirmation for destructive or data-affecting actions. Keep reset a separate explicitly named operation.
- [x] Show bounded readiness/health results for HAProxy, Keycloak, UI, PostgreSQL, all three business APIs, and the manual/test runner without treating a running container as a healthy service.
- [x] Expose `operator healthcheck` (with `health` alias): require all seven core services healthy and check the selected-user viewer when present; verify against the live Apple Silicon stack.
- [x] Gather local, redacted telemetry from Compose state, bounded logs, test reports and certificate metadata (issuer, serial, expiry, CRL publication age); never display or export private keys, tokens, passwords or full certificate bundles.
- [x] Run containerized certificate/communication diagnostics: exact-origin hostname and trust checks, no-cert and revoked-cert rejection on fresh connections, gateway/backend mTLS, Node-to-Go and Python-to-Node caller/token pairing, and public rejection of private routes. Do not disable TLS verification.
- [x] Launch the existing Playwright contract, Playwright browser and Cucumber suites from the TUI with selected test identity/browser; report test IDs and artifacts without inventing a parallel test runner or bypassing the real Chrome/Edge requirement.
- [ ] Test command boundaries, cancellation/timeouts, status refresh, redaction, failure display and terminal fallback; Apple Silicon checks passed, native Linux operator remains unverified.
- [x] Update the architecture/workflow Mermaid diagrams and operator guide with the implemented control path, privilege boundary and observed behavior; write `docs/completion/13-operator-tui.md` with exact container build/test commands and results.

## 14 — Agent adoption handoff

- [x] Write a target-agnostic explanation of the reference certificate, login, service and runner boundaries with explicit observed-platform limits.
- [x] Provide ordered copyable prompts for other agents to inventory, prove, implement and test certificate paths in their own repositories without copying this lab's secrets or assumptions.
- [x] Link the handoff from the root and documentation entry points and record the first source-commit decision and remaining CI/platform limits.

## Testing expansion — prioritized agent checklist

See the [prioritized testing checklist](testing-scenario-checklist.md) for TEST-01–11, ordered by priority with handoff prompts, dependencies and acceptance criteria. TEST-01/03 have local status/fault evidence in [completion 19](completion/19-checkout-dependency-faults.md); TEST-02 has native certificate/password evidence in completion 18. TEST-08 has local concurrent idempotency/lost-response evidence in [completion 20](completion/20-checkout-idempotency.md). TEST-05/07 have local Prism compatibility/UI failure evidence in [completion 21](completion/21-prism-compatibility.md) and [completion 22](completion/22-prism-browser-failures.md). TEST-06/09 have Mokapi compatibility and real insights pagination fault evidence in [completion 23](completion/23-mokapi-reporting-sequences.md). TEST-10 has real provider and browser boundary evidence in [completion 24](completion/24-regional-reporting-boundaries.md). TEST-04 is recorded in [completion 25](completion/25-pr-base-contract-evidence.md); TEST-11 is complete with separate native reports and intentional-failure cleanup/red-gating evidence in [completion 26](completion/26-independent-ci-evidence.md). Local TEST-06/09/10 work was committed and pushed as `d637aa7`; the corresponding native jobs were added in `54ef7dd`, corrected for Linux harness behavior in `20272cf` and verified in completion 26.

## Deferred scope

- Stock Firefox or Playwright Firefox.
- Production certificate enrollment/self-service identity proof and CA availability.
- Real payments, atomic inventory reservation, external customer messages.
- Certificate-bound OAuth tokens and automated CA rotation.
- Moving/publishing `saturday-keycloak` into the upstream Saturday repository.

### Learning examples — mocking for tests

FEATURE-01–03 are isolated examples of mocking dependencies for tests. They must not change app behavior, replace the lab's Keycloak, reroute the normal HAProxy listeners, weaken API verification, or add a login fallback. Follow the shared container, TLS, secrets and evidence instructions in the [agent checklist](testing-scenario-checklist.md). Keep mock results explicitly separate from real authentication/provider evidence. User-directed priority: complete FEATURE-01–03 before the other backlog items. These isolated examples are now observed; see [completion 16](completion/16-mocking-examples.md) and [copyable commands](../spikes/mock-auth/README.md).

- [x] **FEATURE-01 — Signed-token mocking example. Priority: medium.**

  **Handoff prompt:** Create a container-only example in `spikes/mock-auth/` that generates an ephemeral test signing key and demonstrates JWT verification in an isolated test consumer. Use synthetic claims shaped like the lab's claims, without reusing real credentials or trusted realm keys. Demonstrate valid, expired, wrong-audience and altered-signature tokens. Document that this tests token handling and does not authenticate a user or bypass Keycloak in the app.

  **Done when:** The isolated consumer accepts the valid fixture and rejects each negative fixture; keys/tokens stay container-held; no app verifier, trusted JWKS, realm or routing changes are required.

- [x] **FEATURE-02 — OIDC dependency mocking example. Priority: medium.**

  **Handoff prompt:** Build a standalone disposable container example with a pinned OIDC mock server and a dedicated test consumer. Demonstrate discovery, JWKS, token handling and supported failure scenarios. Verify the tool's actual protocol support before choosing scenarios. Use a private test network and test-local configuration; leave Vue, Keycloak and HAProxy unchanged. Explain which protocol behaviors are mocked and which authentication guarantees remain untested.

  **Done when:** The test consumer exercises documented success/failure cases against the mock with verified TLS, repeatable reset and cleanup. The example requires no changes to the app's issuer, clients, routes or login flows.

- [x] **FEATURE-03 — API dependency mocking example. Priority: medium; requires a bounded tool compatibility experiment (completed for mock-only Prism use); full TEST-05/06 are not prerequisites for this isolated example.**

  **Handoff prompt:** Build a standalone test-consumer example using Prism or Mokapi and canonical contract fixtures for success, structured errors and delayed responses. Demonstrate how tests replace an API dependency without replacing app authentication. Validate normal fixtures with existing Ajv tooling and label intentionally invalid fault fixtures. Do not create a proxy that injects authentication into real services or requires weakening their certificate/token checks.

  **Done when:** The isolated consumer demonstrates deterministic response and recovery assertions, valid fixtures pass contract validation, and no real API, gateway, certificate policy or app behavior changes are needed.

For adoption into another application, use [M00–M05](mock-testing-adoption-prompts.md). The completed [browser mock suite](../spikes/mock-auth/browser/README.md) and [completion 17](completion/17-browser-mock-consumers.md) extend the examples with recorded consumer/UI evidence; they do not close the live-provider or native-CI backlog.

### Product expansion ideas — separate from mock examples

FEATURE-04–06 propose app behavior changes. They remain separate future scope and are not authorized for implementation by the mocking examples above.

- [ ] **FEATURE-04 — Inventory Deduction (Go + Node)**
  **Handoff prompt:** Update the simulated checkout process in the Node Customer API to make an atomic inventory deduction request to the Go Catalog API. If the Go API returns a 409 (Out of Stock), the checkout should fail.
  **Done when:** A successful checkout reduces the stock count in the Go database, and attempting to buy more items than available results in a clean error without creating an order.

- [ ] **FEATURE-05 — Product Reviews & Ratings**
  **Handoff prompt:** Add a new domain for product reviews. Customers should be able to leave a 1-5 star rating and text review on items they have purchased. Update the Vue UI to display aggregate ratings on the catalog items.
  **Done when:** The API successfully persists reviews, enforces that the user has bought the item, and the UI displays the average rating.

- [ ] **FEATURE-06 — "Manager" Persona**
  **Handoff prompt:** Add a new Keycloak role (`shop-manager`) that is allowed to read the insights and reporting endpoints but cannot modify the catalog or manage users. Update the JWT scope verification in the APIs.
  **Done when:** A user with the manager role can view the admin dashboard map but receives a 403 Forbidden when attempting to edit an item.

## 15 — Separate certificate + password teaching view

- [x] Confirm both factors and interactive container password provisioning with the user.
- [x] Add a separate client, REQUIRED X.509/password flow and isolated Vue callback entry.
- [x] Keep passwords on Keycloak pages and preserve the certificate-only shop/API boundaries.
- [x] Complete Chrome/Edge × Playwright/Cucumber positive, negative and cookie matrix; record completion 15.
- [ ] Set the user's demo password interactively inside the container and demonstrate the lesson manually.
- [x] Verify the new feature in native Linux CI: 36/36 in run 38027680587 with scanned/readable uploaded reports and success/failure/cancellation cleanup evidence; see [completion 18](completion/18-native-certificate-password-ci.md). Prior run 38012708736 remains unrelated to this feature.

- [ ] **Reporting timestamp precision follow-up:** Compare reporting range endpoints chronologically rather than lexically. Completion 24 observes a valid mixed whole/fractional-second interval returning canonical 503. Preserve half-open UTC semantics and authorization; add independent regression coverage before claiming full endpoint precision support.
