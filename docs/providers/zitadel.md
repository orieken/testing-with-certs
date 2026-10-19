# Optional ZITADEL Cloud account

IDP-06 remains optional. Self-hosting is the preferred future repeatable CI path
and requires no hosted ZITADEL account. This guide documents the Cloud alternative
only; no deployment or live acceptance is implied.
See the [shared handoff and integration rules](README.md).

## Manual setup

1. Follow the [official quick start](https://zitadel.com/docs/guides/start/quickstart)
   to create a Cloud account and complete verification/administrator setup.
2. In the customer portal, select the intended Free subscription if available
   and create the test instance through the instance setup flow.
3. Copy the assigned instance domain and confirm you can open its console.
   Record its actual subscription and limits before adding integrations.
4. Stop before creating project applications, credentials, or scenario users.

The [instance guide](https://help.zitadel.com/customer-portal-instances) describes
instance creation and generated domains; [pricing details](https://zitadel.com/pricing/detail)
list current allowances. Check instance, administrator, active-user, and external
provider limits rather than assuming a trial's capabilities persist on Free.
No student status is assumed by this preparation.

## Project handoff and cleanup

Record instance ID/domain, exact issuer/discovery endpoint shown by the console,
region if available, plan, owner, and administrator access method. Later work must
choose and label self-hosted versus Cloud provenance and verify actual OIDC/SAML,
passkey, and organization capabilities before promising acceptance.

Track the project's organizations, projects, apps, users, identity providers, and
credentials for selective removal. Deleting an instance or canceling a subscription
is a separate owner decision; local cleanup does not remove Cloud resources.
Return to the [provider backlog](../TODO.md#additional-identity-provider-examples--2026-10-16).
