# Certificate-free authentication lessons

The teaching entrance is `https://shop.magic.test:8543/teaching`.
It uses the existing shop server certificate and does not request a user certificate.
The certificate-only shop remains at `https://shop.magic.test:8443`.

The gateway serves only the lesson index, explicit lesson/callback routes, and built application assets on port 8543.
Business API paths and other application routes return 404 on this entrance.
The gateway still verifies its UI connection and presents its service certificate.
The port is internal to the lab network, like the existing shop and authentication ports.
It is not published to the host. Use a browser inside the lab network with the lab server CA trusted.

## Password and authenticator code

The first lesson is `/teaching/password-otp`.
It uses the public Keycloak client `password-otp-spa` with Authorization Code and PKCE S256.
Its only callback is `https://shop.magic.test:8543/teaching/password-otp/callback`.
The client includes the `basic` and `profile` scopes and requires username/password followed by OTP. Neither step has a cookie alternative.
First login requires authenticator enrollment on Keycloak's page.
The configured codes have six digits and a 30-second period, using HMAC-SHA1.
The clock tolerance is one adjacent interval.

Keycloak collects the password and code. The lesson holds issued tokens in memory.
Its access token has the `password-otp-lesson` audience and no business API audience mappers.
The APIs retain their existing client allowlists and certificate identity checks.
The lesson displays identity only and does not call business APIs.

From the repository root, start or update the lab:

```sh
./lab up
docker compose -f infra/compose.yaml --profile operator run --rm lesson-user
```

The second command creates the dedicated `lesson-otp` user and asks for a password inside the container.
Enter and confirm at least 12 characters. The account has no certificate mapping or business roles.
Repeat provisioning changes its password and ends its sessions. It preserves an enrolled authenticator.
Normal bootstrap does not create this account or overwrite credentials.

Open the lesson in a trusted lab-network browser. Choose **Sign in with password and code**.
Use `lesson-otp` and the password you set. Connect your authenticator when Keycloak requests enrollment.
Browser authentication remains at `https://auth.magic.test:9443`.
The certificate-free manual viewer described below can reach this entrance without installing a user certificate.

## Automated verification

Run from the repository root with Docker available:

```sh
LAB_PROJECT=magic-shop-otp-demo sh testing/run-password-otp.sh
```

Use a new disposable `magic-shop-otp-*` name. The command refuses existing project resources.
It starts a separate stack, builds the runner, and runs seven scenarios in Chrome and Edge.
Each browser gets fresh test accounts and a fresh profile volume.
No browser client certificate is configured. A separate API request context uses a certificate solely for API rejection checks.

The suite covers:

- Certificate-free page access, blocked routes, and the shop's existing certificate requirement.
- Authenticator enrollment, lesson audience, and rejection at all three business APIs.
- Wrong passwords and disabled accounts.
- Incorrect and expired codes.
- Successful login, logout, and mandatory factors despite existing SSO cookies without `prompt=login`.
- Fresh browser context and second-account isolation.

The TOTP helper has independent RFC 6238 reference-vector tests.
Bootstrap tests check repeat execution and rejection of weakened flows or changed callbacks.
The dedicated CI job is required by the final evidence gate.

Passwords remain in a Docker volume. Enrollment secrets remain in browser/test process memory and Keycloak storage.
Traces, screenshots, videos, and raw failure diagnostics are disabled because enrollment screens contain secrets.
Allowlisted HTML, JSON, and JUnit reports appear under `artifacts/password-otp/PROJECT/`.
The runner scans reports before delivery. CI uploads only reports that pass the scan.

The exit handler removes fixture accounts, verifies their removal, and removes the disposable stack and volumes.
For recovery after a hard termination, use the same project name:

```sh
export LAB_PROJECT=magic-shop-otp-demo
export LAB_OTP_REPORT_DIR="$PWD/artifacts/password-otp/$LAB_PROJECT"
docker compose -f infra/compose.yaml -f infra/otp.compose.yaml --profile '*' down --volumes --remove-orphans
```

## Passkeys, OIDC, SAML, and Kerberos

All remaining lesson entry pages and infrastructure are authored:

| Page | Client | Identity check |
| --- | --- | --- |
| `/teaching/passkeys/enroll` | `passkeys-enroll-spa` | Setup password, followed by WebAuthn registration |
| `/teaching/passkeys` | `passkeys-spa` | Username, followed by an enrolled passkey; no password fallback |
| `/teaching/oidc` | `oidc-spa` | OIDC federation to the controlled lesson provider |
| `/teaching/saml` | `saml-spa` | SAML federation with signed assertions and responses |
| `/teaching/kerberos` | `kerberos-spa` | Kerberos/SPNEGO using a runner ticket; no password fallback |

Passkey enrollment and login have distinct callbacks and audiences.
The enrollment page requests the `webauthn-register-passwordless` action and checks its successful callback status.
Enrollment tokens cannot satisfy the passkey login page.
The relying-party ID is `auth.magic.test`. Resident credentials and user verification are required.
Playwright uses Chromium's virtual authenticator through CDP in real Chrome and Edge.
Virtual credentials remain in test-process memory and are not exported in browser storage-state files.
This checks browser and Keycloak ceremonies, not physical security-key or biometric behavior.

The additional Keycloak container listens through the gateway at `https://shop.magic.test:9643`.
It hosts the upstream `lesson-provider` realm and separate `lesson-oidc` and `lesson-saml` broker realms.
The realm boundaries exercise real OIDC and SAML exchanges with separate realm signing keys.
Each broker realm contains only its designated identity provider.
OIDC uses a confidential broker client, PKCE, exact issuer validation, and JWKS signature validation.
SAML requires signed assertions and validates the configured signing certificate.
The provider uses Keycloak development mode and persistent H2 storage for this controlled lab.
It is not a commercial or external organizational identity provider.
The primary Keycloak user-certificate trust configuration stays unchanged.

The separate `lesson-kerberos` realm uses Kerberos storage, keeping that lookup behavior out of the main shop realm.
The KDC uses `MAGIC.TEST`, with service principal `HTTP/auth.magic.test@MAGIC.TEST`.
It listens inside Docker on port 8888. It publishes no host port.
The server keytab is mounted only into Keycloak and the KDC.
The user keytab remains in the KDC. Runners receive short-lived ticket caches instead.
The browser's integrated-auth allowlist contains only `auth.magic.test`.
Automated Kerberos cases use a fresh regular profile and initialize Chromium's Linux GSSAPI setting before launch.
No prior browser cookies or authentication sessions are imported.
Kerberos tickets can authenticate again after logout until they expire, just as an installed certificate can.

Start or update the full lesson stack from the repository root:

```sh
sh testing/start-auth-lessons.sh
docker compose -f infra/compose.yaml -f infra/auth-lessons.compose.yaml --profile test build runner-test
```

Create the manual passkey account and upstream provider accounts with hidden container prompts:

```sh
docker compose -f infra/compose.yaml -f infra/auth-lessons.compose.yaml --profile operator run --rm --no-deps passkey-user
docker compose -f infra/compose.yaml -f infra/auth-lessons.compose.yaml run --rm --no-deps --entrypoint node auth-lesson-setup /app/provider-user.mjs oidc
docker compose -f infra/compose.yaml -f infra/auth-lessons.compose.yaml run --rm --no-deps --entrypoint node auth-lesson-setup /app/provider-user.mjs saml
```

The manual usernames are `lesson-passkeys`, `lesson-oidc`, and `lesson-saml`.
The passkey account lives in the primary realm. Provider accounts live only in `lesson-provider`.
Normal bootstrap does not set their passwords.

## Certificate-free manual viewer

Prepare the Kerberos ticket, then start Chrome or Edge in a fresh certificate-free profile:

```sh
docker compose -f infra/compose.yaml -f infra/auth-lessons.compose.yaml exec -T lesson-kdc sh /app/tickets.sh
LAB_BROWSER=chrome docker compose -f infra/compose.yaml -f infra/auth-lessons.compose.yaml --profile auth-manual up -d --no-deps runner-auth-manual
docker compose -f infra/compose.yaml -f infra/auth-lessons.compose.yaml exec runner-auth-manual cat /tmp/viewer-password
```

Open `http://localhost:6084/vnc.html` and enter the generated viewer password.
The viewer starts at the lesson index and does not import a user certificate.
Set `LAB_AUTH_LESSON=kerberos` to start directly at the Kerberos lesson.
Use `LAB_BROWSER=msedge` for Edge. Only the viewer is exposed on loopback.
NoVNC does not forward your host's fingerprint reader or USB security key.
Manual passkey enrollment needs an authenticator available to the remote browser; automated tests supply a virtual one.

## Full authentication lesson tests

Run all new methods in a fresh disposable stack:

```sh
LAB_PROJECT=magic-shop-auth-demo sh testing/run-auth-lessons.sh
```

The authored matrix has 23 cases per browser, 46 total:

- Seven passkey cases: enrollment, login/logout, missing credentials, altered signatures, disabled users, unconfigured users, and account isolation.
- Five OIDC cases: login/API rejection/logout, disabled users, callback state, provider isolation, and broker state.
- Seven SAML cases: the same five boundaries, plus modified signed responses and replay rejection.
- Four Kerberos cases: valid, missing, and expired tickets, plus disabled imported users.

This is a separate suite from the existing 14-case password/OTP matrix.
Its exit handler removes fixture accounts and the disposable stack, including keys, ticket caches, and browser volumes.
Reports are allowlisted HTML, JSON, and JUnit under `artifacts/auth-lessons/PROJECT/`.
Traces, screenshots, video, enrollment secrets, assertions, and ticket caches are excluded from reports.
The artifact scanner also rejects keytabs, cache filenames, fixture credential files, and passkey private-key fields.
The `auth-lessons` CI job is required by the final evidence gate.

For recovery after hard termination, use only the disposable project name from that run:

```sh
export LAB_PROJECT=magic-shop-auth-demo
export LAB_AUTH_REPORT_DIR="$PWD/artifacts/auth-lessons/$LAB_PROJECT"
docker compose -f infra/compose.yaml -f infra/auth-lessons.compose.yaml --profile '*' down --volumes --remove-orphans
```

## Observed evidence and remaining acceptance

On 2026-10-15, UI type checking and the production UI build passed.
The host dependency tree contained Linux binaries. Matching macOS build binaries were downloaded into a temporary directory for the build.
No package manifest or lockfile changed for that workaround.
On 2026-10-16, fifteen focused bootstrap, OTP reference-vector, artifact-safety, runner-cleanup, and CI-gate tests passed.
Base and lesson-overlay Compose validation and architecture checks passed.
On 2026-10-16, Docker became available. Fresh disposable stacks passed all 60 new Chrome/Edge cases, report scans, and complete cleanup.
The existing certificate/password regression also passed 36/36 cases across both browsers and runners.
[Completion 30](completion/30-authentication-lessons.md) records the observed results and runtime corrections.
Independent native Ubuntu CI subsequently passed the same 60 cases, scanned uploads, and teardown; see [completion 31](completion/31-native-authentication-ci.md). The manual viewer remains unverified.

Local automated login acceptance passed for every new method. Broader acceptance remains open for the cases below.
The expanded Kerberos matrix, including actual wrong-service-principal ticket rejection, subsequently passed 10/10 locally; [completion 34](completion/34-kerberos-wrong-service.md) records the cached-image versions and original local evidence.
The expanded full suite subsequently passed 56/56 locally, including signed SAML audience/recipient/expiry checks. A lesson-only recipient mapper was necessary because pinned upstream accepted the wrong-recipient fixture; see [completion 35](completion/35-saml-recipient-matrix.md).
The full 56-case suite and separate 14-case TOTP suite subsequently passed in native Ubuntu CI with exact-count gates and scanned uploads; see [completion 36](completion/36-native-expanded-authentication.md).
Password/TOTP subsequently passed 28/28 cases across Chrome/Edge and Playwright/Cucumber, locally and natively. The complete native authentication inventory passed 84/84; see [completion 37](completion/37-password-otp-cucumber.md).
Passkey parity subsequently passed 28/28 across both runners and browsers; the full protocol suite passed 70/70 and the combined native authentication inventory passed 98/98. See [completion 38](completion/38-passkey-cucumber.md).
Controlled OIDC parity subsequently passed 20/20 across both runners and browsers; the full protocol suite passed 80/80 and the combined native authentication inventory passed 108/108. See [completion 39](completion/39-oidc-cucumber.md).
SAML parity subsequently passed 44/44 across both runners and browsers; the full protocol suite passed 102/102 and the combined native authentication inventory passed 130/130. See [completion 40](completion/40-saml-cucumber.md).
Kerberos parity subsequently passed 20/20 across both runners and browsers; the full protocol suite passed 112/112 and the combined native authentication inventory passed 140/140. All five methods now have both-runner evidence. See [completion 41](completion/41-kerberos-cucumber.md).
Scoped SAML role mapping subsequently passed: exact reviewer value, absent/unrecognized attributes, and role withdrawal in a later signed assertion. The SAML suite passed 60/60 and the full native authentication inventory passed 156/156; lesson tokens still fail at all three business APIs. [Completion 42](completion/42-saml-role-mapping.md) records the scope and evidence.
Additional work remains for
passkey physical-device checks, broader session/refresh negatives, existing-token revocation and cancellation-cleanup CI probes.
See [the implementation TODO list](TODO.md) for remaining acceptance requirements.

Password/TOTP session and refresh acceptance subsequently passed 48/48 baseline/lifecycle executions locally and natively. The browser clears sign-in at access-token expiry and requires both factors again; private protocol checks cover successful refresh, logout invalidation, client binding, and actual session expiry. Only disposable lifecycle fixtures shorten this client’s lifetimes, then verify restoration. No automatic browser refresh feature was added. [Completion 43](completion/43-password-otp-session-refresh.md) records independently checked reports, cleanup, and the successful full-workflow regression retry.

Passkey session and refresh acceptance subsequently passed 48/48 baseline/lifecycle executions locally and natively. Expiry requires a new submitted WebAuthn assertion despite provider cookies; private protocol checks verify refresh identity/audience, API denial, logout invalidation, client binding, and actual session expiry. Disposable client lifetimes are restored and verified after each selection. The full native authentication inventory passed 196/196 and all 15 workflow jobs passed on the first attempt. [Completion 44](completion/44-passkey-session-refresh.md) records evidence; physical keys and platform biometrics remain unverified.

Controlled external OIDC session and refresh acceptance subsequently passed 40/40 baseline/lifecycle executions locally and natively. Expiry re-enters the real provider with the same mapped subject/username, including verified password-only reauthentication in the pinned provider. Private broker-token checks cover refresh identity/audience/API denial, logout invalidation, client binding, and actual session expiry. Disposable broker-client policy is restored and verified. The full native authentication inventory passed 216/216, and all 15 workflow jobs passed at the corrected source. [Completion 45](completion/45-oidc-session-refresh.md) records the failed-helper history and scope: broker tokens are tested; upstream provider refresh-token revocation and organizational-provider compatibility remain unverified.

SAML broker session and refresh acceptance subsequently passed **84/84** baseline/lifecycle executions locally and natively. Six shared cases cover expiry re-entry, mapped-role preservation, a no-role refresh control, logout invalidation, client binding, and actual session expiry. Client policy restoration and credential-safe reports passed. The native inventory at that increment passed **240/240**, with all 15 workflow jobs green at `161dc03`, including a verified WebAuthn script-readiness correction. [Completion 46](completion/46-saml-session-refresh.md) records independent evidence and earlier failed attempts. Refresh exercises broker-issued OIDC tokens; upstream SAML role changes and assertion revocation remain separate acceptance work. Kerberos session/refresh acceptance is recorded below.

Kerberos lesson session and refresh acceptance subsequently passed **40/40** baseline/lifecycle executions locally and natively. Five shared cases cover expiry/re-entry, refresh after removing a privately copied ticket cache, logout invalidation, client binding, and actual client-session expiry. Each invocation removes its owned cache/profile; group cleanup restores client policy and logs out imported-account sessions. The current native matrix passed **260/260**, with all 15 jobs green at `0d65396`. [Completion 47](completion/47-kerberos-session-refresh.md) records independently checked reports and cleanup. Re-entry permits Keycloak SSO reuse; token refresh does not establish immediate KDC revocation propagation or other-platform support.
