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

The independent gate requires all 104 browser/runner executions: seven baseline and six
lifecycle cases per protocol, each in real Chrome/Edge under Playwright/Cucumber. Required cases
cover mapped group roles, absent groups, incorrect password, disabled user,
unmatched lesson callback, provider logout plus a clean return and isolated profile,
and OIDC broker-state or SAML signature rejection. Callback fixtures use invalid
fixture code/unmatched state, following the existing lesson boundary pattern;
they do not claim a valid-code state-tampering acceptance test. The SAML negative
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

The evidence gate requires 56 baseline plus 48 lifecycle records, segregates their
spec names and phases into 16 indexed report selections, and rejects mislabeled
phase/spec/privacy evidence. The independent membership check produces
`lifecycle-cleanup.txt` only after all four browser/runner selections pass.
Fixed group-stage progress messages are strictly allowlisted by the reporter;
unknown messages, extra values, and credential-like suffixes are withheld.
[Completion 58](completion/58-authentik-lifecycle.md) records native lifecycle
acceptance. Full local browser acceptance remains unavailable after a Docker API
failure; a separate real-provider control probe passed and was cleaned up.

## Observed acceptance

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
