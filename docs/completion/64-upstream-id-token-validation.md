# Upstream OIDC ID-token validation

Date: 2026-10-25. Source: working-tree changes based on `0195993`. Native CI and the separate full protocol/OTP matrix are outside this acceptance increment.

## Implementation

Both provider topologies now exercise the Keycloak broker's upstream ID-token validation through [one shared implementation](../../testing/teaching/oidc-upstream.mjs). Playwright and randomized Cucumber enumerate ten cases in Chrome and Edge: an unchanged-claims signed control, followed by independent signature, unknown-key, issuer, audience, authorized-party, expired, future-not-before, wrong-nonce and missing-nonce checks.

The [private relay](../../infra/oidc-token-fixture/server.mjs) forwards real upstream code exchanges, verifies the original ID-token signature against the real provider JWKS and checks its issuer, audience, expiry and nonce presence. It replaces only `id_token` in the returned response. Semantic mutations remain RSA-signed with a temporary fixture key exposed through the disposable broker's configured JWKS endpoint. The signed control uses the same key without changing claims. Each negative changes one claim or signature/key input, must be observed exactly once, and must be rejected at the real broker callback without any application code, browser token exchange or lesson identity. A new unmodified real login then succeeds with identity/audience/API-denial checks.

The fixture key stays in process memory. The runner receives only a mode-0600 control credential on a read-only volume. Control requires exclusive owner leases; another owner cannot arm, inspect or release the active case. Both harnesses verify the relay has no active lease before teardown, including failure cleanup. The gateway terminates trusted TLS at internal port `9843`; the relay forwards only to fixed provider HTTPS endpoints with TLS verification. Broker signature and nonce validation remain enabled and clock skew is explicitly zero. Issuer/authorization URLs remain the real provider; only owned broker token/JWKS URLs use the relay. Main-shop and business-API key trust is unchanged.

The [OIDC guide](../oidc-testing.md#upstream-id-token-validation) includes the flow diagram, exact mutation contracts, isolation and limits. The reusable skill's working reference describes the same pattern.

## Commands and required inventory

Run from the repository root using fresh project names:

```sh
LAB_PROJECT=magic-shop-auth-idtoken-example-01 sh testing/run-auth-lessons.sh oidc
LAB_PROJECT=magic-shop-authentik-idtoken-example-01 sh testing/run-authentik.sh
```

Focused controlled OIDC requires **136 executions**: twenty-nine baseline and five lifecycle behaviors × four browser/runner combinations. The complete authentik harness requires **200 executions**: thirty-one OIDC baseline, seven SAML baseline and six lifecycle behaviors per protocol × four combinations. Eighty executions are new to this increment, including eight standalone signed controls and seventy-two negative cases; every negative also contains its own successful signed control and unmodified recovery login.

## Source checks

Fifty-one focused source tests passed locally. Fifty-two passed in the Linux runner container, including the additional HTTP authorization/ownership test against an isolated relay process with a synthetic credential and no external network. The host sandbox refused that test's loopback socket; the container run exercised the real server without changing its deployment behavior. Crypto tests independently verify signed-control acceptance, valid signatures and single-field isolation for semantic negatives, distinct signature/key failures, and refusal of invalid original tokens. Existing matrix/provenance, case enumeration, recording, artifact and cleanup regressions also pass.

The container quality gate passed: 317 authored files, 1,836 functions; no new complexity exemption. Node syntax, whitespace, relative documentation-link checks and skill validation passed. The installed and repository skill references match.

## Observed container acceptance

The ordinary focused Keycloak harness exited successfully in project `magic-shop-auth-idtoken-20261025-01`, with no retries:

| Browser / runner | Baseline | Lifecycle | Total |
| --- | --- | --- | --- |
| Chrome / Playwright | 29/29 | 5/5 | 34/34 |
| Chrome / Cucumber | 29/29 | 5/5 | 34/34 |
| Edge / Playwright | 29/29 | 5/5 | 34/34 |
| Edge / Cucumber | 29/29 | 5/5 | 34/34 |
| Total | 116/116 | 20/20 | 136/136 |

Its forty new upstream ID-token executions passed. The recording gate verified 136 nonempty videos across eight selections. Privacy and artifact gates passed; initial and indexed scans checked 460 and 469 entries. Fixture restoration and the relay-idle check passed before teardown. Independent Docker label queries found zero remaining containers, volumes or networks. The final scan, including independent cleanup evidence, passed 470 entries. Cucumber seeds were Chrome baseline `515854`, Chrome lifecycle `924858`, Edge baseline `47700` and Edge lifecycle `381432`.

Reports are under `artifacts/auth-lessons/magic-shop-auth-idtoken-20261025-01/`. Twenty-five inspected runner, relay, gateway and broker-provisioning source hashes matched the workspace and are retained in `source-verification.json`; runtime versions and independent cleanup evidence accompany the reports.

The ordinary authentik harness also exited successfully in project `magic-shop-authentik-idtoken-20261025-01`, with no retries:

| Browser / runner | OIDC | SAML regression | Total |
| --- | --- | --- | --- |
| Chrome / Playwright | 37/37 | 13/13 | 50/50 |
| Chrome / Cucumber | 37/37 | 13/13 | 50/50 |
| Edge / Playwright | 37/37 | 13/13 | 50/50 |
| Edge / Cucumber | 37/37 | 13/13 | 50/50 |
| Total | 148/148 | 52/52 | 200/200 |

Its forty new upstream ID-token executions passed. The exact gate verified 216 nonempty videos across sixteen selections. The privacy probe passed; the initial artifact scan checked 674 entries. Owned group memberships and the private upstream client credential were verified before teardown. The relay-idle check and ordinary cleanup gate passed, and independent label queries also found zero containers, volumes or networks. The final scan, including teardown and independent cleanup evidence, passed 676 entries. Cucumber seeds were Chrome `299003` and Edge `295140`.

Reports are under `artifacts/authentik/magic-shop-authentik-idtoken-20261025-01/`. Twenty-eight inspected runner, relay, gateway and provider/provisioning source-hash records matched the workspace; `source-verification.json`, browser runtime metadata and independent cleanup evidence accompany the reports.

All **80 new executions** passed across both providers, both browsers and both runners, including 72 negative cases with embedded signed controls and recovery checks and eight standalone signed controls. They are included in the 136 and 200 totals above.

Environment: Apple Silicon host using Linux amd64 container emulation; Node `24.19.0`, Chrome `155.0.8059.84`, Edge `154.0.4258.62`, Playwright `1.61.0`, Keycloak `26.4.0`, pinned authentik `2026.8.4`.

## Limits

The live providers perform the real authorization and code exchanges; the relay deliberately controls the ID-token response and adds an ephemeral key to these disposable broker fixtures. This proves the pinned Keycloak broker rejects each isolated negative for both upstream topologies. It does not prove direct authentik application-adapter validation, arbitrary organizational/cloud providers, signing-key rotation, JWKS outage handling, every optional JWT/OIDC claim, or native CI acceptance. Public JWT decoding alone is not used as a signature-validation substitute.

## Subsequent native key/JWKS coverage

2026-10-25: [Completion 65](65-native-key-rotation-jwks.md) adds real provider-generated key rotation and cached/uncached JWKS failure/recovery for both upstreams. Its 156/156 controlled and 220/220 authentik executions passed across both runners and browsers. The totals and limitations above describe this earlier ID-token increment.
