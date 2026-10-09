# 01 — Certificate-login feasibility

Date: 2026-10-05; runtime continuation 2026-10-06. **Apple Silicon emulation and
human viewer login pass; native Linux amd64 remains unverified.** The authentication
path is proved for the local emulated stack, but the cross-platform exit gate is open.
No earlier completion notes existed.

## Changes

- Read the requested architecture, workflows, authentication, Saturday package,
  test-plan and API-contract documents, plus source inventory and TODO. Inspected
  Saturday's UBI9 certificate example, helper source, magic-shop package/auth store
  and locations view. Copied documents were treated as reference material.
- Authored `spikes/certificate-login`: digest-pinned Compose candidates, non-root
  browser runner, UBI9 PKI issuer, three trust domains, isolated credential volumes,
  HAProxy shop termination at 8443 and independent auth passthrough at 9443.
- Added Keycloak 26.4.0 realm import with synthetic customer/admin/revocation fixtures,
  a sole REQUIRED X509 browser execution, no cookie/password alternative, PKCE S256,
  protected `cert_identity`, explicit audience and a two-minute access-token lifetime.
- Added a small HTTPS landing app and identity endpoint. The endpoint verifies
  the gateway service certificate, signed access-token issuer/audience/algorithm,
  token type and certificate identity equality. Domain comparison is separate from
  TLS/JWT/HTTP adapters. There are no list/database queries in the spike API.
- Added exact-origin Playwright context fixtures using the installed Saturday helper,
  shared Saturday site/page/element/flow interactions, Playwright and Cucumber
  entrypoints, native NSS import/policy scripts, and a loopback-only password-protected
  noVNC candidate. Manual HOME is ephemeral and receives one selected identity.
- Added positive/negative browser and transport tests, including mismatched saved
  cookies, mismatched token/header spoofing, unknown user, user/service CA separation,
  hostname failure, and independent auth-origin revocation tests.
- Added compatibility/dependency records and explicit spike overlays to architecture
  and workflows during implementation. Full-stack diagrams for service tokens,
  regional reporting, both runners, lifecycle and three-language OpenAPI services
  remain planned. No full UI migration was attempted.

## Initial attempt: environment and results

| Check | Actual result |
| --- | --- |
| Host / Docker | macOS arm64; Docker Desktop Engine 29.8.0; Compose 5.5.1; server aarch64 |
| Native amd64 platform | unavailable; only default and desktop-linux contexts configured |
| UBI9 browser dependency probe | verified UBI9 repositories lacked Xvfb and xdg-utils; exit 1 |
| Initial Debian candidate build | failed; Docker filesystem 59 GiB, 56 GiB used, 0 available, 100% full |
| Signature diagnosis | both amd64 and arm64 apt failed on full disk; same signed metadata succeeded using tmpfs |
| Browser metadata | Chrome 154.0.8037.97-1, Edge 154.0.4258.62-1; 310-package closure pinned; both branded binaries launched later |
| Image inspection | Keycloak reports RHEL 9.6; HAProxy reports Debian 13/trixie |
| Saturday registry | core 0.1.3 / Playwright 0.1.1 / Cucumber 0.1.1 available; cert helper returned 404 |
| Certificate helper fallback | built/packed inside container, installed into spike; repeat pack reproduced SHA-256 |
| TypeScript | strict checks passed |
| Unit behavior | 4 identity-boundary tests passed; domain module 100% lines/branches/functions/statements |
| Playwright collection | 31 tests discovered across Chrome, Edge and browserless transport; not executed against the stack |
| Cucumber dry-run | 1 scenario / 3 steps bound and skipped as expected; warns Node 24 is not tested by Cucumber 11.3 |
| PKI tmpfs check | issue + initial CRL accepted leaf; revoked leaf rejected with OpenSSL error 23; customer still valid; shop hostname valid |
| Dependency audit | initial high/critical findings fixed; final 9 findings: 1 low, 8 moderate, 0 high, 0 critical |
| Browser/native/manual/Keycloak acceptance | see runtime continuation below; disk blocker cleared |

Coverage denominator is only `src/domain/identity.ts`. UI/adapter coverage, complete
complexity enforcement and full runtime quality gates are **not** established.
Test collection, dry-runs, package resolution and offline CRL verification are not
substitutes for the exit criteria.

Evidence lives under `spikes/certificate-login/evidence/`: signed metadata and
package plan, disk/signature diagnosis, source checks, PKI checks, npm audit, package
packing/reproducibility, and pinned Keycloak help. No private keys, tokens, browser
profiles, storage states or certificate bundles are in those records.

## Exact significant commands executed

All package installation, compilation, certificate operations and tests used Docker.
The following commands were run from `spikes/certificate-login` unless stated otherwise.
Reads and source edits used the host's ordinary file tools; no host language runtime
or certificate utility was used.

```sh
docker version
docker context ls
docker info --format '{{json .}}'
docker image ls --format '{{.Repository}}:{{.Tag}} {{.ID}}'
docker run --rm --platform linux/amd64 registry.access.redhat.com/ubi9/ubi:9.6 dnf --setopt=timeout=20 --setopt=retries=1 list available nss-tools xorg-x11-server-Xvfb gtk3 mesa-libgbm xdg-utils nodejs
docker run --rm --platform linux/amd64 registry.access.redhat.com/ubi9/ubi:9.6 dnf --setopt=timeout=20 --setopt=retries=1 install -y xorg-x11-server-Xvfb xdg-utils
docker pull quay.io/keycloak/keycloak:26.4.0
docker pull haproxy:3.2.6-bookworm
docker pull haproxy:3.2.6
docker system df
```

`haproxy:3.2.6-bookworm` does not exist; the official 3.2.6 tag was resolved to its
recorded digest. The initial experimental browser resolver was invoked with:

```sh
docker build --platform linux/amd64 -f container/Resolve.Dockerfile -t certificate-spike-resolver:01 . > evidence/package-resolution.log 2>&1
```

It failed at disk exhaustion. That exploratory resolver was removed; the final
`Runner.Dockerfile` consumes the exact apt lock rather than resolving floating packages.
The successful metadata-only replacement was:

```sh
docker run --rm --platform linux/amd64 --tmpfs /tmp --tmpfs /var/lib/apt/lists --tmpfs /var/cache/apt -v "$PWD/container:/scripts:ro" -v "$PWD/evidence:/output" node:24.10.0-bookworm-slim sh /scripts/resolve-metadata.sh > evidence/metadata-resolution.log 2>&1
```

Container dependency commands included:

```sh
docker run --rm -v "$PWD:/work" -w /work -e PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 node:24.10.0-bookworm-slim npm install --ignore-scripts --fetch-timeout=30000 --fetch-retries=1
docker run --rm --platform linux/arm64 --tmpfs /root/.npm -v "$PWD:/work" -w /work -e PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 node:24.10.0-bookworm-slim npm install --ignore-scripts --save-exact @cucumber/cucumber@11.3.0 vitest@3.2.7 @vitest/coverage-v8@3.2.7 tsup@8.5.1 --fetch-timeout=30000 --fetch-retries=1
docker run --rm --platform linux/arm64 --tmpfs /tmp --tmpfs /root/.npm -v "$PWD:/work" -v /Users/oscarrieken/Projects/Rieken/saturday-monorepo:/source:ro -v "$PWD/vendor:/output" -w /work node:24.10.0-bookworm-slim sh container/pack-saturday.sh > evidence/saturday-pack.log 2>&1
docker run --rm --platform linux/arm64 --tmpfs /root/.npm -v "$PWD:/work" -w /work -e PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 node:24.10.0-bookworm-slim npm install --ignore-scripts --save-exact ./vendor/orieken-saturday-playwright-certs-0.1.0.tgz --fetch-timeout=30000 --fetch-retries=1
docker run --rm --platform linux/arm64 --tmpfs /root/.npm -v "$PWD:/work" -w /work node:24.10.0-bookworm-slim sh -c 'npm run typecheck && npm run unit && npm exec playwright test -- --list && npm run bdd -- --dry-run' > evidence/source-checks.log 2>&1
docker compose config --quiet
```

Offline certificate test (the final `pki/verify.sh` extracts the same executed check):

```sh
docker run --rm --platform linux/amd64 --network none --user 1000:1000 --tmpfs /state:uid=1000,gid=1000,mode=700 --tmpfs /public:uid=1000,gid=1000 --tmpfs /gateway:uid=1000,gid=1000 --tmpfs /keycloak:uid=1000,gid=1000 --tmpfs /landing:uid=1000,gid=1000 --tmpfs /fixtures:uid=1000,gid=1000 --tmpfs /manual-customer:uid=1000,gid=1000 --tmpfs /manual-admin:uid=1000,gid=1000 -v "$PWD/pki:/work:ro" registry.access.redhat.com/ubi9/ubi:9.6 bash -c 'set -eu; bash /work/issue.sh; openssl verify -CAfile /public/user-ca.pem -CRLfile /public/user.crl.pem -crl_check /state/revocable.crt; bash /work/issue.sh revoke; if openssl verify -CAfile /public/user-ca.pem -CRLfile /public/user.crl.pem -crl_check /state/revocable.crt; then exit 1; fi; openssl verify -CAfile /public/user-ca.pem -CRLfile /public/user.crl.pem -crl_check /state/customer.crt; openssl verify -CAfile /public/server-ca.pem -verify_hostname shop.magic.test /state/shop.crt' > evidence/pki-check.log 2>&1
```

## Decisions and source-backed constraints

- UBI9 package availability justified the supported Bookworm runner. The later
  successful browser build and runtime result is recorded below. UBI9 remains PKI;
  Keycloak's base is RHEL9.
- Keycloak file DB, official HAProxy image and a single Node landing/identity adapter
  are bounded spike choices. PostgreSQL, three business languages, their OpenAPI
  contracts and live Playwright contract tests remain requirements for later prompts.
- Keycloak trusts the user CA only. Adding service CA trust later requires separate
  human-flow issuer enforcement. A service-CN collision fixture tests this boundary.
- CRL publication restarts HAProxy and Keycloak to drain connections and clear the
  pinned Keycloak CRL cache. Fresh-connection denial and a 29.79-second operation
  were observed on Apple Silicon emulation; native amd64 remains unverified.
  Existing JWTs still have a residual 120-second lifetime.
- Playwright 1.61 context certificates use a local TLS proxy. Real mapped upstream
  origins retain certificate and hostname verification; browser-to-proxy trust is
  internally relaxed by Playwright. No authored TLS-bypass flags or disabled
  verification settings were introduced. Native-store checks are separate evidence.
- Saturday source HEAD was `b5d3b1e45e4e45ffd0384958c9159298ae4395ca`, but the certificate
  package is untracked in that working tree. HEAD alone cannot reconstruct it.
  Exact working-tree input hashes and the retained reproducible distribution tarball
  are therefore the dependency evidence. No claim that the source exists in HEAD.
- Code/security review found and corrected healthcheck protocol mismatch, missing
  manual/revocation environment forwarding, generated coverage inclusion and missing
  independent auth-listener negative tests. Accessibility review at this slice is
  limited to semantic heading/button/status output; browser interaction remains untested.

## Limitations and next dependency

The Docker VM was full during the initial attempt, then recovered before the runtime
continuation. No shared cache, unrelated image/container/volume or Saturday file was
removed or modified by this task. No commit, package publication or deployment occurred.
Host trust is untouched.

The local checks below establish the emulated path. Native Linux amd64 and a human
viewer interaction remain to be observed. The remote amd64 Docker-context and
SSH-forwarded viewer workflow is documented in the spike README but unexecuted.
Keep the combined platform TODO box open.

Final issuer hardening: verified `/usr/bin/flock` in the pinned UBI9 base and added a
non-blocking exclusive issuer lock. Re-ran the offline check through the extracted
script after that change:

```sh
docker run --rm --platform linux/amd64 --network none --user 1000:1000 --tmpfs /state:uid=1000,gid=1000,mode=700 --tmpfs /public:uid=1000,gid=1000 --tmpfs /gateway:uid=1000,gid=1000 --tmpfs /keycloak:uid=1000,gid=1000 --tmpfs /landing:uid=1000,gid=1000 --tmpfs /fixtures:uid=1000,gid=1000 --tmpfs /manual-customer:uid=1000,gid=1000 --tmpfs /manual-admin:uid=1000,gid=1000 -v "$PWD/pki:/work:ro" registry.access.redhat.com/ubi9/ubi:9.6 bash /work/verify.sh > evidence/pki-check.log 2>&1
```

## Runtime continuation: 2026-10-06

The recovered Docker VM built all spike images and brought Keycloak, HAProxy and
the landing app to healthy state on macOS arm64 with amd64 emulation. The actual
runner reported Node 24.10.0, Chrome 154.0.8037.97 and Edge 154.0.4258.62.
Keycloak is 26.4.0. The runner UID/GID is 1000; no host trust was changed.

The initial runtime uncovered two build defects. Compose's service `platform` did
not select the amd64 build stage; `build.platforms: [linux/amd64]` fixed that.
Keycloak required `https-client-auth=request` at build time; its optimized server
then started. The landing browser bundle originally left `keycloak-js` unresolved;
pinning esbuild 0.27.7 and bundling the app fixed it. These implementation changes
are reflected in the architecture/workflow overlays, not in the planned full stack.

| Check | Observed result |
| --- | --- |
| Playwright before revocation | 27/31 after first assertion correction; remaining four expected the rejected auth URL to remain visible instead of Chrome's internal network-error page. Corrected auth-origin negatives passed 4/4. Pre-revocation dedicated leaf was accepted at both boundaries. |
| Playwright after revocation | 31/31 passed in 1.1 minutes with the final baked test image, including both browser channels and five browserless transport checks. |
| Customer/admin PKCE | Both users logged in with real Chrome and Edge; no password input. Token `preferred_username` and immutable `cert_identity` matched the selected leaf; `/api/identity` returned the corresponding role. |
| Saved admin cookie plus customer leaf | Keycloak denied the stale session and issued no token. The old admin token was rejected by the identity endpoint with 403; a fresh customer session then received the customer identity claim. |
| Native certificate store | Customer and admin passed in both Chrome and Edge, each with an ephemeral NSS import and brand-specific managed certificate-selection policy. |
| Manual viewer transport | `manual` container ran; noVNC returned HTTP 200 and Compose published only `127.0.0.1:6080`. A later human session completed customer login; see follow-up below. |
| Negative TLS/auth | Missing and untrusted user certificates, wrong hostname, missing auth-origin certificate, unknown mapped user and issuer collision were rejected. Removing runner server trust failed at both exact origins. Browser command lines contained no TLS-bypass flag. |
| CRL | Dedicated leaf accepted before revoke. `./lab revoke` published CRL and restarted HAProxy/Keycloak in 29.79 s; fresh shop and auth attempts were denied, and 3/3 focused revocation tests passed. Already issued JWTs retain up to 120 s lifetime. |
| Both test runners | Cucumber: one scenario and three steps passed in each branded channel. Strict TypeScript and four domain tests passed, with 100% coverage of that one module. |
| Platform | Apple Silicon amd64 emulation passed. Only local Docker contexts exist; native Linux amd64 is unavailable and unverified. |
| Dependency audit | Current npm audit: 10 findings (1 low, 7 moderate, 2 critical). The critical advisories are in Vitest/tinypool dev tooling. Major-version updates need a separately tested pin; no silent upgrade was made. |

Significant continuation commands, from `spikes/certificate-login`:

```sh
docker compose build tests
./lab build
./lab up
./lab unit
./lab test
LAB_BROWSER=chrome ./lab cucumber
LAB_BROWSER=msedge ./lab cucumber
LAB_USER=customer LAB_BROWSER=chrome ./lab native
LAB_USER=admin LAB_BROWSER=chrome ./lab native
LAB_USER=customer LAB_BROWSER=msedge ./lab native
LAB_USER=admin LAB_BROWSER=msedge ./lab native
./lab no-trust
LAB_USER=customer LAB_BROWSER=chrome ./lab manual
docker compose ps --format json manual
docker compose exec -T manual node -e "fetch('http://127.0.0.1:6080/vnc.html',{signal:AbortSignal.timeout(5000)}).then(r=>{console.log(r.status);process.exit(r.ok?0:1)}).catch(e=>{console.error(e.message);process.exit(1)})"
/usr/bin/time -p ./lab revoke
EXPECT_REVOKED=true ./lab test
docker run --rm --platform linux/amd64 -v "$PWD:/work" -w /work node:24.10.0-bookworm-slim npm audit --json
```

For targeted corrective runs, `docker compose run --rm -v "$PWD/tests:/work/tests:ro"
tests npm test -- --grep 'independent Keycloak (untrusted|collision) boundary'`
passed 4/4, and the same form with `EXPECT_REVOKED=true` and grep for
`independent Keycloak revocable boundary|dedicated certificate lifecycle` passed
3/3. The final full run used the rebuilt image without a test-source bind mount.

Raw failed-run browser logs included generated OIDC URL parameters and were removed.
Only safe result counts, package/version records and non-secret logs are retained in
`evidence`. The Docker filesystem had 4.1 GiB free (59 GiB total, 93% used) after
the builds; the macOS host had 43 GiB free. This was sufficient for the spike but
is tight for the full stack. Native amd64 is the next external evidence dependency. The planned
three-language business services and OpenAPI-backed contract suite remain subsequent
prompts, not implied by this thin slice.

The native-platform follow-up checked `docker context ls` and
`docker info --format 'OSType={{.OSType}} Architecture={{.Architecture}} OperatingSystem={{.OperatingSystem}}'`
again. Only the local `default` and `desktop-linux` contexts are configured, and the
selected engine reports Linux `aarch64` on Docker Desktop. The safe output is in
`evidence/native-platform-check.log`. There is no native Linux amd64 Docker target to
run the matrix against, so the platform checkbox remains open. The documented remote
Docker-context workflow is ready when a host is available; no credentials or host
certificate material were requested or copied into this repository.

The manual-viewer follow-up recreated the `manual` container with `LAB_USER=customer`
and `LAB_BROWSER=chrome`, then opened `http://127.0.0.1:6080/vnc.html` locally. The
viewer connected to remote Chrome and displayed the landing page. The user clicked
**Sign in with certificate** and confirmed **Authenticated: customer**; the visible
page also showed the `customer` role. There was no password input in the shop or
Keycloak flow. The ephemeral noVNC password was used only for the local viewer
connection and was not copied into the repository or completion evidence. The
human-viewer TODO entry is complete; native Linux amd64 remains open.
