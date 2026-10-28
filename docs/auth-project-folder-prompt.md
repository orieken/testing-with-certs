# Prompt: assess projects and plan recorded container authentication tests

Replace `<PROJECTS_ROOT>` with the folder to assess. The reference path below is this checkout; replace it if running elsewhere. This prompt requests assessment and plans only.

```text
Assess every project under <PROJECTS_ROOT> and propose authentication tests in the style of /Users/oscarrieken/Projects/Rieken/testing-with-certs. Use $oidc-testing for discovery and planning, including its project-folder-assessment and recorded-container-tests references. Inventory other authentication mechanisms too; do not assume OIDC or replace existing providers.

Work in assessment mode. Inspect source/config/tests only; do not change project code, start containers, install dependencies, provision identities, change providers, publish reports or run acceptance tests. Return the assessment and plans here. Do not print secrets. If the reference checkout is unavailable, state that and use the skill's documented pattern, marking source-specific details unverified.

1. Discover repositories, independently deployed apps and shared authentication services. Explain monorepo/nested-project grouping. Skip dependencies, vendor/build/generated folders; stay inside the supplied root and reference checkout.

2. For each project, trace actual authentication wiring. Identify OIDC/OAuth2, SAML, sessions/cookies, passwords/MFA, passkeys, Kerberos, certificate login/mTLS, API keys, service credentials, custom auth or no authentication found. Separate user login, client authentication and API authorization. Identify providers, brokers, issuers, callbacks, token/session ownership, roles/tenant boundaries, refresh/logout behavior and certificate bindings where applicable. Cite file paths and line numbers, confidence and unresolved questions. Distinguish real integration from unused packages, samples, mocks and inferred behavior.

3. Propose a project-specific implementation plan that preserves its authentication design. Include:
- Disposable container topology, pinned runtime/browser images, network DNS, verified TLS and CA distribution, health/readiness, owned identities and test data.
- A headed browser desktop with Xvfb/window manager and VNC/noVNC like the reference, plus automated runs in the intended container/display environment. Include loopback/private viewer access and local/CI operation without host browser installations.
- Applicable successful controls, isolated rejection cases, callback/PKCE/token checks, authorization boundaries, session/refresh/logout/recovery and certificate tests. For RFC 8705, require a real signed cnf thumbprint and rejection of a valid token with another independently valid certificate, preferably for the same identity. Do not prescribe unsupported mechanisms.
- A proposed Chrome/Edge and Playwright/Cucumber matrix, reusing shared behavior checks, and explicit justification for unsupported or inapplicable selections.
- Video for every executed browser scenario, passing and failing, including relevant pages/popups; finalized clips linked to scenario outcomes. VNC availability alone does not count as recording. API-only cases get structured evidence and explicit labels; plan real UI companions where meaningful without fabricating clips or claims.
- Credential-safe visual recording, filtered diagnostics and verified privacy controls.
- A local HTML report similar to the reference: scenario/spec results, filterable matrix, embedded playable videos, evidence links, JSON/JUnit, source/run/attempt provenance and cleanup receipts. Require complete selection/video inventories, privacy scans, link/playback checks and failure-preserving cleanup before calling a run complete. Do not publish anything.
- Proposed files, commands, artifact layout, implementation dependencies, prerequisites, blockers and observable acceptance criteria. Mark commands and coverage as proposed, not executed.

4. Deliver a cross-project summary table (project, auth mechanism/provider, evidence/confidence, current test readiness, main gaps), then an ordered plan for each project. Finish with reusable harness components, provider-specific adapters, a prioritized rollout and the best first pilot with reasons. Identify existing console-only/headless/no-video suites as evidence gaps when they do not meet this requested delivery style. Ask only questions that materially block a plan; continue assessing the other projects.
```
