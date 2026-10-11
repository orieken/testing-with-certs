# TEST-03 — Real checkout dependency faults and recovery

Observed 2026-10-10 (America/Chicago) on macOS arm64 Docker Desktop. All builds,
provisioning, certificates, schema checks and tests ran in containers. Browserless
Playwright uses a linux/amd64 runner under emulation; this is **local evidence**.
No new native Linux, GitHub update, PR, deployment or publication was performed.
The existing branch baseline was `fc706f1`; this increment remains local.

## Implementation and evidence boundaries

The unchanged real Node checkout consumer calls a private test-only catalog quote
adapter through an explicitly selected Compose overlay. The adapter's Docker IP
is discovered, then only the disposable Node container receives a `catalog-api`
hosts entry. Ordinary HAProxy routes, Vue, real Keycloak clients/flows, TLS
verification, PKCE, certificate identity checks and API authorization remain.
The shop stays certificate-only; the separate lesson stays certificate + password.
No mock authentication token is issued or injected into a real API.

The adapter verifies service CA/CRL and the `customer-api` CN, then forwards the
original real signed service token to real Go with verified upstream server
CA/hostname and Node's service certificate. An authorized Go 200 is required
before disconnect, 12-second hold, intentionally malformed JSON or intentionally
invalid quote types/lines are injected. Recovery resumes forwarding actual Go
quotes. Server/caller keys are reused **only within this fresh disposable test
project**, in narrow volumes. The adapter terminates two TLS connections; this is
not end-to-end client-certificate forwarding or a production proxy.

The unavailable case simulates a quote transport outage by disconnecting after
real authorization; it does not stop Go or prove behavior during a real catalog
host outage. Delayed/malformed replies test the real consumer, not a fabricated
checkout endpoint. There is no mock HTTP control/dashboard. Atomic state and
counter-only audit files live in a disposable volume; authorization headers,
request/response contents and tokens are not persisted by the adapter.

Every case uses a new real certificate-only PKCE user token, the existing public
HAProxy checkout path and strict existing Ajv request/response validation. Direct
PostgreSQL assertions use the real `customer_db` with its original scoped
credential, verified TLS and bounded queries. The successful idempotency result
is the order row's owner/key/hash, not a separate cache. Failure must leave both
global order count and owner/key count unchanged, no row/hash and no dataset
revision increment. Recovery with the **same key/body** creates exactly one
completed order with actual Go prices, then stable replay returns that order
without another quote call or database/revision change.

## TEST-01 prerequisite

The manifest now accounts for all **121 documented operation/status pairs**:
100 required live scenarios and 21 explicit exclusions with reasons. All 23
operations retain success/input/auth requirements. Existing quote/widget 422,
checkout 409/422, item/owned-order 404, reporting 409 and follow-up 404 are mandatory.
The stale scaffold-only label is corrected. Deferred scenarios and documented
statuses that need provider/contract reconciliation remain visible; they are not
claimed complete and product behavior/contracts were not changed to satisfy them.

The normal live gate rejects mock/fault provenance. Checkout 503 is explicitly
excluded from untouched live status observations and **required by the independent
TEST-03 fault gate**. It requires all four fault/recovery cases plus TLS/auth
boundary evidence and exact contract digests. The wrapper runs both gates, so a
missing live suite or missing 503 fault cannot yield a successful wrapper exit.
Ordinary live-only runs do not claim fault coverage; native fault CI remains TEST-11.

Mutation controls prove removing createOrder 409 or 422 fails the live gate,
missing a coverage decision fails inventory, and mock provenance cannot satisfy
live coverage. Fault controls reject missing/failed faults, wrong provenance,
missing 503, persistence/TLS/recovery violations and exceeded timing bounds.
A separate reporter control proves raw credential-shaped errors, stdout and
attachments do not enter JSON/JUnit. All **8 controls passed** in the final offline
container check; the two complete runs each included the first 7 controls.

## Copyable commands

From the repository root:

```sh
LAB_PROJECT=magic-shop-checkout-fault-local-19e ./testing/faults/checkout/run.sh
LAB_PROJECT=magic-shop-checkout-fault-recorded-19f ./testing/faults/checkout/record.sh
LAB_PROJECT=magic-shop-checkout-fault-failure-19g CHECKOUT_FORCE_FAILURE=1 ./testing/faults/checkout/run.sh
./infra/render-diagrams.sh
```

These exact named projects were observed and cleaned. Reusing a still-existing
project is rejected; choose another `magic-shop-checkout-fault-*` name for a new
run. The failure command intentionally exits 1. The wrapper builds runner/stack,
provisions the real realm, initializes volume-held state, starts the fault adapter,
recreates Node with the discovered test hosts entry, checks TypeScript, runs
controls and the 17 existing live/schema cases followed by five fault cases,
runs both evidence gates, scans safe reports, then removes and verifies its project.
No host runtime/package installation is needed.

Final offline control command (no network):

```sh
docker run --rm --platform linux/amd64 --network none --entrypoint sh \
  -v "$PWD/testing/faults:/work/testing/faults:ro" \
  -v "$PWD/infra:/work/infra:ro" \
  -v "$PWD/testing/api/contracts/coverage-manifest.json:/work/testing/api/contracts/coverage-manifest.json:ro" \
  magic-shop-runner:03 \
  -c 'node --test /work/infra/check-contract-coverage.test.mjs /work/testing/faults/checkout/evidence.test.mjs /work/testing/faults/checkout/reporter.test.mjs'
```

The runner tag is built locally from the pinned Containerfile/frozen lock; actual
resolved image IDs are saved in each run's `images.txt`. Recording resolves and
uses an exact image ID at startup, rather than following a moving tag mid-video.

## Environment and pins

Docker Engine 29.8.2, Compose v5.5.1; runner Debian 12 Bookworm, linux/x64,
LinuxKit kernel 7.0.14-linuxkit under Docker Desktop on the macOS arm64 host.
Runner Node 24.19.0; Playwright 1.61.0; Ajv 8.20.0; ajv-formats 3.0.1;
pg 8.23.1; pnpm 12.9.1; installed Chrome 155.0.8059.39 and Edge 154.0.4258.62.
The 22 contract/fault cases are browserless; only Chrome's no-network output
viewer runs in the recording. There is no Chrome/Edge/Cucumber checkout matrix
claim for TEST-03.

Pinned bases retained:

- Runner Node 24.19.0 Bookworm: `sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df`.
- Node consumer/adapter 24.10.0 Bookworm: `sha256:b8d2197aff9129d16c801a3e3e1b2a873c4946480f5a310f38056df2268c38d9`.
- Keycloak 26.4.0: `sha256:5f3fb534cde6bf006d79f5912473e5d2c828c707cdfc52e16972803aca9d43dd`.
- PostgreSQL 16.15 Trixie: `sha256:65b16a8b326e0cfbdf33fa7e783f2a0cb352a61448616ccccfd616ef42aa0f65`.
- Go build 1.25.3 Bookworm: `sha256:4f43b271f9673eb7bd0cb3a49cc17b08d8d6ee110277e26dbacc93c43a5a7793`.
- Python UBI9 3.12: `sha256:d3a5322122fd7efd5d5a2486c8c221f4785c364199f27e50a33aced417047e6a`.
- Mermaid CLI 11.17.0 renderer: `sha256:a6fb0574dded4086888b5e38476899c9aff8963196f689f11a0f8fceee588ce1`.
- Playwright-pinned FFmpeg revision 1011 finalizes VP8 WebM, 1440×900 at 25 fps.

First passing runner image:
`sha256:8061ba4712e4749c8f7b7233606056da7db492c349f34b0af3bbd73d5df98617`.
Second passing test runner:
`sha256:2b606c27b66ab14c5ff207311996a5a8faa6dd8d187d8b149465b31981c6494c`.
The recorder used the first exact image ID; changes between image builds were
harness/docs files, not browser package versions. All seven real service/runner
image IDs and Docker/client details are preserved in each report directory.

Primary capability references: [Node 24 HTTPS request options](https://nodejs.org/download/release/v24.10.0/docs/api/https.html#httpsrequesturl-options-callback),
[Node 24 TLS verification](https://nodejs.org/download/release/v24.10.0/docs/api/tls.html),
[Compose extra_hosts](https://docs.docker.com/reference/compose-file/services/#extra_hosts),
and [Playwright API testing](https://playwright.dev/docs/api-testing).
These support the private verified harness; no Prism/Mokapi feature or compatibility
claim is required to exercise this concrete dependency sequence.

## Observed results

Both fresh projects passed **22/22**: 11 existing real provider tests, 6 offline
schema tests and 5 dedicated fault/TLS tests. Both live gates passed all 23
operations and their 100 requirements; both separate fault gates passed.

| Fault | First run elapsed | Recorded fresh run elapsed | Outcome |
| --- | --- | --- | --- |
| Authorized connection disconnected | 33 ms | 29 ms | Canonical 503, zero persistence, same-key recovery and replay |
| 12-second delayed reply | 5028 ms | 5014 ms | Real 5-second abort within 4.5–8 s, zero persistence, recovery/replay |
| Intentionally malformed JSON | 14 ms | 14 ms | Canonical 503, zero persistence, recovery/replay |
| Intentionally invalid quote types/lines | 15 ms | 15 ms | Canonical 503, zero persistence, recovery/replay |

All recovery results were canonical 201 with a 24000-copper order (two real
12000-copper Wand of Embers items), one persisted owner/key/hash and one revision
increment. Stable replay persisted no duplicate and made no dependency call.
Missing/deliberately invalid tokens remained real Go 401; wrong server CA/hostname, missing
client, wrong client CA and wrong caller CN were rejected. Valid downstream and
upstream TLS remained mandatory. No TLS bypass was introduced.

Reports:

- `artifacts/checkout-faults/magic-shop-checkout-fault-local-19e/`
- `artifacts/checkout-faults/magic-shop-checkout-fault-recorded-19f/`
- `artifacts/checkout-faults/magic-shop-checkout-fault-failure-19g/`

The optional new-execution recording is
`artifacts/checkout-faults/magic-shop-checkout-fault-recorded-19f/video/checkout.webm`:
83.12 seconds, VP8, 1440×900, 25 fps. It is labelled as a live-output viewer,
not an application journey. The recorded artifact scan passed 14 entries after
video finalization; recorder profile/tmp volumes were removed. Text scanning does
not inspect video pixels. The first wrapper scan passed 7 files before cleanup
added its final text marker. Representative middle/final frames were extracted in a no-network Chrome container and visually checked: readable test names, fault evidence label and final success/cleanup, with no credentials displayed. Final report/frame scanning is recorded below.

The deliberate failing project reached real realm provisioning, adapter startup,
Node recreation and runtime inspection, then exited **1** with the expected marker.
Its trap removed the project and verified absence of labelled containers,
networks and volumes. Earlier setup failures also tore down their named projects:
architecture-mismatched derived runner, profile permissions and an omitted seed
oracle were corrected without application changes. A repeated NSS initialization
prompt was stopped and its generated temporary log truncated; the harness now
reuses its own store safely, bounds every certutil command to 10 seconds, and
bounds its entire TypeScript/control/Playwright phase to 180 seconds. The recorded
fresh run exercised repeated trust setup successfully.

## Limits and next work

This completes local TEST-03 and its TEST-01 coverage prerequisite. It does not
supply native fault CI (TEST-11), real provider outage evidence, concurrent
idempotency/lost-response proof (TEST-08), browser UI recovery evidence, broad
Prism/Mokapi compatibility (TEST-05/06), a human password demo, or an actual PR-base
comparison (TEST-04). Existing mock browser evidence and historical TEST-02 native
evidence remain separate. GitHub actions are deferred until local work is complete.

## Final local verification

```sh
LAB_PROJECT=magic-shop-checkout-fault-config-check docker compose \
  -f infra/compose.yaml -f infra/checkout-fault.compose.yaml config --quiet
docker run --rm --platform linux/amd64 --network none \
  --mount "type=bind,src=$PWD,target=/work,readonly" magic-shop-quality:15
docker run --rm --platform linux/amd64 --network none --entrypoint node \
  --mount "type=bind,src=$PWD/artifacts,target=/work/artifacts,readonly" \
  magic-shop-runner:03 /work/testing/container/check-artifacts.mjs \
  /work/artifacts/checkout-faults
git diff --exit-code -- apps packages services infra/haproxy infra/keycloak contracts pnpm-lock.yaml .github
git diff --check
```

Compose configuration and containerized shell/JavaScript syntax checks passed.
A no-network container check resolved 101 local documentation file links. All 25
architecture/workflow Mermaid blocks rendered with the pinned renderer; the two
new diagrams were also rendered as PNG for visual review. Existing quality limits
passed across 118 authored files/635 functions: maximum CCN 70 is the existing
capped transport-handler baseline, **not** a claim of global complexity ≤6.
The pinned quality image uses lizard 1.24.1 on the UBI9 Python digest above.

Final artifact scanning passed **44 entries**, including both completed runs,
setup/failure report directories and representative video review frames. A direct
label-based check confirmed no containers/networks/volumes remained for projects
19a through 19g; recorder container and named profile/tmp volumes were absent.
The application, packages, services, normal HAProxy/Keycloak config, canonical
contracts/lockfile and GitHub workflow diff check was empty. The local diff is
limited to tests/harness, coverage tooling and documentation; no commit or push
was made during this increment.
