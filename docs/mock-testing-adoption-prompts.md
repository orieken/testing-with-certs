# Agent handoff: dependency mocks and recorded browser tests in another app

Use these prompts in a target repository to build the patterns demonstrated by
[the isolated consumers](../spikes/mock-auth/README.md) and
[the browser suites](../spikes/mock-auth/browser/README.md). They are a separate
track from [real certificate-authentication adoption](agent-adoption-prompts.md).
Mock tests can be built before real-provider tests; their passes cannot satisfy
real-login, transport identity or live API acceptance criteria.

The reference has completed signed JWT, standalone OIDC and Prism consumers plus
56 recorded browser scenario executions. [Completion 16](completion/16-mocking-examples.md)
and [completion 17](completion/17-browser-mock-consumers.md) give exact observed
versions, commands and limitations. Those results belong to this reference on
macOS Docker Desktop. They are not evidence for the target app or its Linux CI.

## Fill in the dispatch values

```text
TARGET_REPO = <absolute writable target repository path>
REFERENCE_REPO = <read-only checkout of this repository at a recorded revision>
TARGET_APP = <framework, build command and output directory>
TARGET_AUTH = <provider, adapter, issuer, client ID, callback and logout behavior>
TARGET_ORIGINS = <exact app and provider HTTPS origins, including ports>
TARGET_API = <operations, authored OpenAPI/schema paths, validator and commands>
TARGET_ROLES = <synthetic identities and relevant role/permission names>
TARGET_RUNNERS = <installed test runners and pinned browser versions>
TARGET_PLATFORMS = <host/container architectures and required CI platforms>
TARGET_JOURNEYS = <one success journey and selected failure/recovery criteria>
```

Mark unknown values as unknown for prompt M00 to investigate. Use target-specific
identities, audience names, paths and schemas. Do not copy the reference's realms,
domains, fixed `/work` imports, runner image name or seeded roles into a different
app. The reference runner is a locally built lab image, not a public dependency.

Give the receiving agent one prompt at a time with these values and the previous
completion note. Read the target's applicable instructions. Make the target the
only writable project. Preserve its production authentication, provider clients,
routing, TLS verification, PKCE, certificate identity checks and API authorization.
If it has certificate-only and certificate-plus-password entry points, preserve
both. Do not add a production mock-login switch or inject mock credentials into
real APIs. An incompatible seam is a concrete blocker, not permission to weaken
the app.

All builds, installs, certificate operations and tests run in pinned containers.
Use private disposable networks with no published mock ports, fresh test contexts,
volume-held keys/tokens/secrets/profiles and project-scoped cleanup. Verify trust
and hostname; do not use TLS bypass flags. Verify selected tool capabilities
against primary documentation and a bounded experiment. Validate normal fixtures
against authored canonical contracts with the target's existing validator; name
and segregate deliberately invalid fault fixtures. Export safe reports and videos,
not credentials, HAR, traces or saved browser state. Record exact commands, pins,
environment, observed outcomes and limitations in target completion notes. Keep
unrun criteria open. Commit/push only when the target owner authorizes it; do not
publish, deploy or modify an external dependency checkout as a side effect.

## M00 — Map the seams and evidence boundaries

> Work in TARGET_REPO. Read the reference READMEs, completion notes 16–17 and the target's architecture, authentication, API contracts and tests. Inventory TARGET_APP, TARGET_AUTH, TARGET_ORIGINS, TARGET_API and TARGET_RUNNERS. Trace where the app redirects, obtains/refreshes tokens, stores identity, calls APIs and renders dependency failures. Identify which checks belong to the browser adapter, provider, gateway and APIs. Choose separate test seams for a signed-JWT consumer, an OIDC consumer, an API consumer and browser response interception against the unchanged app build. Identify target operations and schemas for valid/error fixtures and recovery. Specify an origin allowlist and a check that no mocked auth/API request escapes to a real service. Record a target-specific diagram, case matrix, commands and unknown capabilities. Do not change runtime authentication or require completion of unrelated backlog work.

**Exit:** Each planned test names its replaced dependency, asserted behavior and
unproven guarantees. Required provider/browser features and isolation boundaries
are either verified or explicitly unknown.

## M01 — Build an isolated signed-JWT consumer

> Create a small container-only consumer using the target's intended JWT validation library. Generate an ephemeral signing key in a disposable volume; use synthetic claims shaped for TARGET_AUTH and TARGET_API. Demonstrate a valid RS256 token and separately signed expired and wrong-audience tokens, then alter one signature byte of a valid token. Assert the specific rejection reason for each negative, not just any exception. Check exact issuer, allowed algorithm, audience and lifetime where required by the target consumer. Keep keys and token contents out of logs and reports. Leave production keys, JWKS trust and API verifiers untouched. Record the copyable command and what it proves. Do not claim production verifier equivalence unless that exact component is independently tested.

**Exit:** Four deterministic cases pass; fresh projects generate new keys;
credential volumes are removed on success and failure; no real login/API call is
needed. Extra target security criteria remain explicit rather than assumed.

## M02 — Build a standalone OIDC mock and consumer

> Select and pin an OIDC mock version and container digest using primary documentation and a bounded compatibility probe. Use a dedicated consumer configured for the disposable issuer, not the production app or real APIs. Exercise verified-TLS discovery, exact issuer and endpoint origins, JWKS and supported token grants. Verify token signatures and issuer/audience/expiry; add wrong audience/issuer/signature, missing key, expiry, unsupported grant or request shape, wrong CA/hostname and bounded dependency failure cases where the selected tool supports them. Distinguish a mock accepting a secret-shaped value from actual client-secret authentication. Record observed status/error differences. Demonstrate recovery with a fresh successful request and repeatable reset. Do not configure the real provider to trust mock keys or count these cases as real login.

**Exit:** Supported protocol and failure scenarios pass with recorded pins and
verified TLS. Unsupported features have concrete limitations. Production issuer,
clients, redirects and routing remain unchanged.

## M03 — Build a canonical API consumer with faults and recovery

> Run a bounded pinned-container Prism or Mokapi experiment for the selected TARGET_API operations. Start with the minimum mock-only capability needed; do not require unrelated proxy or sequence features. Mount authored canonical contracts read-only. Validate normal populated/empty success and structured-error fixtures with the target's existing validator before serving them. If the tool needs a derivative contract, document every change and preserve request/response schemas and required headers. Demonstrate a bounded delay, explicit invalid fixture and a fresh recovery request; assert no stale success. Check applicable Location and bodyless response semantics. Use verified TLS, with a private fixed-upstream TLS adapter if necessary, and describe any internal HTTP hop. Never forward synthetic authentication to real services. Pin scripted sequence tooling only when a target scenario requires mutable outage/recovery state, and prove reset isolation.

**Exit:** The selected consumer's success/failure/recovery cases pass; valid
fixtures pass canonical validation; deliberate faults are visibly labelled;
compatibility limits, cleanup and trust boundaries are recorded. Provider/database
behavior is not claimed from a mock response.

## M04 — Test the unchanged app in real browsers with mock auth/API responses

> Build TARGET_APP unchanged in a container and serve its build in a disposable HTTPS harness at TARGET_ORIGINS. Preserve any existing client-certificate gate using synthetic volume-held credentials; distinguish this harness from the production gateway. Intercept the existing auth adapter's authorization/token/refresh/logout responses and all selected business API requests before they reach real services. Keep the adapter's normal callback, state/nonce handling and PKCE; verify the S256 verifier matches its challenge without logging either. Generate synthetic signed tokens in volumes with the target's claim/role shapes. Block unexpected origins and service workers, and assert zero escaped auth/API requests. Use canonical-validated API fixtures. Share journeys across the target runners; for this reference's matrix use actual Chrome/Edge and Playwright/Cucumber. Test customer/admin equivalents, denied callback, wrong state, invalid identity claims, refresh failure, a successful business journey and structured error/timeout/malformed-response recovery. Assert retained state and absence of stale success. For write retries, assert the intended idempotency key behavior; a mock counter is not proof of real database atomicity. Use fresh contexts and verified TLS. Record actual browser videos with a test-only mock-evidence badge; do not modify the product UI to add the label.

**Exit:** Every selected browser/runner has passing target-specific assertions,
recordings and zero unexpected destinations. The production auth implementation
is unchanged. Missing browsers, runners and platform evidence stay open.

## M05 — Add a separate OIDC browser consumer and finalize recordings

> Add a standalone teaching browser consumer configured for the disposable OIDC issuer from M02. Use discovery, authorization-code redirects with state/nonce and S256 parameters, then JWKS-based ID-token signature/issuer/audience/expiry/nonce verification. Verify actual tool compatibility; matching verifier transit does not prove mock-provider PKCE enforcement. Keep the callback consumer separate from TARGET_APP and prevent calls to business APIs. Test success, discovery failure, token rejection and altered-signature rejection followed by recovery. Clear transaction state after callback, and keep token material out of UI/logs/exported state. Capture one actual browser video per selected scenario/runner/browser, close contexts before finalizing files, and inspect representative success and failure/recovery frames. Also document how to record the browserless examples: a live output-viewer recording must be labelled as such, not as an app journey. Scan exported filenames and text for secrets and explain that this does not inspect video pixels. Run fresh-project reset and intentionally failing cleanup checks. Publish a completion note and target checklist containing only observed acceptance evidence.

**Exit:** Recorded target executions are reproducible with copyable commands,
exact versions and safe artifact paths. All disposable resources are gone after
successful/failing runs. Live-provider, real-login and unrun platform criteria
remain separate. Report a protocol blocker if the mock cannot support the selected
browser flow; do not substitute fabricated provider evidence.

## Reference code map

| Pattern | Reference files |
| --- | --- |
| Ephemeral signing and verifier | `spikes/mock-auth/jwt.mjs` |
| OIDC configuration and token consumer | `spikes/mock-auth/oidc-config.json`, `oidc.mjs` |
| Canonical fixture preparation and API consumer | `spikes/mock-auth/prepare.mjs`, `api.mjs`, `api-server.mjs` |
| Private network and credential lifecycle | `spikes/mock-auth/compose.yaml`, `pki.sh`, `run.sh` |
| Unchanged app build and synthetic TLS gate | `spikes/mock-auth/browser/Ui.Containerfile`, `server.mjs`, `pki.sh` |
| Auth interception, fixtures and shared journeys | `spikes/mock-auth/browser/journeys.mjs`, `fixtures.mjs`, `browser.spec.mjs`, `steps.mjs`, `browser.feature` |
| Browser OIDC verification | `spikes/mock-auth/browser/oidc-consumer.html` |
| Browser recording, trust and cleanup | `spikes/mock-auth/browser/run.sh`, `trust.sh`, `tls-boundary.mjs` |
| Browserless live output recording | `spikes/mock-auth/record.sh`, `record.mjs` |

Adapt the boundaries and assertions to the target. Preserve source licenses and
provenance if copying code; never copy generated artifacts or credential volumes.
