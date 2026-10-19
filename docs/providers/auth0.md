# Auth0 test account and tenant

IDP-03 account preparation only; live implementation is deferred.
See the [shared handoff and integration rules](README.md).

## Manual setup

1. Open [Auth0 signup](https://auth0.com/signup) and create or sign in to an
   authorized administrator account. Complete verification.
2. Follow tenant onboarding. Choose a dedicated test tenant name and suitable
   region; copy the assigned domain exactly from the dashboard. Tenant names
   cannot be renamed or reused after deletion.
3. Check the active subscription in the dashboard and distinguish Free features
   from temporary trial entitlements. Confirm tenant availability before trying
   to create an additional free tenant.
4. Complete administrator authentication and save recovery information privately.
   Stop here: application credentials and test users can wait for implementation.

[Official tenant setup](https://auth0.com/docs/get-started/auth0-overview/create-tenants)
and [pricing](https://auth0.com/pricing) are the current references. Do not assume
MFA, enterprise connections, organizations, or passkeys are available solely
because a trial dashboard exposes them; record actual entitlement and limits.

## Project handoff and cleanup

Record the tenant domain/issuer, region, plan/trial status, administrator access
method, and owner. No secrets are needed for this handoff. Later work starts with
hosted OIDC/PKCE, then separately verifies organization-boundary and available
passkey scenarios. It must distinguish provider roles/organizations from the
broker's scoped lesson roles.

Track future owned applications, connections, Actions, organizations, users, and
credentials individually. Remove those project objects when finished. Keep any
shared tenant; deleting the tenant or account requires a separate owner decision.
Return to the [provider backlog](../TODO.md#additional-identity-provider-examples--2026-10-16).
