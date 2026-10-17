# Expanded native authentication CI — 2026-10-16

Both native authentication jobs passed in [run 38997005710](https://github.com/orieken/testing-with-certs/actions/runs/38997005710), testing commit `e747417bd986e946c93ae5a4de7ca639d57e9ecf` on `codex/authentication-lessons`. This was a fresh Ubuntu 24.04/Linux amd64 run with source-built runner and lesson-provider images. Downloaded JSON and JUnit reports independently confirmed all **70/70** expected cases, with zero failures, duplicates, or omissions. The complete workflow finished successfully: **all 15 jobs passed**, including the final independent-evidence gate.

| Method | Chrome | Edge | Native total |
| --- | --- | --- | --- |
| Password + TOTP | 7/7 | 7/7 | 14/14 |
| Passkey enrollment/login | 7/7 | 7/7 | 14/14 |
| Controlled external OIDC | 5/5 | 5/5 | 10/10 |
| SAML, including signed variants and recipient guard | 11/11 | 11/11 | 22/22 |
| Kerberos, including wrong-service rejection | 5/5 | 5/5 | 10/10 |
| Total | 35/35 | 35/35 | 70/70 |

## Correction found by native testing

The initial [run 38996619167](https://github.com/orieken/testing-with-certs/actions/runs/38996619167) passed Chrome's complete 23-case passkey/federation selection, including all four signed SAML additions. It then failed the wrong-service Kerberos case at an immediate check for a rendered error page or a 401 challenge. The actual wrong-ticket rejection path is separately tracked as HTTP 400/401 on the injected request; that check should not depend on an already-rendered DOM error page.

Commit `e747417` makes the test wait for the tracked rejection, then checks that no authorization code, lesson identity, or password fallback appears. Other negative cases also wait for their challenge/error evidence. It retains the requirement that the injected wrong-service request was submitted and explicitly denied; it does not accept a timeout, arbitrary navigation error, or successful response as rejection. Five focused matrix/runner/artifact tests passed before the corrected native run was pushed. The initial failure and its fixture cleanup remain visible in their run history.

## Verified reports and cleanup

Both native exact-count gates passed: 56 passkey/OIDC/SAML/Kerberos cases and 14 password/TOTP cases. Independent checks of the downloaded JSON/JUnit files reproduced those totals and required each expected name and passed status. The safe reporters export HTML, JSON, and JUnit outcomes without raw credentials or diagnostics. Uploaded artifacts are `auth-lessons-38997005710-1` and `password-otp-38997005710-1`. The corresponding job IDs are `117291799757` and `117291798979`.

Native credential scans passed with 24 authentication entries and eight OTP entries; scans of the downloaded files also passed. Fixture deletion/verification, Compose teardown, final safety scans, and uploads all passed in both jobs. Raw assertions, signing keys, Negotiate tokens, traces, screenshots, and videos were not exported. Artifacts have a seven-day retention period.

Fresh native builds installed Chrome `155.0.8059.84-1` and Edge `154.0.4258.62-1`, with Playwright `1.61.0`. The custom recipient mapper compiled against pinned Keycloak `26.4.0`; the KDC uses MIT Kerberos `1.20.1-2+deb12u5`. This replaces the cached-browser limitation for the new cases.

The [protocol matrix](../teaching-coverage.md#authentication-protocol-matrix) now records all 70 current cases as observed both locally across runs and natively in this run. Local evidence remains in [completion 35](35-saml-recipient-matrix.md), and the historical 60-case native baseline remains in [completion 31](31-native-authentication-ci.md).


## Regression and final gate

The same run independently passed all **36 certificate/password cases**, nine per Chrome/Edge × Playwright/Cucumber selection. Downloaded JSON reports confirmed the exact unique case set and passed status in all four selections. The existing exact-count gate, safe-report upload, intentional runner-failure probe, and independent successful/failure-project cleanup checks passed. Its artifact is `certificate-password-38997005710-1`; job `117292017151` records those checks.

Source/build checks, Compose architecture checks, contracts/security and customer/admin browser journeys, Prism consumers, checkout/reporting/idempotency fault jobs, and regional-boundary tests also passed. Final job metadata confirmed 15 completed successful jobs and an overall successful workflow. The aggregate gate required every independent job; mock/fault evidence did not substitute for live-provider checks. These regression results are separate from the 70 protocol cases, giving 106 authentication/browser cases across the new-method and existing certificate/password matrices.

## Remaining acceptance

New-method Cucumber parity, broader session/refresh negatives and explicit cancellation-cleanup probes, SAML role-mapping assertions, physical passkeys, the manual viewer, and organizational-provider compatibility remain separate open items. A completed native Playwright matrix does not establish those variants.
