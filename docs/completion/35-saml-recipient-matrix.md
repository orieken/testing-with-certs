# SAML recipient fix and expanded authentication matrix — 2026-10-16

The live signed fixtures confirmed a missing check in the pinned Keycloak 26.4.0 lesson broker: a correctly signed assertion with an incorrect `SubjectConfirmationData.Recipient` completed login. The unchanged re-signed control succeeded, while wrong-audience and expired variants were rejected. This was a measured recipient-validation gap, not a signature-fixture failure.

## Fix and regression evidence

The separate lesson-provider image now includes `SamlRecipientMapper`. It runs during broker identity preprocessing, after Keycloak's signature/condition checks and before first-broker login or an existing-user login completes. It requires exactly one bearer subject confirmation with the configured exact HTTPS recipient; missing data or a mismatch fails closed. Bootstrap installs this mapper only on the `lesson-saml` provider and rejects recipient-setting drift. The primary certificate realm and business API validation are unchanged.

The image compiles against the exact Keycloak 26.4.0 runtime libraries using a digest-pinned Temurin 21 compiler image. No Maven dependency resolution or custom Keycloak fork is required. The extension is lesson-specific defense for this pinned version, not evidence that unmodified upstream Keycloak rejects this case.

Both Chrome and Edge now pass the unchanged signed control, wrong audience, wrong recipient, and expired assertion cases. The fixture keeps the response destination, subject, request correlation, and relay state intact; both response and assertion signatures are verified locally against the trusted disposable IdP certificate before submission. Negative cases require the broker error page and no successful token exchange or lesson identity.

The SAML suite therefore has **11 cases per browser, 22 total**, including the original seven. Passkeys, real external OIDC, and Kerberos also passed in the expanded 56-case runner; final aggregate verification is recorded below.

## Matrix maintenance

[auth-matrix.mjs](../../testing/teaching/auth-matrix.mjs) is the expected case inventory used by both safe reporters and [check-auth-matrix.mjs](../../testing/reporting/check-auth-matrix.mjs). The gate requires exact case names, unique entries, passed outcomes, browser/phase identity, and live-evidence provenance for every selection. Mutation tests reject missing, duplicate, additional, unknown, skipped, failed, mislabelled, or mock results. Both ordinary runner scripts invoke the gate before credential scanning.

The expected inventory is 56 passkey/OIDC/SAML/Kerberos cases plus a separate 14 password/TOTP cases, or **70 combined cases**. Historical native evidence remains the original 60 cases from completion 31. Current local versus historical native counts and open work are shown explicitly in [the protocol matrix](../teaching-coverage.md#authentication-protocol-matrix) and linked from [the browser matrix](../browser-matrix.md#authentication-lessons). Authentication lessons are separate from the 28 certificate-shop `./lab matrix` selections.

## Environment and reports

Project: `magic-shop-auth-saml-verify-20261016`. Initial upstream-gap probing, mapper enablement, and the final full run used this disposable project; test users were removed/verified and recreated before each final browser selection. Current lesson-provider and realm-bootstrap images were built. The browser runner and unchanged applications used cached images, with current tests, safe reporter, case inventory, helper, and its pinned pure-JavaScript dependencies mounted read-only at their ordinary runner paths. This is not a clean browser-runner build or native CI evidence.

The browser runtime was the same cached image recorded in completion 34: Chrome `155.0.8059.39`, Edge `154.0.4258.62`, Playwright `1.61.0`, Linux amd64 under Apple Silicon emulation. The source Chrome lock remains `155.0.8059.84-1`. The SAML helper uses exact `xml-crypto@6.4.0` and `@xmldom/xmldom@0.9.12` dependencies. Both signature-helper unit tests passed in an isolated temporary dependency directory using unchanged copies of the repository helper/test files; all 18 focused source tests passed. The custom provider image build and Compose/architecture checks passed, including Java source scanning for TLS bypasses.

Safe HTML/JSON/JUnit reports reside under `artifacts/auth-lessons/magic-shop-auth-saml-verify-20261016/`, with Chrome/Edge `passkeys-federation`, `kerberos`, and `kerberos-disabled` selections. Raw assertions, signing keys, tokens, traces, screenshots, and videos were not exported.

## Aggregate and cleanup

The final full runner passed **56/56** cases. The exact-count gate validated all six browser/phase reports, and the credential-safe scan passed with 24 entries. The same gate validated the existing TOTP reports at 14/14; those cases were not rerun in this increment. Fixture deletion/verification passed after each browser. Compose teardown completed successfully; independent project-label queries found zero remaining containers, volumes, and networks. The disposable signing key, user fixture secrets, ticket caches, and browser profiles were removed with those resources. Native CI repetition, new-method Cucumber parity, physical passkeys, organizational-provider compatibility, and the manual viewer remain open. Completion 33 retains the earlier blocked attempt; completion 34 retains the separate wrong-service Kerberos evidence.
