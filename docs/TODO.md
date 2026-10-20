# Implementation todo list

- [x] **REPORT-AUTO — Publish after successful full runs.** Gated Pages publication, retry-safe artifact selection, fresh media URLs, stale-run protection and public Chrome/Edge playback checks passed end to end in [run 39371444928, attempt 2](https://github.com/orieken/testing-with-certs/actions/runs/39371444928): all 20 jobs, 92 selections and 952 videos. Attempt 1 correctly blocked publication after a registry download failure. See [completion 60](completion/60-automatic-pages.md) and the [publication guide](pages-report.md).

- [x] **REPORT-PAGES — Fresh complete native evidence and public video matrix.** Run all configured automated CI jobs plus the complete Debian/UBI9 browser recording matrix; independently verify downloaded reports, cases, videos and cleanup; publish the sanitized portable report to repository GitHub Pages and verify public playback. External-account and manual-only checks stay explicitly deferred. [Publication procedure](pages-report.md). Completed in [run 39357933655](https://github.com/orieken/testing-with-certs/actions/runs/39357933655): 19/19 jobs, 92 selections, 952 videos and verified public Chrome/Edge playback; [completion 59](completion/59-public-video-matrix.md).

## Additional authentication methods — 2026-10-15

Current coverage: X.509/mTLS user login with OIDC Authorization Code + PKCE, a separate certificate + password lesson, and OAuth client credentials with service mTLS are implemented. Certificate/password has a recorded 36-case native Chrome/Edge × Playwright/Cucumber matrix; see [authentication details](authentication.md), [coverage matrix](teaching-coverage.md), and [completion 18](completion/18-native-certificate-password-ci.md). Standalone mocked OIDC journeys do not establish real external-provider federation coverage.

Implement the remaining methods as separate teaching clients/routes. Preserve the certificate-required shop and its API certificate/token pairing checks. Provide a separate gateway entry point for certificate-free lessons; lesson tokens must remain excluded from business APIs unless that access is explicitly designed and tested.

2026-10-16 live progress: all five method implementations are present. Fresh disposable runs passed 60/60 real Chrome/Edge cases locally on Apple Silicon with Linux amd64 browser emulation. Credential-safe report scans and complete project cleanup passed. [Completion 30](completion/30-authentication-lessons.md) records commands, versions, fixes, reports, and limits. Independent native CI subsequently passed all 60 cases in [completion 31](completion/31-native-authentication-ci.md). Additional acceptance cases below remain open; the implementation items are no longer a request to build the flows from scratch.

Previous expanded native progress: [run 38997005710](https://github.com/orieken/testing-with-certs/actions/runs/38997005710) passed the previous 70-case authentication inventory, including the SAML recipient guard, wrong-service Kerberos case, exact-count gates, scanned reports, and fixture/stack teardown. All 15 workflow jobs also passed, including the 36-case certificate/password regression and final independent-evidence gate. [Completion 36](completion/36-native-expanded-authentication.md) records the correction found by native testing and independent downloaded-report validation.

Previous parity native progress: the [84-case matrix](teaching-coverage.md#authentication-protocol-matrix) passed in [run 39000153768](https://github.com/orieken/testing-with-certs/actions/runs/39000153768), including Password/TOTP Cucumber parity. All 15 jobs passed, including 36/36 certificate/password regression cases and the final evidence gate. [Completion 37](completion/37-password-otp-cucumber.md) records independent downloaded-report validation and an intermittent passkey follow-up.

Previous passkey native progress: the [98-execution matrix](teaching-coverage.md#authentication-protocol-matrix) passed in [run 39014538581](https://github.com/orieken/testing-with-certs/actions/runs/39014538581), including passkey Cucumber parity. All 15 workflow jobs passed, including 36/36 certificate/password regression cases and the final evidence gate. [Completion 38](completion/38-passkey-cucumber.md) records independently checked reports and remaining scope.

Previous OIDC native progress: the [108-execution matrix](teaching-coverage.md#authentication-protocol-matrix) passed in [run 39016710774](https://github.com/orieken/testing-with-certs/actions/runs/39016710774), including OIDC Cucumber parity. All 15 jobs passed, including 36/36 certificate/password regression cases and the final evidence gate. [Completion 39](completion/39-oidc-cucumber.md) records independent downloaded-report verification and the passkey setup correction.

Previous SAML native progress: the [130-execution matrix](teaching-coverage.md#authentication-protocol-matrix) passed in [run 39043010334](https://github.com/orieken/testing-with-certs/actions/runs/39043010334), including SAML Cucumber parity. All 15 workflow jobs passed. [Completion 40](completion/40-saml-cucumber.md) records independently checked reports and remaining scope.

Previous Kerberos native progress: the [140-execution matrix](teaching-coverage.md#authentication-protocol-matrix) passed in [run 39045132366](https://github.com/orieken/testing-with-certs/actions/runs/39045132366), including Kerberos Cucumber parity. All five methods now have both-runner Chrome/Edge evidence. All 15 jobs passed, including 36/36 certificate/password regression cases and the final evidence gate. [Completion 41](completion/41-kerberos-cucumber.md) records independently checked reports and remaining scope.

Previous role-mapping native progress: the [156-execution matrix](teaching-coverage.md#authentication-protocol-matrix) passed in [run 39047493381](https://github.com/orieken/testing-with-certs/actions/runs/39047493381), including the four SAML role-mapping cases in each runner/browser. All 15 jobs passed, including 36/36 certificate/password regression cases and the final evidence gate. [Completion 42](completion/42-saml-role-mapping.md) records independent downloaded-report verification and remaining scope.

Previous OTP lifecycle native progress: [run 39049927361](https://github.com/orieken/testing-with-certs/actions/runs/39049927361) passed the **176-execution matrix** at `5055345`: 48 Password/TOTP baseline/lifecycle executions in attempt 1 and 128 protocol executions in attempt 2. All 15 jobs are green after the recorded failed-job retry, including 36/36 certificate/password regression cases and the final gate. [Completion 43](completion/43-password-otp-session-refresh.md) records independently checked reports, cleanup, and the two open reliability follow-ups.

Previous passkey lifecycle native progress: [run 39074522181](https://github.com/orieken/testing-with-certs/actions/runs/39074522181) passed the **196-execution matrix** at `249ffb4` in its first attempt: 148 protocol and 48 Password/TOTP executions. All 15 jobs passed, including 36/36 certificate/password regression cases and the final gate. [Completion 44](completion/44-passkey-session-refresh.md) records independent downloaded-report checks and cleanup. Earlier reliability follow-ups remain open.

Previous OIDC lifecycle native progress: corrected [run 39086883915](https://github.com/orieken/testing-with-certs/actions/runs/39086883915) passed the **216-execution matrix** at `39ab25a`: 168 protocol and 48 Password/TOTP executions. All 15 jobs passed, including 36/36 certificate/password regression cases and the final gate. [Completion 45](completion/45-oidc-session-refresh.md) records independent downloaded-report checks, policy restoration/cleanup, and the earlier failed helper/diagnostic runs. Earlier reliability follow-ups remain open.

Previous SAML lifecycle native progress: [run 39090277725](https://github.com/orieken/testing-with-certs/actions/runs/39090277725) passed the **240-execution matrix** at `161dc03`: 192 protocol and 48 Password/TOTP executions, including 84/84 SAML. All 15 jobs passed, including 36/36 certificate/password regressions. [Completion 46](completion/46-saml-session-refresh.md) records independently checked reports, restoration/cleanup, the passkey script-readiness correction, and earlier failed attempts.

Previous Kerberos lifecycle native progress: [run 39095093262](https://github.com/orieken/testing-with-certs/actions/runs/39095093262) passed the **260-execution matrix** at `0d65396`: 212 protocol and 48 Password/TOTP executions, including 40/40 Kerberos. All 15 jobs passed, including 36/36 certificate/password regressions. [Completion 47](completion/47-kerberos-session-refresh.md) records independently checked native/local reports, ticket-cache/profile isolation, policy/session restoration, and cleanup.

Current native progress: recording [run 39100485175](https://github.com/orieken/testing-with-certs/actions/runs/39100485175) passed the 260-execution authentication inventory plus 36 certificate/password regressions at `907c327`, with all 15 jobs green. All 296 required executions now have accepted video coverage using native protocol/OTP and local certificate/password recordings. [Completion 51](completion/51-authentication-recordings.md) records exact gates, artifact provenance, combined report counts, and earlier partial runs.

| Delivered method | Local browser evidence | Remaining acceptance |
| --- | --- | --- |
| Password + TOTP | 48/48 passed across both runners | Baseline/lifecycle native acceptance passed; [completion 43](completion/43-password-otp-session-refresh.md) |
| Passkey enrollment/login | 48/48 baseline/lifecycle across both runners | Native CI passed; [completion 44](completion/44-passkey-session-refresh.md); physical devices remain outside virtual-authenticator evidence |
| Controlled external OIDC | 40/40 baseline/lifecycle across both runners | Native CI passed; [completion 45](completion/45-oidc-session-refresh.md); upstream-token and organizational-provider scope remain open |
| SAML | 84/84 baseline/lifecycle across both runners | Native role mapping, signed negatives, recipient guard, and broker lifecycle passed; [completion 46](completion/46-saml-session-refresh.md); upstream/provider follow-ups remain |
| Kerberos/SPNEGO | 40/40 baseline/lifecycle across both runners | Native lifecycle/parity passed, including wrong-service rejection; [completion 47](completion/47-kerberos-session-refresh.md); shared/platform follow-ups remain |


- [x] **AUTH-NEXT-01 — Password + TOTP.** Dedicated Keycloak flow, isolated disposable users, controlled enrollment, and runner-only code generation are implemented. Chrome and Edge cover successful login, incorrect password, incorrect/expired OTP, disabled users, logout, cookie-factor enforcement, and fresh-context/account isolation. Credential-safe reports and cleanup passed. All 14 cases passed locally and in [native CI](completion/31-native-authentication-ci.md). [Acceptance audit](completion/32-password-otp-acceptance.md) maps each requirement to its implementation and evidence. Cucumber parity passed 28/28 locally and natively in [completion 37](completion/37-password-otp-cucumber.md); broader refresh/cancellation probes remain under AUTH-NEXT-06.
- [ ] **AUTH-NEXT-02 — WebAuthn/passkeys.** Add a separate registration/login lesson and Chromium virtual-authenticator fixtures for Chrome and Edge. Cover registration, successful login, missing/wrong credentials, disabled users, logout, and fresh-context credential/session isolation. Explicitly distinguish virtual-authenticator evidence from physical key or biometric verification; document supported browser scope.
- [ ] **AUTH-NEXT-03 — External OIDC federation.** Add a controlled second identity-provider container and configure Keycloak brokering. Exercise real browser redirects, identity mapping, successful/rejected login, disabled users, callback/state failures, logout behavior, and session isolation. Keep live federation evidence separate from existing mocked OIDC examples.
- [ ] **AUTH-NEXT-04 — SAML 2.0 SSO.** The signed audience/recipient/expiry additions now pass locally with the recipient guard; the 22-case SAML suite passed within the full 56-case run. [Completion 35](completion/35-saml-recipient-matrix.md) records the fix, matrix gate, and subsequent [native evidence](completion/36-native-expanded-authentication.md). Role mapping subsequently passed in [completion 42](completion/42-saml-role-mapping.md); broader shared acceptance remains below. Original acceptance: Add a controlled SAML identity provider, metadata/signing-certificate provisioning, and a separate Keycloak broker/client lesson. Exercise successful/rejected login, identity/role mapping, invalid signature/audience/recipient and expired assertion rejection, logout behavior, and session isolation. Use protocol-level fixtures where browser interaction alone cannot produce invalid assertions.
- [x] **AUTH-NEXT-05 — Kerberos/SPNEGO.** Containerized KDC, deterministic hostnames, isolated test principals/keytabs, ticket provisioning, and narrow integrated-auth policies are implemented. Valid/missing/expired/wrong-service tickets, disabled users, logout, lesson-token/API boundaries, and fresh-profile isolation passed 10/10 in Chrome/Edge locally and in [native CI](completion/36-native-expanded-authentication.md). Scope is automated Linux Chrome/Edge; other desktop/platform/manual configurations remain unverified. Shared Cucumber/session/cancellation follow-ups remain under AUTH-NEXT-06.
- [ ] **AUTH-NEXT-06 — Shared acceptance and CI.** For every new lesson, verify token identity and intended audience, reject lesson tokens at business APIs, test applicable authorization failures, and publish scanned Playwright HTML/JUnit/video evidence with reliable cleanup. Add native CI jobs and update the authentication guide and coverage matrix only after observed passes. Add Cucumber parity using shared models where the method supports the existing runner pattern.

The requested implementation order is complete through Kerberos. AUTH-NEXT-01 is closed against its stated Playwright acceptance criteria. The remaining unchecked acceptance items retain their original full requirements until their remaining negative fixtures and shared acceptance requirements are observed. Native CI for the 60 implemented cases is complete; signed SAML audience/recipient/expiry rejection is now observed locally; native repetition of the 56-case suite and 14-case TOTP suite is now complete in [completion 36](completion/36-native-expanded-authentication.md); Cucumber parity subsequently passed for all five methods in [completion 41](completion/41-kerberos-cucumber.md). SAML role mapping subsequently passed in [completion 42](completion/42-saml-role-mapping.md). Password/TOTP session/refresh behavior subsequently passed in [completion 43](completion/43-password-otp-session-refresh.md). Passkey session/refresh behavior subsequently passed in [completion 44](completion/44-passkey-session-refresh.md). Controlled external OIDC broker session/refresh behavior subsequently passed in [completion 45](completion/45-oidc-session-refresh.md). SAML broker session/refresh behavior subsequently passed in [completion 46](completion/46-saml-session-refresh.md). Kerberos token/session behavior subsequently passed in [completion 47](completion/47-kerberos-session-refresh.md); cancellation and platform/manual scope remain open.

- [x] **Native authentication CI:** all 60 new cases, 36 certificate/password regression cases, and all 15 workflow jobs passed in [run 38923211484](https://github.com/orieken/testing-with-certs/actions/runs/38923211484). Scanned uploaded reports and fixture cleanup passed; see [completion 31](completion/31-native-authentication-ci.md).
- [x] **Kerberos wrong-service fixture, local acceptance:** legitimate service-only tickets for `HTTP/wrong.magic.test@MAGIC.TEST` were submitted to the real endpoint and rejected with HTTP 400 in Chrome and Edge. Valid/missing/expired/disabled controls also passed; scans and cleanup verified. [Evidence](completion/34-kerberos-wrong-service.md).
- [x] **SAML signed negative assertions, local acceptance:** unchanged re-signed control, wrong audience, wrong recipient, and expiry all pass in Chrome/Edge. A lesson-only recipient mapper closes a measured gap in pinned upstream Keycloak. The complete expanded lesson run passed 56/56; the matrix at that increment recorded 70 local cases across runs versus the historical 60-case native baseline. [Evidence](completion/35-saml-recipient-matrix.md).
- [x] **Native expanded-matrix evidence:** all 56 lesson cases and 14 TOTP cases, recipient guard, exact-count gates, credential-safe uploads, and fixture/stack cleanup passed in [run 38997005710](https://github.com/orieken/testing-with-certs/actions/runs/38997005710). [Completion 36](completion/36-native-expanded-authentication.md) records downloaded-report verification and the native timing correction.
- [x] **Password + TOTP Cucumber parity:** seven independent scenarios per browser/runner passed 28/28 locally and natively. Randomized Cucumber order, safe reports, exact counts, fixture cleanup, and teardown passed. The full native protocol matrix passed 84/84; [completion 37](completion/37-password-otp-cucumber.md) records the evidence.
- [x] **Passkey readiness and native diagnostic verification:** two earlier runs failed the invalid-signature error-page visibility check (Edge then Chrome); extending the wait did not resolve it. Fresh local 56/56 and native 56/56 repetitions subsequently passed. A later recurrence during OIDC parity showed that no altered signature was submitted and no identity appeared. [Completion 39](completion/39-oidc-cucumber.md) records explicit virtual-authenticator focus and a mandatory submission assertion. Safe Boolean diagnostics remain; the setup correction does not establish the cause of all earlier failures. The mandatory altered-signature submission check failed again in Chrome during completion 43’s first native attempt; unchanged-source retry is recorded there. Completion 46’s first native attempt again failed Chrome’s altered-signature submission poll; its second attempt failed first enrollment. Controlled delayed-script old-versus-ready tests reproduced both symptoms and verified a load-event readiness correction; completion 46 records subsequent validation. Broader historical causality remains unproven. [Completion 55](completion/55-passkey-safe-diagnostics.md) closes the reporter gap with strict allowlisted forwarding, saved Boolean diagnostics in both runners, and 56/56 fresh local baseline repetitions. [Completion 56](completion/56-native-passkey-diagnostics.md) completes current-source native verification: all 48 passkey executions and 128 saved/logged events passed in run 39155716616, attempt 1, with all 15 jobs green. Historical attribution remains limited; finite passing evidence is not a guarantee against recurrence.
- [x] **Passkey safe diagnostics and repeat acceptance:** both runners now export strictly allowlisted diagnostic records. Ten unit/reporting checks and 56/56 real Chrome/Edge baseline executions across two rounds passed, with 96 videos, exact diagnostic gates, artifact scans, and verified cleanup. [Completion 55](completion/55-passkey-safe-diagnostics.md). Native current-source verification subsequently passed in completion 56.
- [x] **Passkey Cucumber parity:** seven independently enrolled scenarios per browser/runner passed 28/28 locally and natively. The expanded full protocol suite passed 70/70, including randomized Cucumber order, safe reports, fixture cleanup, teardown, and independent downloaded-report validation. [Completion 38](completion/38-passkey-cucumber.md) records acceptance.
- [x] **OIDC Cucumber parity:** five shared scenarios in each browser/runner passed 20/20 locally and natively. Fresh contexts/fixtures, randomized order, safe reports, the 80/80 protocol gate, and fixture/stack cleanup passed. [Completion 39](completion/39-oidc-cucumber.md) records acceptance and the virtual-authenticator correction encountered during regression.
- [x] **SAML Cucumber parity:** all 11 shared scenarios in each browser/runner passed 44/44 locally and natively. The expanded protocol suite passed 102/102, including randomized Cucumber order, signed controls/negatives, safe reports, fixture cleanup, teardown, and independent report verification. [Completion 40](completion/40-saml-cucumber.md) records acceptance; role mapping remains open.
- [x] **Kerberos Cucumber parity:** five shared checks in each browser/runner passed 20/20 locally and natively. Fresh profiles/cache selection, randomized ordinary ticket order, a separate disabled-account phase, actual wrong-service rejection, no password fallback, safe reports, the 112-case protocol gate, and cleanup passed. [Completion 41](completion/41-kerberos-cucumber.md) records independent report verification.
- [x] **SAML role-mapping acceptance:** all four new shared cases passed in each runner/browser (16 executions), and SAML passed 60/60 total. Administrator-managed signed attributes, exact reviewer mapping, absent/unrecognized values, later-assertion role withdrawal, restricted scope, and business-API denial passed locally and natively. [Completion 42](completion/42-saml-role-mapping.md) records migration/idempotence checks and independent evidence.
- [x] **Password/TOTP session and refresh acceptance:** five shared lifecycle cases passed all 48 baseline/lifecycle executions locally and natively, including disposable client-specific lifetimes, verified restoration/cleanup, and credential scans. All 15 workflow jobs passed after a recorded same-source failed-job retry. [Completion 43](completion/43-password-otp-session-refresh.md) records acceptance and retry history.
- [x] **Passkey session and refresh acceptance:** all five shared cases passed in each runner/browser (20 executions), with 48/48 total passkey executions locally and natively. Isolated virtual authenticators, mandatory signed assertions after expiry, refresh identity/audience/API boundaries, logout invalidation, same-token client-binding control, actual session expiry, policy restoration, scanned reports, and teardown passed. [Completion 44](completion/44-passkey-session-refresh.md) records acceptance.
- [x] **Controlled external OIDC session and refresh acceptance:** five shared cases passed in each runner/browser (20 executions), with 40/40 total OIDC executions locally and natively. Real provider re-entry, verified mapped identity, private broker refresh, lesson audience/API denial, logout invalidation, same-token client-binding control, actual session expiry, client-policy restoration, scanned reports, and teardown passed. [Completion 45](completion/45-oidc-session-refresh.md) records the helper correction, failed/probe history, provider SSO behavior, and upstream-token limits.
- [x] **SAML session and refresh acceptance:** six shared broker expiry/refresh/logout/client/session cases include mapped-role preservation and a separate no-role refresh control. All 84 baseline/lifecycle executions passed locally and natively, including isolated accounts, client-scoped lifetimes, verified restoration, and scanned reports. [Completion 46](completion/46-saml-session-refresh.md) records acceptance and upstream-role limits.
- [x] **REPORT-VIDEO-01A — Show all saved videos in the browser matrix report:** HTML players/downloads now accompany every available recording in all 28 existing matrix selections, grouped by suite/browser/runner/user/OS/run. Portable links, missing-folder/no-recording notices, safe discovery, and a rebuild command passed validation against 412 saved files. [Completion 48](completion/48-matrix-video-gallery.md) records evidence and scope.
- [x] **REPORT-VIDEO-02 — Style the recording report and show spec outcomes:** responsive cards, summary counts, search, browser/runner/result filters, exact Playwright spec/test/result labels, and unambiguous content-matched recording copies are implemented. Validated against all 412 saved files: 384 Playwright files linked, 28 legacy Cucumber files explicitly unlinked. [Completion 49](completion/49-matrix-report-style-spec-results.md).
- [x] **REPORT-VIDEO-03 — Filter recordings by authentication type:** explicit manifest auth types, labels, per-type video counts, historical certificate-matrix compatibility, unknown-type handling, and combined auth/result filters passed operator and browser checks. Other methods initially showed zero; completion 51 subsequently imports accepted recordings for every implemented auth method. [Completion 50](completion/50-matrix-auth-filter.md).
- [x] **REPORT-VIDEO-01B — Capture and integrate authentication recordings:** every required auth/certificate-password execution (296 across both browsers/runners) has accepted privacy-screened videos and exact case/phase/result metadata. Native/local recording gates, scans, playback, link checks, and cleanup passed. The combined gallery contains 1,128 files across seven auth types, including repeated runs and pages. [Completion 51](completion/51-authentication-recordings.md) records provenance, the remaining-seconds timing correction, and the certificate artifact-upload correction.
- [x] **REPORT-VIDEO-01C — Missing recordings and future Cucumber associations:** partial bundles retain indexed case names/results, show missing/expired notices without broken players, and recover after restoration. Future certificate-shop Cucumber captures write exact scenario/video metadata after browser closure. Operator and hook tests passed. Historical 28 clips remain unlinked because no exact association was saved. [Completion 52](completion/52-recording-availability.md).
- [x] **REPORT-VIDEO-01D — Live Cucumber metadata validation and disabled recording evidence:** all eight Debian/UBI9 × Chrome/Edge × customer/admin selections passed 28 scenarios with exact video mappings. Two additional Chrome/Edge selections passed six scenarios with explicit disabled policies and zero videos. The integrated recording gate, gallery filtering/playback, scans, and disposable-project cleanup passed. Combined gallery: 1,156 videos, six disabled cases; historical 28 clips remain unlinked. [Completion 53](completion/53-live-cucumber-recording-metadata.md).
- [x] **Kerberos session and refresh acceptance:** five shared cases now cover access expiry/re-entry, private refresh after removing an owned ticket cache, logout invalidation, client binding, and actual client-session expiry. Each invocation owns a copied cache and browser profile. All 40 baseline/lifecycle executions passed locally and natively, including verified client-policy restoration, imported-account session cleanup, scanned reports, and teardown. [Completion 47](completion/47-kerberos-session-refresh.md) records acceptance; platform/manual and KDC revocation limits remain.
- [x] **Regional report assertion reliability:** replaced count-then-snapshot with a retrying exact ordered-ID assertion. Controlled table replacement and wrong-order rejection passed in Chrome/Edge; the full local provider gate and 16 real browser/runner journeys passed without retries. Numeric request diagnostics found no overlapping identical requests in this run; historical native causality is not claimed. Coverage matrix and gallery updated; cleanup verified. [Completion 54](completion/54-regional-assertion-reliability.md).

Status reconciled by TEST-04 on 2026-10-10 (America/Chicago): Prompts 01–13 retain their recorded local evidence. Native run [38097316475](https://github.com/orieken/testing-with-certs/actions/runs/38097316475) passed the complete existing workflow, including live contracts/security, all eight customer/admin browser selections, the separate 36-case certificate/password job, scanned/readable text uploads and cleanup. [Completion 25](completion/25-pr-base-contract-evidence.md) records actual unchanged/additive/breaking PR-base acceptance/rejection against committed main; temporary probe mutations were reverted and their draft PRs closed without merging. TEST-03/05–10 now also have their named native consumer/fault/regional scenarios observed under TEST-11 in [completion 26](completion/26-independent-ci-evidence.md), separately from the required live-provider gate. Native manual viewer/operator and literal clean-checkout/repeat-startup remain unverified. Historical failures and limitations remain in their original completion notes.

## Additional identity-provider examples — 2026-10-16

Add independent providers to expose interoperability assumptions hidden by the current Keycloak-to-Keycloak federation tests. These are planned examples, not observed coverage. Preserve the existing authentication acceptance backlog above. Provider implementation order: authentik, Entra ID, Auth0, Okta, Cognito; ZITADEL is an optional extension.

Account setup is now documented for every hosted option in the [external provider setup index](providers/README.md). Per user direction, account creation and live cloud integration are deferred. Documentation is complete; provider implementation and acceptance checkboxes remain open. No external accounts or resources were created.

- [x] **IDP-01 — authentik.** Pinned disposable Open Source provider, separate OIDC/SAML broker lessons, automated users/groups/metadata, safe recordings, and verified cleanup are complete. Native run 39168182768 passed 56/56 Chrome/Edge × Playwright/Cucumber executions and all 16 jobs. Independent downloaded gates and scans passed; all 64 videos are in the matrix gallery. [Completion 57](completion/57-authentik-provider.md) records scope and local Docker limitations; [implementation guide](authentik-lessons.md).
- [ ] **IDP-02 — Microsoft Entra ID.** Preparation started: [tenant handoff and setup sequence](entra-lessons.md), nonsecret tenant-specific plan generator, and boundary unit checks are present. The [test-tenant creation runbook](entra-test-tenant.md) is complete. Per user direction, live tenant creation/provisioning is deferred; no resources provisioned and no live coverage claimed. Add OIDC and SAML examples using a dedicated authorized test tenant. Verify tenant/issuer restrictions, identity/group mapping, disabled-user behavior, and logout. Establish Free-edition coverage first; label Conditional Access or other licensed scenarios separately. Confirm tenant availability and permissions before provisioning.
- [ ] **IDP-03 — Auth0.** [Account setup guide](providers/auth0.md) complete; live setup deferred. Add hosted OIDC/PKCE, organization-boundary, and available passkey examples in a dedicated Free tenant. Verify actual tenant entitlements before adding MFA or enterprise-connection scenarios. Document free-plan limits and distinguish trial features.
- [ ] **IDP-04 — Okta.** [Account setup guide](providers/okta.md) complete; live setup deferred. Add workforce OIDC/SAML examples with an Integrator Free Plan org, test users, and supported authenticator policies. Document business-email signup eligibility, ten-active-user limit, rate limits, and inactivity deactivation; do not rely on the retired Developer Edition.
- [ ] **IDP-05 — Amazon Cognito.** [Account setup guide](providers/cognito.md) complete; live setup deferred. Add a disposable user pool/app client, managed-login OIDC/PKCE, and controlled upstream federation. Use Lite/Essentials where appropriate; keep the test-user set within the relevant free allowance. Account explicitly for chargeable M2M requests, messaging, and optional services; implement resource cleanup.
- [ ] **IDP-06 — ZITADEL (optional).** [Account setup guide](providers/zitadel.md) complete; live setup deferred. Add a pinned self-hosted OIDC/SAML and passkey/organization example. Prefer the community deployment for repeatable CI; evaluate the Cloud Free plan separately if useful.
- [x] **Authentik lifecycle acceptance.** Native run 39316975644 passed all 104 authentik executions, including 48 new lifecycle executions, and all 16 jobs at `c86489c`. Independent downloaded gates verified 120 videos, 64 safe group-stage events, restored membership, scanned artifacts and teardown. The gallery now has 206 selections and 1,872 videos. [Completion 58](completion/58-authentik-lifecycle.md) records scope, startup corrections, the earlier group re-entry timeout, and local Docker limitations.
- [ ] **IDP-07 — Shared provider acceptance.** Reuse login, identity/issuer/audience, callback/state rejection, disabled-user, logout, session-isolation, and business-API-denial assertions. Use separate provider routes/configuration and dedicated test accounts. Distinguish `provider → Keycloak → app` broker evidence from direct `provider → app` evidence; direct examples need a provider-neutral OIDC adapter in place of assumptions in `keycloak-js`. Keep local-container jobs separate from explicitly configured cloud integration jobs, scan reports, verify cleanup, and never count unavailable cloud jobs as passes.

### Free/developer/student access checked 2026-10-16

Free software excludes the cost of hosting and CI compute. Hosted allowances and feature entitlements must be rechecked when each example is implemented. No accounts, subscriptions, or paid resources were created for this planning update.

| Provider | Free route for our examples | Limits and student/developer options |
| --- | --- | --- |
| authentik | Free self-hosted Open Source edition; OIDC and SAML included | Best first disposable local provider. Enterprise features/support are separate. [Official pricing](https://goauthentik.io/pricing/) |
| Entra ID | Entra ID Free for baseline identity/SSO in an available tenant | Advanced licensed features are separate. New workforce-tenant creation has eligibility restrictions; do not assume arbitrary extra tenants are free to create. Azure for Students offers eligible students $100 credit for 12 months without a credit card; it is not an automatic Entra premium license. Microsoft 365 E5 developer sandboxes require qualifying membership. [Free edition](https://learn.microsoft.com/en-us/azure/cost-management-billing/manage/microsoft-entra-id-free), [tenant restrictions](https://learn.microsoft.com/en-us/entra/fundamentals/create-new-tenant), [students](https://azure.microsoft.com/en-us/free/students/), [developer program](https://learn.microsoft.com/en-us/office/developer-program/microsoft-365-developer-program) |
| Auth0 | Hosted Free plan, up to 25,000 monthly active users | Current pricing lists passkeys, five organizations, and one enterprise connection. Broader MFA/features vary by plan; verify actual tenant configuration. No student status needed for Free. [Official pricing](https://auth0.com/pricing) |
| Okta | Integrator Free Plan for integration development/testing | Ten active users; unique business signup email; deactivates after 90 days without sign-ins unless an app is submitted to OIN. No student status needed, but signup eligibility applies. [Official plan limits](https://developer.okta.com/docs/reference/org-defaults/) |
| Cognito | Lite/Essentials: 10,000 monthly active direct/social users; upstream SAML/OIDC federation: 50 monthly active users | These are distinct allowances, not interchangeable. M2M token requests have no free tier; SMS/email and other services can add charges. Use an authorized AWS account; student credits are not required for the service allowance. [Official pricing](https://aws.amazon.com/cognito/pricing/) |
| ZITADEL | Community self-hosting without subscription fees; Cloud Free currently lists 100 daily active users | Cloud Free lists one instance, three active external identity providers, and one administrator. Enterprise support/licensing differs. No student status needed for these free routes. [Offering guide](https://help.zitadel.com/choosing-the-right-zitadel-offering-a-guide-to-our-plans-and-models), [cloud limits](https://zitadel.com/pricing/detail) |

## Planning baseline

- [x] Capture the user's nine clarification answers and original widget requirement.
- [x] Inspect the magic shop, existing certificate helpers and UBI9 browser recipe.
- [x] Separate user certificate issuance from Keycloak authentication.
- [x] Define topology, three language responsibilities, package boundary and manual mode.
- [x] Write sequenced prompts and a test/acceptance matrix.
- [x] Add planned Mermaid diagrams for infrastructure, provisioning, login, service requests, reporting, runner modes and certificate lifecycle.
- [x] Specify canonical OpenAPI inputs and live Playwright contract testing for all three business APIs.

## 01 — Feasibility gate

- [x] Pin compatible browser, Playwright, Saturday, Cucumber and Keycloak versions.
- [x] Confirm published package availability or reproducible packed-source fallback.
- [x] Build and launch actual Chrome and Edge in the documented supported Bookworm fallback image; verified UBI9 package gaps prevented its browser use.
- [ ] Exercise native Linux amd64 and Apple Silicon emulation; automated real Chrome/Edge login passed on both, while a native manual selected-user viewer remains unverified.
- [x] Observe a human selected-user login through the loopback manual viewer; customer identity and role were visible in remote Chrome.
- [x] Choose and document any justified base-image/remote-runner fallback.
- [x] Prove certificate login through both origins with no TLS bypass on Apple Silicon emulation.
- [x] Prove native certificate installation/auto-selection in each manual browser on Apple Silicon emulation.
- [x] Prove wrong/no/unknown certificates, mismatched cookies and identity claims fail safely on Apple Silicon emulation.
- [x] Prove initial CRL reload and new-connection rejection on Apple Silicon emulation.
- [x] Update workflow diagrams with the verified compatibility and authentication decisions.

Observed partial work (does not close the runtime checks above):

- [x] Record published Saturday availability and a licensed, content-hashed certificate-helper tarball.
- [x] Resolve signed Chrome/Edge metadata and pin the browser package dependency closure.
- [x] Verify isolated UBI9 issuance, initial CRL, offline revocation rejection and server hostname validation.
- [x] Add spike-specific architecture/workflow overlays and distinguish them from the planned full stack.

## 02 — Workspace and imported foundation

- [x] Scaffold app, package, testing, three services and infrastructure directories.
- [x] Copy useful UI/data/assets/test models with file hashes and notices.
- [x] Exclude mock auth, plaintext credentials and nested framework-source dependencies from the imported UI and testing tree.
- [x] Define domain dictionary, planned OpenAPI operation inventory, ownership and role/scope matrix (canonical YAML still pending).
- [x] Define seed identities, regions, dates and independently known totals (fixtures validated offline; bootstrap remains pending).
- [x] Author three canonical OpenAPI specs, shared schemas and public/private operation metadata (static validation passed; live providers pending).
- [x] Pin OpenAPI lint/bundle/code-generation tools and scaffold the Playwright contract validator and coverage manifest (five offline validator tests pass; live provider coverage remains open).

## 03 — Containers and PKI

- [x] Implement pinned images, Compose profiles/networks/health dependencies.
- [x] Generate user/service/server trust domains and leaves in containers.
- [x] Isolate signing keys, service keys and selected-user volumes.
- [x] Implement issuance/renewal/revocation/CRL publication with persistent serial state.
- [x] Configure HAProxy shop mTLS, auth passthrough, backend mTLS and exact origins.
- [x] Configure private PostgreSQL databases/grants and verified TLS.
- [x] Add the host-runtime-free `lab` wrapper and explicit project reset.
- [x] Verify no unplanned published ports, TLS bypasses or image-baked secrets.
- [x] Reconcile infrastructure/provisioning diagrams with Compose networks, ports, volumes and startup dependencies.

## 04 — Keycloak

- [x] Add idempotent realm, users, roles, clients, audiences and scopes.
- [x] Configure certificate-required login and protected unique identity mapping.
- [x] Keep operator bootstrap privileges separate from shop-admin.
- [x] Issue paired service credentials with explicit audience/scope restrictions.
- [x] Exercise disabled/unknown user, cookie reuse, refresh and session disable.
- [x] Document and test token TTL/revocation residual lifetime.

## 05 — Local Saturday package

- [x] Implement core types, file/issuer-command providers and Keycloak adapters.
- [x] Add multiple exact-origin certificate mapping and arbitrary identities.
- [x] Add Playwright and Cucumber adapters using shared resolution.
- [x] Add manual-browser manifest and explicit lifecycle CLI.
- [x] Test redaction, path/key validation and namespace-restricted cleanup.
- [x] Pack/install in an independent consumer and scan package contents.
- [x] Exercise the package issuer adapter and lifecycle CLI against an isolated live CA; verify renewal, CRL revocation and rejected leaf.
- [x] Wire the manual manifest into the lab's native Chrome/Edge import path and repeat selected-user sign-in.

## 06–08 — Three business APIs

- [x] Go: catalog browse/detail, item maintenance and private quotes.
- [x] Go: validate JWT and certificate identity, enforce roles and scoped service caller, persist seeded items in its own database, and serve the authenticated bundled OpenAPI artifact.
- [x] Go: pass service-specific live Playwright contracts and six-operation coverage gate on Apple Silicon amd64 emulation.
- [x] Node: owned profiles/orders, server-computed checkout and idempotency.
- [x] Node: persistent role-valid widgets and admin user/order lists.
- [x] Node: paginated/revision-aware service-only reporting feed.
- [x] Node: JWT/certificate pairing, own-database migration/seed, authenticated OpenAPI artifact, and ten-operation live Playwright contract coverage on Apple Silicon emulation.
- [x] Python: admin-only regional sales, customer lists and GeoJSON.
- [x] Python: internal follow-up notes/status with no outbound messaging.
- [x] All APIs: JWT issuer/audience/signature/lifetime/capability validation.
- [x] All APIs: transport identity allowlists and certificate/token pairing checks.
- [x] All APIs: contract tests, migrations/seeds, bounded queries and timeouts.
- [x] All APIs: derive or equivalence-check transport types/validation from canonical OpenAPI; package and expose authenticated internal spec artifacts.
- [x] Go, Node and Python: pass service-specific live Playwright contract suites as each service is implemented.

## 09 — Vue and Leaflet

- [x] Replace localStorage/mock auth with Keycloak PKCE and memory-held tokens.
- [x] Restore shop, details, cart, simulated checkout and own account/orders; live customer runs passed in Chrome and Edge.
- [x] Build admin users/orders/sales view and synchronized map/table filters; live admin runs passed in Chrome and Edge.
- [x] Add/remove authorized widgets and persist layouts; live customer toggle survived a fresh sign-in.
- [x] Add synthetic follow-up note/status UI; live admin create/update survived reload in both browsers.
- [x] Provide local map assets, accessible table controls and error/empty states.
- [x] Test API-enforced authorization as well as visible UI behavior; customer browser direct admin request returned 403 and provider contracts passed.

## 10 — Manual browser

- [x] Start selected-user Chrome/Edge using the same runner image.
- [x] Import certificate/trust into a fresh browser HOME and verify loaded policies.
- [x] Expose credential-protected noVNC on loopback only.
- [x] Verify user switching cannot retain old certificates/cookies/tokens.
- [x] Demonstrate renewal/revocation and document fresh-connection behavior.
- [x] Validate local Apple Silicon operation; native GitHub Linux manual-viewer operation remains unverified.
- [x] Confirm a human click-through in the current Compose viewer for both customer Chrome and admin Edge; the user confirmed shop-admin in Edge and `customer-waterdeep` in Chrome on Apple Silicon emulation.

## 11 — Teaching suites and security evidence

- [x] Record local Playwright Test Chrome/Edge UI slice with per-test WebM video and HTML/JUnit report; keep fixture-backed UI evidence distinct from live API evidence.
- [x] Share Saturday site/page/element/flow models across both runners.
- [x] Run Chrome and Edge examples under both Cucumber and Playwright Test.
- [x] Cover login, roles, orders, widgets and regional map flows in the core teaching examples.
- [x] Map every required test-plan ID to observed, partial or open evidence in `docs/teaching-coverage.md`.
- [x] Verify token/cert failures, spoofing, direct access, service pairing and ownership; JWT-01 signed negatives returned 401 at all three live APIs in a disposable realm.
- [x] Verify parallel isolation, package consumption and offline-map determinism.
- [x] Export local Playwright HTML/JUnit/WebM, Cucumber JSON/JUnit and scenario telemetry; enforce a credential-artifact scan.
- [x] Complete browserless Playwright contract coverage for every public/private business operation and applicable failure responses on Apple Silicon emulation.
- [x] Demonstrate malformed responses fail validation and one-byte deployed contract drift is detected.

## 12 — CI and handoff

- [x] Build/run isolated Compose stack in Linux amd64 CI; the second GitHub push passed startup, live contracts/security and all eight real-browser selections, plus cleanup.
- [x] Gate CI on OpenAPI validity, generated/spec drift, conservative breaking changes and live contract coverage before browser suites: native workflow 38097316475 and actual PR unchanged/additive/rejection steps in completion 25. Separate consumer/fault CI jobs and their native outcomes are recorded in completion 26.
- [x] Implement the conservative OpenAPI base-bundle comparison and test its unchanged, additive and changed cases in a pinned container; actual committed-base PR acceptance/rejection is recorded in completion 25.
- [x] Pass a disposable Apple Silicon CI-equivalent stack through live contracts, security, and all Chrome/Edge × Playwright/Cucumber × customer/admin selections; scan reports and remove only that project's volumes.
- [x] Add architecture/mount/TLS checks, the 23-operation/92-status contract coverage gate, and a measured Go/TypeScript/Python complexity cap over authored source; two existing transport handlers have explicit non-increasing baselines.
- [x] Verify a fresh project with new volumes and repeat startup without reset: the existing realm and a customer database marker survived; database TLS/isolation and PKI/CRLs re-verified. A literal clean Git checkout remains untested after the initial commit.
- [x] Write teaching guide and operational troubleshooting steps.
- [x] Reconcile architecture/workflow diagrams with implemented behavior and observed/planned CI status; link them from the teaching guide.
- [x] Render all 20 Mermaid blocks from the Markdown sources with a digest-pinned container; inspect the topology, infrastructure and CI layouts, and simplify the two crowded overviews.
- [x] Demonstrate zero host certificate installation/management in the audited Apple Silicon run; user/admin trust settings and login/System keychain fingerprints were unchanged before/after containerized PKI and security tests.
- [x] Record historical Chrome 154.0.8037.97 and refreshed Chrome 155.0.8059.39, Edge 154.0.4258.62, Node 24.10.0 and pinned base/container versions with Apple Silicon and native GitHub browser results; the updated runner also passed existing native workflow 38097316475; this does not establish native evidence for separate local-only scenarios.
- [x] Document limitations and possible package upstreaming in the teaching guide and completion note; no package was published.

## 13 — Operator CLI/TUI (after the core lab)

- [x] Build a Go operator CLI/TUI with the Charm stack: Bubble Tea for interaction, Bubbles for status/list components, and Lip Gloss for display. Pin compatible versions and build the host-specific binary in a container; the `lab` wrapper must not require host Go.
- [x] Let the operator start/stop the named Compose services and profiles, show dependencies and current state, and require an explicit confirmation for destructive or data-affecting actions. Keep reset a separate explicitly named operation.
- [x] Show bounded readiness/health results for HAProxy, Keycloak, UI, PostgreSQL, all three business APIs, and the manual/test runner without treating a running container as a healthy service.
- [x] Expose `operator healthcheck` (with `health` alias): require all seven core services healthy and check the selected-user viewer when present; verify against the live Apple Silicon stack.
- [x] Gather local, redacted telemetry from Compose state, bounded logs, test reports and certificate metadata (issuer, serial, expiry, CRL publication age); never display or export private keys, tokens, passwords or full certificate bundles.
- [x] Run containerized certificate/communication diagnostics: exact-origin hostname and trust checks, no-cert and revoked-cert rejection on fresh connections, gateway/backend mTLS, Node-to-Go and Python-to-Node caller/token pairing, and public rejection of private routes. Do not disable TLS verification.
- [x] Launch the existing Playwright contract, Playwright browser and Cucumber suites from the TUI with selected test identity/browser; report test IDs and artifacts without inventing a parallel test runner or bypassing the real Chrome/Edge requirement.
- [ ] Test command boundaries, cancellation/timeouts, status refresh, redaction, failure display and terminal fallback; Apple Silicon checks passed, native Linux operator remains unverified.
- [x] Update the architecture/workflow Mermaid diagrams and operator guide with the implemented control path, privilege boundary and observed behavior; write `docs/completion/13-operator-tui.md` with exact container build/test commands and results.

## 14 — Agent adoption handoff

- [x] Write a target-agnostic explanation of the reference certificate, login, service and runner boundaries with explicit observed-platform limits.
- [x] Provide ordered copyable prompts for other agents to inventory, prove, implement and test certificate paths in their own repositories without copying this lab's secrets or assumptions.
- [x] Link the handoff from the root and documentation entry points and record the first source-commit decision and remaining CI/platform limits.

## Testing expansion — prioritized agent checklist

See the [prioritized testing checklist](testing-scenario-checklist.md) for TEST-01–11, ordered by priority with handoff prompts, dependencies and acceptance criteria. TEST-01/03 have local status/fault evidence in [completion 19](completion/19-checkout-dependency-faults.md); TEST-02 has native certificate/password evidence in completion 18. TEST-08 has local concurrent idempotency/lost-response evidence in [completion 20](completion/20-checkout-idempotency.md). TEST-05/07 have local Prism compatibility/UI failure evidence in [completion 21](completion/21-prism-compatibility.md) and [completion 22](completion/22-prism-browser-failures.md). TEST-06/09 have Mokapi compatibility and real insights pagination fault evidence in [completion 23](completion/23-mokapi-reporting-sequences.md). TEST-10 has real provider and browser boundary evidence in [completion 24](completion/24-regional-reporting-boundaries.md). TEST-04 is recorded in [completion 25](completion/25-pr-base-contract-evidence.md); TEST-11 is complete with separate native reports and intentional-failure cleanup/red-gating evidence in [completion 26](completion/26-independent-ci-evidence.md). Local TEST-06/09/10 work was committed and pushed as `d637aa7`; the corresponding native jobs were added in `54ef7dd`, corrected for Linux harness behavior in `20272cf` and verified in completion 26.

## Deferred scope

- Stock Firefox or Playwright Firefox.
- Production certificate enrollment/self-service identity proof and CA availability.
- Real payments, atomic inventory reservation, external customer messages.
- Certificate-bound OAuth tokens and automated CA rotation.
- Moving/publishing `saturday-keycloak` into the upstream Saturday repository.

### Learning examples — mocking for tests

FEATURE-01–03 are isolated examples of mocking dependencies for tests. They must not change app behavior, replace the lab's Keycloak, reroute the normal HAProxy listeners, weaken API verification, or add a login fallback. Follow the shared container, TLS, secrets and evidence instructions in the [agent checklist](testing-scenario-checklist.md). Keep mock results explicitly separate from real authentication/provider evidence. User-directed priority: complete FEATURE-01–03 before the other backlog items. These isolated examples are now observed; see [completion 16](completion/16-mocking-examples.md) and [copyable commands](../spikes/mock-auth/README.md).

- [x] **FEATURE-01 — Signed-token mocking example. Priority: medium.**

  **Handoff prompt:** Create a container-only example in `spikes/mock-auth/` that generates an ephemeral test signing key and demonstrates JWT verification in an isolated test consumer. Use synthetic claims shaped like the lab's claims, without reusing real credentials or trusted realm keys. Demonstrate valid, expired, wrong-audience and altered-signature tokens. Document that this tests token handling and does not authenticate a user or bypass Keycloak in the app.

  **Done when:** The isolated consumer accepts the valid fixture and rejects each negative fixture; keys/tokens stay container-held; no app verifier, trusted JWKS, realm or routing changes are required.

- [x] **FEATURE-02 — OIDC dependency mocking example. Priority: medium.**

  **Handoff prompt:** Build a standalone disposable container example with a pinned OIDC mock server and a dedicated test consumer. Demonstrate discovery, JWKS, token handling and supported failure scenarios. Verify the tool's actual protocol support before choosing scenarios. Use a private test network and test-local configuration; leave Vue, Keycloak and HAProxy unchanged. Explain which protocol behaviors are mocked and which authentication guarantees remain untested.

  **Done when:** The test consumer exercises documented success/failure cases against the mock with verified TLS, repeatable reset and cleanup. The example requires no changes to the app's issuer, clients, routes or login flows.

- [x] **FEATURE-03 — API dependency mocking example. Priority: medium; requires a bounded tool compatibility experiment (completed for mock-only Prism use); full TEST-05/06 are not prerequisites for this isolated example.**

  **Handoff prompt:** Build a standalone test-consumer example using Prism or Mokapi and canonical contract fixtures for success, structured errors and delayed responses. Demonstrate how tests replace an API dependency without replacing app authentication. Validate normal fixtures with existing Ajv tooling and label intentionally invalid fault fixtures. Do not create a proxy that injects authentication into real services or requires weakening their certificate/token checks.

  **Done when:** The isolated consumer demonstrates deterministic response and recovery assertions, valid fixtures pass contract validation, and no real API, gateway, certificate policy or app behavior changes are needed.

For adoption into another application, use [M00–M05](mock-testing-adoption-prompts.md). The completed [browser mock suite](../spikes/mock-auth/browser/README.md) and [completion 17](completion/17-browser-mock-consumers.md) extend the examples with recorded consumer/UI evidence; they do not close the live-provider or native-CI backlog.

### Product expansion ideas — separate from mock examples

FEATURE-04–06 propose app behavior changes. They remain separate future scope and are not authorized for implementation by the mocking examples above.

- [ ] **FEATURE-04 — Inventory Deduction (Go + Node)**
  **Handoff prompt:** Update the simulated checkout process in the Node Customer API to make an atomic inventory deduction request to the Go Catalog API. If the Go API returns a 409 (Out of Stock), the checkout should fail.
  **Done when:** A successful checkout reduces the stock count in the Go database, and attempting to buy more items than available results in a clean error without creating an order.

- [ ] **FEATURE-05 — Product Reviews & Ratings**
  **Handoff prompt:** Add a new domain for product reviews. Customers should be able to leave a 1-5 star rating and text review on items they have purchased. Update the Vue UI to display aggregate ratings on the catalog items.
  **Done when:** The API successfully persists reviews, enforces that the user has bought the item, and the UI displays the average rating.

- [ ] **FEATURE-06 — "Manager" Persona**
  **Handoff prompt:** Add a new Keycloak role (`shop-manager`) that is allowed to read the insights and reporting endpoints but cannot modify the catalog or manage users. Update the JWT scope verification in the APIs.
  **Done when:** A user with the manager role can view the admin dashboard map but receives a 403 Forbidden when attempting to edit an item.

## 15 — Separate certificate + password teaching view

- [x] Confirm both factors and interactive container password provisioning with the user.
- [x] Add a separate client, REQUIRED X.509/password flow and isolated Vue callback entry.
- [x] Keep passwords on Keycloak pages and preserve the certificate-only shop/API boundaries.
- [x] Complete Chrome/Edge × Playwright/Cucumber positive, negative and cookie matrix; record completion 15.
- [ ] Set the user's demo password interactively inside the container and demonstrate the lesson manually.
- [x] Verify the new feature in native Linux CI: 36/36 in run 38027680587 with scanned/readable uploaded reports and success/failure/cancellation cleanup evidence; see [completion 18](completion/18-native-certificate-password-ci.md). Prior run 38012708736 remains unrelated to this feature.

- [ ] **Reporting timestamp precision follow-up:** Compare reporting range endpoints chronologically rather than lexically. Completion 24 observes a valid mixed whole/fractional-second interval returning canonical 503. Preserve half-open UTC semantics and authorization; add independent regression coverage before claiming full endpoint precision support.
