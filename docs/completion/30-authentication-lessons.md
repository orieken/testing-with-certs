# Authentication lesson live verification — 2026-10-16

All 60 new authentication cases passed in real Chrome and Edge on fresh disposable stacks.
This is local Apple Silicon evidence with Linux amd64 browser runners under emulation.
It is not an independent native Linux CI result. Subsequent [completion 31](31-native-authentication-ci.md) records the independent native run.

| Method | Chrome | Edge | Total |
| --- | --- | --- | --- |
| Password + TOTP | 7/7 | 7/7 | 14/14 |
| Passkey enrollment and login | 7/7 | 7/7 | 14/14 |
| External OIDC federation | 5/5 | 5/5 | 10/10 |
| SAML federation | 7/7 | 7/7 | 14/14 |
| Kerberos/SPNEGO | 4/4 | 4/4 | 8/8 |

The runner used Playwright 1.61.0, Chrome 155.0.8059.39, and Edge 154.0.4258.62.
Keycloak is pinned to 26.4.0. The KDC uses MIT Kerberos 1.20.1-2+deb12u5.
The local Docker server reported 29.8.2.

## Runs and reports

Run from the repository root:

```sh
LAB_PROJECT=magic-shop-auth-20261016-b sh testing/run-auth-lessons.sh
LAB_PROJECT=magic-shop-otp-20261016-b sh testing/run-password-otp.sh
```

The first command exited successfully with 46 passing cases and an artifact scan of 24 entries.
The second exited successfully with 14 passing cases and an artifact scan of eight entries.
Reports contain allowlisted scenario names and pass/fail outcomes, without credential-bearing diagnostics.

- [Chrome passkeys and federation report](../../artifacts/auth-lessons/magic-shop-auth-20261016-b/chrome-passkeys-federation/index.html)
- [Edge passkeys and federation report](../../artifacts/auth-lessons/magic-shop-auth-20261016-b/msedge-passkeys-federation/index.html)
- [Chrome Kerberos report](../../artifacts/auth-lessons/magic-shop-auth-20261016-b/chrome-kerberos/index.html)
- [Edge Kerberos report](../../artifacts/auth-lessons/magic-shop-auth-20261016-b/msedge-kerberos/index.html)
- [Chrome disabled Kerberos user](../../artifacts/auth-lessons/magic-shop-auth-20261016-b/chrome-kerberos-disabled/index.html)
- [Edge disabled Kerberos user](../../artifacts/auth-lessons/magic-shop-auth-20261016-b/msedge-kerberos-disabled/index.html)
- [Chrome password/OTP report](../../artifacts/password-otp/magic-shop-otp-20261016-b/chrome/index.html)
- [Edge password/OTP report](../../artifacts/password-otp/magic-shop-otp-20261016-b/msedge/index.html)

JSON and JUnit results sit beside each HTML report.
Each successful lesson checks its expected issuer, client, and audience, then tests rejection at all three business APIs.
The API rejection checks use a valid user certificate, so missing transport credentials cannot explain the rejection.

## Existing certificate regression

The original certificate/password matrix also passed 36/36 cases in `magic-shop-cert-regression-20261016`.
Each Chrome/Edge × Playwright/Cucumber selection passed nine cases, including certificate-only shop login and cookie/identity boundaries.
The run used `./lab up`, followed by `LAB_PASSWORD_REPORTS=1 sh testing/run-certificate-password.sh` in that project.
The outer exit handler ran `sh testing/cleanup-certificate-password.sh`.
The command exited successfully, the report scan passed with 12 entries, and resource queries found zero containers, volumes, and networks.

- [Chrome Playwright regression](../../artifacts/certificate-password-ci/magic-shop-cert-regression-20261016/chrome-playwright/results.json)
- [Chrome Cucumber regression](../../artifacts/certificate-password-ci/magic-shop-cert-regression-20261016/chrome-cucumber/results.json)
- [Edge Playwright regression](../../artifacts/certificate-password-ci/magic-shop-cert-regression-20261016/msedge-playwright/results.json)
- [Edge Cucumber regression](../../artifacts/certificate-password-ci/magic-shop-cert-regression-20261016/msedge-cucumber/results.json)

Together, the new suites and existing regression provide 96 passing live cases for this increment.

## Corrections found by live testing

- KDC principal lookup can exit successfully when a principal is absent. Startup now checks the returned principal record and verifies both keytabs.
- Keycloak normalizes audience mapper settings and masks broker secrets on readback. Bootstrap accepts the known harmless default, checks non-secret settings, and verifies credential pairing through real login.
- Imported authentication-flow IDs must be unique across realms. First-broker flows now have method-specific IDs.
- Kerberos storage can affect ordinary username/email lookups. It now belongs to its own `lesson-kerberos` realm.
- The Keycloak `basic` scope supplies the access-token subject. New lesson clients receive `basic` and `profile`, without business audience scopes.
- OIDC and SAML logout need explicit return destinations. Both now complete end-to-end in each browser.
- The pinned Keycloak theme uses different error elements. Tests assert visible denial text or the actual credential-error form.
- Chromium on Linux initializes GSSAPI after seeing its first Negotiate challenge. A fresh dedicated regular profile now declares the GSSAPI setting before launch and uses a narrowly scoped integrated-auth policy.
- Reinitializing an existing NSS database can enter an interactive prompt. The trust helper now creates the database only when it is absent.
- The OTP runner retains the last current code step when testing expired codes, preventing accidental accepted-code reuse.

The Kerberos profile setting is `net.received_http_auth_negotiate_headers`.
It prepares the browser's GSSAPI support; it does not install or replace a ticket.
The successful, missing-ticket, expired-ticket, and disabled-user cases prove the separate ticket/account checks.
See [Chromium's network-context implementation](https://chromium.googlesource.com/chromium/src/+/HEAD/chrome/browser/net/system_network_context_manager.cc) for the browser behavior.

## Cleanup and limits

Fixture removal and verification passed before teardown.
Post-run queries found zero containers, volumes, and networks for:

- `magic-shop-auth-20261016-a` — the initial unsuccessful setup run.
- `magic-shop-auth-debug` — the isolated debugging stack.
- `magic-shop-auth-20261016-b` — the passing 46-case run.
- `magic-shop-otp-20261016-a` — the initial theme-selector failure.
- `magic-shop-otp-20261016-b` — the passing 14-case run.

Browser profiles, ticket caches, keytabs, user passwords, and provider secrets stayed in containers or project volumes.
They were removed with those projects. Raw browser traces, videos, screenshots, and SAML assertions were not exported.

Fifteen focused source tests also passed, covering bootstrap isolation/drift, OTP vectors, CI gating, artifact rejection, and runner cleanup.
UI type checking and the container UI build passed. Architecture and Compose checks passed.

Independent native CI, the new manual viewer, physical passkeys, and new-method Cucumber parity remain unverified.
Further negative fixtures remain for independently signed SAML audience/recipient/expiry failures and wrong-service-principal Kerberos tickets.
The controlled OIDC/SAML provider is a separate Keycloak container with distinct provider/broker realms.
These results do not establish compatibility with an organizational identity provider.
