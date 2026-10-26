# Native OIDC signing-key rotation and JWKS failures

Date: 2026-10-25. Source: working-tree changes based on `0195993`. Local Linux amd64 containers run through emulation on Apple Silicon. Native CI and the complete protocol/OTP matrix are separate acceptance scopes.

## Coverage

Five [shared cases](../../testing/teaching/oidc-jwks.mjs) now run against both upstream providers under Playwright and randomized Cucumber in real Chrome and Edge:

| Case | Required behavior |
| --- | --- |
| `signing-key-native-rotation` | Sign in with original native key A; activate provider-generated B; observe new-key JWKS loading and valid login on B; restore A and prove login succeeds again. |
| `jwks-cached-key-outage` | Warm A; prove JWKS returns HTTP 503; sign in with A with no extra broker JWKS request; restore endpoint health and original configuration. |
| `jwks-uncached-key-outage` | Rotate to B; return HTTP 503; observe failed broker JWKS loading and rejection without application code/token exchange/identity; restore JWKS and observe successful lookup/login. |
| `jwks-malformed-response` | Repeat the uncached-key rejection/recovery contract with HTTP 200 containing invalid JSON. |
| `jwks-empty-response` | Repeat with HTTP 200 containing an empty `keys` array. |

The tests preserve real provider ID-token signatures, issuers, clients and claims. The relay verifies each original token against the real upstream JWKS and tracks distinct native key IDs privately. It does not re-sign these cases with the earlier relay fixture key. Failure counters distinguish the cached-key probe from an actual broker lookup. Accepted controls, post-lookup recovery and restored-key sessions check expected username/lesson audience and denial at all three business APIs.

Keycloak's new [private controller](../../infra/oidc-token-fixture/key-control.mjs) generates an owned `rsa-generated` component only in realm `lesson-provider`. [Ownership handling](../../infra/oidc-token-fixture/keycloak-keys.mjs) saves the original active key before creation, refuses existing/drifted fixtures, restores the exact original key and deletes only the journal-owned component. Requests are serialized. Its administrative credential stays inside that controller; the runner uses the existing private fixture-control credential over internal trusted HTTPS port `9853`.

Authentik uses its pinned native `CertificateBuilder`, with a journal-owned key pair assigned only to OAuth2 provider `authentik-oidc-broker`. [Its fixture control](../../infra/authentik/oidc_keys.py) restores the exact original key reference before deleting the owned pair. SAML's signing-key reference remains unchanged. New rotation keys stay within their providers. The pre-existing controlled Keycloak SAML signer remains a separately mounted test key used by earlier signed-assertion fixtures; this increment does not claim that the runner contains no existing provider test-signing material.

Both providers retain original keys for restoration, but their native publication behavior differs: Keycloak retains the original key in its published set while the new higher-priority key signs; authentik publishes its current OAuth2 signing key. Tests do not assume equal overlap/cache behavior. They wait eleven real seconds around unknown-key lookup and recovery, preserving Keycloak's normal ten-second JWKS refresh protection instead of clearing caches or disabling throttling. See the [official conformance guidance](https://github.com/keycloak/keycloak/blob/main/docs/tests-oidc-conformance.md) for that protection; actual acceptance uses the pinned broker.

Every scenario restores its key and completes a new login afterward. Strict pre-acceptance checks require original key references and no owned rotation keys/journals. Failure teardown restores only journal-owned mutations before removing the disposable project. The relay must also be idle. The [OIDC guide](../oidc-testing.md#native-signing-key-rotation-and-jwks-failures) includes the sequence diagram, contracts and limits; the reusable skill reference describes the same pattern.

## Commands and required inventory

From the repository root, with fresh project names:

```sh
LAB_PROJECT=magic-shop-auth-jwks-example-01 sh testing/run-auth-lessons.sh oidc
LAB_PROJECT=magic-shop-authentik-jwks-example-01 sh testing/run-authentik.sh
```

Focused controlled OIDC requires **156 executions**: thirty-four baseline and five lifecycle behaviors × four browser/runner combinations. The complete authentik harness requires **220 executions**: thirty-six OIDC baseline, seven SAML baseline and six lifecycle behaviors per protocol × four combinations. Forty executions are new to this increment.

## Source checks

Fifty-seven focused source tests passed locally. Sixty passed inside the Linux runner container, including actual isolated HTTP authorization, owner-lease and JWKS failure-response checks with a synthetic control credential and no external network. Ownership tests cover exact restoration, refusal of baseline/owner drift, recovery after key creation but before a successful administration response, and preservation of journals when restoration cannot safely proceed. Monitoring tests check counters, bounded modes and withholding of tokens/key IDs from status responses. Existing crypto, inventory/provenance, recording, artifact and runner-cleanup regressions also passed.

The container quality gate passed with 327 authored files and 1,904 functions, with no new complexity exemption. Python/JavaScript syntax, whitespace, relative documentation links and skill validation passed.

## Observed container acceptance

The focused controlled project `magic-shop-auth-jwks-20261025-02` passed **156/156** executions and all twenty new case combinations. It produced 156 indexed videos across eight selections. The ordinary matrix, recording and artifact gates passed; strict native-key checks confirmed the original active key and absence of owned rotation keys/journals. Fixture cleanup and relay-idle checks passed before teardown. Independent post-run label queries found zero containers, volumes or networks. The final host artifact scan, including that cleanup record, passed with 530 entries.

Runtime comparisons matched 32 runner, relay, gateway, federation and native-controller source hashes to this working tree. Randomized Cucumber seeds were Chrome baseline `910692`, Chrome lifecycle `495854`, Edge baseline `450972` and Edge lifecycle `967642`.

The complete authentik project `magic-shop-authentik-jwks-20261025-01` passed **220/220** executions: 168 OIDC and 52 SAML, including all twenty new authentik case combinations. Its exact recording gate verified 236 nonempty videos across sixteen selections. The privacy probe and artifact scan passed, initially checking 734 entries. Strict fixture verification required the original OAuth2 signing-key reference, no owned rotation key/journal, restored group memberships and the expected private upstream client credential. The relay-idle and ordinary cleanup checks passed. Independent post-run label queries found zero containers, volumes or networks; the final artifact scan, including teardown and independent cleanup evidence, passed 736 entries.

Runtime comparisons matched 38 runner, relay, gateway, federation, native-controller and authentik fixture source hashes to this working tree. Randomized Cucumber seeds were Chrome `874113` and Edge `466314`.

| Browser | Runner | Controlled OIDC | Authentik OIDC/SAML |
| --- | --- | --- | --- |
| Chrome | Playwright | 39/39 | 55/55 |
| Chrome | Cucumber | 39/39 | 55/55 |
| Edge | Playwright | 39/39 | 55/55 |
| Edge | Cucumber | 39/39 | 55/55 |
| Total | Both runners | **156/156** | **220/220** |

All forty new rotation/JWKS executions passed. Final independent recording checks found exactly one passing execution for every new case/provider/browser/runner combination. Source hashes remained unchanged through acceptance. Evidence is retained under `artifacts/auth-lessons/magic-shop-auth-jwks-20261025-02/` and `artifacts/authentik/magic-shop-authentik-jwks-20261025-01/`, including runtime/source records, exact recording indexes and independent cleanup records.

Environment: Node `24.19.0`, Chrome `155.0.8059.84`, Edge `154.0.4258.62`, Playwright `1.61.0`, Keycloak `26.4.0`, and pinned authentik `2026.8.4`.

## Diagnostic history and limits

The first project, `magic-shop-auth-jwks-20261025-01`, stopped before browser execution because starting the new native-key controller reran the existing non-idempotent credential initializer. Startup now uses `--no-deps` only after the required dependencies are ready. The failed project was torn down and independent queries found zero remaining containers, volumes or networks; its cleanup record is retained. That attempt contributes no browser acceptance.

These results cover native provider rotation and controlled failures on the broker-facing JWKS endpoint. They do not establish emergency revocation of already cached keys, immediate old-key eviction, fleet-wide propagation, prolonged outage behavior after cache expiry, direct authentik application-adapter behavior, arbitrary cloud-provider policy, or fresh native CI acceptance.

## Subsequent refresh rotation/reuse coverage

2026-10-25: [Completion 66](66-refresh-rotation-reuse.md) adds distinct broker and upstream refresh-token rotation/replay contracts, including the providers' different replacement-token consequences. Its 172/172 controlled OIDC and 236/236 authentik local container executions passed across both runners and browsers. Counts above describe this earlier signing-key/JWKS increment.
