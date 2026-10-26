# Refresh-token rotation and reuse detection

Date: 2026-10-25. Source: working tree based on `0195993`. Live acceptance runs use Linux amd64 containers under Apple Silicon emulation. Native CI and the complete protocol/OTP inventory remain separate scopes.

## Contract

[Four shared cases](../../testing/teaching/oidc-refresh.mjs) run for each provider topology in real Chrome and Edge through Playwright and randomized Cucumber:

| Case | Required behavior |
| --- | --- |
| `app-refresh-rotation` | Real broker authorization/code exchange; refresh R0 into a different R1, then R1 into a different R2, retaining identity and lesson-token/API-denial checks. |
| `app-refresh-reuse` | Establish R1; replay exact spent R0; require `400 invalid_grant` with no credentials; require R1 rejection after Keycloak detaches the client session; recover through new browser authorization plus refresh. |
| `upstream-refresh-rotation` | Real upstream confidential-client authorization/code exchange; two distinct refresh replacements; expected issuer/client/username/subject and successful real UserInfo requests. |
| `upstream-refresh-reuse` | Replay spent upstream R0; require credential-free `invalid_grant`; check issuer-specific replacement behavior and recover through new browser authorization plus refresh. |

All authorization uses existing strict registered callbacks, real accounts and S256 PKCE. Code interception prevents the actual callback from consuming the privately exchanged code. Refresh requests use the private request context, not the browser. Within the runner, tokens and responses remain in scenario memory; the browser must send no refresh grant and must not acquire a lesson identity from these private exchanges. No synthetic token, claim mutation, relay fault or test key supplies these cases.

## Issuer-specific policy and effects

Both application legs issue Keycloak tokens, including `authentik → Keycloak → app`. They are tested separately from the actual Keycloak and authentik upstream refresh grants.

[Keycloak policy control](../../infra/oidc-token-fixture/refresh-policy.mjs) temporarily sets `revokeRefreshToken=true` and `refreshTokenMaxReuse=0`. The authenticated private controller permits only fixed disposable targets: `lesson-oidc`, `lesson-provider` and `lesson-authentik-oidc`. It holds the administrative credential. The exact original settings and realm ownership are journaled before mutation; restoration refuses owner/realm/policy drift, restores only those settings and reads them back before dropping its journal. Final gates reject remaining journals, and failure cleanup restores journal-owned changes before removing the project.

The pinned [Keycloak TokenManager](https://github.com/keycloak/keycloak/blob/26.4.0/services/src/main/java/org/keycloak/protocol/oidc/TokenManager.java) checks the maximum reuse count and detaches the affected client session on a violation. The tests assert both spent-token rejection and replacement-token rejection; they do not infer session invalidation from a changed token string.

[Authentik policy control](../../infra/authentik/refresh_policy.py) snapshots the exact original `refresh_token_threshold` on only owned OAuth2 provider `authentik-oidc-broker`, then sets `seconds=0` for always-rotate behavior. Only direct upstream test authorization requests `offline_access`, with its explicit provider scope mapping. The ordinary broker default scope stays unchanged. The pinned `2026.8.4` image's `views/token.py` creates a new refresh token and marks the spent one revoked; `token/refresh_token.py` rejects revoked-token reuse and creates a suspicious request event. The test requires that safe event count to increase and verifies the replacement remains refreshable. It does not claim family-wide authentik revocation. The journal is restored on scenario completion and failure teardown and must be absent before acceptance.

The [OIDC guide](../oidc-testing.md#refresh-token-rotation-and-reuse-detection) includes the provider matrix, sequence diagram, policy ownership and limits. The reusable skill working reference and installed copy describe the same distinction.

## Commands and inventory

Use fresh project names from the repository root:

```sh
LAB_PROJECT=magic-shop-auth-refresh-example-01 sh testing/run-auth-lessons.sh oidc
LAB_PROJECT=magic-shop-authentik-refresh-example-01 sh testing/run-authentik.sh
```

Focused OIDC requires **172 executions**: thirty-eight baseline plus five lifecycle behaviors × four browser/runner combinations. The complete authentik harness requires **236 executions**: forty OIDC baseline, seven SAML baseline and six lifecycle behaviors per protocol × four combinations. Thirty-two executions are new to this increment.

## Source verification

Forty focused source tests passed locally and forty-three passed in the isolated Linux runner, including actual HTTP controls with a synthetic private control credential and no external network. New policy tests cover exact restoration of nondefault originals, exclusive ownership, partial application/interrupted administration responses, drift refusal and preservation of recovery journals. Existing crypto, inventory, recording, artifact, lifetime and harness-cleanup regressions passed. Additional HTTP assertions check fixed refresh target/action/owner bounds before administration.

JavaScript/Python syntax, shell syntax, whitespace, documentation links and skill validation passed.

The container quality gate passed for 332 authored files and 1,935 functions without a new complexity exemption. The first quality invocation used a nonexistent local tag; it did not execute a check. The documented quality image was then built and the ordinary gate passed.

## Observed container acceptance

Controlled project `magic-shop-auth-refresh-20261025-01` passed **172/172** executions, including all sixteen new case combinations. Recording checks verified 172 nonempty videos across eight selections. Privacy, matrix and artifact gates passed, with 567 entries in the initial scan and 576 after indexing. Native-key/fixture verification and relay-idle checks passed; remaining refresh-policy journals were rejected by the strict pre-acceptance check. Independent post-run label queries found zero containers, volumes or networks. The final host artifact scan, including independent cleanup and runner-image version records, passed 578 entries.

Runtime comparisons matched 35 runner, relay, gateway, federation and native-controller/policy source hashes to this working tree. Randomized Cucumber seeds: Chrome baseline `757010`, Chrome lifecycle `89449`, Edge baseline `597800`, Edge lifecycle `239091`.

The tested runner image was independently probed after the controlled teardown: Node `24.19.0`, Chrome `155.0.8059.84`, Edge `154.0.4258.62` and Playwright `1.61.0`. Authentik records its actual launched browser versions during its ordinary harness. Provider pins remain Keycloak `26.4.0` and authentik `2026.8.4`.

Authentik project `magic-shop-authentik-refresh-20261025-01` passed **236/236** executions: 184 OIDC and 52 SAML, including all sixteen new authentik case combinations. Recording gates verified 252 nonempty videos across sixteen selections. The privacy probe, exact inventory gate and artifact scan passed; the initial scan checked 782 entries. Authentik verification required restored owned group memberships, the expected private client credential, original signing-key state and no upstream refresh-policy journal. Relay-idle and ordinary teardown checks passed. Independent post-run label queries found zero containers, volumes or networks. The final host artifact scan, including cleanup and independent policy-verification records, passed 785 entries.

After all sixteen new authentik cases completed and before teardown, the exact strict Keycloak key/refresh-policy command passed independently inside the live `oidc-key-control` container. It confirmed the original key, no owned native key and no remaining Keycloak policy journals. That command is now included before the normal authentik evidence gates in [the entrypoint](../../testing/run-authentik.sh). Shell syntax passed. The browser matrix was not rerun for this verification-only entrypoint addition; the exact added command was verified live, and no browser test or runtime fixture changed.

Runtime comparisons matched 42 runner, relay, gateway, federation, native-controller/policy and authentik fixture source hashes to this working tree. Chrome Cucumber used seed `975020`; Edge Cucumber used `753612`.

| Browser | Runner | Controlled OIDC | Authentik OIDC/SAML |
| --- | --- | --- | --- |
| Chrome | Playwright | 43/43 | 59/59 |
| Chrome | Cucumber | 43/43 | 59/59 |
| Edge | Playwright | 43/43 | 59/59 |
| Edge | Cucumber | 43/43 | 59/59 |
| Total | Both runners | **172/172** | **236/236** |

All thirty-two new broker/upstream refresh executions passed. Independent recording checks found exactly one passing execution per new case/provider/browser/runner combination. Browser-test and runtime-fixture source hashes remained unchanged through acceptance. Evidence is retained under `artifacts/auth-lessons/magic-shop-auth-refresh-20261025-01/` and `artifacts/authentik/magic-shop-authentik-refresh-20261025-01/`, including exact recording indexes, source/runtime records, policy verification and independent cleanup proof.

## Limits

This establishes the configured pinned-provider contracts in disposable realms. It does not establish default production policy, concurrent refresh race behavior, grace intervals, cluster-wide replay propagation, global upstream/broker-session revocation, invalidation of already issued access tokens, arbitrary cloud-provider behavior or fresh native CI acceptance. Existing browser expiry behavior remains unchanged; these are private refresh-grant tests, not browser auto-refresh.

## Subsequent upstream logout/session coverage

2026-10-26: [Completion 67](67-upstream-logout-revocation.md) adds native upstream RP logout, owned-user session deletion, RFC 7009 refresh-token revocation and the unnotified broker-session boundary. Its 188/188 controlled OIDC and 252/252 authentik local container executions passed across both runners and browsers. Counts above describe this earlier refresh rotation/reuse increment.
