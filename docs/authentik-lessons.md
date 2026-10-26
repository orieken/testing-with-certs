# authentik provider examples

These examples use the self-hosted authentik application/provider model with two
separate broker lessons:

- OIDC: `/teaching/authentik-oidc` → `lesson-authentik-oidc` → authentik OIDC.
- SAML: `/teaching/authentik-saml` → `lesson-authentik-saml` → authentik SAML.

The lesson entry point is `https://shop.magic.test:8543`; the existing Keycloak
broker is on port 9643 and authentik is behind the lab TLS gateway on port 9743.
These ports are internal to the disposable Docker network. No host provider port,
Docker socket, hosted account, enterprise license, or paid cloud service is used.
The certificate-required shop and its business API authorization remain separate.
This proves `authentik → Keycloak → app` interoperability, not direct authentik-to-app
OIDC or SAML support.

## Run

```sh
LAB_PROJECT=magic-shop-authentik-unique sh testing/run-authentik.sh
```

Choose a new project name and report folder for every run. The harness refuses
existing project resources or evidence. It creates private random secrets,
starts pinned server/worker/PostgreSQL containers, waits for required built-in
blueprints, and provisions owned users, groups, providers, and separate broker
realms. Credentials stay in private named volumes; passwords and protocol bodies
are not exported. Teardown removes and independently checks the project's
containers, networks, and volumes, including its entire provider database and keys.

Authentik is pinned to 2026.8.4 and its immutable image digest. The fixture uses
that release's Django management models deliberately; upgrades require checking
schema, blueprints, and the live acceptance matrix. OIDC grants explicitly permit
only authorization code and refresh. Discovery and SAML metadata are fetched over
verified TLS, the signing certificate is checked, redirects and audiences are
restricted to the broker, and client roles are explicitly scoped. SAML requires
signed assertions/responses and an exact recipient. Signed POST logout responses
use native front-channel return so the top-level browser returns to the lesson.

The authentik lessons use normal SSO semantics. Existing lessons retain their
forced-login behavior. A controlled provider probe observed repeated identification
when `prompt=login` was forwarded upstream; omitting that optional prompt on the
new lessons allowed the same real credential flow to complete. This is not proof
of upstream reauthentication on every existing-session login.

## Required evidence

The independent gate requires all 252 browser/runner executions: forty-four OIDC baseline
cases, seven SAML baseline cases, and six lifecycle cases per protocol, each in real
Chrome/Edge under Playwright/Cucumber. Required cases cover mapped group roles,
absent groups, incorrect password, disabled user, lesson callback rejection,
provider logout plus a clean return and isolated profile, and OIDC broker-state
or SAML signature rejection. OIDC code-exchange negatives cover wrong/missing
PKCE verifiers, consumed codes, and unregistered callbacks on both exchanges.
Six additional OIDC cases cover controlled cancellation, interrupted callback, provider/token unavailability, interrupted token response, and failed logout navigation, each followed by a successful login in the same context. See [the shared recovery contract](oidc-testing.md#cancellation-and-recovery).
OIDC state cases change only state on real pending callbacks. The separate SAML
application callback fixture retains its invalid-code/unmatched-state input.
The SAML signature negative
changes the actual authentik signature values and requires observed mutation and
server rejection. Positive sessions verify issuer, client, identity, audience,
scoped roles, and denial at all three business APIs. Browser traffic must remain
on the lab origins. Physical authenticators and global upstream-session revocation remain outside
this increment. Lifecycle implementation and its acceptance status are described below.

Results, safe JUnit, browser runtime versions, privacy-screened videos, and exact
case indexes are written under `artifacts/authentik/PROJECT/`. Provider pages are
hidden from video before rendering; a real-browser frame privacy probe must pass.
The gate rejects missing/duplicate/failed cases, wrong provenance, symlinks, empty
or unindexed recordings. It exports `recording-matrix.json` for `./lab matrix-merge`.
The ordinary native CI job runs the same harness, scans before upload, always
verifies cleanup, and is required by the final independent gate. Only observed
passes may be added to the coverage matrix.

Four additional OIDC baseline cases cover [refresh-token rotation and reuse detection](oidc-testing.md#refresh-token-rotation-and-reuse-detection) on both the Keycloak broker and actual authentik upstream. The test records the pinned providers' different replay consequences; it does not claim authentik revokes an entire token family.

Four further OIDC baseline cases cover [native upstream logout and session/token revocation](oidc-testing.md#upstream-logout-and-session-revocation), including the surviving authentik refresh grant after session deletion and the independent broker session without configured logout notifications. These checks preserve the default invalidation flow and use dedicated disposable identities.

## OIDC callback and code-exchange boundaries

Both runners call [the same boundary implementation](../testing/teaching/authentik-boundaries.mjs).
It captures authentik authorization responses or flow-executor JSON redirects,
then follows a bounded chain of real provider/broker redirects within the trusted
lab origins. It stops before the selected callback processes its real code.

The application state check changes only state, requires an observed changed
callback request, no broker token exchange, and no lesson identity. The untouched
callback then succeeds in the same context. The broker state check first completes
an untouched login control. It then uses a fresh pending transaction, corrupts
only state, and requires Keycloak's page-expired response without an application
token exchange or identity. The rejected broker transaction is not reused.

Each PKCE/code case first obtains a real code through the browser and completes a
successful private exchange. Verifier negatives obtain a fresh code and change
only its verifier field. Replay repeats the successful exchange with the same code,
verifier, client and cookies. Unregistered redirects must fail before credential entry.
Fresh cookies between independent transactions avoid relying on provider-specific
forced-login prompts. They do not change the application's normal SSO policy.

The upstream checks use confidential client `authentik-oidc-broker`; the application
checks use public client `authentik-oidc-spa`. Only the upstream client credential is
copied to `/ak-fixture/oidc-client-secret`, with mode `0600`, inside the private fixture
volume. The runner mounts that volume read-only. Final fixture verification checks
the file's permissions and equality with the owned provider client's secret. No
authentik signing keys or server secret are added to the runner. Reports and videos
exclude code, state, verifier, client-secret and token values.

These boundary checks are complemented by [upstream ID-token validation](oidc-testing.md#upstream-id-token-validation): ten additional OIDC cases include a valid signed control and isolated signature/key, issuer, audience, authorized-party, time and nonce negatives on the broker's server-side exchange. They use the same private relay and controls as the Keycloak upstream variant. Five further shared [native rotation/JWKS cases](oidc-testing.md#native-signing-key-rotation-and-jwks-failures) rotate the actual provider key, distinguish cached and uncached outages, and cover malformed/empty JWKS recovery. Direct authentik application adapters and fleet-wide key revocation remain separate coverage.

## Lifecycle implementation

The disposable broker clients use an exact 20-second access-token lifetime and a
45-second maximum client session. These overrides belong only to newly created
fixture realms; the harness deletes their database and keys at teardown. Each
lifecycle scenario has its own provider account. Both runners enumerate the same
six cases for each protocol:

- Access expiry clears the displayed identity without automatic browser refresh;
  sign-in can establish the same identity again. Broker SSO may be reused, so this
  does not imply upstream reauthentication or a new assertion on expiry alone.
- Manual broker refresh preserves subject, username, issuer, client, intended
  audience and API denial. It does not initiate a browser navigation to the upstream provider.
- Logout must reach the provider, return cleanly to the lesson, invalidate the
  saved broker refresh token and leave a fresh browser context signed out.
- Refresh under the wrong client is rejected, with a same-token correct-client
  success control to exclude expiry as the cause.
- Actual maximum-session expiry rejects refresh after waiting the observed
  lifetime; the test does not mutate the token clock or simply use a bad token.
- Group withdrawal removes actual provider membership. Broker refresh retains its
  cached role; after provider logout and a new provider roundtrip the role must be
  absent with the same subject. Provider SSO may reuse cookies; a password prompt
  is not required, but a new provider roundtrip and new mapped token are. Membership
  is restored in `finally` and independently checked afterward.

The private `authentik-control` service uses the pinned provider's management
models to change only the two owned group-withdrawal users. It has no host port,
requires a private random bearer secret, refuses other users/actions, and emits
no request logs. Real tests require unauthorized calls to fail and an authenticated
unknown target to fail before performing the owned mutation. Its secret is kept
in the private fixture volume, never reports. The lifecycle control is test-only;
it is not an application or gateway endpoint. Tests access the private auth
network as well as the browser front network.

The evidence gate requires 88 baseline plus 48 lifecycle records, segregates their
spec names and phases into 16 indexed report selections, and rejects mislabeled
phase/spec/privacy evidence. The independent membership check produces
`lifecycle-cleanup.txt` only after all four browser/runner selections pass.
Fixed group-stage progress messages are strictly allowlisted by the reporter;
unknown messages, extra values, and credential-like suffixes are withheld.
[Completion 58](completion/58-authentik-lifecycle.md) records native lifecycle
acceptance. That historical increment did not obtain full local browser acceptance
after a Docker API failure; its separate real-provider control probe passed and
was cleaned up. Current execution requirements include the later OIDC boundaries above.

## Observed acceptance

The subsequent upstream logout/revocation suite passed **252/252 local container executions**, including 200 OIDC and 52 SAML regressions across both runners and browsers. All sixteen new authentik topology executions passed. The native invalidation-flow, surviving refresh grant after browser-session deletion and independent unnotified broker session are explicit asserted boundaries. Recording/artifact gates and independent cleanup passed. [Completion 67](completion/67-upstream-logout-revocation.md) records the controls, recoveries and exact evidence.

The subsequent refresh rotation/reuse suite passed **236/236 local container executions**, including 184 OIDC and 52 SAML regressions across both runners and browsers. All sixteen new authentik topology executions passed, with strict original-policy restoration, recording/artifact gates and independent cleanup. [Completion 66](completion/66-refresh-rotation-reuse.md) records the separate broker and upstream contracts, audit/replacement assertions and exact evidence.

The subsequent native signing-key/JWKS suite passed **220/220 local container executions**, including 168 OIDC and 52 SAML regressions across both runners and browsers. All twenty new authentik rotation/outage combinations passed. Original keys and owned fixtures were verified before teardown; recording/artifact gates and independent resource cleanup passed. [Completion 65](completion/65-native-key-rotation-jwks.md) records the native controls, observed cache behavior, recovery and exact evidence.

The subsequent upstream ID-token suite passed **200/200 local container executions**, including 148 OIDC and 52 SAML regressions. The exact gate verified 216 videos across sixteen selections; fixture restoration, relay-idle checks and independent cleanup passed. [Completion 64](completion/64-upstream-id-token-validation.md) records the signed control, nine isolated rejections, source/runtime evidence and scope.

The subsequent cancellation/recovery suite passed **160/160 local container executions**, including 108 OIDC and 52 SAML regressions. All 176 videos across sixteen selections were verified; fixtures and independent resource cleanup passed. [Completion 63](completion/63-oidc-cancellation-recovery.md) records the six new behaviors, exact commands, runtime/source evidence, and controlled-fault limits.

The extended OIDC boundary suite passed **136/136 local container executions**,
including 84 OIDC and 52 SAML regression executions across both browsers and runners.
The gate verified 152 videos across 16 selections, fixture verification and teardown
passed, and independent queries found zero remaining project resources.
[Completion 62](completion/62-authentik-callback-pkce.md) records the command, source
hashes, runtimes, earlier probes, and scope. This is local acceptance; the native
104-case result below remains historical evidence for its recorded source.

[Native run 39316975644](https://github.com/orieken/testing-with-certs/actions/runs/39316975644)
passed all 104 executions and all 16 jobs at `c86489c`. Independent downloaded gates
verified 120 videos across 16 baseline/lifecycle selections and scanned 386 entries.
All eight group-withdrawal executions retain complete safe log stages (64 events),
and both group restoration and project teardown records are present. The gallery
now has 206 selections and 1,872 videos; every video source resolves. Earlier
fixture-startup failures and the group re-entry timeout are retained in completion
58. This acceptance uses real native Linux x64 Chrome/Edge in both runners.

Earlier baseline acceptance:

[Native run 39168182768](https://github.com/orieken/testing-with-certs/actions/runs/39168182768)
passed 56/56 required executions and all 16 workflow jobs at `2bbf1b5`, attempt 1.
Independent downloaded gates verified eight method/browser/runner selections and
64 indexed videos; the credential scan checked 213 entries, including verified
cleanup. All videos are imported into the combined matrix gallery.
[Completion 57](completion/57-authentik-provider.md) records runtime versions,
local Docker limitations, and remaining acceptance scope.

## Sources

- [Official Docker Compose installation](https://docs.goauthentik.io/install-config/install/docker-compose/)
- [Authentik 2026.8 release notes](https://docs.goauthentik.io/releases/2026.8/)
- [Official Keycloak integration](https://integrations.goauthentik.io/infrastructure/keycloak/)
- [SAML provider configuration](https://docs.goauthentik.io/add-secure-apps/providers/saml/)
- [Provider property mappings](https://docs.goauthentik.io/add-secure-apps/providers/property-mappings/)
- [Upstream report concerning repeated prompt=login authentication](https://github.com/goauthentik/authentik/issues/18507)
