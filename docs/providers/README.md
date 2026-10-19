# External provider account setup

Account-creation documentation checked 2026-10-19. Per the current project decision,
external account creation, cloud provisioning, and live provider integration are
deferred. These guides do not create accounts or count as authentication coverage.

| Backlog | Account preparation | Live implementation |
| --- | --- | --- |
| IDP-02 Entra ID | [Workforce test tenant](../entra-test-tenant.md); [integration preparation](../entra-lessons.md) | Deferred |
| IDP-03 Auth0 | [Free test tenant](auth0.md) | Deferred |
| IDP-04 Okta | [Integrator Free Plan org](okta.md) | Deferred |
| IDP-05 Cognito | [AWS account and access](cognito.md) | Deferred |
| IDP-06 ZITADEL, optional | [Cloud account](zitadel.md) | Deferred; self-hosting remains preferred |

Authentik's accepted disposable implementation needs no hosted account. A local
ZITADEL deployment also does not require ZITADEL Cloud signup. Neither account
creation nor plan eligibility can be replaced by a mocked provider test.

## Shared handoff

Choose a dedicated test environment with an owner and keep administrator accounts
separate from ordinary scenario users. Complete the provider's verification and
administrator authentication. Preserve account security policies. Use an existing
authorized test account where appropriate instead of creating duplicate accounts.

Record only nonsecret identifiers for the next implementation stage:

- Tenant/org/account/instance identifier and region or cloud.
- Exact issuer/domain copied from that environment, not inferred from its name.
- Available administrative access and who can approve later provisioning.
- Actual plan, trial expiration, usage limits, and feature entitlements.
- Cleanup owner and intended retention period.

Passwords, tokens, recovery codes, signing keys, and client secrets belong in a
private secret store. Do not put them in chat, Git, screenshots, recordings, or the
handoff document. Any future cloud automation must track the exact objects it
creates and remove only those objects. Closing an entire account is a separate
owner decision.

## Integration stage, when resumed

The current example pattern is provider → Keycloak broker → app. It needs a
confidential server-side OIDC application when the broker holds a client secret;
a direct browser SPA integration is a different implementation. Future registration
instructions must supply exact broker redirect/logout URLs, SAML entity IDs and
Reply URLs, scoped claims, and audience restrictions after implementation exists.
Do not register guessed wildcard callbacks or copy authentik callback URLs.

Hosted login also requires a deliberate test-network egress configuration while
retaining lab DNS/TLS trust. Observe provider assets before defining allowed
origins. Use private dedicated test users, preserve required MFA, and label manual
or unavailable cases accurately. Separately configured cloud CI must scan evidence,
verify cleanup, and exclude unavailable runs from passing counts. The matrix gets
provider rows and videos only after observed acceptance.

No service spending, plan upgrades, account signup, or provisioning is authorized
by these documentation changes. Review the provider's current signup terms before
using a guide; free software, service allowances, trial credits, and free account
eligibility are different things.
