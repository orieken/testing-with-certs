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
The manual viewer and independent native CI remain unverified.

Local automated login acceptance passed for every new method. Broader acceptance remains open for the cases below.
Additional work remains for independently signed wrong-audience/expired SAML assertions, Kerberos wrong-service-principal tickets,
passkey physical-device checks, broader session/refresh negatives, Cucumber parity, and cancellation-cleanup CI probes.
See [the implementation TODO list](TODO.md) for remaining acceptance requirements.
