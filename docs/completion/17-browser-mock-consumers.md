# Browser mock consumers and recorded journeys

User requested isolated browser tests with mock authentication and recordings
following FEATURE-01–03. Source changes are confined to `spikes/mock-auth/browser`
and documentation. Vue authentication, Keycloak clients/flows, HAProxy, API
providers, contracts and the lockfile remain unchanged. The shop remains
certificate-only and the separate teaching view still requires certificate plus
password.

## Implementation and commands

From `/Users/oscarrieken/Projects/Rieken/testing-with-certs`:

```sh
./spikes/mock-auth/browser/run.sh
MOCK_BROWSERS=chrome MOCK_RUNNERS=playwright ./spikes/mock-auth/browser/run.sh
MOCK_BROWSERS=msedge MOCK_RUNNERS=playwright MOCK_SCENARIO=customer ./spikes/mock-auth/browser/run.sh
MOCK_BROWSERS=chrome MOCK_RUNNERS=playwright MOCK_SCENARIO=wrong-state MOCK_FORCE_FAILURE=1 ./spikes/mock-auth/browser/run.sh
```

The wrapper builds and typechecks the unchanged Vue application in a container,
creates disposable certificate/profile/state volumes, runs actual Chrome/Edge,
and removes resources on success or failure. Fourteen scenarios share one
journey implementation between Playwright and Cucumber: customer, admin,
auth-denied, wrong-state, invalid-claims, refresh-failure, checkout-403,
checkout-503, checkout-delay, checkout-malformed, oidc-success,
oidc-discovery-failure, oidc-token-failure, oidc-signature-failure.

Vue tests replace the normal Keycloak adapter's HTTP responses and every
business API response. The callback preserves the adapter's state, nonce and
S256 verifier checks. Synthetic bearer tokens reach only intercepted requests;
an audit endpoint verifies zero escaped authentication/API requests. Valid
requests and response fixtures use existing `testing/api/contracts/validator.ts`
and canonical bundles. The malformed-JSON fixture is explicitly intentionally
invalid. Cart recovery checks no successful order on failure and reuse of the
same idempotency key on manual retry. Token refresh failure uses a browser clock.

The standalone OIDC browser consumer uses the pinned NAV mock's discovery,
authorization code and JWKS endpoints over verified TLS. It verifies its ID-token
signature with WebCrypto and checks issuer, audience, expiry and nonce.
Injected discovery/token/signature faults are followed by recovery. Its state
and verifier live only in the disposable browser profile and are removed after
callback. It never calls shop APIs.

## Environment and exact versions

Observed on Apple Silicon macOS with Docker Desktop, engine 29.8.2 and Compose
v5.5.1. Browser runner is linux/amd64 under emulation, not native Linux-host
verification. UI and NAV containers use their native platform.

- Base runner resolved before build: `sha256:2e5bf243f0730f9a83e9e00a616b2bd66eb322c68a0d1b448a4613034c1ab0b2` from existing locked `magic-shop-runner:03`; wrapper makes a temporary local tag for this exact ID and does not pull it.
- Node runtime in runner: 24.19.0; Playwright 1.61.0; Cucumber 12.9.0.
- Google Chrome 155.0.8059.39; Microsoft Edge 154.0.4258.62.
- Vue build/runtime: Node 24.10.0 bookworm slim at `sha256:b8d2197aff9129d16c801a3e3e1b2a873c4946480f5a310f38056df2268c38d9`; pnpm 12.9.1, frozen existing lockfile; Vite 7.2.4; Keycloak adapter 26.2.4.
- PKI: UBI 9.6 at `sha256:dec374e05cc13ebbc0975c9f521f3db6942d27f8ccdf06b180160490eef8bdbc` with no network.
- NAV mock 6.0.4 at `sha256:47374fe063995d9b6d39ebb6ea21eb5f765025bf0aa08b61b08b439eb91adaf0`, inherited from the FEATURE-02 Compose configuration.
- Derived runner image: `sha256:02ed865be5b9734a2aaf7cef15bddaa865794d36ad64ba1537e486bd3063f7e7`.
- Derived UI image: `sha256:b2468c343d6549f9abfc0d91199eb293fe4959652bdf73a035fcb7d394b2f532`.

Primary capability references: [Playwright network mocking](https://playwright.dev/docs/mock),
[Keycloak adapter 26.2.4 source](https://github.com/keycloak/keycloak-js/blob/26.2.4/lib/keycloak.js),
and [NAV mock 6.0.4 documentation](https://github.com/navikt/mock-oauth2-server/blob/6.0.4/README.md).
Authorization-code compatibility is established by these browser runs. Matching
S256 parameters are checked at the consumer boundary; provider enforcement of
PKCE is not claimed.

## Security and evidence boundaries

No host ports, real application network, real credentials or real API are used.
The static test server enforces a separate synthetic client-certificate gate.
Verified TLS probes accept the trusted client and reject missing certificates,
wrong CA and wrong hostname. Browser TLS verification remains enabled; both
mock server CAs are installed for browser and Playwright fetch clients.
All signing keys, tokens, certificates and profiles reside in Docker volumes;
mock logging is disabled. Each test creates a fresh context. Videos and safe
counters alone are exported; no HAR, trace, storage state or tokens are saved.

These results prove consumer/UI behavior with replaced dependencies. They do
not prove real Keycloak login, certificate/account pairing, production HAProxy
routing, live API authorization, certificate-plus-password flow, native Linux CI
or full TEST-01–11 acceptance. The real API's cryptographic authorization cannot
be inferred from the browser accepting a synthetic identity.

## Observed verification

Final matrix and cleanup results are recorded below after execution. Earlier
smoke runs caught a UUID fixture mismatch and a missing CA in Playwright's
response-fetching trust bundle; both were corrected without disabling validation
or TLS verification. Those failed runs are diagnostic evidence, not passing
acceptance evidence.

Final command `./spikes/mock-auth/browser/run.sh` exited 0. Project
`cert-mock-browser-1791608201-10732` passed all 56 scenario executions:

| Runner | Chrome | Edge |
|---|---:|---:|
| Playwright | 14/14 | 14/14 |
| Cucumber | 14/14 | 14/14 |

TLS positive/negative probes passed. Every scenario reported zero escaped
API/authentication requests and no external destinations. Valid fixture checks
passed through existing Ajv tooling. The wrapper's exported artifact scan passed,
and cleanup verified no labelled containers, networks or volumes remained.
The deliberately failing command above exited 1 after its passing wrong-state
scenario and intentional error; cleanup also passed for project
`cert-mock-browser-1791608244-11100`.

Exact run transcripts are `artifacts/mock-browser/<project>/run.txt`; version
metadata is `versions.json`, host/base-image identity is `environment.txt`, and
per-scenario counters are `<runner>-<browser>/observations.jsonl`. There are 56
final videos, one per scenario/selection, at
`artifacts/mock-browser/cert-mock-browser-1791608201-10732/<runner>-<browser>/<scenario>.webm`.
They are VP8 WebM at 1440×900, 25 fps. Customer and OIDC recovery frames were
visually inspected using the runner's bundled FFmpeg; preview PNGs are beside
the reports. Videos capture browser content, without an address bar or network
inspector. The text/filename credential scanner does not inspect video pixels.

Additional final checks: `git diff --check` passed; unchanged application,
services, infrastructure, contracts, testing code and lockfile were verified
with `git diff --exit-code -- apps services infra packages contracts testing pnpm-lock.yaml`.
No Saturday checkout changes, publishing or deployment occurred. Native Linux
host and real-login/provider evidence remain unclaimed.

After adding the exact run transcripts, a no-network container invocation of
`testing/container/check-artifacts.mjs` against all browser artifact directories
passed (124 entries). The final matrix alone passed its scan at 68 entries before
transcript export. Final documentation whitespace and unchanged-app checks passed.
