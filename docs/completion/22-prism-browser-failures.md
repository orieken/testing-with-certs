# TEST-07 — Prism-backed Vue failure and recovery journeys

Observed 2026-10-10 (America/Chicago), macOS arm64 Docker Desktop with real Chrome
and Edge running in linux/amd64 containers under emulation. All builds, PKI,
provisioning and tests ran in containers. This is **UI/mock consumer evidence**;
it supplies no new native Linux, live-provider or real-login result. Baseline HEAD
remains `fc706f1`; all changes remain local and GitHub updates are deferred.

## Implementation and trust boundary

The unchanged Vue application is typechecked/built with the existing frozen
container build and served only inside the fresh private test project. Neither
its sources nor Keycloak clients/flows, HAProxy routes, TLS verification, PKCE,
certificate identity checks or real API authorization change. The shop remains
certificate-only; the separate certificate/password view stays unchanged.
No mock credential reaches a real provider or API.

The browser interceptor replaces only authentication responses, using ephemeral
RS256 keys/tokens in a Docker state volume. It checks the normal adapter's expected
client/callback, state/nonce transaction and matching S256 verifier, then supplies
a synthetic customer identity. This proves consuming a mock auth transaction,
not real provider authentication, cryptographic API verification or PKCE enforcement.
Tokens stay out of browser persistent storage and exported reports.

Unlike completion 17's fixture-only API interception, the new suite obtains normal
API replies from **actual pinned Prism processes**. A fixed Node HTTPS request
uses a synthetic client certificate and verifies the mock adapter's CA/hostname.
The adapter strips authorization/cookie headers and sends allowlisted content,
Prefer and idempotency headers to fixed Prism HTTP destinations on a separate
internal network. Browser bearer values are inspected only for expected shape;
they are never copied into that request. The internal HTTP hop carries mock data,
not credentials; it is not end-to-end TLS or certificate forwarding evidence.
All valid replies/checkout requests pass existing strict canonical Ajv validation
before browser delivery. Unsupported/unexpected origins or API operations fail.

A synthetic mutual-TLS static server gates the normal shop/auth origins; its audit
must show zero escaped auth/API calls. Separate probes reject absent clients,
wrong CA and wrong hostname at both static server and mock adapter. Signing CA
state is held only by no-network PKI. No published ports, dashboards or request
logs are enabled. Browser HOME/tmp/profile/key/token files stay in Docker volumes,
with no exported trace, HAR, screenshots or saved browser storage state.

## Scenarios and specific assertions

The same journey functions run in Playwright and Cucumber, in real Chrome and
Edge, with fresh contexts and an actual video for each execution.

| Scenario | Source/fault | Behavior asserted |
| --- | --- | --- |
| `catalog-populated` | Canonical named Prism example | Expected wares and fresh search results |
| `catalog-empty` | Prism empty example after populated list | Stale cards disappear, explicit empty state; later populated search recovers |
| `catalog-wrong-type` | Explicit `FAULT_wrong_type`, outside valid examples | Existing catalog parser rejects string price; stale cards clear, error appears; fresh Prism reply recovers |
| `checkout-409`, `checkout-422`, `checkout-503`, `checkout-403` | Canonical named Prism error examples | No successful order/cart clearing; retained cart and manual same-key recovery |
| `checkout-malformed-json` | Explicit invalid JSON after normal Prism reply | Parse failure retains cart and never displays success; normal retry succeeds |
| `checkout-oversized` | Syntactically valid JSON with `FAULT_padding`, over 1,048,576 bytes | Existing UI size bound prevents success and cart clearing; normal retry succeeds |
| `checkout-delay` | Hold normal mock delivery for 11 seconds | Existing 10-second deadline ends pending work; disabled button returns; bounded failure and recovery |
| `checkout-disconnect` | Abort delivery as connection reset | Transport failure retains cart and permits manual recovery |

Before manual retry, checkout assertions require one request, zero successful mock
order deliveries, a retained cart, no successful-order status and an enabled
retry button. Manual recovery must produce exactly two requests, the same key,
one delivered mock order, an empty cart and one order entry on Account. No
automatic retry can inflate the mock counters. The delayed UI failure is measured
within 9,500–14,000 ms; the application's timeout stays at 10,000 ms. The contract
test helper's separate raw-body bound is 1,000,000 bytes; the fault exceeds both
bounds and is deliberately not delivered through the normal validator path.

This does **not** establish database idempotency: Prism's write mocks are stateless,
and delivery counters refer only to mock replies seen by the UI. Real persistence
and committed-response retry were independently proved in [completion 20](20-checkout-idempotency.md).

## Runtime validation evaluation

The existing catalog parser already checks item types/price and rejects the tested
wrong-type fixture. The generic checkout transport checks status, JSON syntax,
size and deadline, but its TypeScript response cast is not a full runtime OpenAPI
validator. This suite exercises those existing boundaries and does not claim that
an arbitrary well-formed, wrong-schema checkout order is rejected. No Ajv runtime
bundle or app behavior was added. Full order validation would be a separate
product change requiring its own behavior/security review; the observed scenarios
do not require it to satisfy this bounded consumer-testing scope.

## Exact commands and observed results

From the repository root:

```sh
LAB_PROJECT=cert-prism-browser-diagnostic-22a PRISM_BROWSERS=chrome \
  PRISM_RUNNERS=playwright PRISM_DIAGNOSTIC=1 ./testing/prism/run.sh browser
LAB_PROJECT=cert-prism-browser-matrix-22b ./testing/prism/run.sh browser
LAB_PROJECT=cert-prism-final-22e ./testing/prism/run.sh all
LAB_PROJECT=cert-prism-browser-failure-22d PRISM_BROWSERS=chrome \
  PRISM_RUNNERS=playwright PRISM_SCENARIO=catalog-wrong-type \
  PRISM_DIAGNOSTIC=1 PRISM_FORCE_FAILURE=1 ./testing/prism/run.sh browser
```

22a passed 11 diagnostic Chrome/Playwright cases, explicitly skipping the full
matrix gate. 22b passed **44/44** with every video, its separate gate, safe scan and
cleanup. 22e repeats **44/44** after the expanded 27-case compatibility experiment,
new TLS probes, measured delay bounds and strengthened evidence gate. The 22d
command is intentionally failing after one completed browser journey; it must
exit 1 and still remove all project/profile/credential resources.

The wrapper uses a project-specific derived runner image from the immutable local
base, builds the unchanged UI, provisions fresh certificate/state/profile volumes,
prevalidates seventeen canonical response fixtures plus the checkout request,
starts private Prism processes and TLS adapter, checks TLS controls, executes
four selections with 240-second bounds each, then gates/scans/cleans. Canonical
business error bodies originate in Prism; the explicitly invalid type/JSON/size
and transport faults are applied after obtaining normal mock data.

The dedicated evidence source is `prism-mock-browser-consumer`; it cannot satisfy
`playwright-contracts` live coverage. The gate requires eleven unique passing
cases for each browser/runner, actual Prism calls, exact structured error statuses,
one delivered mock order, two same-key checkout requests, bounded delay, no
escaped calls and every video. Mutation controls reject missing/duplicate/failed/
wrong-provenance observations, absent videos, duplicate deliveries, extra retries,
missing faults, omitted error statuses, leaked calls and exceeded deadlines.

The first final build ran both new browser-gate controls. A review found the
existing live-gate controls were absent from the inherited image and Node's test
selection skipped that unmatched file. The derived image now copies them explicitly
and the wrapper verifies that the file exists before running controls. The final
failure/offline checks run all six controls: four live-gate controls and two new
browser-gate controls. Browser behavior/code was unaffected by this image correction.

## Versions, artifacts and limitations

Runner Node 24.19.0, Playwright 1.61.0, Cucumber 12.9.0, Chrome 155.0.8059.39,
Edge 154.0.4258.62; Docker 29.8.2, Compose v5.5.1; Debian 12/linux x64 on LinuxKit
7.0.14-linuxkit under macOS arm64 Docker Desktop. Ajv 8.20.0/ajv-formats 3.0.1;
pnpm 12.9.1 with unchanged frozen lock. Vue 3.5.25, keycloak-js 26.2.4, Pinia
3.0.4, Vue Router 4.6.3, Vite 7.2.4 and TypeScript 5.9.3 retain existing pins.

Prism/image/base digests are recorded in [completion 21](21-prism-compatibility.md).
The final combined derived runner is
`sha256:cad0f31d6fa586bef0cec70308c4fa0946f4fb28653bf731e021ff1c11d7871f`;
unchanged built UI is
`sha256:f10a057710efc0d69d3f510b80e1f68db820ff971185efedc882fb37a1f4848a`.
Each directory saves versions, host/runner environment, canonical digests, exact
resolved image IDs, safe JSON observations/gated report and actual WebM journeys.
Browser videos use Playwright-pinned FFmpeg revision 1011, VP8, 1440×900/25 fps,
and a visible mock-evidence badge. They show application interaction, not an output
viewer or old logs. Reports are credential-scanned; video pixels require visual
review because the text scanner does not inspect binary media.

Reports/videos are under:

- `artifacts/prism/cert-prism-browser-matrix-22b/`
- `artifacts/prism/cert-prism-final-22e/`
- `artifacts/prism/cert-prism-browser-failure-22d/`

No native CI, real Keycloak login, real HAProxy routes, certificate/account pairing,
API authorization, real provider outage or general load result is inferred from
these mock journeys. Existing live/native evidence remains separate. TEST-06,
TEST-09–11 and actual TEST-04 PR-event evidence remain open; GitHub stays deferred.

Final verification: `LAB_PROJECT=cert-prism-final-22e ./testing/prism/run.sh all`
exited 0: six gate mutation controls, 27 compatibility observations, verified TLS
controls and 44 browser scenarios passed. The separate browser evidence gate and
safe artifact scan (64 entries before review images) passed. Cleanup confirmed
all project containers, networks and credential/profile volumes were removed.

The preceding `cert-prism-final-22c` run passed its 27 probes and 44 scenarios,
but editing the wrapper during execution caused its final scan command to fail
with exit 127. Its cleanup succeeded and an independent scan passed. The runner
was frozen for the clean 22e repeat; 22c is not counted as a successful wrapper.
The intentional `cert-prism-browser-failure-22d` run exited 1 after its completed
journey and six controls, and cleanup removed all project resources.

Prism and browser runners used emulated linux/amd64 containers. The adapter and
upstream used native arm64 containers: Node 24.10.0, OpenSSL 3.5.4, LinuxKit
7.0.14-linuxkit; metadata is saved as `adapter-runtime.json` and
`upstream-runtime.json`. This is Docker Desktop evidence, not native Linux-host
or CI evidence.

Post-run verification (all runtimes in no-network containers):

```sh
docker run --rm --platform linux/amd64 --network none \
  --mount type=bind,src="$PWD",dst=/work,readonly magic-shop-quality:15
docker run --rm --platform linux/amd64 --network none --entrypoint node \
  --mount type=bind,src="$PWD",dst=/work,readonly magic-shop-runner:03 \
  /work/testing/container/check-artifacts.mjs /work/artifacts/prism
docker run --rm --platform linux/amd64 --network none --entrypoint sh \
  --mount type=bind,src="$PWD",dst=/work,readonly magic-shop-runner:03 \
  -c 'for f in /work/testing/prism/*.mjs /work/testing/prism/browser/*.mjs /work/testing/prism/compatibility/*.mjs; do node --check "$f" || exit; done; sh -n /work/testing/prism/run.sh /work/testing/prism/pki.sh /work/testing/prism/trust.sh'
```

Quality passed for 142 authored files / 800 functions under existing repository
limits, including its two capped transport baselines. Syntax checks passed. The
whole Prism artifact scan passed (252 entries at that check). A containerized
check also confirmed private networks, no published ports/privileged services,
PKI-only CA signing state and valid local documentation links. The new Mermaid
diagram rendered successfully using the pinned renderer. Project resource queries
returned no remaining `cert-prism-*` containers, volumes or networks.

FFmpeg revision 1011 in the pinned browser runtime extracted checkout-503 frames
at 1.9 and 2.4 seconds. Visual review confirmed the service-unavailable error with
the retained cart, subsequent single mock order and visible teaching-evidence
label. Videos are VP8 WebM, 1440×900, 25 fps.
