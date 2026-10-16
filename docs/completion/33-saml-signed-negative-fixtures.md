# Signed SAML negative fixtures — implementation in progress

This increment adds four browser cases: an unchanged re-signed positive control, wrong assertion audience, wrong `SubjectConfirmationData.Recipient`, and expired assertion conditions/confirmation. They are not yet observed browser passes. Prior native evidence in completion 31 remains the original seven SAML cases per browser.

The fixture retains the captured login's request IDs, issuer, subject, response destination, and relay state. It removes the original signatures, signs the assertion followed by the containing response with RSA-SHA256, and verifies both signatures against the explicitly trusted fixture certificate before submission. The negative browser cases require the broker error page and no successful token exchange. The control requires a real authenticated lesson identity and business-API rejection checks.

A new disposable RSA key is imported into the isolated `lesson-provider` realm before broker trust is configured. Keycloak supplies the matching public certificate. Only lesson setup and the automated lesson runner mount the new `saml-fixture-key` volume; the runner mount is read-only. Neither the primary realm, certificate-free manual viewer, nor business APIs receive the key volume. This test key is unrelated to the lab CA and user transport certificates. Removing the disposable project volumes removes it.

XML helpers use exact locked `xml-crypto@6.4.0` and `@xmldom/xmldom@0.9.12` dependencies. New unit tests check signed variants, retained request correlation, tamper rejection, and malformed/ambiguous fixture rejection. Reports allow only the new case names and outcomes; keys, raw assertions, traces, screenshots, and videos remain excluded.

## Validation status — 2026-10-16

JavaScript syntax checks and Compose/architecture validation passed. The architecture validator now rejects mounting the signing-key volume in any service except lesson setup and automated lesson tests. Dependency lockfile supply-chain validation passed when adding the exact dependencies.

A fresh local stack and runner build were attempted for `magic-shop-auth-saml-20261016`. Host and container dependency downloads repeatedly timed out, including npm registry packages and the browser repositories. The XML-dependent unit tests could not load their not-yet-installed modules, and the browser cases have not run. No new runtime pass counts are claimed.

The runner ultimately failed because `packages.microsoft.com` could not be reached and the Edge package index was unavailable. Remaining stalled task processes were stopped. Compose teardown completed, and independent label queries found zero containers, volumes, and networks for this disposable project. Seven existing bootstrap, OTP-vector, and artifact-safety tests passed without the new XML dependencies.

The pinned [Keycloak 26.4.0 SAML broker source](https://github.com/keycloak/keycloak/blob/26.4.0/services/src/main/java/org/keycloak/broker/saml/SAMLEndpoint.java) validates assertion conditions/audiences and response destination, but inspection did not reveal a `SubjectConfirmationData.Recipient` comparison. This is a suspected acceptance gap, not a measured result. Do not replace the recipient test with a destination test, weaken its assertion, or mark the SAML checklist complete without proving actual recipient rejection. If the live case demonstrates acceptance, implement and verify a broker-side fix or explicitly retain the unmet requirement.

## Resume verification

1. Install the frozen workspace dependencies and run `node --test testing/teaching/saml-fixture.test.mjs`.
2. Build the current runner and start a fresh disposable authentication project.
3. Run the four `saml:signed-*` cases in real Chrome and Edge, then the full lesson matrix. The expanded full matrix should contain 54 cases (23 passkey/federation plus four Kerberos cases per browser), up from 46.
4. Inspect the positive control and each negative outcome independently. Resolve any actual broker validation gap before claiming completion.
5. Scan safe reports, verify fixture/resource cleanup, repeat in native CI, and update observed coverage only after passes.
