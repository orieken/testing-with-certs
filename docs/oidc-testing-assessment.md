# OIDC testing assessment

Assessment date: 2026-10-24. Inspected commit: `0195993`, plus the current workspace documentation and skill additions. This is a source assessment with focused local tests, not a fresh live-browser acceptance run.

The repository has a complete foundation for controlled OIDC testing. The main opportunities are more precise negative tests, cancellation/recovery coverage, tighter provisioning checks, and easier focused execution.

Follow-up: [controlled callback-state and code-exchange acceptance](completion/61-oidc-callback-pkce.md) records 72/72 local container executions, plus focused OIDC execution and empty-report-directory refusal. [Authentik callback-state and code-exchange acceptance](completion/62-authentik-callback-pkce.md) adds the same OIDC boundaries and records 136/136 local container executions including SAML regressions. Both providers now have real-transaction OIDC state isolation and verifier/replay/redirect negatives on both exchanges. The findings below preserve the original assessment. [Cancellation and recovery acceptance](completion/63-oidc-cancellation-recovery.md) subsequently records 96/96 controlled OIDC and 160/160 authentik local container executions. The new [shared cancellation/recovery contract](oidc-testing.md#cancellation-and-recovery) implements six controlled browser-fault cases for each provider. Native provider cancellation controls, the rejected-logout-promise catch branch, upstream server-to-server failures, provisioning drift completeness and the other stated limits remain separate work. The [upstream ID-token contract](oidc-testing.md#upstream-id-token-validation) now adds ten cases per provider, including a trusted signed control and nine precise rejections; live acceptance is recorded separately from this original assessment.

## Scope and topology

The controlled lesson uses a public Vue SPA client, `oidc-spa`, in broker realm `lesson-oidc`. A confidential upstream client, `lesson-oidc-broker`, belongs to realm `lesson-provider`. Both realms run in the same provider container. Application and upstream exchanges have separate callbacks and PKCE S256 configuration.

The browser clears identity at access-token expiry. Lifecycle tests refresh broker tokens through a private request context. This is the intended behavior; browser auto-refresh is not missing coverage for this lesson.

The repository also tests authentik-to-Keycloak OIDC federation. Its inventory adds wrong-password, group mapping/withdrawal, and logout-isolation behaviors. The certificate-authenticated shop has its own OIDC and API security tests. Findings below distinguish these suites rather than treating controlled Keycloak federation as the whole repository.

Current source inventories require **40 controlled OIDC executions** and **52 authentik OIDC executions**, across Chrome/Edge and Playwright/Cucumber. These are expected counts, not observations from this assessment.

## Inventory

| Area | Status | Evidence and qualification |
| --- | --- | --- |
| Topology and client contract | Present | [Federation provisioning](../infra/keycloak/federation.mjs), [lesson clients](../infra/keycloak/lessons.json): separate realms/clients, exact callbacks, public/confidential distinction, PKCE. |
| Application session handling | Present | [Session implementation](../apps/magic-shop/src/teaching/certificate-free/session.ts): adapter callback handling, issuer/client/audience checks, expiry clearing, logout. Failure and cancellation branches need more live coverage. |
| Container orchestration and trust | Present in source | [Base stack](../infra/compose.yaml), [lesson overlay](../infra/auth-lessons.compose.yaml), [startup](../testing/start-auth-lessons.sh): trust mounts, health checks, internal names, amd64 browsers. No live environment verification in this assessment. |
| Owned fixtures and restoration | Present | [Fixtures](../infra/keycloak/auth-lesson-fixture.mjs), [policy helper](../infra/keycloak/lesson-session-policy.mjs): private generated credentials, scenario accounts, ownership before policy mutation, removal and verification. |
| Login and lifecycle | Present | [Shared controlled checks](../testing/teaching/oidc.mjs), [authentik baseline](../testing/teaching/authentik.mjs), [authentik lifecycle](../testing/teaching/authentik-lifecycle.mjs): baseline and expiry/refresh/logout/client-binding/session-expiry coverage. |
| Token/API boundaries | Present, with attribution limits | [Lesson token checks](../testing/teaching/auth-lessons.mjs) inspect claims and require real API rejection. [API security](../testing/api/security/security.spec.ts) and [signed negatives](../testing/container/jwt-negative-live.mjs) cover separate shop boundaries. Lesson rejection alone does not isolate issuer versus signature versus audience. |
| Reporting, privacy, and gates | Present | [Reporter](../testing/reporting/auth-lessons.mjs), [recording wrapper](../testing/teaching/auth-recording.mjs), [privacy probe](../testing/teaching/auth-recording-privacy.mjs), [matrix gate](../testing/reporting/check-auth-matrix.mjs), [recording gate](../testing/reporting/auth-recording-index.mjs). Run freshness is partial. |
| Cleanup and CI | Present, with verification limits | [Runner](../testing/run-auth-lessons.sh), [runner probes](../testing/run-auth-lessons.test.mjs), [CI](../.github/workflows/ci.yml): exit traps, failure probes, fixture verification, teardown, required jobs. Current runner does not independently query resource absence after teardown. |
| Organizational/cloud provider acceptance | Partial/deferred | Authentik is implemented. [Entra planning](../infra/entra/plan.mjs) explicitly returns `planned-not-provisioned`. Historical acceptance notes do not establish arbitrary provider interoperability. |

## Prioritized gaps

### 1. Callback-state checks do not isolate state validation

Both controlled callback negatives submit an invalid code and unmatched state into a fresh context. They require a visible error and absent identity. See `callback-state-rejection` and `broker-state-rejection` in [the shared model](../testing/teaching/oidc.mjs). Authentik's analogous checks also combine invalid inputs.

These prove rejection of malformed callbacks. They could still pass if state validation regressed, because code exchange or missing transaction state could fail independently.

**Next coverage:** start a genuine login, intercept a callback, alter only its state, and verify no identity or successful token exchange. Use an unmodified successful control. Cover application and broker callbacks separately, and add callback/code replay checks.

### 2. PKCE and redirect enforcement are configured but lack dedicated live rejection cases

The SPA client and upstream broker client require S256, and successful login exercises PKCE. The OIDC inventories do not include missing/wrong verifier, code reuse, or unauthorized redirect cases.

**Next coverage:** pair successful code exchange with wrong/missing-verifier rejection, consumed-code rejection, and unauthorized callback rejection. Exercise both exchanges where practical. Treat nonce/ID-token validation as a separate adapter contract: first inspect actual adapter behavior before proposing a nonce-specific assertion.

The existing shop JWT signature/issuer/audience tests are useful and should remain. They do not exercise upstream OIDC ID-token validation at the broker. Altered upstream signature/issuer/audience and signing-key rotation are additional federation tests, distinct from business-API JWT rejection.

**Observed upstream acceptance:** [Completion 64](completion/64-upstream-id-token-validation.md) records 136/136 controlled OIDC and 200/200 authentik local container executions, including every new case across both runners and browsers.

**Observed native rotation/JWKS acceptance:** [Completion 65](completion/65-native-key-rotation-jwks.md) records 156/156 controlled OIDC and 220/220 authentik local container executions, including all forty new case combinations across both runners and browsers. Original key restoration, outage recovery, recording/artifact gates and independent cleanup passed.

**Implemented upstream follow-up:** [the current server-side contract](oidc-testing.md#upstream-id-token-validation) adds a signed valid control and nine isolated signature/key, issuer, audience, authorized-party, time and nonce negatives for both providers. The pinned broker implementation was inspected before defining its nonce assertions. This covers the broker's upstream validation; browser-adapter ID-token validation remains separate. The [native rotation/JWKS follow-up](oidc-testing.md#native-signing-key-rotation-and-jwks-failures) adds real provider key changes, cached-key availability, and uncached-key rejection/recovery for HTTP 503, malformed JSON and empty key sets; fleet-wide revocation and prolonged cache-expiry outages remain separate.

### 3. Cancellation and dependency-failure recovery (original finding; controlled coverage added)

The controlled and authentik OIDC inventories do not cover provider cancellation, authorization denial, interrupted callbacks, or failed token exchange followed by retry. The UI contains catch/error paths, including local clearing when logout fails, which successful lifecycle cases do not exercise.

**Implemented follow-up:** both inventories now include six controlled faults with successful same-context recovery; see [the current contract and precise limits](oidc-testing.md#cancellation-and-recovery). The original recommendation follows for context.

**Original next coverage:** cancel or deny a real authorization, interrupt a token response, and simulate provider/token-endpoint unavailability in isolated selections. Require absent identity, a usable error/sign-in state, and a successful new login afterward. Add a failed-logout case verifying the UI's stated local-clear behavior. Label controlled faults separately from provider interoperability.

### 4. Upstream client drift validation omits two explicitly disabled capabilities

In [federation provisioning](../infra/keycloak/federation.mjs), `lesson-oidc-broker` is created with `implicitFlowEnabled: false` and `serviceAccountsEnabled: false`. The existing-client comparison checks protocol, public-client mode, standard flow, direct grants, and redirects, but omits those two fields.

An existing client with either capability enabled can pass this portion of provisioning validation. Fresh disposable creation reduces exposure, but the drift guard is incomplete.

**Next change:** compare both fields and add behavioral provisioning tests that reject each drift independently. This is a setup validation issue, not evidence that a current live client has either capability enabled.

### 5. Report freshness and post-teardown absence need explicit gates

The runner refuses existing Docker resources, but creates/reuses the host report directory with `mkdir -p`. Reports check browser, phase, case inventory, and normalized evidence type; they have no unique invocation/source identity. Recording directories have random names, but metadata is not bound to an invocation.

Reusing a project name after teardown can leave old recordings alongside new ones. The recording gate rejects duplicates, so an otherwise successful rerun can fail late. Standalone matrix validation also cannot distinguish an old complete report set from a new one. This is not proof that the ordinary runner currently reports failed tests as passing: it stops on failures.

The runner checks teardown's exit status but does not independently query remaining containers, volumes, and networks afterward. Historical completion notes record such independent checks, but they are not an executable assertion in this entrypoint.

**Next changes:** refuse a nonempty report destination or allocate a unique invocation directory; bind reports and recordings to run/source identity; query resource absence after teardown. Add meaningful probes for cleanup failures and handled interruption, beyond the existing runner-command failure probes.

### 6. A supported OIDC-only entrypoint is missing

[The ordinary runner](../testing/run-auth-lessons.sh) executes every protocol and provisions shared non-OIDC dependencies. A passkey or Kerberos failure can stop the run before later OIDC selections. There is no top-level OIDC-only selector; setting `LAB_AUTH_SUITE` outside the script does not provide one.

**Next change:** support an OIDC selection that retains fixture ownership, both runners/browsers, privacy checks, exact scoped evidence counts, and cleanup. Keep the combined CI matrix as separate full acceptance. This improves iteration and failure isolation; it is not a missing authentication behavior.

## Proposed coverage increments

| Increment | Existing coverage to preserve | Add |
| --- | --- | --- |
| Provisioning | Exact clients/callbacks, S256, dedicated provider | Disabled-capability drift negatives |
| Callback integrity | Malformed app/broker callback rejection | Genuine-transaction state mutation and replay controls |
| Code exchange | Successful exchanges on both legs | Wrong/missing verifier, consumed code, bad redirects |
| Recovery | Successful login/logout and expiry re-entry | Cancel/deny, exchange failure, provider outage, failed logout, successful retry |
| Evidence and operations | Exact browser/runner/phase counts, privacy, fixture restoration | Fresh invocation identity, nonempty-output refusal, post-teardown queries, interruption probes, focused entrypoint |
| Advanced/provider-specific | Keycloak and authentik broker lifecycle | Upstream ID-token negatives, key rotation, refresh reuse policy, upstream revocation/SSO contracts, explicitly scoped cloud acceptance |

Do not add refresh rotation/reuse expectations until the fixture's intended provider policy is defined. Do not require upstream passwords after access expiry; current tests deliberately permit SSO. Cloud acceptance requires a dedicated external tenant and cannot be inferred from controlled providers.

## Verification performed

Ran 39 focused local Node tests across lesson provisioning, scoped policy ownership/restoration, runner failure cleanup, exact matrix gates, filtered reporting, recording completeness, and token lifetime checks. All 39 passed. Runner probes substitute Docker commands; they do not start a provider or establish live cleanup.

No live stack was started, historical artifacts were not credited as current results, and remote CI status was not queried. The assessment identifies coverage and setup gaps; it does not establish exploitable authentication defects.

## Supported commands

From the repository root, the existing full protocol command is:

```sh
LAB_PROJECT=magic-shop-auth-assessment-01 sh testing/run-auth-lessons.sh
```

Use a fresh name and report destination. It needs Docker/Compose, image/build dependency access, and resources for the full stack; browser execution targets Linux amd64. Reports remain under `artifacts/auth-lessons/magic-shop-auth-assessment-01/`. The runner handles fixture restoration and teardown. See [the OIDC guide](oidc-testing.md) for trust, reports, and interrupted-run recovery.

Authentik has its own entrypoint, `testing/run-authentik.sh`; inspect its project-name and environment contract before use. Neither suite was executed live during this assessment.

## Refresh rotation follow-up

The [current refresh rotation/reuse contract](oidc-testing.md#refresh-token-rotation-and-reuse-detection) adds four real-authorization cases per provider topology: broker rotation/reuse and direct upstream rotation/reuse. Temporary owned policies restore exact original values. The Keycloak client-session invalidation and authentik revoked-token audit/valid-child semantics are separate assertions. Concurrent refresh races, grace-period settings and distributed token-family policy remain separate work. Live acceptance is recorded separately from this original assessment.

**Observed refresh rotation/reuse acceptance:** [Completion 66](completion/66-refresh-rotation-reuse.md) records 172/172 controlled OIDC and 236/236 authentik local container executions, including all thirty-two new executions in both browsers/runners. Original policies, recording/artifact gates and independent resource cleanup passed. Native acceptance and the stated race/grace/distributed-policy limits remain separate.

## Upstream logout/session follow-up

The [current upstream logout/session contract](oidc-testing.md#upstream-logout-and-session-revocation) adds native RP logout, native owned-user session deletion, RFC 7009 refresh-token revocation and the independent broker-session boundary for both upstreams. Silent authorization checks keep the original cookies until recovery. The authentik default invalidation flow, surviving refresh grant after session deletion, and absence of broker notification are explicit boundaries rather than claims of global logout. Live acceptance is recorded separately from this original assessment.

**Observed upstream logout/revocation acceptance:** [Completion 67](completion/67-upstream-logout-revocation.md) records 188/188 controlled OIDC and 252/252 authentik local container executions, including all thirty-two new executions across both runners and browsers. Native logout, scoped session/token revocation, same-cookie SSO probes, broker-boundary controls, recoveries, artifact gates and independent cleanup passed. This does not add configured SLO or establish global revocation.
