# Upstream OIDC logout and session revocation

Started: 2026-10-25. Acceptance continued: 2026-10-26. Source: working tree based on `0195993`. Local live checks use Linux amd64 containers under Apple Silicon emulation. Native CI and the complete protocol/OTP inventory are separate acceptance scopes.

## Contracts and isolation

[Four shared cases](../../testing/teaching/oidc-sessions.mjs) run against both upstreams in Chrome and Edge under Playwright and randomized Cucumber. Each uses a dedicated owned provider identity. Real browser authorization and S256 PKCE produce real grants; a successful refresh, live UserInfo request and silent upstream SSO establish controls before destruction. TLS, strict registered callbacks and business API authorization stay enabled. Credentials, codes, token bodies, session identifiers and native provider logs are not exported.

| Case | Required behavior |
| --- | --- |
| `upstream-rp-logout` | Browser calls the real end-session endpoint with valid ID-token hint, registered return and state. Observe the native return before the broker callback; require old UserInfo denial, check refresh/SSO fate according to the issuer, then recover through fresh authorization plus refresh. |
| `upstream-session-revoked` | Native administration deletes only the dedicated upstream user's sessions, with positive-before/zero-after counts. Require old UserInfo denial, the expected refresh outcome, silent SSO failure using the retained cookies, and recovery through real credentials. |
| `upstream-token-revoked` | Confidential client revokes the current real refresh token twice at RFC 7009 endpoint with HTTP 200. Require refresh `invalid_grant` with no access/refresh/ID token, check expected SSO state, and recover. This case does not establish immediate invalidation of every existing access token. |
| `upstream-revocation-broker-boundary` | Real application login plus valid broker refresh and upstream SSO control; upstream session deletion makes silent upstream SSO fail, while the independent broker session still refreshes with expected lesson identity/audience/API denial without configured logout notification. Fresh application login then recovers. |

Cookies remain in the same browser context for the before/after SSO probes; clearing them is not used as evidence of revocation. Private `prompt=none` requests must return matching state and either code or `login_required`; their codes are never exchanged or exported. Only recovery deliberately clears cookies and completes new real authorization. Browser pages must send no refresh grant: private test requests perform those grants, while product expiry behavior remains unchanged.

[Keycloak control](../../infra/oidc-token-fixture/session-revocation.mjs) allows only two fixed test-user selectors in `lesson-provider`. It rejects unknown selectors, missing/ambiguous/mismatched accounts and absent positive sessions before calling the native user-logout API. It checks sessions are actually gone and returns only counts. [Authentik control](../../infra/authentik/session_revocation.py) verifies the dedicated user against the private fixture inventory and deletes its native `AuthenticatedSession` objects, retaining native pre/post-delete signals. Both reject the broker-boundary contract if logout-notification configuration has appeared unexpectedly. Administrative credentials stay in private fixture services.

These are irreversible deletions of disposable owned sessions, not policy overrides to restore. Recovery establishes new sessions through real credentials. The normal controlled fixture removes owned provider/imported users; authentik teardown removes the entire owned database, credentials, grants and sessions. Failure teardown preserves its failing status and removes only the disposable project.

## Pinned-provider distinctions

Keycloak native RP logout and administrative session deletion reject the upstream refresh grant and silent SSO. RFC 7009 removes the token's client session and, in this single-client fixture, removes upstream SSO when its last client session is gone. See the pinned [TokenRevocationEndpoint](https://github.com/keycloak/keycloak/blob/26.4.0/services/src/main/java/org/keycloak/protocol/oidc/endpoints/TokenRevocationEndpoint.java).

Authentik's default provider invalidation flow ends the application's access grants while retaining authentik SSO and the independent refresh grant. Native session deletion removes its old access grant and SSO but deliberately preserves refresh tokens; explicit refresh-token revocation rejects that token while browser SSO survives. The pinned [refresh-token model](https://github.com/goauthentik/authentik/blob/version/2026.8.4/authentik/providers/oauth2/models.py), [session-deletion signal](https://github.com/goauthentik/authentik/blob/version/2026.8.4/authentik/providers/oauth2/signals.py), and [end-session view](https://github.com/goauthentik/authentik/blob/version/2026.8.4/authentik/providers/oauth2/views/end_session.py) define the assertions. Tests preserve this default flow instead of adding a User Logout stage or changing SLO policy to force another outcome.

Both broker topologies currently omit upstream logout-notification configuration. Deleting the upstream session therefore does not establish global broker-session revocation. The tests require the actual broker refresh to remain valid and independently prove upstream silent SSO fails. This records a boundary explicitly; it does not add backchannel delivery.

The [OIDC guide](../oidc-testing.md#upstream-logout-and-session-revocation) includes the operation matrix and sequence diagram. The repository and installed skill references explain how to inventory these distinctions in another project.

## Commands and source checks

Use fresh projects from the repository root:

```sh
LAB_PROJECT=magic-shop-auth-sessions-example-01 sh testing/run-auth-lessons.sh oidc
LAB_PROJECT=magic-shop-authentik-sessions-example-01 sh testing/run-authentik.sh
```

Focused OIDC requires **188 executions**: forty-two baseline and five lifecycle behaviors × four browser/runner combinations. Authentik requires **252 executions**: forty-four OIDC baseline, seven SAML baseline and six lifecycle behaviors per protocol × four combinations. Thirty-two executions are new.

Forty-four focused source checks passed locally; forty-seven passed inside the isolated Linux runner, including actual private HTTP controls with a synthetic credential and no external network. New ownership tests verify exact account selection, rejection before destructive calls, positive/zero session counters, actual deletion, withholding session identifiers and refusal of unexpected logout notification. Existing crypto, inventory, recording, artifact, lifetime and harness-cleanup regressions passed. JavaScript/Python/shell syntax, documentation links, whitespace and skill validation passed.

The container quality gate passed with 337 authored files and 1,974 functions, without a new complexity exemption.

## Observed container acceptance

Controlled project `magic-shop-auth-sessions-20261025-02` passed **188/188** executions, including all sixteen new case combinations. Exact recording gates verified 188 nonempty videos across eight selections. Privacy, matrix and artifact gates passed, checking 616 entries initially and 625 after indexing. Native-key/refresh-policy checks, owned account/imported-user cleanup and the relay-idle check passed. Independent post-run label queries found zero containers, volumes or networks; the final host scan including cleanup evidence passed 626 entries.

Thirty-nine runner, relay, gateway, federation, controller and owned-account provisioning image source hashes matched the workspace. Cucumber seeds were Chrome baseline `5306`, Chrome lifecycle `369821`, Edge baseline `89637` and Edge lifecycle `348096`. A version probe of the tested runner image recorded Node `24.19.0`, Playwright `1.61.0`, Chrome `155.0.8059.84` and Edge `154.0.4258.62`. Provider pins remain Keycloak `26.4.0` and authentik `2026.8.4`.

Authentik project `magic-shop-authentik-sessions-20261026-01` passed **252/252** executions: 200 OIDC and 52 SAML, including all sixteen new authentik case combinations. Exact recording gates verified 268 nonempty videos across sixteen selections. The privacy probe, required inventory gate and artifact scan passed, initially checking 830 entries. The normal harness verified original Keycloak/native authentik signing-key state, absent refresh-policy journals, restored group membership and the expected private upstream client credential. Relay-idle and ordinary teardown checks passed. Independent post-run label queries found zero containers, volumes or networks; final host artifact scanning including cleanup proof passed 832 entries.

Forty-seven runner, relay, gateway, controller, owned-account provisioning image and authentik fixture source hashes matched the workspace. Actual browser launch records agree with the tested image's Chrome/Edge versions above. Chrome Cucumber used seed `75850`; Edge Cucumber used `475600`.

| Browser | Runner | Controlled OIDC | Authentik OIDC/SAML |
| --- | --- | --- | --- |
| Chrome | Playwright | 47/47 | 63/63 |
| Chrome | Cucumber | 47/47 | 63/63 |
| Edge | Playwright | 47/47 | 63/63 |
| Edge | Cucumber | 47/47 | 63/63 |
| Total | Both runners | **188/188** | **252/252** |

All thirty-two new upstream logout/session/token-revocation and broker-boundary executions passed. Independent recording checks found exactly one passing result per new case/provider/browser/runner combination. Runtime source hashes remained unchanged through acceptance. Evidence is retained under `artifacts/auth-lessons/magic-shop-auth-sessions-20261025-02/` and `artifacts/authentik/magic-shop-authentik-sessions-20261026-01/`, including exact recording indexes, source/runtime records and independent cleanup proof.

## Diagnostic history and limits

The first controlled project, `magic-shop-auth-sessions-20261025-01`, passed session deletion, token revocation and the broker boundary but failed native logout callback observation. A callback-only browser route did not intercept the later native redirect. Logout now captures the initial Keycloak response or authentik flow-executor return before the unmatched broker callback. The failed browser selection was stopped to let the normal harness tear down; independent queries found zero remaining containers, volumes or networks. That partial project is diagnostic evidence, not matrix acceptance.

These tests do not establish configured SLO/backchannel delivery, global logout of every broker/application session, distributed/racing revocation, arbitrary cloud-provider policy, immediate rejection at offline JWT-verifying APIs, or native CI acceptance. Provider-specific grant survival is an asserted contract rather than a universal security guarantee.
