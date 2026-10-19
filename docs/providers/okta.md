# Okta Integrator Free Plan test org

IDP-04 account preparation only; live implementation is deferred.
See the [shared handoff and integration rules](README.md).

## Manual setup

1. Open [Okta developer signup](https://developer.okta.com/signup/) and choose
   **Integrator Free Plan** under Workforce Identity.
2. Supply your name, location, and a unique business signup email. Eligibility
   checks apply; do not assume a personal or student address qualifies.
3. Use the verification email to activate the org. Copy the assigned org domain
   and complete the administrator password/authenticator setup.
4. Confirm the actual plan and preserve administrator recovery information
   privately. Stop before creating app integrations or API tokens.

The [official org defaults](https://developer.okta.com/docs/reference/org-defaults/)
list ten active users, limited rate limits, and deactivation after 90 consecutive
days without user sign-in unless an app is submitted to OIN. Org2Org is unavailable.
This plan replaces the old Developer Edition; do not substitute a time-limited
workforce trial. Recheck these limits when live work resumes.

## Project handoff and cleanup

Record the org domain, org identifier if available, plan status, administrator
access method, and owner. Determine the issuer from the authorization server
actually selected during implementation; the org URL and a custom authorization
server issuer are not interchangeable.

Later work adds separate OIDC/SAML integrations, narrowly assigned test users, and
supported authenticator policies. Stay within the org's total user allowance,
including administrators and existing users. Do not weaken authentication policies
for automation. Track project integrations, assignments, users, groups, and tokens
for selective cleanup; do not delete a shared org.
Return to the [provider backlog](../TODO.md#additional-identity-provider-examples--2026-10-16).
