# Infrastructure, Prompts 03–04

`infra/compose.yaml` currently runs container-only PKI, database-secret,
PostgreSQL, Keycloak, HAProxy, a Vue certificate-sign-in shell and three language-specific
transport placeholders. These placeholders return 503 for business routes;
they are not OpenAPI-backed providers. `./lab up` builds and waits for this
infrastructure. The `test` and `manual` profiles use the same pinned amd64
Bookworm image with actual Chrome and Edge binaries. Prompt 04 adds an idempotent certificate-only Keycloak realm to this Compose stack. The early UI-auth increment now uses that realm for PKCE sign-in, in-memory tokens and sign-out. Catalog data remains unavailable until the Go API is implemented.

The PKI image is pinned UBI9 9.6 at
`sha256:dec374e05cc13ebbc0975c9f521f3db6942d27f8ccdf06b180160490eef8bdbc`.
It runs as UID/GID 1000, has no network, and uses the image's OpenSSL. No CA key,
leaf key, certificate or password is copied from the repository or baked into an
image. Run `docker compose -f infra/compose.yaml build pki` once, then use
`./lab pki init`, `./lab pki verify`, `./lab pki renew shop-admin`, or
`./lab pki revoke shop-admin previous`, then `./lab pki retire shop-admin`.
Revoke publishes a new CRL. `docker compose -f infra/compose.yaml restart
gateway keycloak` reloads both TLS consumers; use a fresh connection for the rejection check. Keycloak realm-level CRL rejection was observed in Prompt 04.

| Volume | Contents | Intended runtime readers |
| --- | --- | --- |
| `ca-state` | Three signing keys, serial/index files, issued-leaf archive | PKI job only |
| `public-trust` | Public server/user/service CA certificates, CRLs, and combined service CA/CRL bundle | TLS consumers and selected runner |
| `cert-shop`, `cert-gateway-client` | Shop server and gateway service-client leaves | HAProxy only |
| `cert-auth` | Auth server leaf | Keycloak only |
| `cert-ui` | UI server leaf | UI only |
| `cert-customer-api`, `cert-catalog-api`, `cert-insights-api` | Server leaves for exact private HTTPS DNS names | Respective APIs only |
| `cert-customer-client`, `cert-catalog-client`, `cert-insights-client` | Service-client leaves | Customer and insights currently mount their own; catalog remains unmounted until needed |
| `cert-postgres` | `postgres` DNS server leaf | PostgreSQL only |
| `cert-<seed-user>` | One user certificate/key, PKCS#12 bundle and random bundle password per volume | One selected user volume is mounted into each runner instance |
| `cert-unknown-user` | Trusted user-CA certificate with no Keycloak mapping | Negative-fixture runner only |
| `auth-secret-admin`, `auth-secret-catalog`, `auth-secret-reporting` | Generated 0600 bootstrap-admin and scoped service-client secrets | Keycloak/operator/bootstrap, customer service, and insights service respectively |
| `db-secret-admin` | PostgreSQL superuser password, owned by UID 999 | PostgreSQL and database bootstrap only |
| `db-secret-keycloak`, `db-secret-customer`, `db-secret-catalog`, `db-secret-insights` | Two owner-scoped 0600 copies of each generated password, for UID 999 bootstrap and UID 1000 future service | Secret job, bootstrap, and only the corresponding future service |
| `pg-data` | Persistent PostgreSQL data | PostgreSQL only |

The six seed-user volume suffixes are `customer-waterdeep`, `customer-baldur`,
`customer-neverwinter`, `shopkeeper`, `shop-admin`, and `disabled-customer`.
Their certificate CNs use the fixed protected `certIdentity` values in
`seed/identities.json`, not usernames. All six mapped identities now exist in Keycloak; `unknown-user` is intentionally absent. All leaf keys are mode 0600,
public certificates/CRLs 0644, and the signer keeps private state in its own
volume. Renewal permits one overlapping previous certificate and fails another
renewal until that overlap is resolved. Ordinary `init` reuses existing leaves.

PostgreSQL uses the official multi-architecture 16.15 Trixie image pinned at
`sha256:65b16a8b326e0cfbdf33fa7e783f2a0cb352a61448616ccccfd616ef42aa0f65`.
This is a documented UBI9 exception because the maintained official entrypoint
handles persistent cluster initialization. A root entrypoint copies only the
PostgreSQL server leaf to a postgres-owned runtime path, then drops to UID 999.
The database is on the internal `database` network and accepts network clients
only with TLS plus SCRAM. Bootstrap uses `sslmode=verify-full` against the
`postgres` SAN and the public server CA. Its idempotent four-owner/four-database
setup is repeated via `./lab db init`; `./lab db verify` tests own-db access and
cross-db, plaintext, wrong-CA and wrong-hostname rejection. Each future service
will mount only its own 0600 UID 1000 password copy. A secret job initializes
the scoped volumes with container OpenSSL and reuses them on repeat startup.

Keycloak 26.4.0 is pinned to the digest from the certificate-login spike,
`sha256:5f3fb534cde6bf006d79f5912473e5d2c828c707cdfc52e16972803aca9d43dd`.
It runs as UID 1000 with its `auth.magic.test` server leaf, user CA trust,
Keycloak database password and separate generated bootstrap-admin secret mounted. It reaches PostgreSQL as
`keycloak_app` with JDBC `sslmode=verify-full`, the `postgres` DNS name and
server CA. Its direct HTTPS endpoint is on private auth `:8443`; HAProxy now
exposes the canonical passthrough `:9443` to the front network. The `magic-shop` realm has a certificate-required browser flow, protected identity claim, six seeded users, SPA PKCE client and two narrowly scoped confidential service clients.

HAProxy 3.2.6 uses the pinned Prompt 01 digest
`sha256:7a5f2b4eac999e35d38b0c49040ec885ac2929c6b1a17fde0d1dc2fbcaf07c52`.
It runs as UID 1000. Shop `:8443` requires a user certificate and checks the
user CRL; auth `:9443` is TCP passthrough. The frontend removes spoofable
identity headers and never routes `/internal/*`. While business APIs are
unimplemented, `/api/*` returns 503. Other shop paths reach the built Vue
preview over private mTLS using only the gateway service certificate. The UI
checks that caller's certificate CN is `gateway`; a different service caller
gets 403. Both containers have loopback-only management health endpoints.
The UI uses the already validated pinned Node 24.10.0 Bookworm build/runtime
image; its UBI9 exception is limited to this preview path and remains subject
to later runtime review.

The customer placeholder is strict TypeScript compiled in the pinned Node
24.10.0 container; the catalog placeholder is a statically compiled Go 1.25.3
binary built in a pinned official Go image and run on pinned UBI9 9.6; insights
uses pinned UBI9 Python 3.12.14. Each runs as UID 1000 on private backend
`:8443`, requires a certificate from the service CA and checks a concrete
caller CN. Gateway reaches only the public prefixes. The Node reporting
placeholder accepts only the `insights-api` client identity, and the Go quote
placeholder accepts only `customer-api`; their outbound calls and service-token
checks are not implemented. The service leaves were migrated from the early
short CNs (`customer`, `catalog`, `insights`) to full names, with old serials
revoked in the service CRL. User and database volumes were preserved. Each API
mounts only its own database secret, although placeholders do not use it yet.
The three business OpenAPI specs and live Playwright suites remain pending
provider implementation in Prompts 06–08 and 11.

Networks are declared for the full stack: `front` for browser/proxy,
`backend` for private HTTPS, `auth` for Keycloak passthrough, and `database`
for PostgreSQL. The last three are internal. All four networks are now active.
The default profile publishes **no host ports**. PostgreSQL listens on private
`:5432`, Keycloak, UI and the three APIs on private `:8443`, and HAProxy on
front `:8443` and `:9443`. Only the optional manual profile publishes the
password-protected viewer on `127.0.0.1:6080`.

The three API TLS listeners load the service CRL at startup. The Go listener
checks the signed CRL and serial in its verified TLS connection hook; Node and
Python use their TLS libraries' CRL checks. Revoking a service leaf with
`./lab pki revoke-service SERVICE` publishes the CRL; restart the three API
consumers before testing a fresh connection. A disposable project proved that
all three rejected a revoked catalog-client leaf while accepting a valid
gateway leaf. Do not revoke a retained project's leaf for a demonstration.

`./lab test chrome` or `./lab test msedge` starts an ephemeral container with
one selected seed-user volume and verifies both exact HTTPS origins, a 503
placeholder API response, and the public private-route boundary. An optional
third argument selects the user. `./lab manual chrome [SEED_USER]` and the
Edge equivalent start a fresh remote desktop with native PKCS#12 installation
and browser policy. The only published port in that profile is
`127.0.0.1:6080` for the password-protected noVNC viewer; retrieve its random
password with `./lab viewer-password`. The shop and auth ports stay inside the
front network. Automated Chrome/Edge Vue sign-in now passes with both context certificates and installed native-store certificates. The Compose noVNC viewer displayed selected-user Chrome at the shop; its sign-in control is now present. A separate human click-through in that viewer has not been recorded for this UI increment.

`./lab status` and `./lab down` inspect/stop the named Compose project without
deleting volumes. `./lab reset --project NAME` deletes only that explicitly named
project's Compose resources and labeled volumes, including volumes left by
one-shot `--rm` jobs. Reset is destructive and is never part of ordinary init.
