# Agent handoff: add certificate-authentication tests to another project

This is a copyable sequence for agents working in a **target repository**. The Magic Shop is a reference implementation, not a template to paste wholesale. Its architecture, exact commands, and observed results are documented in [architecture](architecture.md), [workflows](workflows.md), [authentication](authentication.md), [test plan](test-plan.md), [OpenAPI contracts](api-contracts.md), [manual browser](manual-browser.md), [operator guide](operator-guide.md), and [completion notes](completion/). Read those sources before adapting a step. Historical completion notes describe this lab's Apple Silicon amd64-emulation observations. Native GitHub Linux contracts, security and all eight real-browser selections passed on the second run; its artifact upload is pending a permission fix, while manual viewer/operator native paths remain unverified.

## How this reference works

The container-only PKI has separate server, human-client and service-client trust domains. Signing keys stay in a PKI-only Docker volume; runtime containers mount only their own leaf material and public trust. HAProxy terminates shop TLS on `shop.magic.test:8443`, verifies the human certificate, strips caller identity headers, and presents its gateway service certificate to backend APIs. Its separate `auth.magic.test:9443` listener passes TLS through to Keycloak, which performs X.509 user mapping and Authorization Code + PKCE without a password. A protected immutable certificate identity claim ties the issued token to the verified connection identity. Go, Node and Python services validate signed token issuer, audience, lifetime, role/scope and certificate identity. Node-to-Go and Python-to-Node private calls require both an allowlisted service certificate and a correctly scoped service token; private routes are not exposed through HAProxy.

Automated Playwright contexts map the selected client certificate to **both exact origins**, including ports. Real Google Chrome and Microsoft Edge run in the pinned container image. The separate manual desktop imports one selected PKCS#12 identity into the browser's native NSS store, applies browser-specific exact-origin selection policy, and exposes password-protected noVNC on host loopback. Playwright Test and Cucumber share identity resolution and site models. Browserless Playwright tests compare live Go, Node and Python responses with authored OpenAPI contracts, while the security suite probes wrong trust, hostname, missing/revoked certificates, token claims, ownership, gateway spoofing and service pairing. The host uses Docker and a shell; it does not install a lab CA, client certificate, Node, Go, Python or OpenSSL.

The reference's three-language shop, synthetic users, domains, ports and Keycloak realm are **examples**. A target project should keep its existing service ownership and authentication provider unless its own requirements call for a change. If it does not use Keycloak, map the certificate-to-user and PKCE checks to its actual identity provider. If its provider cannot perform certificate login, report that feasibility gap rather than substituting password login or a mocked token. Do not claim a certificate test passed merely because a request with a prebuilt bearer token succeeded.

## Dispatch contract

Before sending prompt 00, fill in these values for the receiving agent:

```text
TARGET_REPO = <absolute path to the project being changed>
REFERENCE_REPO = <read-only path or revision of this Magic Shop repository>
TARGET_ORIGINS = <exact browser/app and identity-provider HTTPS origins, including ports>
TARGET_IDP = <existing identity provider and certificate-login capability, or unknown>
TARGET_RUNNERS = <current Playwright Test/Cucumber setup, or none>
TARGET_PLATFORMS = <platforms that must actually be verified>
```

Give the agent one numbered prompt at a time. The target repository is the only writable project. It may inspect this reference but must not edit it, copy its generated credentials, or publish its package. For each step, require a target-repository completion note with changes, exact commands, environment, observed results, decisions, limitations and next dependency. Keep target TODO boxes open for unrun platforms and tests. Use containers for builds, dependency installation, certificate operations, database setup and tests; a host wrapper may invoke Docker but must not install certificates or require host Node, Go, Python or OpenSSL. Keep TLS verification enabled. Use strict types, explicit network timeouts, bounded queries and meaningful tests; use framework polling rather than sleep loops. Preserve licenses, notices and provenance for any source or asset copied. Do not copy `node_modules`, browser profiles, generated keys, certificates, tokens, secrets or nested framework packages. Do not commit or deploy unless the target-project owner explicitly authorizes it. Update affected architecture/workflow diagrams as behavior changes, labeling planned and observed paths separately.

### Prompt 00 — Map the target and choose a minimal test seam

> Work only in `TARGET_REPO`; read `REFERENCE_REPO/docs/architecture.md`, `docs/workflows.md`, `docs/authentication.md`, `docs/test-plan.md`, `docs/api-contracts.md` and the relevant completion notes as reference. Inventory the target's real ingress, IdP, browser origins, trust stores, certificate issuance, API boundaries, runner versions, CI, secrets and existing tests. Identify whether human certificate login, service mTLS or both are required. Record exact origin strings, redirects, certificate identity source, token issuer/audiences, service caller identities, and where TLS terminates. Do not assume the Magic Shop's domains, Keycloak realm, three API languages, Compose layout or seeded roles belong in this project. Propose the smallest end-to-end certificate-login test seam and a negative control, plus a target-specific architecture diagram and test matrix. Verify pinned Playwright support for `clientCertificates` and actual Chrome/Edge channels before relying on broad package peer ranges. Deliver a target completion note and an ordered dependency list. Do not alter production authentication in this inventory step.

**Exit:** The target has an explicit component/origin/credential map, exact tests to build and known feasibility risks. Unknown provider capability is labeled unknown.

### Prompt 01 — Prove real certificate login before broad migration

> Build a bounded, disposable thin slice in `TARGET_REPO` using the target's existing IdP where possible. Provision a local test CA and one synthetic user entirely in containers. Serve a minimal HTTPS landing endpoint at the target's exact application origin and exercise the actual browser redirect to the exact IdP origin. Use Authorization Code + PKCE when the target is an OIDC browser app. In real Chrome and Edge, prove that the issued access token identifies the certificate selected for the run. Repeat with a mismatched saved cookie, no certificate, an untrusted certificate, unknown/disabled identity, wrong server hostname and wrong trust root. Test both origins and record versions and platform architecture. Do not use password entry, bundled Chromium, `ignoreHTTPSErrors`, insecure curl flags or host trust installation to manufacture a pass. If the existing IdP cannot perform certificate login, stop that path at a documented feasibility gap and propose a target-approved alternative. Keep the spike bounded and update diagrams and the completion note.

**Exit:** A real browser demonstrates the intended identity, and negative cases fail at the expected boundary. Missing browser/platform evidence stays open.

### Prompt 02 — Make issuance and transport reproducible

> Promote only the proved spike patterns into the target's container setup. Separate server, human-client and service-client trust; keep CA signing keys in a PKI-only volume and each runtime leaf in a scoped volume. Add idempotent issuance, renewal, CRL publication and explicit reset. Give server leaves exact SANs and proper EKUs. Configure the existing gateway or a justified proxy for browser mTLS and, if required, a separate IdP TLS passthrough path. Strip untrusted identity headers; verify backend server names and allowlist service client identities. Keep all application, database, debug and raw VNC ports private except explicitly approved loopback listeners. Use health/readiness dependencies and bounded timeouts. Prove repeated startup preserves state, wrong trust and hostname fail, and a newly revoked leaf is rejected on a fresh connection after CRL publication/reload. Record mount and port inventories, host-trust before/after evidence, diagrams and completion note.

**Exit:** Runtime credentials remain scoped and container-only; no host certificate operation is required.

### Prompt 03 — Pair certificate identity with authorization

> Integrate the target's real browser app and IdP, retaining its domain and role model. Protect a stable unique certificate identity mapping from user edits and include it in signed tokens when supported. For a PKCE browser flow, keep tokens out of persistent browser storage. Make each API verify signature, exact issuer, intended audience, lifetime, role/scope and equality of the token identity with the verified transport identity supplied by its trusted gateway. For service-to-service routes, require the correct service leaf **and** a token with the correct audience/scope; do not route private endpoints publicly. Add meaningful tests for tampered/expired/wrong-audience tokens, certificate/token mismatch, spoofed identity headers, disabled users, ownership and wrong service caller. If the target has OpenAPI services, expose authenticated deployed specs and compare them with authored canonical specifications; do not let a live service define its own expected schema. Use target-specific fixtures and bounded data queries. Update trust-boundary and request-flow diagrams and the completion note.

**Exit:** A valid certificate alone cannot bypass token authorization, and a valid token alone cannot impersonate the wrong certificate holder on protected paths.

### Prompt 04 — Add both automated and manual browser paths

> Build one identity resolver that supplies exact-origin certificate mappings to Playwright Test and Cucumber adapters. Use real Google Chrome and Microsoft Edge separately; record browser and pinned Playwright versions. Create isolated browser contexts and unique test data per worker. Add a manual container mode using the same browser image: mount one selected identity, import it into that brand's native certificate store, apply narrow auto-selection policy for both exact HTTPS origins, start a fresh HOME/profile and expose a password-protected noVNC viewer on loopback only. Prove user switching cannot keep prior cookies, tokens or certificates. Test customer/admin or the target's equivalent identities in each browser and runner. Record local video/report paths if enabled, scan artifacts for credential leaks, and ensure reports do not contain private keys or tokens. Update the runner-mode and viewer lifecycle diagrams and completion note.

**Exit:** Automated contexts and manual native-store sessions both authenticate as the selected identity; manual mode does not install a certificate on the host. Mark a human click-through observed only after a human actually confirms it.

### Prompt 05 — Build the security and contract matrix

> Turn the target-specific matrix from prompt 00 into independent tests. Exercise exact shop/IdP origins, hostname and CA verification, no-cert/untrusted/revoked/expired certificates on fresh connections, mismatched cookies, signed JWT negatives, identity-header spoofing, service-certificate/token pairing, private-route isolation, ownership and parallel-worker isolation. For each OpenAPI-backed target API, run browserless Playwright request-context contracts against the live provider using an authored spec, expected status/schema, deployed-spec digest and operation/status coverage gate. Make a deliberately malformed response or changed spec fail validation. Keep destructive revocation and key-rotation cases in disposable namespaces; do not alter a shared learner session. Run both browser suites after contract/security checks. Produce a per-test-ID evidence map, redacted reports, exact commands/results, and updated security/workflow diagrams.

**Exit:** The matrix distinguishes passing, failing, partial and unrun evidence; a green browser flow does not conceal missing transport or API checks.

### Prompt 06 — Hand off operation and CI without overstating coverage

> Add a thin target-specific operator command or integrate with the target's existing CLI. It should start/stop named services, report Compose/process state separately from readiness, run bounded health and certificate/communication diagnostics, launch existing test suites, show safe certificate metadata and local report locations, and keep destructive reset explicit. Do not mount Docker control into an application or test runner. Add a pinned container-only build/test workflow and a CI job that creates an isolated project, runs static/spec checks, live contracts/security and the selected real-browser matrix, scans artifacts, then cleans only that project's resources. Keep CA and user certificates inside containers/volumes. Document a clean-start and repeat-start exercise, exact environment and versions, any native-platform run actually performed, and unverified CI or browser paths. Update operator/CI diagrams, a teaching guide, TODO and completion note.

**Exit:** Another developer can reproduce the proven path with Docker and a shell, see failures by layer, and tell which platform and CI claims remain unverified.

## Reference entry points

| Need | Inspect in this repository |
| --- | --- |
| Start, stop, selected viewer, tests | [`lab`](../lab), [`infra/compose.yaml`](../infra/compose.yaml), [teaching guide](teaching-guide.md) |
| Issuance, CRLs, trust split | [`infra/pki/issue.sh`](../infra/pki/issue.sh), [authentication](authentication.md), [workflows](workflows.md) |
| Certificate-only identity mapping | [`infra/keycloak/realm.json`](../infra/keycloak/realm.json), [`infra/keycloak/bootstrap.mjs`](../infra/keycloak/bootstrap.mjs) |
| Browser adapters and native viewer | [`packages/saturday-keycloak`](../packages/saturday-keycloak/), [`testing/container/manual.sh`](../testing/container/manual.sh), [manual guide](manual-browser.md) |
| API tests and coverage | [`testing/api/contracts`](../testing/api/contracts/), [`contracts/openapi`](../contracts/openapi/), [contract guide](api-contracts.md) |
| Negative tests and safe operation | [`testing/api/security`](../testing/api/security/), [`operator/main.go`](../operator/main.go), [operator guide](operator-guide.md) |

The local `saturday-keycloak` package is private and was not published. The reference contains a licensed, provenance-recorded certificate-helper tarball because the required published version was unavailable; target agents should choose an independently verified dependency strategy rather than silently copying a nested Saturday checkout. The target owner decides whether to adopt a reusable adapter, implement an equivalent boundary, or upstream a package later.
