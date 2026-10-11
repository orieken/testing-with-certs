# TEST-05 → TEST-07: Prism compatibility and Vue failure/recovery

From the repository root, with Docker Desktop and the existing pinned
`magic-shop-runner:03` image (build it with `docker compose -f infra/compose.yaml
--profile test build runner-test` if needed):

```sh
./testing/prism/run.sh compatibility # TEST-05: bounded 27-observation experiment
./testing/prism/run.sh browser       # TEST-07: 11 cases × two browsers × two runners
./testing/prism/run.sh all           # compatibility first, then all browser cases
```

Each command creates a fresh `cert-prism-*` project, with private front and mock
backend networks, no published ports and no connection to real APIs, Keycloak or
HAProxy. The runner base is resolved to an exact image ID; the derived runner gets
a project-specific image tag. Builds, certificates, provisioning and tests run
in containers. Keys, synthetic signed tokens, secrets, profiles and temporary
files stay in Docker volumes or container memory. Success/failure/INT/TERM clean
up project containers, networks, volumes and temporary runner image tags. Docker
must remain available for the trap; recover only the printed project, never prune
other projects.

Safe observations, exact versions/image IDs, canonical digests and actual WebM
journeys land in `artifacts/prism/<project>/`. Mock results have dedicated source
labels/gates and cannot satisfy live-provider coverage. The application, its
canonical contracts, certificate-only shop and separate certificate/password
lesson are unchanged.

## Compatibility experiment

Prism 5.14.2 is pinned to image digest
`sha256:87972b6cf73da2c0339fca18f362b6f93118152d652c970fab93ed13cfd55bae`.
Seventeen valid response examples and the checkout request are checked with the
existing strict Ajv tooling before being added to volume-held derivatives of the
read-only canonical catalog/customer/insights bundles. Only these derivatives
remove security metadata: Prism is a mock, not an authentication authority.
Schemas, parameters, paths and header requirements remain canonical. Invalid
`FAULT_*` fixtures are separate and deliberately rejected/checked before use.

The experiment compares deterministic examples, structured 403/409/422/503,
required 201 Location, bodyless 204, invalid request handling, tuple length/types/
coordinate positions, UTC pattern/calendar validity, default proxy warnings versus
`--errors`, upstream 501 fallback, upstream CA/hostname checks and client-certificate
forwarding. A synthetic upstream and atomic control file supply the exact faults;
only counts/flags are audited, never request headers or credentials.

**Decision: mock-only.** Observed default proxy mode returns an invalid 200 with
`sl-violations`; `--errors` returns a Prism 500 for response violations and 422 for
invalid requests. These Prism problem responses are not the application's
canonical business errors. An upstream 501 may become a valid mocked 200, so a
proxy success cannot establish provider implementation. Verified upstream TLS
works with an explicitly mounted CA and rejects wrong CA/hostname, but the
experiment did not forward a client certificate to the mTLS upstream. No
credentialed real-provider traffic is routed through Prism. The exact bounded
schema findings and limitations are in [completion 21](../../docs/completion/21-prism-compatibility.md).

The test-only `mock-api` adapter verifies server CA/hostname and a synthetic
client-certificate gate on its HTTPS front. It forwards only allowlisted
content/Prefer/idempotency headers to fixed private Prism HTTP destinations.
Authorization/cookies are stripped and tested with synthetic markers. Its
credential-free internal HTTP hop is explicit: it is not end-to-end TLS,
certificate passthrough or provider authorization evidence.

## Browser scenarios

The unchanged Vue build is served by the existing test-only mutual-TLS static
server on its normal shop/auth origins inside the private project. Browser
interception supplies ephemeral signed synthetic authentication and checks the
adapter's state/nonce transaction and matching S256 verifier. Business responses
come from actual Prism through the verified test adapter; every normal response
and checkout request is validated against the canonical bundle before delivery.
No intercepted bearer/cookie is forwarded to Prism or another service.

| Case | What is controlled | What the actual UI proves |
| --- | --- | --- |
| Populated catalog | Prism named example | Correct wares render and searches recover |
| Empty catalog | Prism empty example after populated state | Prior wares disappear, explicit empty state, later populated recovery |
| Wrong-type catalog | Labelled invalid `priceCopper` outside Prism examples | Existing runtime catalog parser rejects it, stale wares clear, fresh Prism response recovers |
| Checkout 403/409/422/503 | Prism canonical named error examples | No success/order/cart clearing; cart retained; one manual retry reuses the key and succeeds |
| Malformed JSON | Explicit invalid JSON after a real mock reply | Parsing failure cannot display success; same-key recovery succeeds |
| Oversized JSON | Syntactically valid order JSON with a labelled padding field over 1 MiB | Existing response size bound prevents success/cart clearing; fresh normal reply recovers |
| Delay | Withhold a normal Prism reply for 11 seconds | Existing 10-second deadline ends pending work, button returns, cart retained, same-key recovery |
| Disconnect | Abort the intercepted delivery | Transport failure retains cart and permits recovery |

The shared journey functions execute under Playwright and Cucumber in real Chrome
and Edge. Each browser context gets an actual 1440×900 recording with a visible
`MOCK AUTH · PRISM API · UI CONSUMER EVIDENCE` badge. No traces, HAR, screenshots
or persistent storage states are exported. TLS verification stays enabled and
service workers are blocked. The static server audit must show no escaped auth/
API calls; unknown origins/operations fail rather than silently reaching a real
service. Separate negative TLS probes cover both the static server and adapter.

Checkout tests assert zero successful mock deliveries and no automatic retry
before manual recovery, then exactly two requests, one delivered mock order and
the same idempotency key. This is **UI/mock evidence**, not database atomicity;
[TEST-08](../faults/idempotency/README.md) separately proves real persistence.
Wrong-type rejection here exercises the existing catalog parser. Checkout's
existing generic JSON transport enforces status/JSON/size/deadline but does not
perform complete runtime OpenAPI order validation. No new runtime dependency or
product behavior is introduced; this suite does not claim arbitrary malformed
checkout schemas are rejected. See [completion 22](../../docs/completion/22-prism-browser-failures.md)
for that evaluation and recorded results.

## Diagnostic and cleanup controls

A bounded subset is explicitly diagnostic and cannot satisfy the 44-case gate:

```sh
PRISM_BROWSERS=chrome PRISM_RUNNERS=playwright PRISM_DIAGNOSTIC=1 \
  ./testing/prism/run.sh browser

# Expected exit 1 after one completed browser journey, then cleanup:
PRISM_BROWSERS=chrome PRISM_RUNNERS=playwright PRISM_SCENARIO=catalog-wrong-type \
  PRISM_DIAGNOSTIC=1 PRISM_FORCE_FAILURE=1 ./testing/prism/run.sh browser
```

The default gate requires all eleven unique cases under each of four selections,
passing assertions, real Prism calls, required error statuses, stable same-key
recovery, one mock order, bounded delay and every video. Mutation controls reject
missing/duplicate/failed/wrong-provenance results, absent videos, extra deliveries/
retries, missing faults, leaked calls and violated bounds. Existing live-coverage
mutation controls remain separate. No native CI, real login, production
certificate/account pairing, real outages or actual authorization is claimed.
GitHub updates remain deferred.
