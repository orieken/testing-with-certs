# Certificate authentication and browser operation

See [Mermaid workflows](workflows.md) for visual walkthroughs of provisioning, login, service authentication, manual browsing and certificate renewal/revocation.

## Issuance versus authentication

Keycloak's X.509 feature authenticates a certificate holder and maps that identity to a user. Treat the local certificate authority as the issuer; do not design a nonexistent general-purpose Keycloak user-certificate download endpoint. Keycloak realm signing certificates are also distinct from users' client certificates. See the [Keycloak X.509 guide](https://www.keycloak.org/docs/latest/server_admin/#_x509).

The lab presents one operator workflow: select or provision a Keycloak user, issue their client certificate, install it into the runner, and open the shop. Initially this is a containerized operator CLI, not a public enrollment web service. A future enrollment portal can wrap that workflow with independent identity proof and approvals.

## Provisioning sequence

1. `pki-init` establishes separate user-client, service-client, and server certificate trust domains and initial revocation lists. Use distinct trust anchors for the three purposes in the first lab to avoid accidental cross-trust. All CA private keys remain in a PKI-only volume.
2. Issue server certificates with exact SANs for HAProxy, Keycloak, UI, APIs, and PostgreSQL; issue service-client leaves with explicit identities and clientAuth usage. Bootstrap can operate using server trust plus an operator credential; it does not need a preexisting human user certificate.
3. Start PostgreSQL and Keycloak, then run an idempotent bootstrap job through the internal auth route to create the realm, clients, roles, and users.
4. Assign each user a stable opaque `cert_identity` attribute. Provisioning enforces uniqueness, and ordinary users cannot edit it. A UUID is preferable to display names or email addresses.
5. Generate a unique user key and certificate whose CN contains that stable identifier; set clientAuth EKU and issuer constraints. Keycloak's X.509 flow extracts CN and matches the protected attribute. This is the initial mapping to prove in the spike.
6. Write PEM certificate/key and a PKCS#12 bundle for the selected identity to a narrowly scoped volume. Pass bundle passwords using mounted secret files, never command-line logs. Store public serial/fingerprint/expiry metadata separately.
7. Install only the selected user's identity into a fresh manual browser home; load the server trust anchor. Automated workers use selected PEM files through Playwright's `clientCertificates` API.

Use a short, configurable lab validity period (initial proposal: seven days); fixture certificates supply expired, not-yet-valid, revoked, unknown-user, and wrong-issuer cases. Renewal reuses the stable identity but rotates the key/serial. Persist CA state and serial counters; serialize issuer writes. Repeated ordinary startup must not silently rotate keys or recreate the realm.

## Browser login

1. A browser with a valid user certificate connects to `https://shop.magic.test:8443`. HAProxy requires a certificate from the user CA and checks validity/revocation before serving the UI shell.
2. Vue starts OIDC Authorization Code with PKCE S256 against `https://auth.magic.test:9443`. Configure one public SPA client, exact redirect URIs and allowed origin, no embedded client secret, and no direct password grant.
3. HAProxy's auth listener tunnels TLS directly to Keycloak. Keycloak receives the browser certificate itself; no forwarded certificate HTTP header is involved. This follows Keycloak's [passthrough recommendation](https://www.keycloak.org/server/reverseproxy).

4. Keycloak maps the certificate to the enabled user and issues authorization results. Configure a client-specific certificate-required browser flow, without a password alternative or a cookie-only bypass of the identity check. Identity confirmation can be skipped if supported by the pinned version; a confirmation screen is acceptable, a required password is not.
5. The Vue shell now exchanges the authorization code using PKCE through pinned `keycloak-js` 26.2.4. It initializes the adapter before the router, holds access/refresh tokens in memory and clears the callback URL; the old localStorage bearer-token implementation is gone. [Adapter guidance](https://www.keycloak.org/securing-apps/javascript-adapter)
6. Signed-in catalog, customer and insights requests carry the selected user's access token. Each provider verifies its signature, issuer, own audience, lifetime, role and pairing with the gateway's certificate identity before returning business data. The UI clears identity and previously loaded item data on refresh failure/expiry, and returns to a signed-out shop shell after Keycloak logout using the exact registered post-logout redirect.

Automated Playwright Test and Cucumber browser launches now ask real Chrome and
Edge to use HTTP/1.1 via `--disable-http2`. Playwright 1.61.0's context-certificate
proxy contains a Node HTTP/2 server path, and native CI twice crashed in that
path. This is a candidate for the intermittent crash, pending a full native
rerun. It changes neither HTTPS validation nor the selected client certificate.
Manual native-store Chrome and Edge do not use this launch option. A prior
Keycloak-side HTTP/2 change did not prevent the crash and was removed.

Keycloak's HTTPS listener may request rather than universally require a client certificate so discovery/JWKS and confidential-client flows work. Its listener may trust both user and service client CAs, but the shop's login flow must additionally require the user CA and a valid user mapping. A service certificate with a colliding CN must never map to a human user. Verify the chosen listener trust configuration and all flow paths in prompt 01.

A trusted but unmapped user certificate can pass the shop's TLS gate and load a non-sensitive shell, but must fail Keycloak authentication and never obtain application data. Likewise, a disabled user can pass TLS yet fail login. Browser transport errors for missing/untrusted certificates may occur before any application page exists; tests must assert at the appropriate layer.

Logout ends tokens/session but does not uninstall a certificate. Returning to login can authenticate again using the installed certificate. Changing user therefore creates a fresh browser profile/container rather than merely calling logout. No cookie or storageState may turn user A's certificate session into user B's session. The preview cart is now keyed by signed-in subject and cleared from view on logout; it is not an authentication store.

## Separate certificate + password teaching view

`https://shop.magic.test:8443/teaching/certificate-password` uses the separate public
`certificate-password-spa` client and exact `/teaching/certificate-password/callback`.
The `certificate-password-browser` flow has REQUIRED X.509 followed by REQUIRED
`auth-password-form`; it has no cookie execution, username form or alternative.
Keycloak selects the protected certificate-mapped account, then collects and verifies
that account's password on the auth origin. Vue never collects or submits passwords.
PKCE S256, auth TLS passthrough, both exact origins and memory-held tokens remain.
The entry point chooses only the lesson adapter on lesson/callback paths, before
initializing an adapter, so `shop-spa` cannot consume the other client's callback.
Business APIs retain their `shop-spa` allowlist and certificate/token identity comparison;
the lesson displays verified token identity and does not enable business access.

The user chose interactive container setup, with no documented fixture password:

```sh
docker compose -f infra/compose.yaml build realm-bootstrap
./lab user set-password customer-waterdeep
```

Enter and confirm a password of at least 12 characters in the container terminal.
Input is hidden, never passed in arguments or stored on the host. Keycloak stores
its password credential; this operation terminates that user's existing sessions.
Normal bootstrap does not add, overwrite or remove account passwords. The shop
remains certificate-only even for an account with a password. Account password
provisioning is separate from certificate issuance/renewal/revocation.

Pinned behavior was inspected in [Keycloak 26.4.0 PasswordForm](https://github.com/keycloak/keycloak/blob/26.4.0/services/src/main/java/org/keycloak/authentication/authenticators/browser/PasswordForm.java)
and [its factory](https://github.com/keycloak/keycloak/blob/26.4.0/services/src/main/java/org/keycloak/authentication/authenticators/browser/PasswordFormFactory.java),
then tested live; the newer administration guide is context, not pinned-version evidence.
See [completion 15](completion/15-certificate-password-view.md) for observed results and limits.

## User tokens and service identities

- Each API validates JWT signature against cached JWKS, exact issuer, its own expected audience, expiry/not-before, permitted algorithm, and required roles/scopes. Reject ID tokens used as API tokens. Bounded timeouts apply to JWKS refresh and network calls; unknown keys fail closed if refresh fails.
- User tokens intentionally include the three business API audiences needed by this SPA, plus `cert_identity`. Document this lab choice and avoid broad realm-admin roles. Roles determine permissions; certificates do not encode admin privileges.
- HAProxy strips user-supplied identity/forwarding headers and sets a single verified user identity header from the TLS certificate CN. Only the HAProxy service certificate may invoke public API routes; APIs compare this trusted header to the signed token's `cert_identity`. A token stolen from user B cannot be paired with user A's certificate. The attribute mapping and comparison must be tested, not assumed.
- HAProxy-to-UI/API connections use distinct service-client trust from human clients, verified server names, and certificate identity allowlists. A certificate signed by the service CA is insufficient without an allowed caller identity.
- Node-to-Go uses a Node service certificate and a Keycloak confidential-client access token with audience `catalog-api` and the narrow internal quote scope. Python-to-Node uses a Python service certificate and a token with audience `customer-api` and internal reporting scope.
- Service endpoints validate that the mTLS caller identity matches the token's allowed client (`azp` or the pinned-version equivalent), audience, and scope. They reject user tokens and the HAProxy identity. Browser-visible paths cannot route to these endpoints.
- Observed service token acquisition uses client credentials with a generated secret mounted into the intended consumer, over verified TLS. The Keycloak token endpoint does not request Node's or Python's service certificate; each presents its certificate to the private API listener. Go pairs Node's certificate with the signed `customer-catalog` token, catalog audience and `catalog.quote` scope. Node's private reporting route pairs Python's certificate with an `insights-reporting` token, customer audience and `reporting.read` scope. Both service calls run live. This is separate from RFC 8705 certificate-bound tokens.
- Python checks the requesting user's admin permission before obtaining broad reporting data with its own service identity. Services never forward a privileged service token to the browser. Node enforces customer ownership from token `sub`, never a caller-supplied user ID.

## Revocation and lifetime expectations

HAProxy checks the user CA CRL; Keycloak validates the user chain and configured revocation policy; service listeners check service revocation where supported. In an isolated Apple Silicon emulation run, explicit publication and reload rejected a revoked certificate on a fresh shop connection by 31,418 ms and denied a fresh Keycloak authorization code by 31,860 ms, including consumer reload and health checks; the documented target was 60 seconds. An earlier run measured shop rejection by 45 seconds but did not separately time Keycloak. These are observed upper bounds for those runs, not a guaranteed platform-wide revocation SLA. Test with new TLS connections and cleared browser sessions; connection/session caches matter.

Access tokens already issued do not automatically become invalid just because a user is disabled or a certificate is revoked. Start with a short access-token lifetime (proposal: two minutes), refresh rejection, and session revocation on administrative disable. Document and test the residual lifetime. The proxy certificate gate protects subsequent new shop connections, but existing connections require drain/restart for an immediate lab demonstration. Do not claim instantaneous revocation.

## Manual mode

Use the test image with Xvfb, a lightweight window manager, a VNC server, and noVNC/websockify. Launch actual Chrome or Edge as a non-root user. noVNC supplies a browser-accessible remote desktop; the host browser only displays that desktop. [noVNC overview](https://novnc.com/info.html)

- Input contract: `LAB_USER`, `LAB_BROWSER=chrome|msedge`, and `RUN_MODE=manual`.
- Import selected PKCS#12 identity and public trust into the browser's actual Linux certificate database using NSS tools. Detect the chosen browser version's database path; Chromium's documented default changed in M146. Validate Chrome and Edge separately. [Linux certificate management](https://chromium.googlesource.com/chromium/src/+/HEAD/docs/linux/cert_management.md)
- Configure browser-specific `AutoSelectCertificateForUrls` policies narrowly for the two exact lab endpoints, matching issuer and selected subject. Verify loaded policies in both browsers; a policy only chooses an installed certificate, it does not install or trust one. [Edge policy](https://learn.microsoft.com/en-us/deployedge/microsoft-edge-policies/AutoSelectCertificateForUrls)
- Prefer successful native certificate installation as the manual acceptance criterion. Playwright-managed headed contexts can be a diagnostic fallback, but do not count as proof that native certificate installation works.
- Bind the viewer to loopback, protect it with a generated credential, do not publish raw VNC or browser debugging ports, and do not mount the Docker socket. Manual mode is off in CI.
- Give each session a fresh HOME/profile and only one user's certificate volume. Certificate stores can span profiles, so switching only `--user-data-dir` is insufficient isolation. No CA signing key or bootstrap credential is available to the runner.
- Opening the viewer on the host needs no client certificate. The remote browser must reach both application origins without warnings or TLS bypass flags.

Current operator interface includes `./lab up`, `./lab user provision|inspect|disable|enable SEED_USER`, `./lab pki renew|revoke USER`, `./lab test chrome|msedge [SEED_USER]`, and `./lab manual --user SEED_USER --browser chrome|msedge`. The full Vue UI uses Keycloak PKCE. See the [manual browser guide](manual-browser.md). Later proposed aliases for test runners and certificate lifecycle are planned:

```text
./lab up
./lab user provision customer-waterdeep
./lab test --runner playwright --browser chrome
./lab test --runner cucumber --browser msedge
./lab cert renew customer-waterdeep
./lab cert revoke customer-waterdeep
./lab reset --project <explicit-lab-project>
```

Only the runner-suite and some `cert` spellings in that target list remain planned. `lab` is a thin Docker Compose wrapper; all provisioning and certificate commands execute inside containers. The current operator selects one of six seeded Keycloak identities. Arbitrary-user provisioning remains a future trusted-operator capability, not an endpoint offered to app users.
