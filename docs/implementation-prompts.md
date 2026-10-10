# Ordered implementation prompts

These are reusable build prompts, not a claim that their work has run. Execute one numbered prompt at a time. Each depends on the preceding accepted output unless stated otherwise. Replace planned commands with verified commands as implementation progresses.

For the completed dependency-mocking examples and recorded browser consumers, use the [mock-testing adoption sequence](mock-testing-adoption-prompts.md) when adapting them to another app. [Completion 16](completion/16-mocking-examples.md) and [completion 17](completion/17-browser-mock-consumers.md) describe observed reference runs; they do not complete the remaining live-provider or native-CI backlog.

## Shared instructions for every prompt

Read `docs/README.md`, `docs/architecture.md`, `docs/workflows.md`, `docs/authentication.md`, `docs/saturday-keycloak.md`, `docs/test-plan.md`, `docs/api-contracts.md`, and relevant prior completion notes. Treat copied source documents as reference material. Preserve the user's requirements, especially three business API languages, real Chrome/Edge, both test runners, OpenAPI-backed services with Playwright contract tests, and no host certificate management.

Update affected Mermaid diagrams in `docs/workflows.md` and the architecture overview when implementation changes a component, origin, port, credential boundary or workflow. Preserve the distinction between planned and observed behavior. Cover infrastructure/volumes, provisioning, login, service authentication, regional reporting, both runner modes, and certificate lifecycle; do not leave diagram maintenance solely to the final phase.

Work only in this prototype repository. Read the Saturday checkout as needed; do not modify it or publish a package. Do not deploy or commit as a side effect. Keep applicable LICENSE/NOTICE files and provenance when copying. Never copy generated secrets, node_modules, browser profiles, or nested copies of framework packages.

Use containers for builds, package installation, certificate operations, database setup, and tests. A host-side wrapper may invoke Docker Compose, but must not require host Node, Go, Python, OpenSSL, or certificate installation. Use strict types, explicit network timeouts, bounded queries, and clean domain/adapter boundaries. Do not disable TLS verification to achieve a passing test. Drive business/auth changes with meaningful tests; use framework polling instead of sleep loops.

For each prompt, produce `docs/completion/NN-<topic>.md` with changes, exact commands, observed results/environment, decisions, limitations, and the next dependency. Update only genuinely completed entries in `docs/TODO.md`. If a required platform is unavailable, report it as unverified and retain the corresponding checkbox. Technical alternatives within the user's accepted scope can be selected with recorded evidence; do not silently substitute bundled Chromium or password login.

## 01 — Prove browser and certificate feasibility

**Objective:** Establish a runnable thin slice before committing to the full architecture.

Inspect `packages/saturday-playwright-certs/example` and the magic-shop source in the Saturday checkout. Create a bounded spike under `spikes/certificate-login/`. Adapt its UBI9 recipe to use verified packages, a non-root browser user, isolated certificate volumes, and actual `chrome`/`msedge` binaries. Record exact image/package versions and remove floating installation assumptions. Verify the supported features of the pinned Playwright version; do not rely solely on broad peer dependency declarations.

Provision a small local CA set and Keycloak instance, one user, and a minimal HTTPS landing app. Use HAProxy shop termination plus the separate auth passthrough listener. Show actual user-certificate authentication through Authorization Code + PKCE without password input. Demonstrate both Playwright context certificates and native certificate installation in the remote desktop. Ensure the selected user identity is the one in the issued access token, including after a mismatched saved-cookie attempt.

Test both exact origins, server hostname validation, absence of TLS bypass flags, no-cert failure, unknown-user failure, and valid customer/admin identity mapping. Prototype the immutable certificate identity claim and gateway/API comparison with one minimal endpoint. Verify initial CRL publication and rejection on a new connection. Validate Chrome and Edge certificate stores/policies separately.

Run on native Linux amd64 when available and Apple Silicon emulation. If emulation is unreliable, document evidence and a remote amd64 Docker-context workflow that still exposes only a safely forwarded manual viewer and stores all certificates remotely. If UBI9 is the obstacle, select a supported Linux runner base within the user's permission and retain UBI9 for unaffected components.

**Deliver:** Feasibility code, `docs/compatibility.md` with versions/base/architecture/results, a recorded package dependency strategy, and completion note 01. No full UI migration yet.

**Exit:** Chrome and Edge reach the landing app via a real Keycloak certificate login; manual selected-user login works; missing/untrusted certificates fail; host trust is untouched. Missing platform evidence remains explicitly incomplete. The full-stack prompts must not rely on an unproven authentication path.

## 02 — Scaffold the repository and import the reusable shop

**Objective:** Establish a clean workspace and preserve the useful app/data.

Create a pnpm workspace for `apps/magic-shop`, `packages/saturday-keycloak`, and `testing`, plus `services/customer-api`, `services/catalog-api`, `services/insights-api`, `infra`, `seed`, and `artifacts` layout. Add language-specific manifests, formatting/type checks, ignore rules, and `.env.example` containing placeholders only. Use the versions verified in prompt 01.

Copy the Vue theme, views/components, cart, assets, Leaflet interactions, useful Saturday site models, and representative tests from the inventory in `docs/research.md`. Record source revision plus copied file hashes. Preserve notices. Transform seed data to omit passwords/tokens and prepare explicit identity/region mapping. Do not copy mock authentication logic or nested `saturday-*` source directories. Depend on pinned installed Saturday packages or the verified tarball strategy.

Add a clear domain dictionary for identity, user, customer, shopkeeper, shop-admin, item, order, region, and widget. Write OpenAPI contracts and example synthetic payloads for the three APIs, including private service endpoints, error format, cursor pagination, amounts, and UTC date boundaries. Clarify detail PATCH paths. Specify separate database ownership and role/scope matrix. Keep the initial imported UI buildable without pretending that mock auth is the final solution.

Create canonical OpenAPI 3.1 specifications in `contracts/openapi/` following `docs/api-contracts.md`. Pin and validate compatible lint/bundle/schema/code-generation tooling. Specify operation IDs, exact success/error responses, security requirements and public/private server boundaries. Scaffold the browserless Playwright contract project, expected-spec validator and operation coverage manifest; prove malformed sample responses fail validation. Verify any Saturday Swagger/Sunday integration before relying on it. Live provider checks become required as each API is implemented.

**Deliver:** Workspace scaffold, import provenance, sanitized fixtures, contracts, domain dictionary, completion note 02.

**Exit:** Containers can build/lint/type-check imported UI and scaffolded packages; no framework-source duplicates or legacy credential files are included; source and data licenses/notices remain present.

## 03 — Build container infrastructure and PKI lifecycle

**Objective:** Bring up reproducible infrastructure without host certificate work.

Promote the validated spike patterns into `infra/` and `testing/container/`. Create Compose services for UI, Keycloak, three APIs, HAProxy, PostgreSQL, runner profiles, PKI, and bootstrap. Keep placeholder business endpoints minimal until later prompts. Prefer UBI9 and record image exceptions already justified by prompt 01.

Implement container-only server/user/service CA generation with persistent signing state, identity-scoped output volumes, ownership/permissions, proper SAN/EKU constraints, public trust bundles, and CRL generation/reload. Separate signer keys from runtime leaf material. Ensure no single runner receives every user's private key or any CA key. Add volume/network/port inventory documentation. Ordinary startup is idempotent; reset requires an explicit project name.

Configure HAProxy shop HTTPS/mTLS routes, private backend mTLS, auth TCP passthrough, canonical origins, header stripping, health checks and request timeouts. Verify service caller identities, not just common issuer trust. Route no `/internal/*` endpoint publicly. Set up PostgreSQL with separate database owners and verified server TLS.

Add a thin `./lab` wrapper for startup/status/shutdown and certificate operations. At this stage, unsupported commands should fail clearly rather than succeed without action. Startup follows health/readiness and completed-job dependencies; no fixed sleeps. Root may initialize filesystem trust/ownership, then services and browsers run with minimal privileges.

**Deliver:** Compose configuration, pinned Dockerfiles, PKI scripts/provider, trust/mount map, operational wrapper, completion note 03.

**Exit:** Repeated startup preserves state; chain/SAN checks pass; wrong trust and service identities fail; host stores remain untouched; only intended loopback ports are published. Secrets do not appear in image layers or tracked files.

## 04 — Configure Keycloak certificate identities and roles

**Objective:** Create stable, repeatable user and service authentication configuration.

Implement a realm template plus containerized idempotent provisioning for shop SPA, API audiences/scopes, service clients, roles, and synthetic users. Configure the verified certificate-only browser flow and protected unique `cert_identity` user attribute. Include that attribute in signed user access tokens. Disable self-service edits and password/direct-grant fallback for the shop client. Keep bootstrap administration separate from the shop-admin role.

Connect issuance to the selected Keycloak user through the operator workflow. Produce service-client secrets at runtime, mounted to their owner only. Configure the catalog quote and reporting scopes/audiences explicitly. Add JWKS validation contract examples for each service without hardcoding token signing keys.

Implement renewal and revocation publication, session termination on user disable, short token TTLs, and a documented residual-access bound. Test fresh sessions and existing cookies independently. Make diagnostic output distinguish certificate validation, identity mapping, token validation, and permission failures without exposing credentials.

**Deliver:** Realm/client/user configuration, bootstrap adapter, identity manifest, tests, completion note 04.

**Exit:** Certificate-only customer/admin login works on both channels; service certificates cannot become human logins; wrong/unknown/disabled user cases fail; repeat bootstrap neither duplicates users nor resets existing business data.

## 05 — Extract the reusable Saturday Keycloak package

**Objective:** Replace spike-specific test-auth glue with a portable package.

Implement the ports, adapters, CLI and typed exports in `docs/saturday-keycloak.md`. Accept arbitrary caller-provided identity refs, exact multiple origins, file providers and timeout configuration. Reuse the existing certificate package's safe helpers; avoid duplicating its project-building logic unnecessarily. Keep core free of browser/runner dependencies and app-specific roles/origins.

Create Playwright fixtures composable with `@orieken/saturday-playwright`, and Cucumber hooks/world integration using `@orieken/saturday-cucumber`. Both must build context options from the same identity resolver. Keep certificate-authentication coverage on the actual browser redirect flow; label programmatic service token helpers distinctly.

Define explicit provision/read/renew/revoke/cleanup capabilities. Namespace-scoped cleanup cannot delete arbitrary realms/users. Include certificate/key/path validation and public-only metadata. Export a manual-browser manifest for the runner without performing host trust changes. Refactor validated bootstrap logic into reusable adapters while leaving Compose-specific operations in the lab layer.

**Deliver:** Package, unit/integration tests, examples, README, packed artifact consumer check, completion note 05.

**Exit:** Independent packed installation works; both adapters reach the authenticated landing slice; no absolute developer paths, shop domain dependency, or secret files exist in package contents.

## 06 — Implement the Go catalog service

**Objective:** Serve real magical-item data with demonstrable transport and token authorization.

Implement the catalog OpenAPI contract using Go, with domain/use-case/adapter separation and its own database. Seed copied magical items and preserve image URLs served by the UI. Add bounded browse/search/detail, shopkeeper/admin item maintenance, and a private batch quote endpoint for Node. Archive rather than deleting items referenced by historical orders.

Enforce server/client certificate validation and caller identity allowlists. Public paths accept only HAProxy's service identity plus a valid user token with audience, roles and matching verified certificate identity. Private quote paths accept only the Node service certificate paired with its correctly scoped client-credentials token. Use the canonical issuer and bounded JWKS caching/refresh.

Write unit tests for item rules and integration tests for persistence, cursor pagination, all relevant token/certificate failures, and correct role/caller behavior. Publish no backend port to the host.

Implement the canonical catalog OpenAPI through generated or equivalence-checked transport types/validation, package its resolved spec with the image, and expose it through the authenticated internal spec route. Add and run `catalog.contract.spec.ts` with Playwright against public catalog routes and the private quote endpoint. Validate success/errors and enforce operation coverage; do not defer these tests to prompt 11.

**Deliver:** Go service/image/migrations/seeds/tests, contract conformance results, completion note 06.

**Exit:** Both authorized request paths work, role failures and identity mismatches fail, and other services cannot query the catalog database directly.

## 07 — Implement the Node customer, order and widget service

**Objective:** Support owned customer data and simulated purchases.

Implement profiles keyed by Keycloak `sub`, own/admin order queries, user dashboard layouts, and the internal reporting feed. Use Node/TypeScript and strict schemas against the contracts. Resolve pricing through the Go service using the Node service certificate and scoped token; never accept a client-computed total as authoritative. Add immutable order line snapshots and idempotency-key conflict semantics.

Enforce customer ownership, admin capabilities, certificate/token identity agreement, and explicit audience/scope checks. The internal reporting feed accepts only the insights service's paired transport/token identity. Return paginated joined customer/order snapshots with dataset revision semantics; avoid per-row lookups and unbounded exports. Include role-scoped widget validation and reject writes for another user.

Implement repeatable migrations/seeds, bounded network errors, and tests for tampered pricing, duplicate submissions, cross-user access, malformed layouts, and missing/mismatched service credentials. Use stable synthetic customer-to-region mapping.

Use the canonical customer OpenAPI for service transport validation/types and its deployed spec artifact. Add and run `customer.contract.spec.ts` in Playwright for profiles, orders, widgets, admin queries and private reporting. Check exact status/schema, ownership errors, invalid input, pagination and idempotency against the expected specification and operation coverage manifest.

**Deliver:** Node service/image/persistence/seeds/tests, completion note 07.

**Exit:** A customer can create and retrieve their own correctly priced order and widget preferences; a second customer cannot read them; admin queries and Python-only reporting access work as specified.

## 08 — Implement Python regional insights and follow-up records

**Objective:** Teach authenticated aggregation across services.

Implement the insights contract in Python. Check the end user's admin token/certificate identity before reading reporting data. Fetch Node's paginated feed using the Python service identity, correct client-credentials audience and scope, explicit timeouts, and the maximum-size rule. No direct reads of Node's database.

Compute completed-order sales by region and half-open UTC date ranges using integer amounts. Deduplicate customers who ordered from each selected region. Distinguish historical order region from current profile region. Return local GeoJSON and matching table filters. Handle revision changes during multi-page reads explicitly; use bounded library retries or return a retriable error, never silently mix inconsistent snapshots.

Persist local follow-up note/status records. Do not send external messages. Include independent expected-value tests for sums, empty regions, date boundaries, cancelled orders, customer moves, and permission failures. Return useful errors for upstream auth/unavailability without leaking tokens.

Use the canonical insights OpenAPI for service transport validation/types and its deployed spec artifact. Add and run `insights.contract.spec.ts` in Playwright for sales, regions, customer/order summaries and follow-ups, including GeoJSON, empty responses, query validation and admin-only error responses. Compare responses against the repository's expected contract, not just a schema exported by the running Python app.

**Deliver:** Python service/image/tests, region fixtures and follow-up persistence, completion note 08.

**Exit:** Seeded region totals match independent expectations, customer endpoints remain forbidden to ordinary users, and the reporting hop requires both valid service credentials.

## 09 — Connect the Vue shop, dashboard widgets and Leaflet map

**Objective:** Complete the usable teaching application.

Replace mock auth/localStorage token code with the validated Keycloak adapter flow. Keep access/refresh tokens in memory and use Authorization Code + PKCE. Wire all shop requests through HAProxy's same-origin API prefixes, refresh tokens appropriately, and implement clear signed-out/access-denied/error states. Do not reintroduce hostname guessing or direct mock-api URLs.

Preserve the theme, item browsing, cart and simulated checkout, account view and shop-location interactions. Add user/role display, own orders, and role-authorized dashboard widgets with add/remove persistence. Add the admin users/orders/sales view, region/date filters, Leaflet map-linked table, and internal follow-up notes/status. Retain typed Saturday test hooks where useful.

Use local deterministic map assets. Provide table equivalents for map filtering, keyboard access, accessible labels, and loading/empty/error cases. Simulated purchase and informational stock should be clear in the UI. Do not expose bootstrap/CA administration or implementation secrets in the application.

**Deliver:** Integrated Vue app with component/domain tests and targeted authenticated browser smoke checks, completion note 09.

**Exit:** Customer and admin journeys work end to end in actual Chrome/Edge; UI restrictions correspond to enforced API permissions; widgets and notes persist; no external map service is required for CI.

## 10 — Finish selected-user manual browser mode

**Objective:** Make manual exploration as a chosen certificate holder a one-command workflow.

Finish the `./lab manual --user ... --browser ...` interface using the same runner image. Resolve the chosen identity via the local package, mount only that identity bundle and public trust, import into the version-correct browser database, configure narrow auto-selection policies, and launch a non-root browser with a fresh HOME/profile under the desktop. Open the shop by default.

Expose authenticated noVNC only on loopback; print the access instructions without logging reusable secrets. Use a mounted/generated credential file and explain how the operator retrieves it. Do not expose VNC/debugging ports or Docker socket. Validate that shutdown removes the ephemeral browser profile but retains intentionally persistent certificate issuance state.

Demonstrate customer Chrome, admin Edge, switching users, missing-certificate diagnostics, renewal, and revocation using new connections. Confirm the host has no installed CA/client certificate. Reuse the architecture/emulation decision from prompt 01; document and test any remote Linux viewer tunnel.

**Deliver:** Manual runner entrypoint/profile, operator guide with screenshots if useful, completion note 10.

**Exit:** A human can inspect the full app as either seeded role without using Playwright to inject auth state or installing certificates on the host. Verify both branded browsers independently.

## 11 — Build both Saturday example suites and the failure matrix

**Objective:** Provide readable examples plus evidence that authentication boundaries work.

Adapt the imported `MagicShop` site into common Saturday page/element/flow classes under `testing/site`. Implement equivalent certificate-login and role-specific journey examples in native Playwright Test and Cucumber. Include widget and regional map scenarios. Keep business assertions visible and share only setup/interactions. Use package fixtures/hooks to select identity and exact origins.

Implement the matrix in `docs/test-plan.md` at the appropriate level, including API/TLS tests for malformed tokens, identity mismatch, user ownership, proxy spoofing, backend bypass, service pairing, revocation, signing-key rotation, untrusted servers, and parallel isolation. Use dedicated namespaces/projects for destructive cases. Add local scenario telemetry through adapters.

Finish the dedicated Playwright `contracts` project and `./lab test --runner playwright --suite contracts` command. Reuse each service's existing contract cases; complete positive/negative operation coverage across all three real providers, spec-digest checks and validator failure demonstrations from `docs/api-contracts.md`. Use isolated certificate/token-aware API request contexts without browser fixtures. Keep expected schemas sourced from canonical OpenAPI, and preserve readable independent domain assertions.

Produce safe reports and enforce credential exclusion for artifacts. Do not enable auth traces by default merely to improve reports; verify any redaction path first. Include meaningful tags/annotations and clear runner/browser commands. Add the independent packed-package consumer tests to the suite.

**Deliver:** Test suites, reports, matrix-to-test-ID mapping, completion note 11.

**Exit:** Both runner/browser combinations pass core certificate-login and business journeys; all mandatory negative cases pass at their designated layer; parallel workers do not overwrite data or artifacts.

## 12 — Linux CI, clean-start validation and teaching handoff

**Objective:** Make the lab reproducible for another learner.

Create an amd64 Linux CI workflow that builds verified images, starts an isolated Compose project, waits on health/setup results, runs appropriate unit/integration/security tests and both browser/runner smoke combinations, exports only approved artifacts, then cleans that project's resources. Keep runtime certificate generation inside containers. Pin dependencies/actions and avoid exposing setup secrets to untrusted pull-request code.

Gate CI on OpenAPI lint/bundling, generated-artifact drift, breaking-change checks against the base revision, deployed contract digests and the browserless Playwright contract suite. Run contracts once before the browser acceptance matrix. Publish safe operation/status coverage alongside Playwright HTML/JUnit; fail on uncovered business operations and contract violations.

Wire the agreed architecture checks for service ownership, package isolation, certificate mounts, real browser versions, and TLS verification. Run a local equivalent before depending on CI. Honor any applicable workflow-change approval requirements; complete the workflow and validation evidence before requesting a necessary final approval.

Write a root README and teaching guide covering clean startup, selecting a user, each language's auth middleware, certificate versus token failures, adding a widget/test/user, region reporting, renewal/revocation and explicit reset. Document expected token residual lifetime, base-image exceptions, Apple Silicon evidence, and selected browser versions. Include troubleshooting by layer: DNS/origin, TLS/trust, certificate selection, Keycloak mapping, token, role/ownership, and application.

Reconcile every Mermaid diagram in `docs/workflows.md` and `docs/architecture.md` with the final Compose configuration, mounted credentials, API contracts and observed test paths. Render all diagrams using a pinned containerized Mermaid renderer, inspect layout/readability, and fix syntax or ambiguous arrows. Link the diagrams from the teaching guide. Retain the Markdown Mermaid sources; generate any teaching exports from those sources. Record rendering commands and verification evidence in the completion note.

Run a clean-checkout/no-preexisting-volumes exercise and repeat startup without reset. Demonstrate that host trust is unchanged and that manual plus automated workflows match the docs. Summarize generic package improvements for future upstreaming without publishing or changing Saturday.

**Deliver:** CI, README/teaching guide, reconciled and rendered Mermaid diagrams, final observed compatibility table and test report, completion note 12.

**Exit:** A new learner can follow the documented container-only workflow; required checks pass on their recorded platforms; unchecked work or limitations remain explicit rather than being hidden by a final success statement.

## 13 — Add a Charm-based operator CLI/TUI

**Objective:** Give a trusted lab operator a local terminal interface for service
control, health, telemetry and repeatable certificate/communication diagnostics
after the core stack and suites exist.

Use Go with Bubble Tea, Bubbles and Lip Gloss. Pin compatible versions and build
host-specific binaries in a container; the thin `lab` wrapper must not require
host Go, Node, Python, OpenSSL or certificate installation. The TUI may invoke the
existing Docker Compose control path and containerized `lab` diagnostics/tests;
private certificate operations and test execution stay inside containers. It is
an operator tool, not a fourth business API or a public shop feature. Keep the
Docker control privilege limited to the trusted operator process; never mount a
Docker socket into the UI, APIs, Keycloak, or test/manual runner.

Display named services, profiles, dependency/readiness status and bounded local
telemetry. Start/stop selected services deliberately, confirm data-affecting
actions, preserve persistent volumes by default, and keep explicit project reset
separate. Redact logs and artifact previews. Show only safe certificate metadata
such as serial, expiry and CRL age, never key or token contents.

Offer health and diagnostic actions covering both exact origins, server hostname
validation, absent/revoked certificates on new connections, gateway/backend mTLS,
Node-to-Go and Python-to-Node service identity/token pairing, and private-route
isolation. Use the existing Playwright contract suite and both browser runners for
full test execution. Every action needs an explicit timeout/cancellation path,
clear partial-failure state, and a noninteractive CLI equivalent for CI or plain
terminals. Do not make a green dashboard out of container-process state alone.

Reconcile affected architecture and workflow diagrams when the control path is
implemented. Validate on Apple Silicon and native Linux amd64 independently;
record unavailable platform checks as unverified.

**Deliver:** Go CLI/TUI, containerized build and tests, operator documentation,
safe telemetry/diagnostic results, updated diagrams and completion note 13.

**Exit:** A trusted operator can start/stop the lab, distinguish healthy from
merely running services, run certificate and service-communication checks and
launch existing suites without host language/certificate tooling or TLS bypass.
