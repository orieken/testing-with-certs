# Create an Entra test tenant

Checked against Microsoft documentation on 2026-10-19. This is a manual setup
runbook; no account, subscription, or tenant has been created for this repository.
Live IDP-02 implementation stays deferred until a dedicated tenant is available.

## Choose an available path

| Situation | Path |
| --- | --- |
| You already control a dedicated test directory | Reuse it after confirming authorization and administrator access. |
| Your paid Microsoft account is eligible to create workforce tenants | Use the portal procedure below. |
| You have no suitable directory | Follow Microsoft's [Azure account signup](https://azure.microsoft.com/en-us/free/) and review its current eligibility, verification, and billing terms before enrolling. |
| You are an eligible university student | [Azure for Students](https://azure.microsoft.com/en-us/free/students/) offers $100 for 12 months without a credit card. Academic verification applies; this is not an Entra premium entitlement. |
| You qualify for a developer sandbox | Use the [Microsoft 365 Developer Program](https://learn.microsoft.com/en-us/office/developer-program/microsoft-365-developer-program). Eligible Visual Studio subscribers and qualifying partner/support programs can request an E5 sandbox; joining alone does not guarantee one. |

Microsoft currently restricts additional workforce-tenant creation to paid
customers; free/trial customers cannot assume that option is available. Check
tenant-creation permissions or the Tenant Creator role if creation is unavailable.
See the [tenant creation prerequisites](https://learn.microsoft.com/en-us/entra/fundamentals/create-new-tenant).

## Create the workforce directory

1. Sign in to the [Azure portal](https://portal.azure.com/) with the eligible account.
2. Open **Microsoft Entra ID → Overview → Manage tenants → Create**.
3. Choose **Microsoft Entra ID** for a workforce tenant. This lesson does not use
   External ID customer tenants or B2C.
4. Enter an organization name, a unique initial domain prefix, and the appropriate
   country/region. Example project name: `Magic Shop Auth Test`.
5. Review and create, then switch into the new directory. Its initial domain ends
   in `.onmicrosoft.com`; no purchased custom domain is needed for our initial lab.
6. In its Overview, record the tenant GUID and primary domain. The creator is
   initially a Global Administrator.

The portal may present different creation flows according to account eligibility;
follow the [official workforce procedure](https://learn.microsoft.com/en-us/entra/fundamentals/create-new-tenant)
if the displayed options differ. Do not select a governed/add-on setup merely to
work around an unavailable standalone creation option.

## Prepare it for this project

Confirm the selected directory name and ID before any later app/user changes.
Use a password manager for administrator credentials and complete Microsoft's
required administrator authentication. Keep existing security defaults and MFA.
Use separate ordinary test users for browser cases rather than the administrator.

Record this nonsecret handoff information:

| Field | What to record |
| --- | --- |
| Tenant ID | Directory GUID from Overview |
| Primary domain | The directory's `.onmicrosoft.com` domain |
| Cloud | Azure public cloud for the current preparation |
| Available access | Who can register apps, configure enterprise SAML, and manage owned test users |
| Licensing | Actual edition/entitlements visible in the tenant |
| Ownership | Person responsible for later cleanup |

Do not include passwords, tokens, or client secrets. No app registration, secret,
or test user needs to be created yet. With the tenant GUID available, run:

```sh
node infra/entra/plan.mjs <dedicated-tenant-guid>
```

Continue with the [provider setup sequence](entra-lessons.md#provisioning-sequence-after-handoff)
when live implementation resumes. It separates OIDC and SAML applications and
records owned objects for cleanup.

## Cost and cleanup

The [Microsoft Entra ID Free billing record](https://learn.microsoft.com/en-us/azure/cost-management-billing/manage/microsoft-entra-id-free)
has no product charge. Separate Azure resources, premium licenses, and purchased
products can still cost money. Tenant eligibility and a free billing record are
separate questions. This project does not require deploying an Azure VM, database,
or paid license to obtain a tenant handoff.

After testing, remove only the project's recorded applications, service principals,
users, groups, assignments, and credentials. Keep the directory if it serves other
work. Deleting an entire tenant is a separate owner decision; use Microsoft's
[tenant deletion procedure](https://learn.microsoft.com/en-us/entra/identity/users/directory-delete-howto)
and satisfy its prerequisites. Removing Docker resources does not remove cloud
objects or cancel subscriptions.
