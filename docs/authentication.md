# Certificate authentication and browser operation

The separate [authentik OIDC/SAML examples](authentik-lessons.md) now have 56/56 native Chrome/Edge × Playwright/Cucumber passes, scoped group mapping, rejection/logout checks, and 64 verified recordings. [Completion 57](completion/57-authentik-provider.md) records broker scope and cleanup.

For upcoming hosted providers, see the [external account setup guides](providers/README.md). These are preparation documents; live cloud integration remains deferred.

This document explains the implemented identity and access boundaries.
The [certificate-free lessons guide](certificate-free-lessons.md) describes the separate port 8543 entrance and password/OTP implementation, with a [current protocol matrix](teaching-coverage.md#authentication-protocol-matrix) of 260 local passes across runs and 260 native passes at the current source. [Completion 42](completion/42-saml-role-mapping.md) records scoped SAML role mapping. [Completion 43](completion/43-password-otp-session-refresh.md) records 48/48 Password/TOTP baseline/lifecycle passes; subsequent [passkey lifecycle acceptance](completion/44-passkey-session-refresh.md) passed 48/48 total passkey executions. [Completion 45](completion/45-oidc-session-refresh.md) adds 40/40 controlled OIDC baseline/lifecycle executions and all 15 workflow jobs at the corrected source, with provider SSO and upstream-token limits explicit.
Use the [project terminology dictionary](project-terminology.md) and [writing guide](writing-guide.md) with this document.
See [Mermaid workflows](workflows.md) for expanded request and certificate lifecycle diagrams.
The [teaching guide](teaching-guide.md) gives copyable learner procedures.

## Issuance versus authentication

The lab certificate authority issues user certificates.
Keycloak checks a certificate holder and maps that identity to an enabled user.
Keycloak does not provide a general-purpose user-certificate download endpoint for this lab.
Realm signing keys sign tokens. They differ from users' certificate private keys.

The trusted operator selects or provisions a seeded user and issues that user's certificate.
The runner installs the selected identity before it opens the shop.
This is an operator workflow, not a public enrollment service.
Future self-enrollment would need independent identity proof and approvals.
See the [Keycloak X.509 guide](https://www.keycloak.org/docs/latest/server_admin/#_x509) for general background.

## Provisioning sequence

1. The PKI container establishes separate user, service, and server trust domains.
   It creates the initial certificate revocation lists (CRLs).
   Certificate-authority private keys stay in the PKI-only volume.
2. The issuer creates server certificates with exact subject alternative names (SANs).
   It creates service certificates with explicit identities and clientAuth extended key usage (EKU).
3. PostgreSQL and Keycloak start.
   The bootstrap job creates or verifies the realm, clients, roles, and seeded users through the internal authentication route.
   Bootstrap uses server trust and an operator credential. It needs no existing human certificate.
4. Each user gets a protected, unique `cert_identity` attribute.
   This stable opaque UUID is not a display name or email address.
   Ordinary users cannot edit it.
5. The issuer creates the user's key and certificate.
   The certificate common name (CN) contains the stable identity.
   The certificate has clientAuth EKU and the required issuer constraints.
   Keycloak extracts CN and matches the protected attribute.
6. The issuer writes PEM certificate/key files and a PKCS#12 bundle to narrowly scoped volumes.
   Bundle passwords use mounted secret files. They do not appear in command arguments or logs.
   Public serial, fingerprint, and expiry metadata remain separate.
7. The manual runner installs only the selected user's identity in a fresh browser HOME.
   It loads the server trust anchor.
   Automated workers use selected PEM files through Playwright's `clientCertificates` API.

The current PKI configuration uses a 30-day default leaf validity and a seven-day CRL validity.
Special fixtures cover expired, not-yet-valid, revoked, unmapped, and wrong-issuer certificates.
Renewal retains the stable identity and rotates the key and serial.
Issuer state and serial counters persist. Issuer writes are serialized.
Ordinary startup does not rotate keys or recreate the realm.
See [the issuer configuration](../infra/pki/issue.sh) for exact settings.

## Browser login

1. The browser connects to `https://shop.magic.test:8443` with its selected user certificate.
   HAProxy requires user-CA trust and checks validity and revocation before serving the UI shell.
2. Vue starts OIDC Authorization Code with PKCE S256 against `https://auth.magic.test:9443`.
   The `shop-spa` public client uses exact redirects and an allowed origin.
   It has no embedded client secret or direct password grant.
3. HAProxy tunnels the authentication TLS connection directly to Keycloak.
   Keycloak receives the browser certificate itself. It does not use a forwarded certificate HTTP header.
4. Keycloak checks the certificate and enabled user mapping.
   The shop flow requires X.509. It has no password alternative or cookie-only identity bypass.
   The pinned configuration disables the identity confirmation page.
5. Vue exchanges the authorization code with PKCE through `keycloak-js` 26.2.4.
   It initializes the adapter before the router and clears the callback URL.
   Access and refresh tokens stay in memory.
6. Business requests carry the selected user's access token.
   Each API checks the signature, issuer, audience, lifetime, role, and certificate identity match.

The UI clears identity and previously loaded item data when refresh fails or the session expires.
Keycloak logout returns to the signed-out shop shell through the registered post-logout redirect.
The old localStorage bearer-token implementation is not used.
See [reverse proxy guidance](https://www.keycloak.org/server/reverseproxy) and
[adapter guidance](https://www.keycloak.org/securing-apps/javascript-adapter) for general background.

Automated Playwright Test and Cucumber launches use `--disable-http2` for Chrome and Edge.
Earlier native runs crashed in the Node HTTP/2 path of the context-certificate proxy.
A Keycloak-side HTTP/2 change did not fix the crash and was removed.
Later native workflows passed with the automated browser launch option.
This result does not establish the exact cause of the race.
TLS validation and the selected certificate remain active.
Manual browsers with native certificate stores do not use this launch option.
See [native CI history](completion/12-native-linux-ci.md) and [current CI evidence](completion/26-independent-ci-evidence.md).

Keycloak uses `--https-client-auth=request`, not a universal client-certificate requirement at its TLS listener.
Discovery, JWKS, and confidential-client token requests can therefore operate without a human certificate.
The configured trust store contains the user CA. The human login flow still requires a valid user certificate and mapping.
A service certificate must not authenticate as a human, even if its CN collides.
See [Keycloak container configuration](../infra/keycloak/Containerfile),
[Compose trust configuration](../infra/compose.yaml), and [realm settings](../infra/keycloak/realm.json).

A trusted but unmapped certificate can pass the shop TLS gate and load a non-sensitive shell.
It cannot obtain a successful Keycloak login or business records.
A disabled account also cannot log in.
Missing or untrusted certificates can fail before an application page exists.
Tests must check failure at the appropriate layer.

Logout ends the session. It does not uninstall the certificate.
The same browser can authenticate again with its installed certificate.
Changing users requires a fresh browser profile or container.
Cookies and `storageState` must not convert one user's certificate session into another user's session.
The preview cart is keyed by signed-in subject and cleared from view on logout.
It is not an authentication store.

## Separate certificate + password teaching view

The lesson is at `https://shop.magic.test:8443/teaching/certificate-password`.
It uses the separate public client `certificate-password-spa`.
Its exact callback is `/teaching/certificate-password/callback`.

The `certificate-password-browser` flow requires X.509 followed by `auth-password-form`.
It has no cookie execution, username form, or alternative execution.
Keycloak selects the certificate-mapped account and checks that account's password on the authentication origin.
Vue never collects or submits passwords.

The lesson retains PKCE S256, TLS passthrough, exact origins, and memory-held tokens.
The entry point selects the lesson adapter before initialization on lesson and callback paths.
The shop adapter cannot consume the lesson's callback.
Business APIs retain their `shop-spa` allowlist and certificate/token identity checks.
The lesson displays verified token identity. Its tokens do not grant business API access.

Run these commands from the repository root for operator-controlled password setup:

```sh
docker compose -f infra/compose.yaml build realm-bootstrap
./lab user set-password customer-waterdeep
```

Enter and confirm at least 12 characters in the hidden container prompt.
The password is not passed in arguments or stored on the host.
Keycloak stores the password credential. The operation ends that user's existing sessions.
Normal bootstrap does not add, overwrite, or remove account passwords.
An account with a password still uses certificate-only login in the shop.
Password setup is separate from certificate issuance, renewal, and revocation.

The original implementation review inspected [Keycloak 26.4.0 PasswordForm](https://github.com/keycloak/keycloak/blob/26.4.0/services/src/main/java/org/keycloak/authentication/authenticators/browser/PasswordForm.java)
and [its factory](https://github.com/keycloak/keycloak/blob/26.4.0/services/src/main/java/org/keycloak/authentication/authenticators/browser/PasswordFormFactory.java).
The current administration guide supplies context, not evidence about that pinned release.
See [completion 15](completion/15-certificate-password-view.md) for implementation observations.
See [completion 18](completion/18-native-certificate-password-ci.md) for the 36-case native matrix and cleanup evidence.

## User tokens and service identities

### Public business requests

Each API validates the JWT signature against cached JWKS.
It checks the exact issuer, its own audience, expiry, not-before, permitted algorithm, and required role.
It rejects ID tokens presented as API access tokens.
JWKS refresh and network requests have bounded timeouts.
An unknown key fails closed if refresh fails.

The shop's user access tokens include the three business API audiences and `cert_identity`.
This is a lab client choice. It does not grant realm-administrator privileges.
Roles determine permissions. Certificates do not encode administrator privileges.

HAProxy removes caller-supplied identity and forwarding headers.
It sets one verified user identity header from the certificate CN.
Only the allowed HAProxy service certificate can invoke public API routes.
The API compares the trusted identity header with the signed `cert_identity` claim.
User B's token cannot be paired with user A's certificate.
Node derives record ownership from verified token `sub`, not a caller-supplied user ID.

Gateway-to-UI and gateway-to-API connections verify the server name and CA.
They use service-client trust and explicit caller identity allowlists.
Service-CA trust alone is not enough to permit a caller.

### Private service requests

| Consumer | Certificate identity | Token client | Audience | Required scope |
| --- | --- | --- | --- | --- |
| Node customer API | `customer-api` | `customer-catalog` | `catalog-api` | `catalog.quote` |
| Python insights API | `insights-api` | `insights-reporting` | `customer-api` | `reporting.read` |

The service obtains its access token through client credentials over verified TLS.
Its generated client secret is mounted only into the intended consumer.
Keycloak does not request these service certificates at the token endpoint.
The consumer presents its service certificate to the private API listener instead.

Private APIs check the certificate identity, token client (`azp`), audience, and scope together.
They reject user tokens and the gateway identity on these private operations.
Browser-visible routes cannot reach those operations.
These checks are not RFC 8705 certificate-bound tokens.

Python checks the requesting user's administrator permission before reading the reporting feed.
A privileged service token is never forwarded to the browser.
See the [live security plan](test-plan.md) and [coverage map](teaching-coverage.md) for observed checks.

## Revocation and lifetime expectations

HAProxy checks the user-CA CRL.
Keycloak checks the user chain and configured revocation policy.
Service listeners check service revocation under their configured TLS policy.
Publication alone does not reload every consumer. Reload the required services and use fresh connections.

One isolated Apple Silicon emulation run observed fresh shop rejection by 31,418 ms.
It observed denial of a fresh Keycloak authorization code by 31,860 ms.
These times include consumer reload and health checks. The recorded target was 60 seconds.
An earlier run observed shop rejection by 45 seconds without separately timing Keycloak.
These are upper bounds for those runs, not a platform-wide service-level guarantee.
See [security completion](completion/11-security-matrix.md) for the recorded evidence.

Disabling a user or revoking a certificate does not automatically invalidate an issued access token.
The realm configures a 120-second access-token lifetime.
Administrative disable also revokes sessions and blocks refresh.
Existing connections and sessions can retain state until their respective checks or lifetimes end.
Drain or restart connections for an immediate lab demonstration.
Do not claim instantaneous revocation.

## Manual mode

The manual runner uses the test image with Xvfb, a window manager, VNC, and noVNC/websockify.
It launches actual Chrome or Edge as a non-root user.
The host browser displays the remote desktop. It does not perform the lab login itself.
See the [noVNC overview](https://novnc.com/info.html) for the remote desktop tool.

The input contract is `LAB_USER`, `LAB_BROWSER=chrome|msedge`, and `RUN_MODE=manual`.
The runner imports the selected PKCS#12 identity and public trust with NSS tools.
It uses the certificate database path required by the pinned browser.
Chrome and Edge installation and policy checks are separate.
See [Chromium certificate management](https://chromium.googlesource.com/chromium/src/+/HEAD/docs/linux/cert_management.md) for general background.

Browser-specific `AutoSelectCertificateForUrls` policies match the selected issuer and subject at the two exact endpoints.
A policy selects an installed certificate. It does not install or trust a certificate.
See the [Edge policy definition](https://learn.microsoft.com/en-us/deployedge/microsoft-edge-policies/AutoSelectCertificateForUrls).
A Playwright-managed headed context can help diagnosis, but does not prove native certificate installation.

The viewer is bound to loopback and protected by a generated credential.
Raw VNC and browser debugging ports are not published.
The runner has no Docker socket, CA signing key, or bootstrap credential.
Manual mode is off in CI.

Each session has a fresh HOME and profile with only one selected user certificate volume.
Changing only `--user-data-dir` is insufficient because certificate stores can span browser profiles.
The host needs no client certificate to open the viewer.
The remote browser must reach both origins without warnings or TLS bypass flags.

Run the implemented commands from the repository root:

```sh
./lab up
./lab user inspect customer-waterdeep
./lab user provision customer-waterdeep
./lab test --runner playwright --browser chrome --user customer-waterdeep
./lab test --runner cucumber --browser msedge --user shop-admin
./lab manual --user customer-waterdeep --browser chrome
./lab pki renew customer-waterdeep
./lab pki revoke customer-waterdeep
```

The lifecycle spelling is `pki`, not the earlier proposed `cert` alias.
`lab` is a thin Docker Compose wrapper. Provisioning and certificate commands run in containers.
It selects the six seeded identities. Arbitrary-user provisioning remains future trusted-operator scope.
See the [manual browser guide](manual-browser.md) for viewer access and profile disposal.
Native Linux manual viewer and operator checks remain unverified.

## Test replacements do not change these boundaries

Standalone JWT and OIDC examples use dedicated consumers and disposable identities.
Browser mock suites keep synthetic authentication inside their isolated test system.
Fault suites replace a specified dependency while retaining the required real authentication checks.
No mock authentication is injected into real business APIs.
Mock results do not prove real Keycloak login or normal live-provider behavior.
See [current independent CI evidence](completion/26-independent-ci-evidence.md) for the separate required reports.

[Completion 46](completion/46-saml-session-refresh.md) records 84/84 SAML baseline/lifecycle executions locally and natively, including broker refresh with mapped/no-role controls, expiry re-entry, logout, client binding, and session expiry. All 15 native jobs passed at `161dc03`, including the passkey script-readiness correction. Broker refresh does not establish upstream SAML role-change or assertion-revocation propagation. Kerberos lifecycle acceptance subsequently passed in [completion 47](completion/47-kerberos-session-refresh.md): 40/40 baseline/lifecycle executions locally and natively, including refresh after removing the owned ticket cache. The current 260-execution native matrix and all 15 jobs passed at `0d65396`. KDC revocation propagation and other desktop platforms remain outside this acceptance.

[Authentication recording acceptance](completion/51-authentication-recordings.md) now covers every implemented method in both runners/browsers. Provider documents are hidden before paint to exclude passwords, OTP enrollment material, and assertions from video; real authentication and assertions remain active. Scanned, case-linked recordings are imported into the matrix gallery with auth-type filters.
