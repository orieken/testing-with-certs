# TEST-05 — Bounded Prism compatibility experiment

Observed 2026-10-10 (America/Chicago), macOS arm64 Docker Desktop, linux/amd64
containers under emulation. All builds, PKI, provisioning and tests ran in
containers; no host runtime/package installation or trust changes. Local branch
baseline remains `fc706f1`. No Saturday checkout, product change, GitHub update,
commit/push, deployment or publication occurred. This extends completion 16's
bounded mock experiment without changing its historical claims.

## Decision and evidence boundary

**Prism is used only as a private mock**, not on authenticated real-provider
routes. This experiment verified selected canonical OpenAPI 3.1/2020-12 examples,
request validation, response validation and upstream TLS behavior. It did **not**
forward a client certificate to the synthetic mTLS upstream. Default warning
mode lets an invalid 200 through. A real upstream 501 becomes a canonical mock
200. Neither that proxy success nor mock security metadata is provider evidence.
No real credentials or app APIs are connected to this project.

The source canonical bundles stay read-only/unchanged. Seventeen valid named
response fixtures and a canonical checkout request pass existing strict Ajv
8.20.0/ajv-formats 3.0.1 before preparing volume-held catalog/customer/insights
derivatives. Only derivative security metadata is removed; path, parameter,
request/response schema and header semantics remain. `FAULT_*` data is separate,
explicitly invalid and never added as a normal Prism example. Ajv rejects wrong
types, tuple length/position/type and invalid date data; malformed JSON and size
faults have specific rejection checks. Oversized data is syntactically valid JSON,
so a JSON parse error cannot falsely satisfy the size test.

The synthetic upstream uses an atomic volume-held control file. It supports
normal HTTP, verified HTTPS and required synthetic mTLS on separate private ports.
Its audit stores only counts and whether authorization/cookie headers appeared.
The test adapter fronts fixed Prism destinations with verified synthetic mTLS;
its backend is credential-free HTTP on a separate internal mock network. A marker
request proves bearer/cookie stripping. This is not end-to-end TLS, certificate
passthrough or production authorization. Signing CA state is mounted only into
no-network PKI. Private keys, test state and profiles stay in disposable volumes.
There are no published ports, dashboards or request logs (`logging: none`, Prism
silent, single-process mode). Ordinary application routing/clients/flows remain.

Primary references verified: [Prism 5.14.2 mocking guide](https://raw.githubusercontent.com/stoplightio/prism/v5.14.2/docs/guides/01-mocking.md),
[validation proxy guide](https://github.com/stoplightio/prism/blob/master/docs/guides/03-validation-proxy.md),
[proxy CLI behavior](https://github.com/stoplightio/prism/blob/master/docs/getting-started/03-cli.md),
[pinned shared CLI options](https://raw.githubusercontent.com/stoplightio/prism/v5.14.2/packages/cli/src/commands/sharedOptions.ts).
Pinned-image `--version`/`proxy --help` were also executed; their exact output is
saved with the final report. The live experiment, not assumptions about a later
release, determines the decision.

## Exact observed commands

From the repository root:

```sh
docker run --rm --platform linux/amd64 --network none \
  stoplight/prism:5.14.2@sha256:87972b6cf73da2c0339fca18f362b6f93118152d652c970fab93ed13cfd55bae --version
docker run --rm --platform linux/amd64 --network none \
  stoplight/prism:5.14.2@sha256:87972b6cf73da2c0339fca18f362b6f93118152d652c970fab93ed13cfd55bae proxy --help
LAB_PROJECT=cert-prism-compatibility-21c ./testing/prism/run.sh compatibility
LAB_PROJECT=cert-prism-final-22e ./testing/prism/run.sh all
```

21c passed 23 initial observations and safe export/cleanup. The combined final
project adds tuple positions/types, calendar validity and credential stripping
for **27 observations** and its mandatory TEST-05 gate, before TEST-07. Each is
an independent fresh project with new certificate/control/profile volumes. The
wrapper's consumer phase has a 180-second overall deadline, bounded TLS/HTTP
requests, a 60-second service-start bound and project cleanup assertions.

Proxy invocations are exactly specified in `testing/prism/compose.yaml`: fixed
read-only derivative document + synthetic upstream URL, `-h 0.0.0.0 --multiprocess
false -v silent`; enforcing variants add `--errors`. The HTTPS variant mounts only
the public server CA via `NODE_EXTRA_CA_CERTS`. Wrong-CA has no added trust;
wrong-hostname uses the same synthetic host via a name absent from the leaf SAN;
mTLS requires the synthetic customer leaf, available to the direct verifier but
not configured/forwarded by Prism.

## Observed compatibility matrix

| Probe | Observed result | Meaning |
| --- | --- | --- |
| Populated/empty catalog; GeoJSON tuple; UTC sales fixture | Exact named 200 body, strict Ajv accepts | Selected positive examples work |
| Canonical structured 403 and checkout 409/422/503 | Exact selected status/body, Ajv accepts | Mock business errors work with valid request/header |
| Create item 201 | Canonical body and required Location, Ajv accepts | Header example retained |
| Archive 204 | Empty body, Ajv accepts | Bodyless response works |
| `limit=0` | Canonical 400 | Mock request constraints enforced |
| Invalid POST through enforcing proxy | 422, zero upstream calls | Request rejected before forwarding |
| Wrong-type response, warning proxy | 200 + `sl-violations` on `priceCopper`, Ajv rejects | Default proxy mode does not protect consumer from invalid data |
| Wrong-type response, enforcing proxy | 500 + response/type violation | `--errors` rejects this response |
| Three-element coordinate tuple | 500 + maxItems/items response violations | Tuple length enforced |
| Latitude 91 at coordinate position 1 | 500 + maximum violation at position 1 | Position-specific bound enforced |
| String at coordinate position 0 | 500 + type violation at position 0 | Position-specific type enforced |
| Non-UTC date suffix | 500 + `Z$` pattern violation | Canonical UTC constraint enforced |
| February 30 | 500 + date-time format violation | Calendar-invalid date rejected |
| Missing required Location | 500 + response/header required violation | Header enforcement works |
| Upstream 501 with Prefer empty/200 | Canonical mocked empty 200 | Mock fallback masks unimplemented upstream behavior |
| Correct upstream HTTPS CA/hostname | Canonical 200, one upstream call | TLS verification succeeds with explicit public CA |
| Wrong CA or hostname | 500, zero upstream calls | Verification fails closed |
| Prism → mTLS upstream | 500, zero authorized upstream calls | CLI experiment did not forward customer certificate |
| Direct verified mTLS upstream | 200; absent client rejected | Upstream itself requires a valid client, not a broken TLS fixture |
| Adapter negative controls | Missing client/wrong CA/hostname rejected | Synthetic HTTPS front is verified |
| Synthetic bearer/cookie marker | Neither observed by upstream | Adapter strips credentials before private mock hop |

The enforcing 500/422 problem responses belong to Prism, not the app's canonical
business Error schema. These selected findings do not prove every JSON Schema
keyword, dynamic generation, production proxy configuration or a programmable
Prism library TLS implementation. No TLS bypass, real routing change or mock
provider pass was used to close this item.

## Pins and environment

- Prism 5.14.2 image: `stoplight/prism:5.14.2@sha256:87972b6cf73da2c0339fca18f362b6f93118152d652c970fab93ed13cfd55bae`, platform linux/amd64; resolved image ID `sha256:7bc9b7013b9af7aa65673e2c808405eda034f1693fb9edfb93fb9fef20ca7824`.
- Node adapter/upstream and unchanged UI build: 24.10.0 Bookworm `sha256:b8d2197aff9129d16c801a3e3e1b2a873c4946480f5a310f38056df2268c38d9`.
- PKI UBI9 9.6: `sha256:dec374e05cc13ebbc0975c9f521f3db6942d27f8ccdf06b180160490eef8bdbc`.
- Existing runner Node 24.19.0 Bookworm: `sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df`; immutable local base `sha256:36c0adc3e9e63cf3aa012c278f3f69e97e6e9ebce353b93b8c8db08bf2b2a7b5`.
- Final derived runner: `sha256:cad0f31d6fa586bef0cec70308c4fa0946f4fb28653bf731e021ff1c11d7871f`.
- Docker 29.8.2, Compose v5.5.1, Debian 12 runner, linux/x64, LinuxKit 7.0.14-linuxkit on macOS arm64. No new native-host evidence.
- Playwright 1.61.0, Ajv 8.20.0, ajv-formats 3.0.1, pnpm 12.9.1 (frozen lock); installed Chrome 155.0.8059.39 and Edge 154.0.4258.62.

Exact reports/digests/versions/help/image IDs are under
`artifacts/prism/cert-prism-compatibility-21c/` and
`artifacts/prism/cert-prism-final-22e/`. The latter also holds the separate browser
suite described in [completion 22](22-prism-browser-failures.md).

## Setup corrections and limits

21a stopped because the experiment's checkout request omitted the canonical
required idempotency header; Prism correctly selected 422 instead of requested
409. The test request/adapter allowlist was corrected, not the contract. 21b
completed its 21-observation experiment but its final scanner rejected `/reports`
as outside the approved artifact root. The wrapper now mounts safe reports under
`/work/artifacts/prism` for scanning. Both failed projects cleaned up. No product
change or security weakening was needed.

The final acceptance is the reproducible report, explicit mock-only decision,
verified synthetic TLS boundaries and safe cleanup. Real Keycloak/HAProxy/API
verification, certificate/account pairing, actual provider errors/outages and
native CI are outside this evidence. GitHub changes remain deferred.

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
