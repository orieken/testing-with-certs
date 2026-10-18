# Kerberos lesson session and refresh acceptance

Five shared cases are implemented in separate Playwright/Cucumber phases for real Chrome and Edge. All 20 new lifecycle executions passed locally and natively. The required inventory is 212 protocol executions plus 48 Password/TOTP executions, for 260 total; Kerberos requires 40 baseline/lifecycle executions. Existing 240-execution native evidence remains recorded in completion 46 and is not evidence for these new cases.

Each invocation owns a private copy of the provisioned valid ticket cache, a persistent browser profile, and token material. The copy/profile are removed after closing the browser, including on failure. Narrow Negotiate host policies remain in force; password fallback is not permitted. The dedicated disposable realm retains its existing single Kerberos principal; each invocation gets its own browser/client session, and group cleanup logs out imported-account sessions and verifies their absence.

Access expiry must clear the lesson without browser refresh. Re-entry must make a new real OIDC authorization request, retain the subject/username, and pass lesson audience/API-denial checks. Existing Keycloak SSO cookies are preserved: this establishes lesson re-entry, not a mandatory fresh ticket negotiation after every access-token expiry. Existing baseline missing/expired/wrong-service-ticket tests remain separate.

Private runner requests test the Keycloak-issued OIDC refresh grant. One case removes only its copied ticket cache before refreshing and requires successful refresh with the same subject/username, a different access token, correct issuer/client/lesson audience, and rejection at all three business APIs with a valid customer certificate. The copied cache must remain absent and no browser authorization occurs during refresh. This demonstrates that refresh can remain valid without that cache; it does not establish immediate revocation after KDC account/ticket changes. Other cases require logout to invalidate refresh, another real public client to reject refresh followed by a same-token correct-client successful control, and actual client-session expiry to reject refresh.

Only `lesson-kerberos` / `kerberos-spa` in a fresh disposable project receives 20-second access and 45-second client-session maximum overrides. KDC ticket lifetimes, realm lifetimes, and clocks are unchanged. The five-client policy allowlist, private ownership recording, drift rejection, explicit null removal, and verified restoration are retained. The real `account-console` client is validated before the binding negative and is not modified. Reports contain only allowlisted case names and normalized outcomes; no ticket, authorization header, token, password, or raw failure is exported.

Thirty-three focused tests passed: policy scope/recovery/restoration for all five allowlisted clients, report filtering, matrix completeness, runner selection coverage, and cleanup after injected runner failures. Syntax and whitespace checks passed. Automated evidence is limited to the pinned Linux Chrome/Edge setup; other operating systems, enterprise KDC interoperability, physical environments, and manual integrated-auth policies remain open.

## Native acceptance

Source `0d653968835d0dc283863d89f150bb0a1b8415ba` passed native [run 39095093262](https://github.com/orieken/testing-with-certs/actions/runs/39095093262) in its first attempt. All **15 jobs** passed, including **212/212 protocol executions**, **48/48 Password/TOTP executions**, and **36/36 separate certificate/password regressions**. The authentication inventory passed **260/260**, including all **40 Kerberos baseline/lifecycle executions** and all 20 new lifecycle executions.

Independently downloaded protocol and OTP reports passed their exact-count gates and credential scans (128 and 32 entries). Certificate/password reports independently confirmed nine passing cases per browser/runner selection and passed their scan (12 entries). The accepted native reports are retained locally under `/tmp/kerberos-session-native/{protocol,otp,certificate}/`. Fixture restoration, imported-account session cleanup, and stack teardown passed in CI.

## Local acceptance

The full ordinary runner passed **212/212 protocol executions** at the same source in disposable project `magic-shop-auth-kerberos-session-20261017`, including **40/40 Kerberos baseline/lifecycle executions** and all 20 new lifecycle executions. Retained local Password/TOTP evidence from completion 43 brings local coverage across runs to 260; it is not a same-run local OTP repetition. Both runner phases passed in both browsers, with lifecycle Cucumber seeds Chrome `736838` and Edge `914478`.

The exact-count gate and credential scan passed (128 entries). Policy restoration, imported-account session cleanup, and fixture cleanup passed after each group and on exit; the ordinary runner exited successfully. Independent Docker queries found no remaining project containers, volumes, or networks. Reports are under `artifacts/auth-lessons/magic-shop-auth-kerberos-session-20261017/`.

These runs use Playwright 1.61.0, Chrome 155.0.8059.84, and Edge 154.0.4258.62. Local Linux amd64 browsers run under Apple Silicon emulation; native evidence uses Ubuntu CI.
