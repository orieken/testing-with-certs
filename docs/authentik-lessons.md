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

The independent gate requires all 56 browser/runner executions: seven OIDC and
seven SAML cases, each in real Chrome/Edge under Playwright/Cucumber. Required cases
cover mapped group roles, absent groups, incorrect password, disabled user,
unmatched lesson callback, provider logout plus a clean return and isolated profile,
and OIDC broker-state or SAML signature rejection. Callback fixtures use invalid
fixture code/unmatched state, following the existing lesson boundary pattern;
they do not claim a valid-code state-tampering acceptance test. The SAML negative
changes the actual authentik signature values and requires observed mutation and
server rejection. Positive sessions verify issuer, client, identity, audience,
scoped roles, and denial at all three business APIs. Browser traffic must remain
on the lab origins. No physical authenticator, lifecycle/refresh, group withdrawal,
or global upstream-session revocation acceptance is implied.

Results, safe JUnit, browser runtime versions, privacy-screened videos, and exact
case indexes are written under `artifacts/authentik/PROJECT/`. Provider pages are
hidden from video before rendering; a real-browser frame privacy probe must pass.
The gate rejects missing/duplicate/failed cases, wrong provenance, symlinks, empty
or unindexed recordings. It exports `recording-matrix.json` for `./lab matrix-merge`.
The ordinary native CI job runs the same harness, scans before upload, always
verifies cleanup, and is required by the final independent gate. Only observed
passes may be added to the coverage matrix.

## Observed acceptance

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
