# OIDC cancellation and recovery

Acceptance finalized: 2026-10-25, following runs started on 2026-10-24. Source: working-tree changes based on `0195993`; no commit or native CI acceptance is claimed.

## Coverage

Both Keycloak and authentik OIDC now share six recovery checks in [oidc-recovery.mjs](../../testing/teaching/oidc-recovery.mjs), with a dependency-free [inventory](../../testing/teaching/oidc-recovery-cases.mjs). Playwright and randomized Cucumber enumerate every check in real Chrome and Edge. Exact report and recording gates include the new cases.

| Check | Fault and failure assertion |
| --- | --- |
| `authorization-cancelled` | Capture a genuine successful authorization response before application callback delivery; preserve state, remove code, and deliver `error=access_denied`. Require an alert, enabled sign-in, zero broker token requests, and absent identity. |
| `callback-interrupted` | Capture a real callback and deliver the lesson landing page instead. Require zero broker token requests and absent identity. |
| `provider-unavailable` | Return HTTP 503 once for the provider password submission. Require absent lesson identity and usable sign-in after explicit application re-entry. |
| `token-unavailable` | Return HTTP 503 once for the browser's broker token request. Require an alert, absent identity and enabled sign-in before re-entry. |
| `token-interrupted` | Abort that token request as a connection failure. Require the same application failure state and recovery as the 503 case. |
| `logout-unavailable` | First complete a validated login; return HTTP 503 once for broker logout navigation. Require absent local identity on application re-entry. |

Every case must then complete a new real authorization and token exchange successfully in the **same browser context, without clearing cookies or storage**. Recovery validates the expected username, issuer, client and lesson audience and requires all three business APIs to reject the lesson token with valid transport credentials. Existing provider SSO semantics remain permitted. No fault can silently remain active during the successful control: each fires exactly once and subsequent requests reach the real services.

The existing provider-specific callback capture helpers are reused. Keycloak interception starts with its credential POST response. Authentik interception also understands the flow executor's `xak-flow-redirect` JSON response. Both follow bounded redirects within trusted lab origins, stopping before the selected application callback consumes its code.

TLS verification, PKCE and product authentication policy remain enabled. Credential-bearing requests, callback values and tokens stay private; filtered reporting and provider-document video masking remain required. The [OIDC guide](../oidc-testing.md#cancellation-and-recovery) includes the recovery diagram, contracts and limits. The reusable skill's repository reference and installed copy describe the same coverage.

## Commands

Use a fresh project name from the repository root:

```sh
LAB_PROJECT=magic-shop-auth-recovery-example-01 sh testing/run-auth-lessons.sh oidc
LAB_PROJECT=magic-shop-authentik-recovery-example-01 sh testing/run-authentik.sh
```

The controlled OIDC gate requires 96 executions: nineteen baseline and five lifecycle behaviors in four browser/runner combinations. The authentik harness requires 160 executions: twenty-one OIDC baseline, seven SAML baseline, and six lifecycle behaviors per protocol, each in four combinations. Existing project resources and stale focused/provider evidence are refused.

## Observed local acceptance

Keycloak project `magic-shop-auth-recovery-20261024-01` completed on its first run with no retries:

| Browser / runner | Baseline | Lifecycle | Total |
| --- | --- | --- | --- |
| Chrome / Playwright | 19/19 | 5/5 | 24/24 |
| Chrome / Cucumber | 19/19 | 5/5 | 24/24 |
| Edge / Playwright | 19/19 | 5/5 | 24/24 |
| Edge / Cucumber | 19/19 | 5/5 | 24/24 |
| Total | 76/76 | 20/20 | 96/96 |

The exact recording gate verified 96 videos across eight selections. The privacy probe and artifact scans passed. Fixture restoration was verified between groups and during teardown. Independent post-run Docker label queries found zero containers, volumes or networks. The final artifact scan, including source/runtime/independent cleanup evidence, passed 350 entries. Cucumber seeds were Chrome baseline `604030`, Chrome lifecycle `261950`, Edge baseline `14058`, and Edge lifecycle `233255`.

Reports are under `artifacts/auth-lessons/magic-shop-auth-recovery-20261024-01/`. Sixteen inspected runtime source files matched the runner image; hashes are retained in `source-verification.json`.

Authentik project `magic-shop-authentik-recovery-20261024-01` also completed on its first run with no retries:

| Browser / runner | OIDC | SAML regression | Total |
| --- | --- | --- | --- |
| Chrome / Playwright | 27/27 | 13/13 | 40/40 |
| Chrome / Cucumber | 27/27 | 13/13 | 40/40 |
| Edge / Playwright | 27/27 | 13/13 | 40/40 |
| Edge / Cucumber | 27/27 | 13/13 | 40/40 |
| Total | 108/108 | 52/52 | 160/160 |

Its exact gate verified 176 nonempty videos across sixteen selections. The privacy probe passed, and the initial artifact scan passed 554 entries. Owned group membership and the private client credential were verified before teardown. The ordinary cleanup gate passed; independent post-run queries also found zero containers, volumes or networks. The final scan, including teardown and independent cleanup evidence, passed 556 entries. Cucumber seeds were Chrome `349682` and Edge `587898`.

Reports are under `artifacts/authentik/magic-shop-authentik-recovery-20261024-01/`. Sixteen inspected runner source files and two live provider fixture files matched the workspace; hashes are retained in `source-verification.json`. Runtime metadata and independent cleanup evidence accompany both projects.

Across the two suites, all **48 new recovery executions** passed: six behaviors × two providers × two browsers × two runners. These are included in the 96 and 160 totals above.

## Source verification and scope

Forty-seven focused source tests passed locally and in the Linux runner container. They cover exact case provenance, both authentik inventories, recording completeness, artifact credential rejection, failure cleanup, owned fixture policy restoration and token lifetime contracts. Syntax, whitespace, relative documentation links, skill validation and the container complexity gate passed.

Environment: Apple Silicon host using Linux amd64 container emulation; Node `24.19.0`, Chrome `155.0.8059.84`, Edge `154.0.4258.62`, Playwright `1.61.0`, Keycloak `26.4.0`, and pinned authentik `2026.8.4`.

These are controlled browser-fault tests against live services. Cancellation delivers a protocol cancellation signal on an owned real transaction; it does not click a provider-native Cancel button. Provider/token faults do not establish recovery from a server-to-server upstream token outage or altered upstream ID tokens. The failed logout navigation proves local clearing after re-entry, not the adapter's rejected-promise catch branch or global provider-session revocation. The separate complete protocol/OTP matrix and native CI were not rerun for this increment.

## Upstream ID-token follow-up

[Completion 64](64-upstream-id-token-validation.md) records the subsequent local 136/136 controlled OIDC and 200/200 authentik OIDC/SAML acceptance. It adds ten shared upstream ID-token cases per provider. The source inventory and observed counts above belong to this earlier recovery increment.
