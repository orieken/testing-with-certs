# Implementation todo list

Status: Prompts 01–11 have observed Apple Silicon amd64-emulation evidence, including all three live business APIs, the 23-operation Playwright OpenAPI coverage gate, integrated customer/admin UI, both teaching runners in Chrome and Edge, and the signed JWT-01 matrix. Prompt 12's static and isolated live CI-equivalent checks, new-volume/repeat startup, teaching guide, diagrams and local host-trust before/after audit passed. Prompt 13's Go operator passed local CLI/TUI, diagnostic and runner checks. The initial GitHub Linux push passed static checks and stack startup, then stopped at an unavailable old Chrome pin; the exact pin is refreshed locally and the full rerun is pending. Native integration boxes remain unchecked. A literal clean-clone test and actual PR-base comparison also remain unverified. See [native CI continuation](completion/12-native-linux-ci.md) and [implementation prompts](implementation-prompts.md).

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
- [ ] Exercise native Linux amd64 and Apple Silicon emulation; Apple Silicon passed, native GitHub Linux static/startup checks passed but real-browser integration is pending.
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

- [ ] Build/run isolated Compose stack in Linux amd64 CI (static and startup passed; runner package refresh and integration rerun pending).
- [ ] Gate CI on OpenAPI validity, generated/spec drift, breaking changes and Playwright contract coverage before browser suites (native static checks passed; live contract/browser suites and actual PR-base comparison unrun).
- [x] Implement the conservative OpenAPI base-bundle comparison and test its unchanged, additive and changed cases in a pinned container; the actual PR base comparison awaits a pull request and CI run.
- [x] Pass a disposable Apple Silicon CI-equivalent stack through live contracts, security, and all Chrome/Edge × Playwright/Cucumber × customer/admin selections; scan reports and remove only that project's volumes.
- [x] Add architecture/mount/TLS checks, the 23-operation/92-status contract coverage gate, and a measured Go/TypeScript/Python complexity cap over authored source; two existing transport handlers have explicit non-increasing baselines.
- [x] Verify a fresh project with new volumes and repeat startup without reset: the existing realm and a customer database marker survived; database TLS/isolation and PKI/CRLs re-verified. A literal clean Git checkout remains untested after the initial commit.
- [x] Write teaching guide and operational troubleshooting steps.
- [x] Reconcile architecture/workflow diagrams with implemented behavior and observed/planned CI status; link them from the teaching guide.
- [x] Render all 20 Mermaid blocks from the Markdown sources with a digest-pinned container; inspect the topology, infrastructure and CI layouts, and simplify the two crowded overviews.
- [x] Demonstrate zero host certificate installation/management in the audited Apple Silicon run; user/admin trust settings and login/System keychain fingerprints were unchanged before/after containerized PKI and security tests.
- [x] Record historical Chrome 154.0.8037.97 and refreshed Chrome 155.0.8059.39, Edge 154.0.4258.62, Node 24.10.0 and pinned base/container versions with Apple Silicon results; the native Linux browser rerun remains unverified.
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

## Deferred scope

- Stock Firefox or Playwright Firefox.
- Production certificate enrollment/self-service identity proof and CA availability.
- Real payments, atomic inventory reservation, external customer messages.
- Certificate-bound OAuth tokens and automated CA rotation.
- Moving/publishing `saturday-keycloak` into the upstream Saturday repository.
