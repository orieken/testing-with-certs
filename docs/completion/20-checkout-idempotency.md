# TEST-08 — Concurrent checkout idempotency and committed-response retry

Observed 2026-10-10 (America/Chicago) on macOS arm64 Docker Desktop. All builds,
provisioning, certificates and tests ran in containers. The browserless runner
is linux/amd64 under emulation, Debian 12 with LinuxKit 7.0.14-linuxkit. These are
**local results**, not native Linux or a browser checkout/login journey. No
Saturday checkout, GitHub update, commit/push, deployment or publication occurred.
Baseline branch HEAD remains `fc706f1`; TEST-01/03 and this work remain local.

## Implementation and what it proves

The unchanged real HAProxy → Node → Go checkout path uses real Keycloak
certificate-only authorization-code/PKCE tokens and PostgreSQL. Vue, realm
clients/flows, gateway routes, TLS validation, PKCE, selected-certificate identity
pairing and API authorization remain intact. The shop remains certificate-only;
the separate certificate/password lesson is unchanged. No mock tokens or mock
checkout endpoint are used.

The new explicit overlay adds only a test observer and response-loss intermediary.
A scoped customer database connection holds `LOCK TABLE orders IN SHARE MODE`,
allowing the pre-insert SELECT but blocking inserts' RowExclusive locks. A bounded
2.5-second Playwright poll joins `pg_locks` to `pg_stat_activity` and requires four
real `customer-api` INSERT waiters for identical bodies or two for conflicting
bodies before releasing the lock. This is database-observed concurrency, not a
sleep/stopwatch assumption. Four requests match the existing provider pool size;
its 5-second database statement timeout remains unchanged. Transactions, requests
and pools are released/settled in `finally`; fresh project removal resets all
fixtures. Either conflicting body may win.

Each request and 201/409 response is checked by existing strict Ajv canonical
OpenAPI tooling. Real database assertions check global and owner/key counts,
selected body SHA-256, completed status, actual Go line prices/quantities and
revision delta. Identical racers all return the same full order/Location; winner
replay is identical and creates no row/revision change. The losing conflicting
body receives `{ "code": "conflict", "message": "conflict" }`, no Location, and
remains 409 on retry without database changes.

The lost-response case alone resolves the test client's socket to `checkout-loss`
while preserving the exact shop URL/SNI/hostname and server verification. The
intermediary verifies user CA/CRL and selected customer certificate CN, presents
that same disposable customer certificate, and forwards the unchanged real user
token to normal HAProxy over independently verified TLS. It reads the real API's
complete 201, which follows the store transaction COMMIT, atomically writes a
credential-free allowlisted response receipt to a private state volume, then
closes the client socket before sending any headers. The client must observe
ECONNRESET with `responseStarted=false`. The receipt and real database prove
persistence; a retry directly through HAProxy returns exactly the same order and
Location without another row/revision. A changed-body retry remains 409.

This is **two verified TLS connections**, not certificate passthrough. The shop
server leaf and selected customer leaf are shared only within this fresh
disposable test project through narrow read-only mounts. The intermediary cannot
mint credentials or bypass real provider authorization, has no control/dashboard
endpoint and exports no request headers/tokens. Receipt data stays in the volume
and is deleted at cleanup. Wrong server CA/hostname, absent/wrong-CA customer
certificate, wrong selected customer and missing/invalid real token controls must
reject without persistence. Ordinary races and all replays bypass the intermediary.

Primary capabilities verified against [PostgreSQL 16 locking](https://www.postgresql.org/docs/16/explicit-locking.html),
[`pg_locks`](https://www.postgresql.org/docs/16/view-pg-locks.html),
[`pg_stat_activity`](https://www.postgresql.org/docs/16/monitoring-stats.html),
[Playwright bounded polling](https://playwright.dev/docs/test-assertions#expectpoll)
and [Node 24 HTTPS request/TLS options](https://nodejs.org/download/release/v24.10.0/docs/api/https.html#httpsrequesturl-options-callback).
No Prism/Mokapi compatibility experiment or unrelated backlog dependency was
needed for this concrete real-provider test.

## Exact observed commands

From the repository root:

```sh
LAB_PROJECT=magic-shop-checkout-idempotency-local-20a ./testing/faults/idempotency/run.sh
LAB_PROJECT=magic-shop-checkout-idempotency-recorded-20b ./testing/faults/idempotency/record.sh
LAB_PROJECT=magic-shop-checkout-idempotency-failure-20c IDEMPOTENCY_FORCE_FAILURE=1 ./testing/faults/idempotency/run.sh
LAB_PROJECT=magic-shop-checkout-idempotency-recorded-20d ./testing/faults/idempotency/record.sh
```

The third command intentionally exits 1 after provisioning. All named projects
are disposable; use another `magic-shop-checkout-idempotency-*` name if a previous
project still exists. The wrapper refuses existing containers/volumes, builds
from pinned sources/frozen lock, starts the real stack on private networks,
bootstraps the real realm, initializes the response receipt volume and starts the
loss intermediary. It checks TypeScript, runs six offline gate controls, runs 17
existing live/schema cases plus four TEST-08 cases, checks live coverage and the
independent idempotency gate, scans safe artifacts, then removes and verifies all
project containers/networks/volumes. Front/backend/auth/database networks are
internal, with no published ports. Keys/secrets/profiles/tmp/receipt live in
volumes; tokens stay in container memory.

The dedicated report source is `real-provider-checkout-idempotency`. The four
new cases never supply live operation/status coverage. The original live gate
still requires all 23 operations and 100 status requirements; its 21 documented
exclusions remain explicit. The idempotency gate rejects missing/failed/duplicate
cases, mock provenance, missing observed waiters, wrong statuses, persistence or
revision mismatch, unstable replay, premature response delivery and trust-control
failures. Six offline controls passed: four existing live coverage controls plus
two new controls covering these idempotency mutations. Safe JSON/JUnit excludes
raw credential-bearing errors/stdout/attachments, using the prior reporter pattern.

## Observed results

Both independent fresh projects passed **21/21**: 11 real provider cases, six
offline schema cases and four idempotency/trust cases. Both coverage gates and
safe artifact scans passed. The first run asserted all database invariants; the
recorded run additionally exports actual numeric counts/revisions:

| Recorded case | Observed API/transport | DB orders before → after | Revision before → after | Owner/key rows |
| --- | --- | --- | --- | --- |
| Four identical blocked inserts | Four 201, identical full body/Location; stable replay | 10 → 11 | 6 → 7 | 0 → 1 |
| Two conflicting blocked inserts | One 201, one 409; winner replay 201, loser replay 409 | 11 → 12 | 7 → 8 | 0 → 1 |
| Committed response discarded | ECONNRESET before headers; receipt 201; direct retry 201; conflict 409 | 12 → 13 | 8 → 9 | 0 → 1 |
| TLS/auth controls | Wrong CA/hostname/client/customer/token rejected | Unchanged | Unchanged | No row |

Every successful case matched its stored request hash and canonical Go prices
(12,000 copper per Wand of Embers; quantity one or two depending on the winner).
All replays left the entire count/revision snapshot unchanged. Barrier waiters
were absent after each completed race. No timeout or product defect was observed.
The deliberate failure project exited 1 as expected; cleanup verification passed.

Safe reports and exact resolved service image IDs are in:

- `artifacts/checkout-idempotency/magic-shop-checkout-idempotency-local-20a/`
- `artifacts/checkout-idempotency/magic-shop-checkout-idempotency-recorded-20b/`
- `artifacts/checkout-idempotency/magic-shop-checkout-idempotency-failure-20c/`
- `artifacts/checkout-idempotency/magic-shop-checkout-idempotency-recorded-20d/`

The preferred video is `video/idempotency.webm` under `magic-shop-checkout-idempotency-recorded-20d`. The first video (20b) was readable but matched project names as well as test names, allowing setup/cleanup noise to crowd out assertions. The viewer filter was narrowed and a new execution (20d) was recorded; no historical log playback was used. This third fresh execution also passed 21/21 and both gates, with the same database counts/revisions as 20b and verified project/recorder cleanup. It records a
**new execution's live safe output** in a no-network Chrome viewer, not a browser
checkout journey. Its profile/tmp volumes and recorder container are removed.
No application credentials or profiles are mounted into the viewer.

## Environment and pinned versions

Docker Engine/client 29.8.2; Compose v5.5.1; runner Node 24.19.0, Playwright
1.61.0, Ajv 8.20.0, ajv-formats 3.0.1, pg 8.23.1, pnpm 12.9.1. Installed
Chrome 155.0.8059.39 and Edge 154.0.4258.62 are retained; only Chrome's output
viewer is exercised here. No browser/Cucumber application matrix is claimed.

Pinned container bases retained:

- Runner Node 24.19.0 Bookworm: `sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df`.
- Node API/UI/bootstrap/loss intermediary 24.10.0 Bookworm: `sha256:b8d2197aff9129d16c801a3e3e1b2a873c4946480f5a310f38056df2268c38d9`.
- Keycloak 26.4.0: `sha256:5f3fb534cde6bf006d79f5912473e5d2c828c707cdfc52e16972803aca9d43dd`.
- PostgreSQL 16.15 Trixie: `sha256:65b16a8b326e0cfbdf33fa7e783f2a0cb352a61448616ccccfd616ef42aa0f65`.
- HAProxy 3.2.6: `sha256:7a5f2b4eac999e35d38b0c49040ec885ac2929c6b1a17fde0d1dc2fbcaf07c52`.
- Go builder 1.25.3 Bookworm: `sha256:4f43b271f9673eb7bd0cb3a49cc17b08d8d6ee110277e26dbacc93c43a5a7793`.
- UBI9 9.6 PKI/secret/Go runtime: `sha256:dec374e05cc13ebbc0975c9f521f3db6942d27f8ccdf06b180160490eef8bdbc`.
- Python UBI9 3.12 API/quality: `sha256:d3a5322122fd7efd5d5a2486c8c221f4785c364199f27e50a33aced417047e6a`.
- Playwright-pinned FFmpeg revision 1011 finalizes VP8 WebM, 1440×900 at 25 fps.

First passing runner and exact recorder image:
`sha256:2e73c383de69a84678976ba7f32f2fb35ecf667c7ee53ca2117894e06f8c5092`.
Second passing test runner:
`sha256:be5be1408c492e9b63c3176cb1a8664a1678ea4c9afe4d409d0e7c6c1445b7b3`.
The image build includes source; harness/docs changed between runs, packages did
not. Recording selects an immutable image ID before starting. Final preferred recording runner:
`sha256:36c0adc3e9e63cf3aa012c278f3f69e97e6e9ebce353b93b8c8db08bf2b2a7b5`;
its exact viewer image:
`sha256:4d40872e9cd455f6eb70160a5a5dbabab4c632f9da9bf093d06050c1b9d63c98`.
Every run saves
all seven service/runner IDs, Docker/Compose versions and observed runner runtime.

## Verification and limits

```sh
LAB_PROJECT=magic-shop-checkout-idempotency-config-check docker compose \
  -f infra/compose.yaml -f infra/checkout-idempotency.compose.yaml --profile '*' config --format json | \
  docker run --rm -i --platform linux/amd64 --network none --entrypoint node \
  --mount "type=bind,src=$PWD,target=/work,readonly" magic-shop-runner:03 /work/infra/check-architecture.mjs
docker run --rm --platform linux/amd64 --network none \
  --mount "type=bind,src=$PWD,target=/work,readonly" magic-shop-quality:15
git diff --exit-code -- apps packages services infra/haproxy infra/keycloak contracts pnpm-lock.yaml .github
git diff --check
```

All-profile resolved Compose/architecture checks passed across 176 source files.
The first configuration check omitted test profiles and correctly reported a
missing runner; adding `--profile '*'` supplied the full topology. No application
change was required. Containerized shell/JavaScript syntax checks and 107 local
documentation links passed. The existing pinned lizard 1.24.1 quality check passed
across 126 authored files/712 functions: maximum CCN 70 is an existing capped
transport-handler baseline, not a claim of global complexity ≤6. Thresholds remain
CCN ≤50/function NLOC ≤180 with two capped baseline exceptions. Representative
video frames were extracted in the container and visually reviewed. The preferred
recording is 67.00 seconds, VP8 WebM at 1440×900/25 fps, with the four TEST-08
assertions and gate/cleanup results readable in its final frame. The final safe
artifact scan passed all 48 entries; no project or recorder containers, networks
or volumes remain.

This proves bounded four/two-request races and one deliberately discarded
committed response for the current implementation. It does not prove general load
capacity, browser UI retry behavior, password login, real production outages,
server crash/durability behavior or native Linux execution. Existing mock browser
and TEST-02 native evidence remain separate. Native fault CI remains TEST-11;
TEST-04–07 and TEST-09–11 remain open. GitHub updates are deferred until local
work is complete. No app/security boundary was changed to make tests pass.
