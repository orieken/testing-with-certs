---
name: oidc-testing
description: Assess OIDC test readiness, build missing live authentication tests, or run and troubleshoot container-based OIDC suites. Use for application login, federation, token/session boundaries, mTLS certificate boundaries, and isolated test fixtures; also supports requested multi-project authentication inventories and recorded-container test plans. Not for generic authentication advice or mock-only API testing.
---

# OIDC testing

Help a project establish repeatable, real OpenID Connect tests with isolated fixtures, verified TLS, useful evidence, and reliable cleanup. Preserve its existing authentication design and provider choices.

## Choose the mode

Infer the mode from the request. If the request spans modes, assess first and continue with authorized implementation or execution.

- **Assess:** Inventory an existing project and identify missing pieces. Read [assessment guidance](references/assess.md). Deliver findings and a prioritized plan; an assessment request alone does not authorize implementation.
- **Build:** Add the missing setup and tests, including projects starting from scratch. Read [build guidance](references/build.md). Inspect existing conventions first, implement within scope, and verify what the environment permits.
- **Run:** Execute or explain container tests and diagnose failures. Read [run guidance](references/run.md). An explanation request does not require starting containers.

Read [the working reference](references/working-reference.md) when comparing topology, fixtures, test coverage, or container commands with `orieken/testing-with-certs`. It describes a specific implementation, not a mandatory architecture. Read [starter prompts](references/starter-prompts.md) when the user needs an invocation to reuse.

Read [mTLS guidance and helpers](references/mtls.md) when certificates participate in login, OAuth client authentication, token binding, or service transport. Identify which mechanism is implemented before choosing assertions.

For explicitly requested folder-wide authentication discovery and planning, read [project-folder assessment](references/project-folder-assessment.md). Inventory other mechanisms without applying OIDC assumptions to them. When the user requests reference-style VNC containers, all scenario videos or matrix reports, read [recorded container requirements](references/recorded-container-tests.md); include those deliverables in the plan and implementation acceptance criteria.

## Shared decisions and boundaries

- Identify the application type and topology: public SPA, server-side client, direct provider login, or brokered federation. A broker and second realm are necessary only when federation is in scope.
- Keep application-to-provider and broker-to-upstream exchanges distinct. Record exact issuers, client IDs, redirect/logout URLs, audiences, and ownership of each callback.
- Establish the application's intended expiry and refresh behavior before designing assertions. A private refresh request does not prove browser auto-refresh. An access-token expiry does not necessarily expire provider SSO or require another password prompt.
- Exercise the real provider and application for live acceptance. Label mocks, simulated callbacks, and controlled providers accurately. Controlled Keycloak federation does not prove cloud-provider interoperability.
- Preserve TLS verification, PKCE where applicable, callback-state validation, and existing API authorization. Decoding JWT claims is inspection, not signature verification.
- Use isolated test identities and owned fixture state. Keep secrets and credential-bearing responses out of logs, reports, videos, screenshots, and traces. Use filtered reporting and deliberate recording privacy where credentials are visible.
- Use a disposable test environment for policy changes. Record ownership before mutation, restore only owned changes, and verify cleanup after success and failure. Preserve failure status if cleanup also fails.
- Distinguish proposed checks, source inspection, attempted execution, and observed passing evidence. Do not claim a full matrix passed from a filtered run or uploaded artifacts.

## Finish with a concrete result

Report what exists or changed, how to run it, what was verified, and any remaining blocker. Include exact file references and commands for the target project. Avoid making this reference repository's names, ports, certificate requirements, or test counts universal defaults.
