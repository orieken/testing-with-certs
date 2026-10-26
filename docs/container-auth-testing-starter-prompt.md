# Starter prompt: adopt container-based Keycloak, OIDC, and mTLS testing

Open the existing project in Codex and paste the prompt below. Replace
`REFERENCE_REPO` with an accessible, read-only checkout of this repository.
The `$oidc-testing` skill must be installed in the receiving environment; its
source is [skills/oidc-testing](../skills/oidc-testing/SKILL.md).

## Copyable prompt

```text
Use $oidc-testing in Assess, Build, then Run modes to adopt repeatable container-based Keycloak, OIDC, and mTLS testing in this existing project.

Working reference:
REFERENCE_REPO=/Users/oscarrieken/Projects/Rieken/testing-with-certs

Read the reference’s:
- skills/oidc-testing/SKILL.md and relevant mode references
- docs/agent-adoption-prompts.md, following prompts 00–06 as applicable
- docs/oidc-testing.md
- docs/authentication.md and docs/workflows.md

Treat the reference as read-only. Adapt its patterns to this project’s architecture and conventions.

First inventory the application, Keycloak configuration, OIDC clients and callbacks, TLS termination, certificate trust, APIs, containers, tests, and CI. Distinguish ordinary OIDC login, human certificate login, and service-to-service mTLS; identify which are required and which already exist. Document gaps with source evidence and a prioritized implementation plan.

Then implement the applicable missing pieces in a disposable test environment. Preserve production authentication behavior. Keep certificate issuance, credentials, dependencies, browsers, and test execution in containers, requiring only Docker and a shell on the host. Keep TLS verification enabled and credentials out of reports and recordings.

Start with a real successful login and a meaningful rejection case. Expand to applicable PKCE and callback-state isolation, token validation, certificate rejection and identity binding, refresh, logout, revocation, key rotation, JWKS failures, recovery, and cleanup. Use real Keycloak and application flows for acceptance.

Verify with Playwright Test and Cucumber in real Chrome and Edge. Clearly distinguish passed, failed, blocked, and unrun combinations. Verify cleanup after success and failure.

Deliver target-specific architecture and login/refresh diagrams, exact container commands, safe test evidence, CI instructions, and remaining gaps. Continue through implementation and available verification; ask only for information or decisions that cannot be established from the repositories. Do not commit, push, or deploy without authorization.
```

For a staged adoption, use the individual prompts in the
[certificate-testing adoption guide](agent-adoption-prompts.md). For OIDC-only
assessment, implementation, or execution, use the skill’s
[mode-specific starter prompts](../skills/oidc-testing/references/starter-prompts.md).
