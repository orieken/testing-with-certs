# Authentik OIDC callback-state and code-exchange acceptance

Date: 2026-10-24. Local project: `magic-shop-authentik-oidc-acceptance-20261024-02`. Source: working-tree changes based on `0195993`. Ten inspected runner and provider-fixture source hashes are retained in `source-verification.json` beside the reports.

## Changes

The existing authentik OIDC application and broker state cases now use genuine pending authorization transactions. The tests change only callback state, retain the real provider-issued code and other callback parameters, observe the changed request, and require no application token exchange or lesson identity during rejection.

The application check then signs in using the same untouched callback. The broker check first completes an untouched login control, then starts a fresh transaction for the state fault. Keycloak expires the tampered broker transaction; the test requires its page-expired controls and broker-realm path and does not reuse that rejected transaction.

Eight new shared cases exercise both `authentik-oidc-spa` at Keycloak and `authentik-oidc-broker` at authentik:

- Wrong PKCE verifier.
- Missing PKCE verifier.
- Reuse of a consumed authorization code.
- Unregistered redirect URI.

Each case first completes a successful private token exchange using a real browser-obtained code, the correct verifier and registered callback, and the confidential credential where applicable. Verifier negatives get a fresh code and change only the verifier field. Replay repeats the successful exchange without clearing its cookies. The verifier and replay negatives require the observed `400 invalid_grant` contract on both endpoints. Unregistered redirects fail before credential entry.

The provider-specific [boundary helper](../../testing/teaching/authentik-boundaries.mjs) captures authorization responses and authentik's flow-executor redirects, including the pinned release's `xak-flow-redirect` JSON. It follows a bounded chain of real redirects within trusted lab origins and stops before the selected callback processes its code. Fresh cookies between independent test transactions avoid assuming that `prompt=login` has the same behavior across providers. The product's normal SSO behavior remains in place.

The owned upstream client credential is copied to a mode-0600 file in the existing private fixture volume, which the runner mounts read-only. Authentik's server secret and signing keys remain outside the runner. Final fixture verification checks that file's permissions and equality with the configured provider client's secret. The artifact scanner's filename rejection is regression-tested against this credential file.

## Container command

From the repository root, with a fresh project name:

```sh
LAB_PROJECT=magic-shop-authentik-oidc-example-03 sh testing/run-authentik.sh
```

The supported command runs the complete authentik OIDC/SAML suite. The gate now requires 136 executions: 88 baseline and 48 lifecycle. OIDC contributes 84 executions; the existing SAML regression contributes 52. It refuses existing project resources or report folders.

## Observed acceptance

The ordinary script exited successfully in project `magic-shop-authentik-oidc-acceptance-20261024-02`:

| Selection | OIDC | SAML regression | Total |
| --- | --- | --- | --- |
| Chrome / Playwright | 21/21 | 13/13 | 34/34 |
| Chrome / Cucumber | 21/21 | 13/13 | 34/34 |
| Edge / Playwright | 21/21 | 13/13 | 34/34 |
| Edge / Cucumber | 21/21 | 13/13 | 34/34 |
| Total | 84/84 | 52/52 | 136/136 |

Environment: Apple Silicon host, Linux amd64 runner containers through emulation, pinned authentik `2026.8.4`, Keycloak `26.4.0`, Node `24.19.0`, Chrome `155.0.8059.84`, Edge `154.0.4258.62`, and Playwright `1.61.0`. Cucumber random-order seeds were Chrome `76584` and Edge `900441`. The accepted run required no retry.

The real-browser recording-privacy probe passed. The exact evidence gate verified 136 passing executions and 152 nonempty indexed videos across 16 browser/runner/protocol/phase selections. The initial artifact scan passed 482 entries. Owned group memberships and the private client credential were verified before teardown. The ordinary harness verified removal of its users, keys, database, containers, networks, and volumes; an independent post-run query also found zero remaining project resources and is retained in `cleanup-verification.json`.

The final artifact scan, including teardown and independent cleanup evidence, passed 484 entries.

Reports, safe JUnit results, browser environment metadata, source hashes, privacy-screened recordings, and cleanup evidence remain under `artifacts/authentik/magic-shop-authentik-oidc-acceptance-20261024-02/`.

Forty-seven focused source tests passed locally and inside the final Linux runner container. They cover provider evidence completeness/provenance, both runners' exact case inventories, secret-file artifact rejection, existing matrix/recording gates, runner cleanup, scoped policy restoration, and token lifetimes. Node/Python syntax, whitespace, and the repository's container complexity check passed.

## Diagnostics and limits

The earlier diagnostic project `magic-shop-authentik-boundary-probe-20261024-01` exposed two harness assumptions: the flow's redirect component differs from the initial assumed component, and a later login can reuse SSO rather than showing another credential form. The initial probe also reproduced the known repeated-login behavior with `prompt=login`. The corrected probe completed all ten new/strengthened boundaries before the fresh full run. Those probes do not count toward the 136-case acceptance. Fixture verification passed before their stack was removed, and independent queries found zero remaining diagnostic containers, volumes, or networks. Diagnostics retained structural outcomes and paths/parameter names, not credentials or callback values.

This is local container acceptance for authentik-to-Keycloak federation, including both clients' token-endpoint boundaries. It does not establish a direct authentik application adapter, UI recovery after an upstream exchange failure, altered upstream ID-token/signing-key rejection, global upstream-session revocation, or cloud-provider interoperability. The SAML callback fixture retains its earlier malformed-code/state coverage. Native CI and the separate complete protocol/OTP matrix were not rerun for this increment.

## Cancellation/recovery follow-up

[Completion 63](63-oidc-cancellation-recovery.md) records the subsequent local 96/96 controlled OIDC and 160/160 authentik OIDC/SAML acceptance with six shared controlled recovery cases per provider. The counts and limits above describe this earlier boundary increment.
