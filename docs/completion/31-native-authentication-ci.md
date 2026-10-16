# Native authentication CI — 2026-10-16

[Native Ubuntu 24.04 run 38923211484](https://github.com/orieken/testing-with-certs/actions/runs/38923211484) tested commit `57cd975164a0e672a79e76cde5b4730a3296e48c` on `codex/authentication-lessons`.
Both new authentication jobs passed with real Linux amd64 Chrome and Edge.
The complete workflow finished successfully: all 15 jobs passed, including the final independent-evidence gate.

| Method | Chrome | Edge | Total |
| --- | --- | --- | --- |
| Password + TOTP | 7/7 | 7/7 | 14/14 |
| Passkey enrollment/login | 7/7 | 7/7 | 14/14 |
| Controlled external OIDC | 5/5 | 5/5 | 10/10 |
| SAML | 7/7 | 7/7 | 14/14 |
| Kerberos/SPNEGO | 4/4 | 4/4 | 8/8 |

Downloaded JSON and JUnit reports independently confirmed all 60 expected cases, unique names within each browser/phase, and zero failures. The six passkey/federation/Kerberos selections contain 19, 3, and 1 cases per browser; each OTP selection contains seven.

The job logs record successful fixture cleanup verification, Compose teardown, credential scans, and artifact uploads. Scans passed with 24 authentication entries and eight OTP entries. A repeated scan of both downloaded artifacts also passed. The artifacts contain allowlisted HTML, JSON, and JUnit outcomes; raw credentials, SAML assertions, traces, screenshots, and videos were not exported.

The run's artifacts are named `auth-lessons-38923211484-1` and `password-otp-38923211484-1`, retained for seven days. Their job IDs are `117048916853` and `117048917148` respectively.

## Existing regression and independent gates

The same run passed all 36 certificate/password cases across Chrome/Edge and Playwright/Cucumber. Its exact-count gate, report scan/upload, intentional runner-failure probe, and independent resource cleanup checks passed. The report artifact is `certificate-password-38923211484-1`; job `117049417754` records cleanup verification for both the successful and intentional-failure projects.

The workflow also passed source/build checks, Compose architecture checks, live contracts/security and customer/admin browser selections, independent Prism consumers, checkout/reporting/idempotency fault jobs, and regional-boundary scenarios. The final required gate accepted every independent job. These results preserve the distinction between real-provider evidence and controlled mock/fault evidence.

## Clean-build correction

The initial [run 38922861452](https://github.com/orieken/testing-with-certs/actions/runs/38922861452) exposed an unavailable Chrome package before new browser evidence was produced. Google's repository had removed `155.0.8059.39-1` from its package index. The runner lock now requires the explicitly available `155.0.8059.84-1`; signed repository verification and all other dependency pins remain enforced. The corrected native jobs installed that exact patch from a fresh build. Edge remains pinned to `154.0.4258.62-1`, and Playwright to `1.61.0`.

## Remaining acceptance

Native CI for these 60 cases is now observed. Physical passkeys, the new manual viewer, organizational-provider compatibility, and new-method Cucumber parity remain unverified. Independently signed SAML wrong-audience/recipient/expired assertions and wrong-service-principal Kerberos tickets remain separate implementation items. Historical local evidence and its browser versions remain recorded in [completion 30](30-authentication-lessons.md).
