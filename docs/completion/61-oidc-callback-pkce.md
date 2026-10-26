# OIDC callback-state and code-exchange acceptance

Date: 2026-10-24. Local project: `magic-shop-auth-oidc-acceptance-20261024-05`. Source: working-tree changes based on `0195993`; the accepted runtime file hashes are retained in `source-verification.json` alongside the reports.

## Changes

The two existing controlled OIDC state checks now operate on real, pending authorization transactions. They change only callback state while retaining the real provider-issued code and other callback parameters. Each requires observation of the changed state at the browser request, no application token exchange, and no lesson identity during rejection.

The application check then completes login using the same untouched callback. The pinned broker expires its transaction after the state fault, so its successful control completes first, followed by a fresh real transaction for the negative. The broker check requires its page-expired controls and broker-realm path, rather than the generic error page produced by the old invalid-code fixture.

Eight additional shared cases cover both the SPA's broker client and the confidential upstream client:

- Wrong PKCE verifier.
- Missing PKCE verifier.
- Reuse of a consumed authorization code.
- Unregistered redirect URI.

Each first completes a successful private code exchange with the correct client, callback, verifier, and confidential secret where applicable. Verifier negatives obtain a fresh authorization code and change only the verifier field. Replay repeats the consumed control exchange. Redirect rejection happens before credential entry.

Browser authorization uses the real provider. The runner performs the code-boundary token requests privately. These checks establish endpoint rejection under the configured clients; they do not establish UI recovery after an upstream exchange failure.

The boundary harness captures the provider credential response and follows a bounded chain of real redirects within trusted lab origins. This avoids Playwright's redirect-chain interception limitation. Codes, states, verifiers, secrets, and token responses remain private to the scenario. Both runners use the same implementation and existing filtered reporting/recording privacy.

## Container execution

From the repository root, using a fresh project name:

```sh
LAB_PROJECT=magic-shop-auth-oidc-example-06 sh testing/run-auth-lessons.sh oidc
```

The new `oidc` argument runs the complete controlled OIDC baseline/lifecycle inventory. It refuses a nonempty report directory and retains fixture restoration, privacy checks, recording gates, scans, and teardown. Shared startup still provisions other lesson dependencies.

Focused results cannot satisfy the full protocol gate. Without the argument, the ordinary runner still requires the full protocol inventory, now 244 executions after these additions. That full inventory was not rerun for this acceptance.

## Observed acceptance

The ordinary script with the `oidc` argument exited successfully in project `magic-shop-auth-oidc-acceptance-20261024-05`:

| Selection | Baseline | Lifecycle | Total |
| --- | --- | --- | --- |
| Chrome / Playwright | 13/13 | 5/5 | 18/18 |
| Chrome / Cucumber | 13/13 | 5/5 | 18/18 |
| Edge / Playwright | 13/13 | 5/5 | 18/18 |
| Edge / Cucumber | 13/13 | 5/5 | 18/18 |
| Total | 52/52 | 20/20 | 72/72 |

Environment: Apple Silicon host, Linux amd64 browser containers through emulation, Chrome `155.0.8059.84`, Edge `154.0.4258.62`, Playwright `1.61.0`, Node `24.19.0`. Cucumber random-order seeds were Chrome baseline `807710`, Chrome lifecycle `146304`, Edge baseline `426677`, and Edge lifecycle `614740`.

The exact scoped matrix gate passed 72/72. The recording gate verified 72 videos across eight selections. The pre-index scan passed 267 entries; the post-index scan passed 276 entries. Fixture account removal and client-policy restoration were verified between every selection and again on exit. Independent post-teardown queries found zero project containers, volumes, and networks; `cleanup-verification.json` records those queries.

The final scan, including that independent cleanup evidence, passed 277 entries.

Reports and privacy-screened recordings remain under `artifacts/auth-lessons/magic-shop-auth-oidc-acceptance-20261024-05/`. Nine runtime source files in the built image matched their working-tree hashes. Forty-three focused source tests passed both locally and inside the Linux runner container. These include scoped/full-gate separation, recording completeness, empty-output refusal, failure cleanup, provisioning, policy restoration, and token lifetimes. Syntax, whitespace, and the repository's container complexity check also passed.

## Earlier attempts and limits

Project `magic-shop-auth-oidc-boundaries-20261024-01` failed the initial callback interception and was stopped before full completion. Probe `magic-shop-auth-oidc-boundary-probe-20261024-02` selected no tests because its filter was too narrow. Probe `magic-shop-auth-oidc-boundary-probe-20261024-03` confirmed the redirect-interception failure. None counts as acceptance.

Targeted diagnostics in `magic-shop-auth-oidc-probe-20261024-04` established the corrected provider-response interception, private PKCE controls, and the broker's page-expired behavior. The broker cannot use its original callback as a successful control after that state fault; the accepted test therefore uses an independent successful transaction first. Diagnostics retained paths, parameter names, and structural/Boolean outcomes, not credential or callback values. All four earlier projects were independently verified to have zero remaining containers, volumes, or networks.

This is local acceptance for controlled Keycloak OIDC. No new native CI run, full 244-case protocol acceptance, authentik browser run, cloud-provider acceptance, or upstream ID-token/signing-key negative coverage is claimed. Authentik's callback-state cases still use their earlier malformed-callback fixtures. Cancellation/recovery, upstream token validation/rotation, provisioning drift completeness, and broader evidence-freshness work remain separate follow-ups.

Later follow-up: [completion 62](62-authentik-callback-pkce.md) adds real-transaction OIDC state isolation and verifier/replay/redirect coverage for authentik, with its own 136/136 local container acceptance. The limits above describe this earlier controlled-provider increment.

## Cancellation/recovery follow-up

[Completion 63](63-oidc-cancellation-recovery.md) records the subsequent local 96/96 controlled OIDC and 160/160 authentik OIDC/SAML acceptance with six shared controlled recovery cases per provider. The counts and limits above describe this earlier boundary increment.
