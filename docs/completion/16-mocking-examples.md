# FEATURE-01–03: isolated dependency replacement examples

Observed 2026-10-09 (America/Chicago), working in
`/Users/oscarrieken/Projects/Rieken/testing-with-certs`, source baseline `1c9970c`.
The user explicitly prioritized these three examples before TEST-01–11 and the
product backlog. All three acceptance criteria are complete for the standalone
consumers. No full-stack, real-login, live-provider or native Linux run is claimed.

## Scope and environment

Read the current feature prompts, scenario checklist/audit, docs README,
architecture, workflows, authentication, API contracts, test plan and relevant
completion 11/12/15 notes before implementation. Pre-existing work consisted of
modified `docs/README.md` and `docs/TODO.md` plus untracked scenario audit/checklist;
that work was retained. Only `spikes/mock-auth/` and documentation were edited.

Host: macOS **26.6.2 (25G83), arm64**. Docker Desktop **4.94.0 (241994)**,
Engine **29.8.2**, Compose **v5.5.1**, `desktop-linux` engine **linux/aarch64**.
Node consumer and NAV OIDC images ran linux/arm64; Prism ran **linux/amd64 under
Apple Silicon emulation**. This is Docker Desktop evidence, not native Linux CI.
No host runtime installed dependencies, generated certificates, built code or ran tests.

| Component | Exact pin |
| --- | --- |
| Consumer base | `node:24.10.0-bookworm-slim@sha256:b8d2197aff9129d16c801a3e3e1b2a873c4946480f5a310f38056df2268c38d9` |
| PKI base | `registry.access.redhat.com/ubi9/ubi:9.6@sha256:dec374e05cc13ebbc0975c9f521f3db6942d27f8ccdf06b180160490eef8bdbc` |
| OIDC mock | `ghcr.io/navikt/mock-oauth2-server:6.0.4@sha256:47374fe063995d9b6d39ebb6ea21eb5f765025bf0aa08b61b08b439eb91adaf0` |
| Prism | `stoplight/prism:5.14.2@sha256:87972b6cf73da2c0339fca18f362b6f93118152d652c970fab93ed13cfd55bae`, `linux/amd64` |
| Package manager / validator | pnpm **12.9.1**, frozen existing lockfile; Ajv **8.20.0**, ajv-formats **3.0.1** |
| Contract checks | Redocly **2.58.1**, openapi-typescript **7.13.0**, TypeScript **5.9.3**, Playwright **1.61.0** |
| Observed PKI executable | OpenSSL **3.2.2 4 Jun 2024**, from the pinned UBI image |

The final tested local consumer image was `cert-mock-consumer:01`,
`sha256:c18a7aee6912a2c72e36c1061385c15cd941a94a2021f93e958960eb73476878`.
It is built from the above pinned base and repository lockfile, not a published image.
Documentation-only edits may change a subsequent local image ID.

Primary tool documentation checked:
[NAV 6.0.4 README](https://github.com/navikt/mock-oauth2-server/blob/6.0.4/README.md)
for discovery, issuer-specific JWKS, client credentials, claim/expiry callbacks
and native TLS keystores;
[NAV releases](https://github.com/navikt/mock-oauth2-server/releases/tag/6.0.4);
[Prism 5.14.2 mocking guide](https://github.com/stoplightio/prism/blob/v5.14.2/docs/guides/01-mocking.md)
for named examples, response selection and request validation. Advertised
capabilities were not counted as executed scenarios.

## Exact commands

The host invoked Docker and the orchestration shell. Every consumer invocation
builds in a container, creates fresh named volumes and private internal networks,
then removes and checks only its own generated project.

Image resolution (including the exploratory tag attempts):

```sh
docker version
docker images --format '{{.Repository}}:{{.Tag}}'
docker pull ghcr.io/navikt/mock-oauth2-server:3.1.4
docker pull ghcr.io/navikt/mock-oauth2-server:2.1.10
docker pull stoplight/prism:5.14.2
docker pull ghcr.io/navikt/mock-oauth2-server:6.0.4
```

The README's illustrative 3.1.4 tag returned `manifest unknown`. The older
2.1.10 pull succeeded but was never used for tests; primary release inspection
selected 6.0.4 instead. Its digest and Prism's digest are pinned in Compose.

Implemented and ran the features in order:

```sh
./spikes/mock-auth/run.sh jwt
./spikes/mock-auth/run.sh oidc
./spikes/mock-auth/run.sh api
./spikes/mock-auth/run.sh all > /tmp/cert-mock-all-1.log 2>&1
./spikes/mock-auth/run.sh all > /tmp/cert-mock-all-2.log 2>&1
MOCK_FORCE_FAILURE=1 ./spikes/mock-auth/run.sh all > /tmp/cert-mock-failure.log 2>&1
./spikes/mock-auth/run.sh all > /tmp/cert-mock-final-1.log 2>&1
```

Development reruns corrected these observed failures: pnpm rejected the
`--fetch-retries` option; the OIDC image's default UID could not read its volume
keystore (now explicitly UID 1000); missing client secret returned 401;
expiry verification initially used the other issuer's JWKS; unsupported grants
returned `invalid_grant`; the canonical item path is `{itemId}`. Each failed
project was removed by the same cleanup trap. A pnpm script preflight tried to
read an unnecessary local tarball, warned, then passed six tests; the final build
calls the installed locked binaries directly and has no such preflight warning.
None of these failures was resolved by disabling verification or changing app configuration.

Final functional source, two independent reset runs plus a deliberately failing
container with all servers running:

```sh
./spikes/mock-auth/run.sh all > /tmp/cert-mock-verified-1.log 2>&1
./spikes/mock-auth/run.sh all > /tmp/cert-mock-verified-2.log 2>&1
MOCK_FORCE_FAILURE=1 ./spikes/mock-auth/run.sh all > /tmp/cert-mock-verified-failure.log 2>&1
```

The first two exited **0**; the last exited **1**, as expected. Project IDs:
`cert-mock-1791602667-73943`, `cert-mock-1791602685-74119`,
`cert-mock-1791602703-73866`. Every run printed `Cleanup verified` after checking
that no project-labelled containers, volumes or networks remained.

Commands executed inside each non-cached consumer build:

```sh
contracts/node_modules/.bin/redocly lint contracts/openapi/catalog.yaml contracts/openapi/customer.yaml contracts/openapi/insights.yaml --extends spec
PATH="/work/contracts/node_modules/.bin:$PATH" node infra/contracts-tooling.mjs check
contracts/node_modules/.bin/tsc --noEmit -p contracts/tsconfig.json
LAB_SECURITY_RUN=1 testing/node_modules/.bin/playwright test -c testing/playwright.config.ts --project=contracts-validator
/bin/sh -n spikes/mock-auth/run.sh
for source in spikes/mock-auth/*.mjs; do node --check "$source"; done
```

All passed: three canonical specifications linted; three bundles, generated
TypeScript declarations and digests matched; contract types compiled;
**six existing validator tests passed** (including tuple/UTC constraints,
headers/204, malformed errors and one-byte drift); new script syntax checks passed.
These are offline harness checks, not provider observations.

Export and credential scan:

```sh
mkdir -p artifacts/mock-consumers
cp /tmp/cert-mock-verified-1.log artifacts/mock-consumers/reset-1.txt
cp /tmp/cert-mock-verified-2.log artifacts/mock-consumers/reset-2.txt
cp /tmp/cert-mock-verified-failure.log artifacts/mock-consumers/failing-cleanup.txt
docker run --rm --network none --entrypoint node \
  --mount type=bind,src="$PWD/testing/container/check-artifacts.mjs",target=/scan.mjs,readonly \
  --mount type=bind,src="$PWD/artifacts/mock-consumers",target=/work/artifacts/mock-consumers,readonly \
  cert-mock-consumer:01 /scan.mjs /work/artifacts/mock-consumers
```

Observed: **Safe artifact scan passed (3 entries)**. Reports are gitignored local
text evidence, separately named `MOCK-CONSUMER`; no live coverage manifest or
provider report was written. The scanner's existing patterns and size/count
bounds apply; it is not a proof against every possible secret encoding.

Environment and unchanged-source checks:

```sh
sw_vers
docker compose version
docker info --format '{{.OSType}}/{{.Architecture}}'
docker image inspect cert-mock-consumer:01 --format '{{.Id}} {{.Os}}/{{.Architecture}}'
docker run --rm --network none registry.access.redhat.com/ubi9/ubi:9.6@sha256:dec374e05cc13ebbc0975c9f521f3db6942d27f8ccdf06b180160490eef8bdbc openssl version
git diff --exit-code -- apps services infra packages contracts testing pnpm-lock.yaml package.json
```

The last command exited 0 with no changes. No Saturday checkout, publication,
deployment, app flow, Keycloak client, gateway route, PKCE behavior, certificate
identity comparison or API authorization code was modified.

## Observed acceptance and bounded compatibility decision

**FEATURE-01:** Ephemeral RSA-2048/RS256 key and volume-held synthetic tokens.
Valid claims accepted; correctly signed expired and wrong-audience tokens rejected
for expiry/audience; a flipped signature byte rejected for signature. **4/4**.
The standalone verifier does not authenticate a user or prove real verifier equivalence.

**FEATURE-02:** Native HTTPS discovery had the exact issuer; token/JWKS endpoints
matched its origin; signed client-credentials tokens verified with issuer-specific
keys. Ten negative cases passed: wrong audience, issuer, signature, no matching
key, signed expiry, missing secret (401 `invalid_client`), unsupported grant
(400 `invalid_grant`), wrong CA, wrong hostname and refused connection on the
mock hostname's unopened port. A fresh valid request then succeeded. The secret
is randomly generated inside the consumer and kept in its volume; the mock does
not establish authenticity of that client secret. No real user login, browser,
PKCE, password/certificate flow, refresh or revocation was exercised.

**FEATURE-03:** Seven normal catalog fixtures passed the existing strict Ajv
validator: populated/empty 200, structured 400/403/404, created item with required
Location, and empty 204. The labelled `FAULT_wrong_type` fixture had to fail Ajv.
Prism returned exact selected examples; `limit=0` returned a schema-valid 400;
201 Location and bodyless 204 matched the canonical contract. Consumer error
handling cleared previous success and recovered on a fresh request. The explicit
800-ms adapter delay exceeded the 250-ms consumer deadline, rejecting at **252 ms**
and **261 ms** in the final reset runs; the failing-cleanup run also completed
these assertions before its intentional failure. Malformed price data was rejected,
left no stale value, and a fresh normal request recovered.

Decision: **Prism mock-only**, behind a test-local verified-TLS/fault adapter.
The fixed adapter-to-Prism hop uses credential-free HTTP on a separate internal
network; this is a documented wrapper boundary, not end-to-end TLS. No upstream
real service is configurable. Authorization/cookie headers are stripped, and no
authentication is injected. CA and hostname negatives passed at both native OIDC
and the API adapter. Both networks are internal and no port is published.

Prism's selected canonical OpenAPI 3.1 examples/request behavior is compatible
with this bounded lesson. Prism generation/validation of all 2020-12 tuple/date
features, validation-proxy enforcement, automatic upstream-501 mocking and
client-certificate forwarding **remain untested**. The passing offline Ajv
checks cannot establish those Prism capabilities. TEST-05 remains open; Mokapi
was unnecessary and TEST-06 remains open. No broader backlog prerequisite was
required to complete these standalone teaching examples.

CA/signing secrets, leaves and persisted tokens stay in disposable Docker volumes;
the mock's ephemeral signing state stays in its process, with JVM temporary files
on container-local tmpfs. No profiles are created. Server request logs are disabled.
Cleanup was observed after success and intentional failure; signal traps are
implemented but cancellation/SIGKILL/daemon-failure cleanup was not experimentally
verified. The printed-project recovery command is documented in the example README.

The [copyable learner guide](../../spikes/mock-auth/README.md) explains the dependency,
proof and non-proof for each example and diagrams the separate trust boundary.
FEATURE-01–03 and their actually observed shared criteria are checked. TEST-01–11,
product expansion, native CI, browser and real-provider criteria remain open.

## Recorded fresh reruns, 2026-10-09 (America/Chicago)

The original browserless executions saved text, not video. At the user's request,
added `spikes/mock-auth/record.sh` and `record.mjs`, then **reran actual tests** while
recording their live output in Chrome. These videos are output-viewer recordings,
not application journeys or playback of previous reports. Normal build noise is
filtered in the viewer; untouched transcripts sit beside the videos. No tests,
application authentication or mock assertions were replaced for recording.

```sh
./spikes/mock-auth/record.sh all > /tmp/cert-mock-video.log 2>&1
./spikes/mock-auth/record.sh all > /tmp/cert-mock-video-final.log 2>&1
```

The first visual inspection found long build output obscured JWT's final lines.
Added automatic scroll-to-end and recorded a second fresh set. Final artifacts:
`artifacts/mock-consumers/videos/20261010T033234Z-77627/`.
All three test commands and recorder processes exited 0:

| Recording | Duration | Observed run |
| --- | --- | --- |
| `jwt/jwt.webm` | 11.32 seconds | 4/4 JWT assertions; six validator tests; cleanup `cert-mock-1791603157-77756` |
| `oidc/oidc.webm` | 8.52 seconds | Discovery/JWKS/token, ten negatives and recovery; cleanup `cert-mock-1791603173-77889` |
| `api/api.webm` | 20.92 seconds | Ajv fixtures, Prism responses, errors, delay rejected at 256 ms, invalid data and recovery; six validator tests; cleanup `cert-mock-1791603186-78019` |

Recorder: existing local `magic-shop-runner:03`, pinned for each invocation to
`sha256:2e5bf243f0730f9a83e9e00a616b2bd66eb322c68a0d1b448a4613034c1ab0b2`.
Observed Node **24.19.0**, Chrome **155.0.8059.39**, Playwright **1.61.0**; recorder
ran linux/amd64 under Apple Silicon emulation, with `--network none`. Chrome is
only the output viewer. Its HOME and temporary profiles live in two disposable
Docker volumes. Both volumes and its container were verified absent afterward.
No application certificate, key, client secret, real token or trust volume was
mounted into the recorder. Videos are silent 1440×900 VP8 WebM at 25 fps.

Container verification and extraction of final frames:

```sh
docker run --rm --platform linux/amd64 --network none --entrypoint sh \
  --mount type=bind,src="$PWD/artifacts/mock-consumers/videos/20261010T033234Z-77627",target=/recordings \
  magic-shop-runner:03 -c 'for mode in jwt oidc api; do /opt/ms-playwright/ffmpeg-1011/ffmpeg-linux -hide_banner -sseof -1 -i /recordings/$mode/$mode.webm -frames:v 1 -update 1 /recordings/$mode/final.png; done'
docker run --rm --network none --entrypoint node \
  --mount type=bind,src="$PWD/testing/container/check-artifacts.mjs",target=/scan.mjs,readonly \
  --mount type=bind,src="$PWD/artifacts/mock-consumers/videos/20261010T033234Z-77627",target=/work/artifacts/mock-videos,readonly \
  cert-mock-consumer:01 /scan.mjs /work/artifacts/mock-videos
docker volume ls -q --filter name=cert-mock-video-20261010T033234Z-77627
docker ps -a --filter name=cert-mock-video-20261010T033234Z-77627 --format '{{.Names}}'
```

All videos decoded; inspected final frames show passing summaries and cleanup.
Credential scan passed **21 entries**; its content patterns inspect text reports,
not binary video pixels. The recorder renders only the scanned execution output
and fixed teaching labels. Final volume/container queries returned no results.
[Playwright's video documentation](https://playwright.dev/docs/videos) describes
the context video lifecycle used here. No real-login/provider or native Linux
evidence is inferred from these recordings.
