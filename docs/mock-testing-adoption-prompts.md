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

## M06 — Prove a real consumer's dependency faults and persistence recovery

> Identify TARGET_APP's actual dependency consumer, canonical failure response and persistence boundary. Inventory existing status coverage first; require already observed business errors and explicitly explain each deferred status. Add mutation controls proving an observed 409/422 cannot disappear silently. Build the unchanged real consumer and database in a fresh private disposable container project. Use real test-provider identities through the target's normal authentication and TLS boundaries; never send mock tokens to real APIs. Insert an explicitly selected dependency-only fault harness, preserving both incoming caller verification and upstream CA/hostname/client/token verification. Apply faults only after the real upstream has authorized the request: disconnect/unavailable response, a deterministic delay longer than the existing timeout, malformed JSON and an explicitly labelled invalid schema payload. Validate normal request/response data with the target's existing contract tooling. For every fault, assert a measured bounded structured failure, no persisted business result/idempotency success or dataset revision change, then restore the dependency and retry with the same key. Assert exactly one real persisted result and stable replay. Preserve existing timeouts and product behavior; report a defect rather than weakening validation to make a test pass. Keep live-provider status evidence and fault-consumer evidence in separately named reports/gates. Reject missing faults, wrong provenance, timing/persistence violations and failed recovery. Run two independent fresh projects and deliberate failure cleanup. Keep keys, tokens, credentials, state and profiles in volumes; export only safe reports. If recording browserless checks, label the video as a live output viewer. Record pins, commands, environment, timing, trust boundary and limits. Defer GitHub changes/native execution when requested; do not claim them from local emulation.

**Exit:** The actual consumer and database pass deterministic failure/recovery
invariants under verified TLS; an explicit fault gate accounts for the error
status without adding mock results to live-provider coverage. Concurrency,
real-outage, browser-journey and unrun-platform evidence remain separate.

Reference: [TEST-03 real checkout harness](../testing/faults/checkout/README.md).
Adapt dependency DNS/routing, schemas, identity checks and database invariants;
this lab's server/caller certificate reuse is limited to its fresh disposable
project and must not be copied into production routing.

## M07 — Prove real concurrent idempotency and committed-response retry

> Identify TARGET_APP's idempotency key scope, canonical request hash, persistence transaction and response-after-commit boundary. Build its unchanged real authentication/provider/database stack in a fresh private disposable container project; preserve TLS, PKCE, certificate identity pairing and API authorization. Never inject mock authentication into real APIs. Race identical requests with one key, then conflicting bodies with one key. Establish concurrency using observed database waiters or another explicit bounded barrier, not sleeps or overlapping stopwatch intervals. Release the barrier only after every competing write reaches it. Assert actual response statuses and canonical schemas, exactly one stored result and one revision increment, winning body/hash/prices, stable identical replay and documented conflict replay; allow either conflicting body to win. Separately consume one real successful response after commit in a test-only verified TLS intermediary and drop its client connection before response headers. Keep a credential-free receipt in a private volume, prove commit from the real database, then retry directly through the real gateway with the same key/body. Require the same result/Location and no duplicate or revision change. Scope the intermediary to the disposable test, preserve both TLS/identity boundaries and forward only unchanged real credentials; add trust, selected-certificate and missing/invalid-token rejection controls. Keep product timeouts unchanged; use bounded polling and always release locks, settle requests and close pools in finally. Require live-provider and dedicated idempotency evidence gates with missing/failed/mock-provenance and persistence/replay controls. Run two independent fresh container projects and intentional failure cleanup. Export only safe reports; keep keys, tokens, receipts, secrets and profiles in volumes or container memory. Record exact pins, commands, environment, database counts and limitations. Label a browserless recording as a live output viewer. Defer GitHub/native runs when requested and never claim unrun platform, browser or real-outage evidence.

**Exit:** Database-observed races prove one persisted winner, stable replay and
canonical conflicts; a real committed-response loss retries without duplication.
All disposable resources clean up on success/failure; authentication and product
behavior remain intact.

Reference: [TEST-08 real checkout idempotency](../testing/faults/idempotency/README.md).
Adapt the barrier to the target database, schema and pool size. Do not reuse this
lab's customer/server certificate sharing outside a disposable test project.

## M08 — Verify Prism before choosing a mock or proxy boundary

> Inventory TARGET_APP's canonical schemas, existing strict fixture validator and actual TLS/client-certificate requirements. Pin Prism's release and container digest, verify its primary documentation and execute the pinned CLI help/version. In private disposable container networks, compare canonical-derived named success/error examples, required headers, bodyless responses, invalid requests, tuple length/positions/types, UTC/calendar constraints and the existing validator's decisions. Use only a synthetic upstream to test default warning versus enforcing proxy behavior and upstream 501 fallback; report exact status/violation locations rather than assuming every proxy error is schema enforcement. Verify upstream CA/hostname rejection and attempt client-certificate forwarding with a direct positive/negative mTLS oracle. Never route real authenticated traffic until the actual capabilities are proved, and choose mock-only if trust/identity or mock-fallback behavior makes proxy evidence unsuitable. Keep source schemas read-only; remove security metadata only in explicit mock derivatives. Prevalidate valid examples and keep labelled invalid faults separate. Test credential stripping, disable request logs/dashboards, keep signing keys/secrets/profiles/control state in volumes, and prove bounded startup/test/failure cleanup. Record passing and unsupported cases, exact image IDs, commands, environment, canonical digests and the concrete decision. Do not weaken TLS, alter app behavior or treat mock success as live implementation/authorization evidence.

**Exit:** A repeatable bounded compatibility report supports a concrete mock-only
or proxy decision; unsupported behavior remains explicit and real security/routing
is unchanged. Reference: [TEST-05 experiment](../testing/prism/README.md).

## M09 — Add contract-derived browser failure and manual recovery journeys

> After TARGET_APP's mock compatibility decision is recorded, build its unchanged UI and serve it only on private disposable test origins with verified TLS. Replace auth responses only inside browser tests; preserve the real app adapter and check the exact callback/state/nonce/PKCE request shape using ephemeral volume-held keys/tokens. Obtain normal API responses and canonical business errors from the pinned mock, using an explicit verified adapter and stripping all bearer/cookie headers before the mock hop. Keep every valid request/response checked with the app's existing strict contract tooling. Add populated → empty → recovered data and specific labelled wrong-type, malformed JSON, syntactically valid oversized JSON, delay, disconnect and permission/business-error cases. Exercise existing runtime boundaries; if the app accepts an invalid schema, report the gap rather than silently changing behavior or claiming rejection. Evaluate full runtime validation separately. Share journeys between Playwright and Cucumber and run real Chrome and Edge. Assert no stale data/success, retained inputs/cart, bounded pending work, no automatic duplicate retries, one manual recovery with the same idempotency key and the expected UI result. Mock delivery counters are not database proof. Require zero escaped auth/API calls, blocked unknown origins/operations, no persistent token storage, verified TLS negative controls, actual labelled videos and a complete independently named mock evidence gate. Add mutation controls for missing/failed/duplicate/wrong-provenance/video/extra-retry/order/deadline evidence. Keep keys/tokens/profiles/secrets in volumes, export only safe observations/videos, and prove failure cleanup in a fresh project. Freeze harness files during executions. Record exact commands/pins/environment/observed results and never infer real login, certificate pairing, API authorization, production outages, database atomicity or unrun native-platform support. Keep GitHub changes deferred when requested.

**Exit:** Applicable shared browser journeys pass all four selections with actual
videos and an independent mock report; product/security behavior remains unchanged.
Reference: [TEST-07 journeys](../testing/prism/browser/journeys.mjs) and
[completion 22](completion/22-prism-browser-failures.md).

## M10 — Scripted reporting dependencies with whole-consumer assertions

> Read your canonical reporting contract, consumer pagination code, authentication and network boundaries. Pin Mokapi by version/digest and verify its handler, response and TLS capabilities from primary docs and a bounded disposable experiment. Script page one revision r1 followed by 409, r2, outage, repeated cursor or a valid empty intermediate page. Seed minimal canonical-valid default examples to bound generation; independently validate responses with Ajv and label intentionally invalid faults. Reset generation atomically between sequences and repeat in independent projects. Preserve real consumer authentication and authorization; if a wrapper is necessary, verify both TLS sides and certificate identities, validate the real token before mocking and strip all credentials on a separate private mock network. Do not inject mock auth into real APIs. Assert whole HTTP consumer responses, no partial totals/pages, exact dependency request counts, explicit recovery, exact record-limit success and over-limit/endless-page termination. Extend existing unit tests without changing app behavior. Keep keys, secrets, profiles and state in volumes; disable dashboards, tracking and logs; scan safe artifacts and test cleanup on success and failure. Use a separate mutation-tested fault evidence gate that cannot satisfy live-provider coverage. Record pins, environment, exact commands, results and unsupported cases. Label any recording as an actual UI journey or output viewer according to what it shows; do not claim unrun native evidence.

## M11 — Real regional boundaries and historical identity

> Read TARGET_APP's canonical reporting contract, date semantics, pagination and profile/order design before asserting behavior. Keep production behavior and all authentication, certificate, TLS and authorization boundaries unchanged. In a fresh private disposable container stack, insert canonical-valid deterministic records immediately before, exactly at and immediately after UTC window boundaries, plus non-completed records. Use an independently written oracle and enough records to cross private and public page limits. Move a real customer's profile through the authenticated API after insertion and prove saved historical order region remains unchanged. Distinguish historical membership filters from displayed current residence. Exhaust every API page, verify revision consistency, exact IDs, distinct customers and totals; preserve existing seed and empty-region oracles. Share actual UI journeys under Chrome/Edge and Playwright/Cucumber, checking map, summary and applicable table rows against the oracle. State any UI page limit and unsupported timestamp precision honestly rather than changing behavior to pass. Validate fixtures and responses with existing strict tooling. Keep secrets, keys, tokens and browser profiles in volumes; record labelled real-auth/real-API videos, mutation-test evidence completeness and verify cleanup on success and failure. Record exact commands, pins, environment and observed results; do not infer unrun native-platform or CI evidence.

Reference: [regional boundary example](../testing/regional/README.md). Nothing is mocked in this example; its provider evidence is separate from dependency replacement examples.

## M12 — Independent native consumer/fault CI evidence

> Reuse TARGET_APP's proven pinned disposable suites rather than changing production behavior to simplify CI. Keep the existing real-provider contract/security/browser gate and ordering independently required. Add explicitly named mock-consumer and dependency-fault jobs with unique private projects, verified TLS, volume-held keys/secrets/profiles and bounded commands. Never inject mock auth into real APIs or merge mock observations into live coverage. Require each suite's completeness/provenance gate and keep matrix failures independent without suppressing errors. After an intentional runner failure, verify exact expected exit/marker and independent container/network/volume absence; always dispose known projects on failure or interruption. Export only allowlisted sanitized text reports with source, actual run outcome, runtime/pins and cleanup receipts, following credential scan and host readability checks. Do not upload raw logs or sensitive browser artifacts; videos remain separately reviewed. Add a final always-running gate that rejects failed/skipped/cancelled/missing live or mock/fault requirements, mutation-test that rule and perform a deliberate failing native job control. Record exact native success/failure/cleanup/upload results and limitations before checking completion; implementation or local tests alone cannot count as native evidence.

Reference: [independent CI suite guide](../testing/ci/README.md).
