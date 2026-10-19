# Microsoft Entra provider preparation

IDP-02 is in progress. No tenant is configured, no cloud resources have been
created, and no Entra browser acceptance or recordings are credited. The local
plan generator and boundary checks are preparation, not provider coverage.

## Tenant handoff

Use a dedicated authorized workforce test tenant. Confirm its tenant GUID,
verified domain, administrator access for app registrations/enterprise apps,
permissions to manage owned test users, and actual available licenses. Do not
paste passwords, tokens, client secrets, or certificates into chat or committed
configuration. Tenant availability must be confirmed before provisioning; do not
create subscriptions or assume tenant creation is free or available.

Generate a nonsecret plan using the actual tenant GUID:

```sh
node infra/entra/plan.mjs <dedicated-tenant-guid>
```

This command has no network access or resource mutations. It prints the exact
planned realm names, client IDs, lesson routes, broker callbacks, audience names,
and tenant-specific issuer/discovery URLs. It rejects shared authorities such as
`common` and `organizations`. These routes are not enabled in the application yet.
The initial target is Azure public cloud; sovereign clouds require separate
endpoint validation and observed acceptance.

## Provisioning sequence after handoff

1. Register an owned single-tenant confidential Web OIDC application, with
   `AzureADMyOrg`, the exact printed **broker callback** as its Web redirect URI,
   and authorization code plus PKCE. The app's browser callback and broker callback
   are different hops. Keep its credential in a private mounted secret, never
   browser configuration or evidence. Pin tenant-specific discovery/issuer and
   validate signatures with the provider keys.
2. Create a separate owned SAML enterprise application. Use the printed broker
   realm as its identifier/entity ID and the SAML broker callback as its Reply URL.
   Obtain its application-specific federation metadata and signing certificate;
   validate tenant issuer, signed assertions, audience, recipient, and validity.
   Configure logout with observed behavior rather than assuming global revocation.
3. Create dedicated member, no-role/no-group, and disabled test accounts. Record
   object IDs of every owned app, service principal, user, group, and assignment in
   a private cleanup ledger. Use individual assignments for baseline setup; verify
   entitlement before group-based application assignments. Do not disable tenant
   security defaults, MFA, or Conditional Access to accommodate browser automation.
4. Add separate broker realms and certificate-free lesson routes with scoped
   lesson roles/audiences. First prove login, identity and mapping in the live
   tenant, then add wrong-password/disabled-user, callback/state, logout/profile
   isolation, tenant-boundary negatives, and business-API denial in both runners.
   Use controlled tenant-boundary fixtures when a second authorized tenant is not
   available, and label them accurately. Never present a synthetic provider as
   live Entra evidence.
5. Add an explicitly configured cloud workflow with private credentials and owned
   accounts, bounded network access, privacy-screened recordings, exact result
   gates, and verified cleanup. Missing configuration must remain unavailable,
   never a passing provider selection. Import videos only after observed passes.

The local lab's internal Docker networks currently isolate the broker from public
provider endpoints. Live Entra requires a deliberate cloud-test egress overlay and
browser access to Microsoft sign-in assets while preserving lab TLS trust. Inspect
metadata and actual browser requests before defining that allowlist. App callback
navigation still needs the existing lab DNS and trusted certificate in the test
browser. No public inbound tunnel is assumed by this preparation.

Free-edition baseline SSO is the initial target; group assignment, MFA, Conditional
Access, and other premium scenarios require checking actual tenant entitlements.
Direct user app-role assignment and group claim mapping are distinct capabilities.
Keep tenant identifiers/object IDs as configuration and map only exact approved
values. Do not infer permissions from display names or add Graph directory-wide
lookup permissions solely to handle group overage. Missing/overage claims must not
grant a lesson role.

## Official references

- [OIDC protocol and tenant-specific authority](https://learn.microsoft.com/en-us/entra/identity-platform/v2-protocols-oidc)
- [Add an enterprise application](https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/add-application-portal)
- [Application roles and claims](https://learn.microsoft.com/en-us/entra/identity-platform/howto-add-app-roles-in-apps)
- [Entra licensing](https://learn.microsoft.com/en-us/entra/fundamentals/licensing)
- [Tenant creation requirements](https://learn.microsoft.com/en-us/entra/fundamentals/create-new-tenant)
