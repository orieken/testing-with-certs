# AUTH-NEXT-01 acceptance audit — 2026-10-16

Password + TOTP meets the stated AUTH-NEXT-01 Playwright requirements. Its implementation and live verification preceded this audit; the unchecked TODO was stale. This audit does not claim a new browser run or additional coverage.

| Requirement | Implementation and observed verification |
| --- | --- |
| Dedicated authentication flow | `password-otp-browser` requires username/password followed by OTP, without cookie alternatives. Bootstrap validates the execution order, required settings, exact callbacks, PKCE S256, and lesson audience. [Bootstrap](../../infra/keycloak/password-otp.mjs) |
| Isolated users and controlled enrollment | Disposable fixture users receive random passwords inside the secret volume. Enrollment reads the test-only setup key within the browser runner and generates codes there. Fixtures delete users and the secret file, then verify absence. [Fixtures](../../infra/keycloak/otp-fixture.mjs) |
| Successful enrollment and login | `enrollment and lesson audience denied at business APIs` enrolls the authenticator and checks the signed-in identity, client, lesson audience, and rejection by all three business APIs using a valid transport certificate. |
| Incorrect password | `wrong password` observes password rejection and confirms no OTP form is reached. |
| Incorrect/expired OTP | `incorrect and expired codes` observes rejection of both a wrong code and a code generated five minutes in the past. |
| Disabled user | `disabled user` observes account rejection before the OTP step. |
| Logout and cookie-factor enforcement | `successful login, logout and cookie cannot skip factors` logs in with OTP, removes the forced-login hint from a subsequent authorization request, confirms cookies cannot skip password/OTP, and verifies local identity remains absent after logout and reload. |
| Session/account isolation | `fresh profile and second account isolation` starts in a fresh Playwright context without identity, enrolls a different account, and verifies the second identity. |
| Secrets excluded from evidence | Traces, screenshots, and videos are disabled. The custom reporter writes allowlisted case names and outcomes rather than raw diagnostics. Credential scans pass before upload. [Runner configuration](../../testing/playwright.otp.config.mjs), [reporter](../../testing/reporting/otp-playwright.mjs) |

The [Playwright specification](../../testing/playwright/password-otp.spec.mjs) contains seven cases per browser, including certificate-free route boundaries. [Completion 30](30-authentication-lessons.md) records 14/14 local passes. [Completion 31](31-native-authentication-ci.md) records 14/14 independent native Ubuntu passes in [run 38923211484](https://github.com/orieken/testing-with-certs/actions/runs/38923211484), along with scanned uploads and successful fixture cleanup/teardown. OTP generation also passes the RFC 6238 SHA-1 reference-vector test, and bootstrap tests cover repeat setup and rejected configuration drift.

## Follow-ups kept open

AUTH-NEXT-06 retains new-method Cucumber parity, broader session/refresh negatives, and explicit cancellation-cleanup probes. The new manual viewer remains unverified. None of these expands the original AUTH-NEXT-01 Playwright checklist implicitly. Independent-provider examples and their dated free/developer/student access notes remain planned under IDP-01 through IDP-07 in the [TODO](../TODO.md).
