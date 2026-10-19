# AWS account preparation for Cognito

IDP-05 account preparation only; live implementation is deferred.
See the [shared handoff and integration rules](README.md).

## Manual setup

1. Use an authorized dedicated AWS test account, or start at
   [AWS signup](https://aws.amazon.com/) → **Create an AWS Account**. Review the
   current account plan, identity verification, payment, and support terms shown
   by AWS before completing enrollment. Free service allowances do not imply
   every account or resource is free.
2. Complete account activation and protect root access with MFA. Use delegated
   administrative access for later project work rather than root access keys.
3. Select and record an intended AWS Region. Confirm the operator can later manage
   Cognito user pools/app clients and remove owned resources in that region.
4. Stop before provisioning a user pool, app client, domain, or messaging service.

The [Cognito getting-started guide](https://docs.aws.amazon.com/cognito/latest/developerguide/get-started.html)
requires an AWS account. Our planned browser example uses a **user pool**; an
identity pool serves a different purpose.

## Allowances and handoff

Check [current Cognito pricing](https://aws.amazon.com/cognito/pricing/) for the
chosen tier and account. Direct/social-user and upstream SAML/OIDC federation
allowances are separate. M2M requests and messaging can incur charges; do not
assume a free user allowance covers them. Keep paid security add-ons, SMS, custom
domains, and unrelated cloud resources outside the initial plan unless separately
selected. Student credits are not a prerequisite for checking service allowances.

Record account ID, region, delegated access method, billing owner, and available
allowances. No access keys are needed in chat. The future implementation will
supply pool ID, exact issuer, managed-login domain, client ID, and callback/logout
URLs after resources exist.

Track the owned pool, clients, users, domain, upstream providers, and any associated
resources. Cleanup must verify their removal; deleting local Docker resources
cannot clean AWS. Keep a shared AWS account and subscriptions intact.
Return to the [provider backlog](../TODO.md#additional-identity-provider-examples--2026-10-16).
