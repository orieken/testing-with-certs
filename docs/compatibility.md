# Certificate-login feasibility

Status: Apple Silicon emulation passed the browser/authentication thin slice,
including a human viewer login. GitHub Actions passed native Linux static,
contract, security and real-browser matrix checks on its second run. The
workflow remained red because report upload could not read one Cucumber
telemetry file; a permission fix was made. A third run crashed in Node HTTP/2
during Cucumber, so the pinned runner update awaits a native rerun. Manual viewer/operator native
paths are separate and remain unverified.

## Full-stack Prompt 12 platform update (2026-10-08 baseline; 2026-10-09 CI continuation)

| Check | Apple Silicon Docker Desktop, linux/amd64 emulation | Native Linux amd64 GitHub CI |
| --- | --- | --- |
| Static container build, strict types, package/unit checks, OpenAPI lint and generated drift | Passed in pinned Node 24.10.0 Bookworm CI image | First three pushes passed static, spike, service-build and Compose architecture jobs |
| Three live OpenAPI providers and 23-operation/92-status inventory | 17 live Playwright tests and full coverage gate passed in disposable `magic-shop-ci-local-12` | Second run passed live Playwright contract/coverage gate |
| Security and eight browser/runner/identity selections | 12 security tests; real Chrome/Edge × Playwright Test/Cucumber × customer/admin passed | Second run passed live security and all eight real-browser selections |
| Browser binaries in the runner | Historical Chrome 154.0.8037.97 and Edge 154.0.4258.62; refreshed Chrome 155.0.8059.39 and Edge 154.0.4258.62 passed local real-browser teaching smoke | Second run built and recorded refreshed real Chrome and Edge |
| Clean new-volume and repeated startup | Disposable `magic-shop-repeat-12` created then retained realm and database marker on repeat; DB TLS/isolation and PKI/CRLs re-verified | Isolated stack startup and realm bootstrap passed; repeat startup unverified |
| Report boundary | Local credential scan passed; CI upload is limited to text JUnit/Cucumber/coverage data | Second run scan passed but upload failed on mode `0600` Cucumber telemetry; third run crashed during browser matrix before upload |

The initial source commit establishes a baseline. An actual PR base-contract comparison has not run because the triggers were pushes, and a literal clean-clone/repeat-startup check remains open. The current Compose viewer click-through passed for admin Edge and customer Chrome on Apple Silicon. The runner uses pinned amd64 Bookworm for actual branded browsers; UBI9 remains the PKI, Go runtime and Python base. The [native CI continuation](completion/12-native-linux-ci.md) records both GitHub runs and fixes; earlier full-stack commands are in [completion note 12](completion/12-ci-handoff.md).

## Environment and candidates

Observed host: macOS arm64, Docker Desktop Engine 29.8.0, Compose 5.5.1;
Docker server reports aarch64. Only local desktop/default contexts are configured.
No separate native Linux amd64 Docker context exists locally. GitHub Actions is now the native Linux verification path; its first run is partial.

The 2026-10-09 context recheck found only `default` and `desktop-linux`; both `docker info` and `docker --context default info` report `linux aarch64 docker-desktop`. No native amd64 engine was available locally. The two current Compose manual-viewer selections were human-confirmed on Apple Silicon emulation after this table's original Prompt 12 run.

- UBI9 9.6 digest `sha256:dec374e05cc13ebbc0975c9f521f3db6942d27f8ccdf06b180160490eef8bdbc`;
  base provides OpenSSL 3.2.2-6.el9_5.1. Verified UBI repositories cannot resolve
  `xorg-x11-server-Xvfb` or `xdg-utils`. No unsigned CentOS overlay or dependency
  bypass was used. Retain UBI9 for PKI; evaluate Debian Bookworm for the browser runner.
- Node 24.10.0 Bookworm slim index digest
  `sha256:b8d2197aff9129d16c801a3e3e1b2a873c4946480f5a310f38056df2268c38d9`
  remains the spike and application base. The candidate browser runner uses
  Node 24.19.0 Bookworm slim index digest
  `sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df`.
- Keycloak 26.4.0 index digest
  `sha256:5f3fb534cde6bf006d79f5912473e5d2c828c707cdfc52e16972803aca9d43dd`.
- HAProxy 3.2.6 index digest
  `sha256:7a5f2b4eac999e35d38b0c49040ec885ac2929c6b1a17fde0d1dc2fbcaf07c52`.
- Playwright/Test 1.61.0; original spike Cucumber 11.3.0, current
  full-stack runner Cucumber 12.9.0; Saturday core 0.1.3,
  Playwright 0.1.1, Cucumber 0.1.1, certificate helper 0.1.0 packed locally.

Initial browser package resolution failed when Docker storage reached 100%
(0 bytes available on a 59 GiB filesystem). Apt reported invalid signatures on
both amd64 and arm64; this is not evidence of browser emulation failure. Package
verification remains enabled. In-memory signed metadata resolution subsequently
succeeded: Chrome 154.0.8037.97-1 and Edge 154.0.4258.62-1, with 310 packages pinned
in `container/apt.lock`. After capacity became available, both branded binaries
launched in the amd64 Bookworm runner under Apple Silicon emulation. Chrome reported
154.0.8037.97 and Edge reported 154.0.4258.62 at runtime.

Inspection of the pinned Keycloak image reports RHEL 9.6; the HAProxy image reports
Debian 13 (trixie). The official HAProxy image is a bounded spike packaging choice,
not proof that a UBI9 HAProxy build is impossible. No full-stack base choices changed.

## Pinned Playwright feature boundary

Installed 1.61.0 declarations and implementation support `clientCertificates` on
browser contexts and API request contexts with exact origin matching including ports.
The existing Saturday peer floor >=1.40 does not establish these capabilities:
[Playwright introduced client certificates in 1.46](https://playwright.dev/docs/release-notes#version-146).

Important implementation detail: 1.61.0 implements context certificates through a
local TLS proxy and internally relaxes the browser-to-proxy certificate check.
Its upstream connection uses Node TLS with `rejectUnauthorized=true` when
`ignoreHTTPSErrors` is false. The lab sets neither TLS-bypass flags nor
`ignoreHTTPSErrors=true`; both mapped real origins must pass upstream validation.
An upstream TLS error can render a Playwright-generated 503 diagnostic instead of
throwing a navigation error. Native-store tests must separately establish browser
server trust without that proxy. Never describe context tests alone as native trust proof.

## Runtime matrix

| Capability | Apple Silicon amd64 emulation | Native Linux amd64 |
| --- | --- | --- |
| Branded Chrome / Edge binaries | passed; exact binary path, version and no TLS-bypass flags checked | unavailable |
| PKCE + customer/admin identity | passed in both browsers; token claim and API identity checked | unavailable |
| Mismatched cookies / token pairing | passed: saved admin cookie denied with customer leaf; fresh customer token maps to customer; gateway/API rejects old admin token | unavailable |
| Missing/untrusted/unknown certificate | passed in both browsers and raw TLS checks | unavailable |
| Exact origins and hostname checks | passed; both HTTPS origins validated, wrong hostname and missing auth-origin certificate rejected | unavailable |
| Native stores / policies / manual viewer | all four user/browser native-store logins passed; a human clicked Sign in with certificate through loopback noVNC and remote Chrome displayed Authenticated: customer with customer role | unavailable |
| Initial CRL and fresh-connection revocation | initial CRL present; dedicated leaf accepted before and rejected after publication/restart at shop and auth; 29.79 s operation | unavailable |

## Observed checks

- UBI9 OpenSSL issued isolated leaves and an initial CRL in container tmpfs. The
  dedicated leaf passed before revocation, failed with error 23 after publication,
  while the customer leaf still passed. Shop server hostname validation passed.
  This is offline cryptographic evidence, not HAProxy/Keycloak rejection evidence.
- Strict TypeScript checks passed. Four identity-boundary unit tests passed with
  100% coverage of `src/domain/identity.ts` (the sole domain module). Adapter/UI
  coverage and the inherited overall quality gates remain incomplete.
- Playwright discovered the browser and independent transport cases. Cucumber
  dry-run validates bindings only; no browser login result is inferred from it.
- Static code/security review corrected readiness protocol, manual identity and
  revocation environment forwarding, generated-file exclusion, and added separate
  auth-origin negative tests.
- The complete post-revocation Playwright suite passed 31/31. Before revocation,
  the dedicated leaf passed the shop and auth checks. Separate corrected auth-origin
  negatives passed 4/4. Cucumber passed one scenario and three steps in each branded
  browser. Strict TypeScript and four identity-domain tests passed again.
- The native store imported one selected PKCS#12 into an ephemeral NSS database and
  loaded a separate managed auto-selection policy for Chrome and Edge. Customer and
  admin login passed in both. Through the loopback-only noVNC viewer, a human clicked
  the certificate sign-in button in remote Chrome; the page displayed the customer
  identity and role without password entry.
- Removing the runner's private server-CA trust caused validated TLS requests to
  fail at both exact origins. The wrong server hostname failed. No authored browser
  TLS bypass flag or `ignoreHTTPSErrors` setting was used.

Docker space later recovered without this task deleting another project's cache,
images or volumes. macOS host had 43 GiB free during the final run; the Docker
filesystem had 4.1 GiB free after the image builds (59 GiB total, 93% used). The
[remote amd64 instructions](../spikes/certificate-login/README.md#remote-native-amd64-docker-context)
are prepared and unexecuted. Native Linux amd64 evidence remains a separate gate.
The current npm audit reports ten dev-tool findings, including two critical in
Vitest/tinypool; pinned updates require compatibility testing before adoption.

Regional reporting, the three business APIs and their OpenAPI contracts remain
future work. The spike identity endpoint is not a fourth business service.

## Prompt 03 Compose runner promotion (2026-10-06)

The same pinned Chrome `154.0.8037.97-1`, Edge `154.0.4258.62-1`, Node
`24.10.0`, and Playwright `1.61.0` now build in
`testing/container/Runner.Containerfile` as an explicitly `linux/amd64`
Compose image under Apple Silicon Docker emulation. Both actual branded
browsers passed exact shop/auth origin transport smoke tests with the selected
user certificate and strict server validation. A separate manual profile
started native Chrome/customer and Edge/admin desktops; the latter's fresh
NSS store did not contain the former's user certificate. The manual viewer
published only on loopback. This is Prompt 03 transport and native-store
evidence, not a new full Keycloak login result for this Compose project.
Prompt 04 subsequently proved direct Chrome/customer and Edge/shop-admin PKCE login against the Compose realm. Both tokens had the expected protected certificate identity, role, audiences and a verified signature. Disabled, unknown and revoked users, a service certificate, and mismatched saved cookies received no human authorization code. The shop rejected a revoked certificate on a fresh verified TLS connection after CRL publication and reload. Native Linux amd64 remains unverified. The Compose viewer's human checks were completed later, after the integrated UI and operator were built.

The final Prompt 04 native-store check also passed real Chrome/customer and Edge/admin in headed persistent profiles using imported PKCS#12 certificates and brand-specific policies, with no Playwright context certificate option. The Compose noVNC viewer displayed its selected Chrome shop page; the static preview has no clickable Keycloak sign-in control yet. A second isolated CRL run measured 45 seconds from publication completion to fresh shop TLS rejection after reload and health checks. Keycloak denied a new code with the same revoked certificate, but that denial was not separately timed against the 60-second target.

## Prompt 10 manual desktop (2026-10-08)

The same pinned amd64 runner image became healthy under Apple Silicon Docker Desktop emulation in customer Chrome and admin Edge manual modes. Both had only the selected native NSS identity, public server trust, and exact-origin brand policy. A fresh-container switch removed the prior HOME/profile, and a mismatched selected user and mounted certificate failed closed. Headed native-store Vue sign-in/sign-out passed for each role without Playwright auth-state injection. The loopback noVNC listener required a per-session VNC password. In the isolated authentication project, a renewed customer leaf completed fresh Chrome PKCE login; after its revocation and TLS consumer reload, a new shop handshake and Keycloak authorization failed. The user later confirmed `shop-admin` in the current Edge viewer and `customer-waterdeep` in the recreated Chrome viewer. Native Linux amd64 and a remote tunnel remain unverified. See [completion 10](completion/10-manual-browser.md).

## Prompt 11 teaching increment (2026-10-08)

The pinned amd64 runner passed shared Saturday Playwright Test and Cucumber customer/admin examples in both Chrome and Edge under local Apple Silicon emulation. Package-backed Playwright contexts now record local WebM files; Cucumber emits JSON/JUnit and bounded scenario telemetry. The browserless OpenAPI gate passed 17 tests and all 23 required operation/status entries; five focused TLS/identity-boundary checks passed. The independently packed local package consumer passed after the fixture change. The full negative and parallel-worker matrix, native Linux amd64 and remote Docker-context tunnel remain unverified. See [completion 11](completion/11-teaching-suite.md).

## Early Prompt 09 Vue authentication increment (2026-10-06)

The Vue shell now has the certificate sign-in control that was absent during Prompt 04. In the retained Apple Silicon Docker project, real Chrome/customer and Edge/shop-admin each completed the UI-initiated PKCE flow, displayed the selected role, sent a catalog-audience bearer token to the existing 503 placeholder, kept tokens out of local/session storage and returned to the signed-out shell after logout. Both channels also passed the same UI click path using native NSS certificate installation and brand-specific managed policies, without Playwright context certificates. Chrome rejected the disabled seed user. A separate customer-to-admin browser-state test showed the preview cart stays scoped to the signed-in subject. `keycloak-js` 26.2.4 is pinned in the workspace lockfile. Native Linux amd64 validation was later skipped by the user; no Linux result is claimed.
