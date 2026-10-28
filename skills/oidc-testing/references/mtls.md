# OIDC with mTLS

Read when certificates participate in OIDC login, OAuth client authentication, resource access, or proxy-to-service transport. First map each TLS termination point, trust root, presented certificate, identity mapping, and token owner. Server trust and client trust can use different CAs.

## Choose the contract

| Mechanism | Evidence required |
| --- | --- |
| Browser X.509 user login | Real authorization with matching callback state and PKCE, expected signed identity, no unintended password fallback; wrong/disabled/unmapped identity denied. |
| Gateway/service mTLS | Verified server name/chain and correct client trust; missing/wrong-trust client rejected on fresh connections; human certificate cannot bypass the gateway. |
| OAuth mTLS client authentication | Registered `tls_client_auth` or `self_signed_tls_client_auth`, actual token endpoint/`mtls_endpoint_aliases`, correct client ID/certificate accepted, wrong client certificate denied. A browser user certificate alone does not establish this. |
| RFC 8705 token binding | Independently verified JWT or trusted introspection contains `cnf.x5t#S256`; DER leaf SHA-256 matches the certificate; resource server rejects the same token with another certificate. |
| Application identity binding | Expected application claim matches the verified transport identity; another identity's certificate/token pair is rejected. This does not establish RFC 8705 thumbprint binding. |

Primary specification: [RFC 8705](https://www.rfc-editor.org/rfc/rfc8705.html), especially sections 2, 3, 5 and 6.5. Client authentication and token binding are independent. Certificate renewal with the same identity can preserve application identity binding while changing the RFC thumbprint.

## Build useful tests

Use the existing disposable PKI and fixture tooling. Generate additional leaves only when needed; keep private keys in owned private temporary storage, restrict permissions, and remove them on failure. Do not copy lab keys into the skill. Avoid minting generic certificates that do not match the provider's subject/SAN/EKU contract.

Start with a successful control on the exact endpoint. Change one boundary at a time:

- Valid transport + valid authorized token: success with expected identity/data.
- Missing certificate, wrong client CA, invalid validity window or revoked leaf: enforce the configured transport policy. Revocation needs a configured CRL/OCSP mechanism; expiration and revocation are separate tests.
- Correct client certificate + wrong server CA or hostname: client TLS verification fails.
- Valid transport + missing/invalid token: API authorization denies; valid token + different valid identity certificate: binding denies.
- Where RFC binding exists, use two independently valid leaves, preferably with the same mapped identity to distinguish identity matching from thumbprint matching. Check resource enforcement as well as the claim. For rotation, acquire a new bound token and confirm the old token fails with the new leaf according to the intended contract.
- Behind a proxy, attempt spoofed certificate identity headers and direct service access. Inspect which headers the edge replaces and which client CA the backend accepts.

Use a fresh context/connection per certificate to avoid TLS/session reuse. In Playwright configure `clientCertificates` for each exact origin (including port), keep `ignoreHTTPSErrors: false`, and trust the server CA in both browser and request runtimes. Certificate injection validates that route; native OS certificate selection needs its own browser test.

Assert the boundary's actual result: a TLS rejection is different from HTTP 401/403 or provider denial. DNS errors, timeouts, refused connections and generic socket resets cannot establish certificate rejection. Pair negatives with successful controls before and after; inspect server evidence when a runtime hides the TLS alert. Preserve issuer, audience, signature, state and PKCE checks.

## Reusable helpers

`scripts/mtls.mjs` exports:

- `probe({url, ca, cert?, key?, servername?, timeout?})`: fresh verified HTTPS GET, no redirects, body or credentials in its result. Returns `{kind:'http', status}`, `{kind:'tls-error'}` or `{kind:'network-error'}`. It cannot identify the precise rejecting server policy by itself. Use only safe readiness URLs; tokens are deliberately unsupported.
- `certificateThumbprint(pem)`: SHA-256 of DER leaf, base64url encoded.
- `assertCertificateBinding(verifiedClaims, pem)`: comparison only; accepts claims already verified by the application's verifier. It does not authenticate a JWT or establish resource-server enforcement.

Import via an absolute path resolved from the skill location; copy/mount the helper into the target runner when necessary. No third-party dependencies; Node with X509Certificate and AbortSignal.timeout support required. Test helpers using `node --test scripts/mtls.test.mjs` from the skill directory.

## Complete reference-repo workflow

In `testing-with-certs`, run from the repo root with Docker/Compose and the repository's build prerequisites:

```sh
LAB_PROJECT=magic-shop-mtls-UNIQUE sh testing/run-oidc-mtls.sh
```

Use a lowercase unique suffix. The script refuses existing project resources, builds/starts the real stack, runs the helper's verified transport checks in the container network, real Chrome certificate/PKCE login with signature/claim checks, and the existing API security suite. It tears down owned containers/volumes/networks and verifies absence, preserving test failure. Safe terminal output is the evidence; no credential-bearing response or recording is saved. Startup needs image/package access if images are not cached.

The transport helper probes shop 8443 with the customer certificate; the login targets auth 9443 and `shop-spa`. Security coverage includes valid API access, token/identity mismatch, invalid tokens, edge header spoofing and direct service bypass. This baseline selection is not the certificate-free federation lesson, native OS certificate selection, the full browser/runner matrix, RFC 8705 client authentication, or thumbprint binding. It does not add expiry/revocation/rotation acceptance. Consult existing leaf-failure/revocation suites when those are requested.

If interrupted outside handled signals, remove only the exact disposable project with `LAB_PROJECT=THE_SAME_NAME docker compose -f infra/compose.yaml --profile '*' down --volumes --remove-orphans`, then independently query project-labeled containers, networks and volumes. Do not remove the retained lab.


## RFC 8705 reference-repo acceptance

Append `rfc8705` to the same workflow command, using a fresh project name. This adds `infra/rfc8705.compose.yaml`, provisions a separately keyed, valid same-identity admin leaf through the private PKI, and runs `testing/rfc8705/binding.spec.mjs` with its credential-safe request-context configuration. The dedicated public client `shop-spa-rfc8705` requires Keycloak's `tls.client.certificate.bound.access.tokens=true`; this does not make it a confidential OAuth mTLS client.

The gateway replaces `X-Cert-Thumbprint` with SHA-256 of verified DER, encoded as standard base64; APIs trust it only from the authenticated gateway and compare with the signed canonical base64url `cnf.x5t#S256`. The dedicated client requires that claim, while any present binding on original-client user tokens is enforced too. Missing/malformed confirmation or mismatch fails with 401. Keep existing token/identity/role checks.

Require both leaves to obtain a signed, correctly bound token and reach all three APIs successfully. Cross-present each token with the other valid leaf and require 401, including spoofed gateway-identity/thumbprint headers. Repeat successful matching controls afterward. This isolates thumbprint enforcement from CN/user mapping and invalid transport credentials. The source workflow also checks missing-client rejection and reruns baseline security coverage. It runs three API-only checks and three recorded browser scenarios in each of real Chrome and Edge, on the VNC container’s Xvfb display. Browser authorization uses test-owned callback capture with the shop adapter suppressed, followed by private code exchange and real API navigation. This does not establish a new product-UI journey. Each channel runs the existing decoded-frame visual privacy probe. All executed browser scenarios retain per-page clips on pass and failure. API-only checks retain structured assertion evidence.

For interrupted RFC selection cleanup include both Compose files in `down --volumes --remove-orphans`; the base file alone does not describe the extra certificate volume. Consult `docs/completion/69-rfc8705-certificate-bound-tokens.md` for observed results. This selection does not test confidential-client authentication, refresh-token binding, revocation or a full federation/browser matrix.


The recorded RFC selection stores results in `artifacts/rfc8705/PROJECT/`: `index.html` for evidence, `matrix.html` for the existing Go video gallery, JSON/JUnit and private-data-free boundary assertions. Complete passing runs export `site/index.html` through the existing `matrix-site` operator, then verify links, filters and decoding/advancing playback for every clip in Chrome and Edge. Source revision plus a content digest for a dirty workspace, run/attempt metadata, privacy receipts and post-teardown cleanup evidence identify the run. Incomplete/failed runs retain available recordings and a failed local report without a passing portable export. See `docs/completion/70-rfc8705-recorded-vnc.md` for observed acceptance.

The live viewer is loopback-only at `http://localhost:6086/vnc.html` by default; `LAB_RFC8705_VIEWER_PORT` selects another port. Retrieve its generated password privately from the running `PROJECT-viewer` container; never copy it into reports. Both channels run sequentially using that name. `LAB_RFC8705_REPORT_DIR` must name the existing report directory when using the overlay directly for interruption recovery. The focused selection supports Playwright on Debian; do not claim Cucumber/UBI9 parity or native OS certificate selection.
