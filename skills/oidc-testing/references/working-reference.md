# Working reference: testing-with-certs

Repository: https://github.com/orieken/testing-with-certs

The maintained explanation is `docs/oidc-testing.md`, including component, login, and refresh diagrams. This skill's versioned source lives at `skills/oidc-testing/` in that repository.

## Locate and read the implementation

If the current workspace is this repository, use its local files. Otherwise use an explicitly supplied checkout, or read the relevant files through connected GitHub tools or the repository website. Do not assume an author's absolute checkout path exists. If the reference cannot be accessed, use this summary and mark source details unverified rather than blocking an independent assessment.

Read only the sources relevant to the current mode:

| Question | Repository-relative source |
| --- | --- |
| Architecture, flow diagrams, complete procedure | `docs/oidc-testing.md` |
| Broader lessons and manual viewer | `docs/certificate-free-lessons.md` |
| Container services, mounts, networks | `infra/compose.yaml`, `infra/auth-lessons.compose.yaml` |
| Ports and transport boundaries | `infra/haproxy/haproxy.cfg` |
| Provider startup and broker provisioning | `infra/auth-lessons/provider.sh`, `infra/keycloak/federation.mjs`, `infra/keycloak/lessons.json` |
| Fixture ownership, users, policy, restoration | `infra/keycloak/auth-lesson-fixture.mjs`, `infra/keycloak/lesson-session-policy.mjs` |
| Browser session behavior | `apps/magic-shop/src/teaching/certificate-free/session.ts` |
| Shared OIDC checks and token/API assertions | `testing/teaching/oidc.mjs`, `testing/teaching/auth-lessons.mjs` |
| Exact inventory and runner selection | `testing/teaching/auth-matrix.mjs`, `testing/playwright.auth-lessons.config.mjs` |
| Cucumber adapter and features | `testing/cucumber/oidc.mjs`, `testing/cucumber/features/oidc.feature`, `testing/cucumber/features/oidc-session.feature` |
| Orchestration | `testing/start-auth-lessons.sh`, `testing/run-auth-lessons.sh` |
| Reports, privacy, completeness | `testing/reporting/auth-lessons.mjs`, `testing/reporting/oidc-cucumber.mjs`, `testing/teaching/auth-recording.mjs`, `testing/reporting/check-auth-matrix.mjs` |
| Recorded acceptance and limitations | `docs/completion/39-oidc-cucumber.md`, `docs/completion/45-oidc-session-refresh.md` |
| Independent authentik provider and boundary checks | `docs/authentik-lessons.md`, `testing/teaching/authentik-boundaries.mjs`, `testing/run-authentik.sh` |

## Architecture to learn from

The `lesson-provider` container hosts upstream realm `lesson-provider` and broker realm `lesson-oidc`. The broker has public SPA client `oidc-spa`; the upstream realm has confidential client `lesson-oidc-broker`. Both code exchanges use PKCE S256. The confidential secret belongs to the broker's server-side exchange.

The browser lesson is `https://shop.magic.test:8543/teaching/oidc`. Its callback appends `/callback`. Broker and upstream realms use `https://shop.magic.test:9643/realms/REALM`. The upstream callback is `/realms/lesson-oidc/broker/lesson-oidc/endpoint` on that origin. HAProxy passes TLS through on `9643`.

The lesson requires no user certificate. Separate API rejection requests use a valid customer certificate on port `8443`; all three business APIs must reject the lesson token. This verifies a token boundary with valid transport credentials.

The browser clears identity at access-token expiry and does not silently refresh. Refresh checks use a private request context. Access expiry re-entry requires another upstream authorization request, with SSO reuse or a credential prompt both permitted.

The reference now defines forty-two baseline and five lifecycle OIDC cases, each required through Playwright and randomized Cucumber in real Chrome and Edge: 188 OIDC executions. Baseline includes real-transaction state mutation, wrong/missing PKCE verifier, code replay, and unauthorized redirect checks on both exchanges. The current source inventory is authoritative; historical completion totals are not a permanent combined-suite target.

## Supported container command

From this repository's root, with Docker/Compose available and a fresh disposable name:

```sh
LAB_PROJECT=magic-shop-auth-oidc-example-01 sh testing/run-auth-lessons.sh
```

The script runs the full protocol lesson suite, not only OIDC. It refuses existing resources under the chosen project label. The runner targets Linux amd64; Apple Silicon uses emulation. Reports remain at `artifacts/auth-lessons/magic-shop-auth-oidc-example-01/`.

For focused OIDC baseline/lifecycle execution, use a fresh project name and append `oidc`:

```sh
LAB_PROJECT=magic-shop-auth-oidc-focused-01 sh testing/run-auth-lessons.sh oidc
```

Focused mode requires an empty report directory, runs the 188-case OIDC inventory, and uses scoped matrix/recording gates. Those results cannot satisfy full protocol acceptance. Shared startup still provisions non-OIDC dependencies.

The script builds and starts dependencies, configures realms, builds the browser runner, checks recording privacy, runs selections, verifies fixtures between groups, gates reports, scans artifacts, and tears down through an exit trap. Shared startup includes non-OIDC dependencies such as Kerberos.

Lifecycle selection pairs fixture action `start-oidc-lifecycle` with container variable `LAB_AUTH_SUITE=oidc-lifecycle`. Baseline uses fixture action `start`. The top-level focused selector is the `oidc` argument, not that internal variable. Custom focused commands must preserve mounted trust, private fixture data, customer certificate, network, and report destination; prefer the supported script over an improvised shortened entrypoint.

Lifecycle fixtures temporarily apply a 20-second access lifetime and 45-second client-session maximum only to broker client `oidc-spa`. Ownership precedes mutation; existing overrides fail setup. `finish` restores owned policy and removes provider/imported users; `verify` checks restoration and absence. Browser home/tmp volumes are removed between groups, and the final teardown removes project resources.

Reports filter known names and status, while provider documents are hidden in recordings. Baseline Playwright OIDC results share the `passkeys-federation` phase; Cucumber baseline uses `oidc-cucumber`. Lifecycle uses distinct `oidc-lifecycle` and `oidc-lifecycle-cucumber` phases. Each has Chrome and Edge output. Full acceptance requires exact selection provenance, scan results, and successful cleanup.

The reference proves controlled Keycloak federation and broker token/session behavior. It does not prove arbitrary provider support, upstream refresh revocation, all provider SSO policies, or forced password prompts.

## Authentik variant

The separate authentik suite also tests application/broker state isolation and both clients' verifier, replay, and redirect rejection. Read its guide and boundary helper when adapting to an independent provider. The pinned authentik flow can finish through `xak-flow-redirect` JSON, so its interception differs from the Keycloak credential-POST response hook. Independent test transactions use fresh browser cookies instead of assuming `prompt=login` works the same way across providers. Same-callback and replay controls retain the transaction state they need. These are reference-specific mechanics, not universal provider requirements.

Its upstream client credential is a mode-0600 file in the existing private fixture volume, mounted read-only by the runner; signing keys and the authentik server secret stay outside the runner. Its complete OIDC/SAML acceptance command is `LAB_PROJECT=magic-shop-authentik-unique sh testing/run-authentik.sh`, from the repository root with a fresh project name. It has its own complete evidence and resource-cleanup gates.

## Cancellation and recovery reference

Both providers share `testing/teaching/oidc-recovery.mjs` and its separate dependency-free case inventory. Six cases control a real transaction's cancellation response, interrupt callback delivery, return a provider password-submission 503, return a broker token 503, abort a broker token request, and return a broker logout-navigation 503. Each fault fires once. Recovery retains the same browser context, cookies and storage, and must complete a real new login with identity/audience/API-denial checks. Token and cancellation errors require an enabled sign-in control before re-entry. Navigation faults require explicit re-entry.

Label these as controlled browser faults. They do not prove a provider-native Cancel button, server-to-server upstream token outage, or global logout revocation when the logout document fails. The logout navigation test proves local identity is absent after re-entry; it does not exercise an adapter rejected-promise catch branch. Preserve those distinctions when assessing another project.

## Upstream ID-token validation reference

Browser routing cannot modify the broker's server-to-server token exchange. The reference uses `infra/oidc-token-fixture/` as a private relay at internal trusted HTTPS port 9843. Only the owned OIDC broker token/JWKS URLs use it; issuer and authorization URLs remain the real provider. It verifies the original token against real JWKS, then replaces only the ID token. Semantic negatives are signed with an ephemeral relay key advertised alongside real public JWKS; the private key stays in process memory. The runner receives only a mode-0600 control credential.

`testing/teaching/oidc-upstream.mjs` shares ten cases across both providers/runners: unchanged-claims signed control; bad signature; unknown key ID; wrong issuer, audience or authorized party; expired or future-not-before token; wrong or missing nonce. Each negative first passes the same signing-key control, changes one input on a fresh transaction, requires broker rejection without application code/exchange/identity, then proves an unmodified live login succeeds. Independent transaction cookies are cleared here; cancellation/recovery tests retain their separate same-context contract. Signature, nonce and TLS validation remain enabled.

Control is owner-scoped and refuses concurrent leases. Both harnesses verify the relay is idle before teardown, including failure cleanup. The authentik OIDC/SAML inventory now requires 252 executions; focused controlled OIDC requires 188. These ID-token mutation fixtures prove the pinned broker's validation, not a direct authentik adapter, cloud-provider compatibility or signing-key rotation. The separate native rotation/JWKS cases below cover native provider key changes. Do not trust an invented test key in shared or production provider settings.

## Native signing-key rotation and JWKS reference

`testing/teaching/oidc-jwks.mjs` shares five cases: real native rotation; cached-key success during a proven HTTP 503; uncached-key rejection/recovery for HTTP 503, malformed JSON and an empty key set. Tokens remain signed by the real provider. The relay verifies each original token using the real provider JWKS and privately tracks distinct key IDs and broker-facing JWKS requests/failures/successes. Do not infer cold-lookup failure from a cached login or immediate revocation from key removal.

Keycloak uses a private fixed-realm controller on internal HTTPS 9853. It generates an owned higher-priority RS256 component in `lesson-provider`, snapshots the original active key before mutation, and deletes only its journal-owned component when restoring. Administrative credentials stay in that controller. Authentik uses its native CertificateBuilder through its existing private fixture control; only the owned OAuth2 provider's key reference changes, with the SAML key unchanged. The key pair stays inside authentik, and the recorded original reference is restored before deleting the owned temporary pair.

Both paths journal ownership before side effects and recover partial mutation on teardown. Strict pre-acceptance checks require the original key active and no leftover owned key/journal. The tests retain eleven-second waits around unknown-key refresh and recovery so the pinned broker's normal ten-second JWKS fetch protection remains enabled. This reference does not establish fleet-wide rotation, emergency revocation, long outages past key-cache lifetime or cloud-provider policy.

The controlled Keycloak provider already uses the dedicated SAML fixture key for its baseline RS256 signing, and existing signed-SAML tests mount that test key in the runner. New native rotation keys stay in Keycloak. Do not describe this whole reference lab as having no provider signing material in its runner; distinguish the existing test signer from newly rotated keys and real production keys.

In this repository, start the Keycloak key controller with `--no-deps` after shared lesson provisioning has completed. Restarting its already-completed non-idempotent secret initializer would correctly refuse the existing credential and stop startup. This is a reference-specific Compose sequencing requirement, not a reason to make credential creation overwrite existing state.

## Refresh rotation and reuse reference

`testing/teaching/oidc-refresh.mjs` shares four baseline cases per provider topology, separately covering application/broker and upstream rotation/reuse. Real browser authorization uses PKCE and exact callbacks; private code exchange produces the refresh token. Rotation requires two distinct replacements and usable identity-bound access tokens. Reuse replays the spent original, checks `invalid_grant` without issued credentials, checks the current replacement's fate and recovers with new authorization plus a successful refresh.

Use temporary owned policy, not provider-default assumptions: Keycloak's fixed disposable realms set `revokeRefreshToken=true` and `refreshTokenMaxReuse=0`; authentik's owned OAuth2 provider sets `refresh_token_threshold=seconds=0` and the upstream request includes explicitly supported `offline_access`. Journal before mutation and restore exact original values on success and failure. Keycloak invalidates the affected client session after replay, while pinned authentik records suspicious revoked-token reuse and keeps the replacement valid. Do not label the latter family-wide revocation. Only a safe event count leaves the private authentik control; tokens and audit context stay private. This tests private refresh grants, not browser auto-refresh, concurrent races, grace intervals or fleet-wide policy.

## Upstream logout and session revocation reference

`testing/teaching/oidc-sessions.mjs` shares four cases per provider: native RP logout, administrative upstream session deletion, RFC 7009 current-refresh-token revocation and the existing broker session after upstream session deletion. Use dedicated owned identities, a valid refresh/UserInfo control and a silent `prompt=none` SSO control before mutation. Keep the original browser cookies for post-mutation checks. Recover with new real authorization, not by restoring deleted sessions.

Pinned Keycloak rejects upstream refresh after logout/session deletion. RFC 7009 removes its refresh-token client session and removes SSO when the fixture has no other clients. Pinned authentik's default provider invalidation flow leaves authentik SSO and refresh available while removing application access grants. Native browser-session deletion removes its old access grant and SSO, but its refresh-token model deliberately survives session deletion. Explicit refresh-token revocation rejects that refresh while preserving authentik SSO. Do not assert a universal logout or family-revocation policy.

Both topologies retain their independent broker refresh after upstream session deletion when logout notification is unconfigured; the control refuses unexpected notification configuration. Fixed private controls can delete sessions only for the dedicated test selectors, require positive/zero before/after counts, and return no session identifiers. Native logout captures the real registered return and state before an unmatched broker callback executes. Capture the initial logout response or authentik flow-executor redirect; callback-only routing is unreliable for later redirects. These checks do not add SLO or claim global revocation, offline JWT invalidation, distributed delivery or cloud compatibility.

## Focused certificate-login and mTLS workflow

For browser X.509 login, gateway/service transport and application identity binding, read [mTLS guidance](mtls.md). `testing/run-oidc-mtls.sh` runs the real shop login and API security contract with the reusable transport helper and verified project cleanup. The shop’s `cert_identity` comparison is separate from RFC 8705 thumbprint binding; this workflow does not establish OAuth mTLS client authentication.

The `rfc8705` argument now adds real Keycloak public-client bound-token issuance and all three APIs' thumbprint enforcement. `testing/rfc8705/binding.spec.mjs` uses two valid same-identity leaves, proves each matching token/certificate succeeds, then requires cross-presentation and spoofed-thumbprint rejection. See the [mTLS reference](mtls.md) and `docs/completion/69-rfc8705-certificate-bound-tokens.md`; baseline application identity matching remains a distinct contract.

The RFC selection now also uses `rfc8705-tests` from `infra/rfc8705.compose.yaml`: real headed Chrome/Edge on Xvfb with x11vnc/noVNC, per-page recordings via the shared auth recording wrapper, per-channel decoded-frame privacy probes and exact scenario/video gates. `testing/reporting/rfc8705-report.mjs` reuses the existing Go matrix gallery/exporter; `check-rfc8705-playback.mjs` checks every exported clip in both channels. Read `docs/completion/70-rfc8705-recorded-vnc.md` for scope and acceptance.
