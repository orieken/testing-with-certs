# TEST-06/09 — Mokapi compatibility and real insights pagination faults

Local Docker Desktop experiment on macOS arm64, 2026-10-10 (America/Chicago);
UTC logs span 2026-10-11.
The Node/Playwright test runner and recording browser use linux/amd64 emulation;
Mokapi, the TLS wrapper and Python service use arm64 containers. This is not native
Linux-host or CI evidence. No app behavior, auth flow, client, gateway route,
PKCE, certificate identity or API authorization was changed. Only Python reporting
unit tests were extended in the application tree. The Saturday checkout was untouched.

## What is replaced and what the evidence means

Mokapi replaces **reporting page contents**, after the real Node provider validates
the real reporting client's signed token. Tests call the unchanged Python insights
HTTP API through the real gateway, using a real certificate-only administrator
PKCE login. Python still obtains its real Keycloak client-credentials token and
uses its service certificate with verified CA/hostname TLS to `customer-api`.

Only that dependency's DNS in the disposable insights container points to the
harness. A pinned Node TLS wrapper uses the disposable customer-api server leaf,
checks the insights service certificate identity, and forwards the incoming signed
token to real Node over verified service TLS for authorization. It then requests
a scripted response from Mokapi with **no token, cookie or certificate**. The
oracle uses a fixed first-page reporting query: it proves authorization for that
operation, not the validity of the scripted pagination cursor or page contents.

Mokapi has its own internal network, no real-service network, published ports,
certificate mounts or signing CA. Its dashboard, MCP, health endpoints, event
storage and handler tracking are disabled. Container logging is disabled in the
application harness. Keys, secrets, profiles and control data live in Docker
volumes. Authentication values live in request/process memory; no token/profile
is exported. Static keys from Mokapi's built-in CA are not trusted or used.

The canonical read-only customer bundle is copied to a volume derivative with
one reporting operation, a mock-only HTTP server address, removed operation
security and two declared test-control query parameters. Production bundles are
unchanged. The canonical response/request schemas remain intact. Three valid
page shapes pass existing Ajv before startup; compatibility responses are checked
again. `wrong-type` is explicitly invalid, and Ajv must reject it.

This proves the real consumer's bounded pagination/error/retry behavior under
scripted dependency data. It does not prove real Node pagination during a real
outage, a live-provider coverage matrix, native Linux support or a browser login
journey. Fault reports cannot satisfy the existing live-provider coverage gate.

## Exact commands

From the repository root, all builds, installation, provisioning and tests happen
inside containers. Independent projects get fresh certificate/database/state volumes.

```sh
LAB_PROJECT=magic-shop-mokapi-probe-23e ./testing/faults/reporting/compatibility.sh
LAB_PROJECT=magic-shop-reporting-fault-23d ./testing/faults/reporting/run.sh
LAB_PROJECT=magic-shop-reporting-fault-23f ./testing/faults/reporting/record.sh
```

The compatibility runner bounds its test command to 90 seconds. The full harness
uses 120-second startup waits, 5-second dependency deadlines, a 240-second test
command bound, and 60-second individual tests. Actual consumer bound cases assert
at most 30 seconds; ordinary faults assert at most 10 seconds. No product timeout
is relaxed. Recording has a 360-second deadline and no network; its browser
profile and temporary directory use disposable volumes.

## Observed results and expected oracles

- Bounded compatibility probe: **14/14** scripted page observations. Twelve valid
  responses pass Ajv, two deliberately invalid responses fail Ajv. The script
  produces page-one r1 then page-two r2, 409 or 503 as selected. Generation changes
  reset sequence index deterministically.
- Full consumer suite: **19/19** in project 23d, with an independent fresh repetition
  in 23f. Three public operations are exercised: sales, regional customers and
  regional orders. Page-one r1 followed by 409, r2, outage or a repeated cursor
  returns exactly canonical 409/503 error bodies, never an aggregate/page body.
  Each stops after two authorized dependency requests. Explicit fresh recovery
  returns two orders / one customer / 200 copper, with no retained partial rows.
- Empty page between two populated pages continues to page three for all three
  operations; the result remains two orders / one customer / 200 copper.
- Exactly 10,000 records succeed after 100 pages with 1,000,000 copper. An over-cap
  feed stops on page 101 with 503. Empty pages with changing cursors stop after the
  documented 101-iteration loop bound with 503. Both recover on a fresh request.
- TLS rejects absent clients, user-CA clients, wrong server CA and wrong hostname.
  A trusted but wrong service identity returns 403; missing token returns real
  Node's 401. Valid service credentials succeed. An invalid script response is
  delivered as 200 but independently rejected by Ajv; subsequent reset succeeds.
- Python image build: **11 unit/equivalence/security tests passed**, including
  empty-page continuation, partial-result rejection and independent record/page
  caps. Existing production Python source remained unchanged.
- Separate evidence gate checks 19 unique passed cases, canonical bundle digests,
  exact request counts, recovery, response statuses, elapsed bounds and TLS
  negatives. Mutation tests reject missing, duplicate, failed, wrong-provenance,
  wrong-schema, partial, retried, unbounded and weakened-TLS evidence.

The recording shows a **new execution's live output viewer**, labelled with the
real insights / mocked dependency boundary. It is not an application browser
journey. TEST-07's actual UI recordings remain separate.

## Pins and environment

- Mokapi **0.52.0**: `mokapi/mokapi:0.52.0@sha256:ba936c3c88db3f95674cbb7b7c790193de1a7e5b6f638efa6adcb89fc6f19be8`;
  arm64 resolved image `sha256:b07073052b6e19dfc1032f529d2a518163913ce793ba5ad02e913f61916369fa`.
- TLS wrapper Node **24.10.0**: `node:24.10.0-bookworm-slim@sha256:b8d2197aff9129d16c801a3e3e1b2a873c4946480f5a310f38056df2268c38d9`.
- Python/quality base: `registry.access.redhat.com/ubi9/python-312@sha256:d3a5322122fd7efd5d5a2486c8c221f4785c364199f27e50a33aced417047e6a`;
  exact service dependencies remain pinned in `services/insights-api/requirements.txt`.
- Runner Node **24.19.0**, Playwright **1.61.0**, Ajv **8.20.0**, pg **8.23.1**;
  Debian 12, kernel **7.0.14-linuxkit**. Recording Chrome **155.0.8059.39**;
  Edge **154.0.4258.62** is installed but no new Edge journey is claimed.
- Docker **29.8.2**, Compose **v5.5.1**. Exact resolved service image IDs and runtime
  metadata are in each project's `images.txt`, `environment.json`,
  `docker-version.json`, `compose-version.txt`. Canonical bundle hashes are in
  `results.json`. Pinned CLI version/help are saved by the compatibility project.

## Capability sources, limitations and failed setup attempts

Primary pinned documentation was read before choosing the scripting/TLS boundary:
[Mokapi event handler](https://github.com/marle3003/mokapi/blob/v0.52.0/docs/javascript-api/mokapi/eventhandler/httpeventhandler.md),
[response data/body](https://github.com/marle3003/mokapi/blob/v0.52.0/docs/javascript-api/mokapi/eventhandler/httpresponse.md),
[handler tracking](https://github.com/marle3003/mokapi/blob/v0.52.0/docs/javascript-api/mokapi/eventhandler/eventargs.md),
[TLS and built-in CA](https://github.com/marle3003/mokapi/blob/v0.52.0/docs/http/tls.md).
The pinned executable's help confirms the selected flags. No general OpenAPI 3.1
feature-equivalence claim is made: selected reporting pages/errors were tested.
A scripted invalid payload can bypass response schema validity, so Ajv is required.
The verified TLS wrapper also preserves the real signed-token authorization oracle;
native Mokapi application certificate/token enforcement is not claimed.

23a hit a default response-generation deadline and was stopped. A seeded minimal
valid response avoids expensive default generation without changing its schema.
23b exposed a generated script reference error (`profile` instead of `customer`),
which caused fallback mock responses; it is not counted as passing evidence.
A bounded credential-free probe identified and corrected the script. Raw failure
diagnostics were not exported. 23a's temporary diagnostic process held the state
volume during cleanup; it was stopped and that sole remaining volume was explicitly
removed. 23b and the successful independent projects use normal cleanup. No stale
volume or old log was adopted to obtain passing results.

See [copyable commands and boundary explanation](../../testing/faults/reporting/README.md).

## Final verification and artifacts

```sh
LAB_PROJECT=magic-shop-reporting-fault-23g REPORTING_FORCE_FAILURE=1 ./testing/faults/reporting/run.sh
LAB_PROJECT=magic-shop-reporting-fault-23h REPORTING_FORCE_FAILURE=post-tests ./testing/faults/reporting/run.sh
LAB_PROJECT=magic-shop-mokapi-probe-23i ./testing/faults/reporting/compatibility.sh
docker run --rm --platform linux/amd64 --network none \
  --mount type=bind,src="$PWD",dst=/work,readonly magic-shop-quality:15
docker run --rm --platform linux/amd64 --network none --entrypoint node \
  --mount type=bind,src="$PWD",dst=/work,readonly magic-shop-runner:03 \
  /work/testing/container/check-artifacts.mjs /work/artifacts/reporting-faults
docker run --rm --platform linux/amd64 --network none --entrypoint sh \
  --mount type=bind,src="$PWD",dst=/repo,readonly magic-shop-runner:03 \
  -c 'for f in /repo/testing/faults/reporting/*.mjs; do node --check "$f" || exit; done; sh -n /repo/testing/faults/reporting/run.sh /repo/testing/faults/reporting/record.sh /repo/testing/faults/reporting/compatibility.sh'
docker compose -f infra/compose.yaml --profile '*' config --format json | \
  docker run --rm -i --platform linux/amd64 --network none --entrypoint node \
  --mount type=bind,src="$PWD",dst=/work,readonly magic-shop-runner:03 \
  /work/infra/check-architecture.mjs
```

23g intentionally exited 1 after authenticated-stack provisioning and cleaned
all resources. 23h repeated **19/19** plus both mutation controls, the strengthened
evidence gate and artifact scan after small harness function refactoring, then
intentionally exited 1 after the tested phases. Its cleanup also verified all
resources gone. Neither intentional failure is counted as a successful wrapper.
23i repeated **14/14** compatibility observations and exited 0 with explicit
container/network/volume cleanup. Successful 23d and recorded 23f both exited 0.
Recorder profile and temporary volumes were removed; resource queries found no
remaining reporting/probe containers, volumes or networks.

The architecture guard passed over 209 source files. The standalone overlay was
separately checked for private networks, isolated credential-free Mokapi, disabled
dashboards/MCP/events/logging, PKI-only signing state and no published mock ports.
Local documentation links and JavaScript/shell syntax passed in no-network
containers. Lizard 1.24.1 inspected 56 new runtime functions: all CCN ≤6 and
function NLOC ≤30. The whole-repository quality check retains its existing two
capped transport-handler exceptions; it does not claim every legacy function
is below six.

Recorded runner image: `sha256:5b74eab2314d333e8bcd8d44920aa01d72cd707b605c2c1f044ac4c2528ecdbb`.
23f's freshly built test-runner image: `sha256:887e2be14f3b6aa30c5a9390cbd702775ea90a3d4e18ec64a61415bb97077257`.
Its Python insights image: `sha256:b386775ff92350c336cf95f6e11317a822841bdf46b496cb1a26d650ac208b77`.
The recorded browser remains attached to its immutable starting image while the
container wrapper builds the fresh test image. Both runtime metadata and every
resolved service image are recorded; mutable local image tags are not version
evidence on their own.

The safe reports are under `artifacts/reporting-faults/`. The recording is
`magic-shop-reporting-fault-23f/video/reporting.webm`. A frame extracted with
FFmpeg revision 1011 (`-sseof -3 -frames:v 1`) was visually reviewed: the visible
label identifies the output viewer, mock boundary, assertions and successful
cleanup. The file is VP8 WebM, 1440×900, 25 fps. No recording is replayed as a new
test result.

The previous local work was committed/pushed as `ef3207e` before starting these
items. This note records the subsequent local TEST-06/09 work; no deployment, PR,
publication or manual CI dispatch was performed.

Final whole-repository quality result: 151 authored files / 870 functions, passing
existing limits with the two pre-existing capped exceptions. Final whole-report
safe artifact scan passed **55 entries**, including failed setup reports and
review media; their failure statuses remain explicit. Final syntax and clean-diff
checks passed. The protected application, canonical contract, authentication,
gateway and CI source diffs are empty relative to the pushed `ef3207e` baseline.
