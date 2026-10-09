# Prompt 03 — container infrastructure and PKI lifecycle (completed on Apple Silicon emulation)

## Changes and decisions

The first Prompt 03 increment promotes the spike's local CA pattern into
`infra/pki/` and `infra/compose.yaml`. A pinned UBI9 9.6 image runs a one-shot PKI
job as UID/GID 1000 with `network_mode: none`. It keeps server, user and service
CA keys and OpenSSL serial/index state in a PKI-only Docker volume. Public roots
and CRLs have a separate volume; every runtime leaf and each of the six seed-user
identities has its own volume. Server leaves use exact DNS SANs and server EKU;
service/user leaves use client EKU. Outputs are mode 0600 for keys and 0644 for
public certificates/CRLs. There is no copied/generated secret in the image or
repository. The CN for each user comes from the fixed protected identity mapping
in `seed/identities.json`; Keycloak provisioning is still Prompt 04.

`init` reuses existing CAs/leaves and republishes initial/current CRLs. `renew`
creates a new serial/key for a named seed user and retains one previous serial;
`revoke` marks either current or previous certificate in the persistent CA index
and atomically publishes an updated user CRL. `retire` refuses to discard the
previous leaf unless the current CRL proves it revoked, then permits another
renewal. Concurrent issuer operations are
rejected by `flock`. Certificate consumers must later reload their CRL state;
this increment proves offline validation only. An explicit `./lab reset --project
NAME` removes a named project's labeled volumes, including those left after
one-shot `--rm` jobs. It was tested only against a disposable test project.

At this first increment, the `./lab` wrapper exposed PKI operations, status,
down and explicit reset using Docker Compose only. It failed unsupported `up`
and test commands with exit 2 because no complete service stack existed. The
image/container inventory and intended mounts are in `infra/README.md`.
Architecture and workflow Mermaid overlays distinguish observed infrastructure
from planned full-stack routes, login and certificate reload paths.

The PKI base remains UBI9 as preferred. No new browser base decision was made;
the Prompt 01 Bookworm exception for real Chrome/Edge remains in force. No
Saturday source, package, host trust store, deployment or commit was changed.

## Exact commands and observed results

Environment: macOS arm64, Docker Desktop Engine 29.8.2, approximately 38 GiB
free on the workspace filesystem at the start of this increment. The built PKI
image reports `linux/arm64` and user `1000:1000`; native Linux amd64 is still
unavailable and unverified. All OpenSSL and certificate operations below ran
inside the container.

```sh
docker compose -f infra/compose.yaml build pki
docker compose -f infra/compose.yaml run --rm pki init
docker compose -f infra/compose.yaml run --rm pki verify
docker compose -f infra/compose.yaml run --rm --entrypoint openssl pki x509 -in /out/customer-waterdeep/cert.pem -noout -serial -fingerprint -sha256
docker compose -f infra/compose.yaml run --rm pki init
docker compose -f infra/compose.yaml run --rm --entrypoint openssl pki x509 -in /out/customer-waterdeep/cert.pem -noout -serial -fingerprint -sha256
LAB_PROJECT=magic-shop-pki-check docker compose -f infra/compose.yaml run --rm pki init
LAB_PROJECT=magic-shop-pki-check docker compose -f infra/compose.yaml run --rm pki renew shop-admin
LAB_PROJECT=magic-shop-pki-check docker compose -f infra/compose.yaml run --rm pki revoke shop-admin previous
LAB_PROJECT=magic-shop-pki-check docker compose -f infra/compose.yaml run --rm --entrypoint bash pki -c 'openssl verify -purpose sslclient -CAfile /public/user-ca.pem -CRLfile /public/user.crl.pem -crl_check /out/shop-admin/cert.pem && if openssl verify -purpose sslclient -CAfile /public/user-ca.pem -CRLfile /public/user.crl.pem -crl_check /state/leaves/shop-admin.previous.crt; then exit 1; else echo previous-certificate-rejected; fi'
LAB_PROJECT=magic-shop-reset-check ./lab pki init
./lab reset --project magic-shop-reset-check
LAB_PROJECT=magic-shop-retire-check ./lab pki init
LAB_PROJECT=magic-shop-retire-check ./lab pki renew shop-admin
LAB_PROJECT=magic-shop-retire-check ./lab pki revoke shop-admin previous
LAB_PROJECT=magic-shop-retire-check ./lab pki retire shop-admin
LAB_PROJECT=magic-shop-retire-check ./lab pki renew shop-admin
./lab reset --project magic-shop-retire-check
./lab pki verify
./lab status
./lab up
docker compose --profile tools -f infra/compose.yaml config --format json
docker compose -f infra/compose.yaml run --rm --entrypoint stat pki -c '%a %u:%g %n' /state/server/ca.key /out/customer-waterdeep/key.pem /out/customer-waterdeep/cert.pem /public/user.crl.pem
sh -n lab
docker run --rm --network none -v "$PWD:/work:ro" registry.access.redhat.com/ubi9/ubi:9.6@sha256:dec374e05cc13ebbc0975c9f521f3db6942d27f8ccdf06b180160490eef8bdbc sh -n /work/lab
rg -n '(ignoreHTTPSErrors|NODE_TLS_REJECT_UNAUTHORIZED|--ignore-certificate-errors|insecureSkipVerify|sslmode=disable)' infra lab
```

The pinned UBI9 PKI image built successfully. Verification accepted the shop,
auth and PostgreSQL server chains and hostnames, and a seeded user client leaf.
It rejected the wrong shop hostname and human certificate under the service CA;
all three initial CRLs existed. Repeating `init` retained the customer-waterdeep
serial `1003` and SHA-256 fingerprint
`AC:92:FE:23:C2:16:83:F6:D6:91:AD:69:25:78:04:06:6F:3B:39:F3:2E:46:6B:6C:E2:AC:E5:60:B3:B2:15:D9`.
In the disposable project, the renewed admin leaf verified while the previous
leaf failed with OpenSSL error 23, `certificate revoked`. Another isolated run
retired that revoked leaf, then successfully renewed a second time. Both test
projects' 19 named volumes were removed. A separate disposable project proved
`./lab reset --project` removes the 19 volumes even when Compose reports no
running resources. `./lab pki verify` exited 0; `./lab up` exited 2 as designed.
Compose configuration showed only `pki`, `network_mode: none`, zero published
ports, 19 volumes, and `ca-state` mounted only into the PKI job. The default
`magic-shop-lab` certificate volumes remain available for continued Prompt 03
work. `stat` showed 0600 UID 1000 keys and 0644 UID 1000 public files;
`sh -n` passed and the TLS-bypass search had no matches. No live CRL connection
test was claimed for this stack.

## PostgreSQL continuation (2026-10-06)

Added a separate no-network secret job, PostgreSQL 16.15 container, private
database network and repeatable bootstrap job. The official multi-architecture
`postgres:16.15-trixie` image is pinned at
`sha256:65b16a8b326e0cfbdf33fa7e783f2a0cb352a61448616ccccfd616ef42aa0f65`.
Its maintained entrypoint is an explicit exception to the UBI9 preference;
the secret job remains pinned UBI9. Docker reported PostgreSQL
`16.15 (Debian 16.15-1.pgdg13+2)` on Linux arm64. The server starts as root
only to copy its isolated 0600 key into a postgres-owned runtime path; `docker
top` showed all six PostgreSQL processes running as UID 999 afterward.

Secret bootstrap generates five random 64-hex-character passwords in containers
and preserves existing values. The admin password is readable only by UID 999;
each application secret volume has a 0600 copy for UID 999 bootstrap and another
0600 copy for UID 1000 future runtime. PostgreSQL mounts only its admin secret;
the database bootstrap job mounts all five for one-shot provisioning. No secret
is in tracked files, image layers or host trust. The `pg_hba.conf` rejects
non-TLS network connections and requires SCRAM over TLS. Bootstrap reaches
`postgres:5432` on the private network using `sslmode=verify-full`, a five-second
connect timeout and the server CA. It creates four NOSUPERUSER owners and
distinct databases, revokes public CONNECT, and grants each owner its own
database. The setup can be rerun without replacing databases or credentials.
Server-side statement and idle-transaction timeouts are five and ten seconds.

Exact significant commands:

```sh
docker buildx imagetools inspect postgres:16.15-trixie
docker run --rm postgres:16.15-trixie@sha256:65b16a8b326e0cfbdf33fa7e783f2a0cb352a61448616ccccfd616ef42aa0f65 id -u postgres
docker compose -f infra/compose.yaml config --quiet
docker compose -f infra/compose.yaml build db-secrets postgres
docker compose -f infra/compose.yaml up -d --wait postgres
docker compose -f infra/compose.yaml run --rm db-bootstrap
./lab db verify
./lab db init
./lab down
docker compose -f infra/compose.yaml up -d --wait postgres
./lab db init
./lab db verify
docker compose -f infra/compose.yaml exec -T postgres postgres --version
docker top magic-shop-lab-postgres-1 -eo user,pid,comm
docker compose -f infra/compose.yaml config --format json
```

The first database verification failed because its assertion expected libpq's
bare boolean output `t` after a SQL concatenation returned `true`; the
assertion was corrected. Final verification passed for all four owners and
confirmed live TLS. It rejected each owner's attempt to connect to another
database, and rejected plaintext, wrong-CA and wrong-hostname connections.
Shutting down and restarting the Compose services preserved all four databases;
repeat bootstrap and verification passed. Compose configuration showed four
services, zero published ports, PostgreSQL only on the private database network,
the CA signer volume only on PKI, and PostgreSQL mounted only its server leaf,
admin password and data volume. No Keycloak or business service uses these
databases yet. The diagrams and volume inventory were updated for the observed
database boundary. The official [PostgreSQL SSL documentation](https://www.postgresql.org/docs/16/libpq-ssl.html)
supports `verify-full` for CA and hostname checks, while its
[HBA documentation](https://www.postgresql.org/docs/16/auth-pg-hba-conf.html)
defines `hostssl` and SCRAM matching.

## Keycloak infrastructure continuation (2026-10-06)

Built Keycloak 26.4.0 from the Prompt 01 digest
`sha256:5f3fb534cde6bf006d79f5912473e5d2c828c707cdfc52e16972803aca9d43dd`
with the PostgreSQL provider, health endpoint and client-certificate request
mode. It runs as UID 1000 on the private auth and database networks. Its only
private mounts are the `auth.magic.test` server leaf and its own UID 1000
database password; the public trust mount supplies the user CA and PostgreSQL
server CA. The startup script reads that scoped password and connects through
JDBC with `sslmode=verify-full` to `postgres:5432/keycloak_db`. Compose waits
for completed PKI and database bootstrap jobs before Keycloak starts; its
management readiness endpoint is checked locally.

Exact significant commands:

```sh
docker compose -f infra/compose.yaml build keycloak
docker compose -f infra/compose.yaml up -d --wait keycloak
docker compose -f infra/compose.yaml exec -T -u postgres postgres psql -X -A -t -U postgres -d postgres -c "SELECT a.usename, a.datname, s.ssl FROM pg_stat_activity a JOIN pg_stat_ssl s ON a.pid=s.pid WHERE a.usename='keycloak_app' LIMIT 5"
docker run --rm --network magic-shop-lab_auth -v magic-shop-lab_public-trust:/public:ro registry.access.redhat.com/ubi9/ubi:9.6@sha256:dec374e05cc13ebbc0975c9f521f3db6942d27f8ccdf06b180160490eef8bdbc bash -c 'address=$(getent ahostsv4 keycloak | awk "NR==1 {print \$1}"); curl --silent --show-error --max-time 5 --cacert /public/server-ca.pem --resolve "auth.magic.test:8443:$address" --output /dev/null --write-out "%{http_code} %{ssl_verify_result}\n" https://auth.magic.test:8443/realms/master/.well-known/openid-configuration'
docker run --rm --network magic-shop-lab_auth -v magic-shop-lab_public-trust:/public:ro registry.access.redhat.com/ubi9/ubi:9.6@sha256:dec374e05cc13ebbc0975c9f521f3db6942d27f8ccdf06b180160490eef8bdbc bash -c 'address=$(getent ahostsv4 keycloak | awk "NR==1 {print \$1}"); if curl --silent --max-time 5 --cacert /public/service-ca.pem --resolve "auth.magic.test:8443:$address" https://auth.magic.test:8443/realms/master/.well-known/openid-configuration >/dev/null; then exit 1; fi; if curl --silent --max-time 5 --cacert /public/server-ca.pem --resolve "wrong.magic.test:8443:$address" https://wrong.magic.test:8443/realms/master/.well-known/openid-configuration >/dev/null; then exit 1; fi; echo wrong-ca-and-hostname-rejected'
```

`up --wait` ended with Keycloak healthy. The PostgreSQL activity query returned
three `keycloak_app|keycloak_db|t` sessions. Direct private HTTPS discovery at
`auth.magic.test:8443` returned HTTP 200 with curl TLS verification result 0;
the same container rejected wrong trust and wrong hostname. This does not test
the canonical `:9443` gateway passthrough, a magic-shop realm, human
certificate mapping or browser PKCE. Those remain unverified in the new stack.
The Keycloak base is the pinned official image, matching the Prompt 01 exception;
no password or certificate key was baked into it. Architecture and workflow
overlays now show its observed credential and database boundaries.

## HAProxy and static UI continuation (2026-10-06)

Built the imported Vue preview in a pinned Node 24.10.0 Bookworm image using
pnpm 12.9.1 and the frozen workspace lockfile. Its container serves static
assets over private HTTPS with a required service certificate and checks the
verified caller CN is `gateway`. A different trusted service caller gets 403.
The preview still contains imported mock-era UI behavior; it is not the
authenticated Prompt 09 application. The official Node Bookworm runtime is a
documented UBI9 exception for this existing preview build path. HAProxy 3.2.6
uses the pinned Prompt 01 digest, runs as UID 1000 and has separate shop
`:8443` user-mTLS termination and auth `:9443` TCP passthrough listeners.
Shop strips supplied identity headers, checks the user CRL, blocks
`/internal/*` with 404 and returns 503 for unfinished `/api/*` routes. Its
static UI backend uses the gateway-only service leaf and verifies the `ui`
server name and server CA. The UI, Keycloak and HAProxy have loopback-only
management health endpoints. Compose waits for the completed PKI/DB jobs and
healthy dependencies without fixed sleeps. No host port is published.

Exact significant commands:

```sh
docker compose -f infra/compose.yaml build ui gateway
docker compose -f infra/compose.yaml up -d --wait gateway
docker run --rm --network magic-shop-lab_front -v magic-shop-lab_public-trust:/public:ro -v magic-shop-lab_cert-customer-waterdeep:/identity:ro registry.access.redhat.com/ubi9/ubi:9.6@sha256:dec374e05cc13ebbc0975c9f521f3db6942d27f8ccdf06b180160490eef8bdbc bash -c 'for url in https://shop.magic.test:8443/ https://auth.magic.test:9443/realms/master/.well-known/openid-configuration; do curl --silent --show-error --max-time 10 --cert /identity/cert.pem --key /identity/key.pem --cacert /public/server-ca.pem --output /dev/null --write-out "%{url_effective} %{http_code} %{ssl_verify_result}\n" "$url"; done'
docker run --rm --network magic-shop-lab_front -v magic-shop-lab_public-trust:/public:ro -v magic-shop-lab_cert-customer-waterdeep:/identity:ro registry.access.redhat.com/ubi9/ubi:9.6@sha256:dec374e05cc13ebbc0975c9f521f3db6942d27f8ccdf06b180160490eef8bdbc bash -c 'set -e; if curl --silent --max-time 5 --cacert /public/server-ca.pem https://shop.magic.test:8443/ >/dev/null; then exit 1; fi; if curl --silent --max-time 5 --cert /identity/cert.pem --key /identity/key.pem --cacert /public/service-ca.pem https://shop.magic.test:8443/ >/dev/null; then exit 1; fi; for path in /internal/reporting/orders /api/catalog/items; do curl --silent --show-error --max-time 5 --cert /identity/cert.pem --key /identity/key.pem --cacert /public/server-ca.pem --output /dev/null --write-out "$path %{http_code}\n" "https://shop.magic.test:8443$path"; done'
docker run --rm --network magic-shop-lab_backend -v magic-shop-lab_public-trust:/public:ro -v magic-shop-lab_cert-customer-client:/identity:ro registry.access.redhat.com/ubi9/ubi:9.6@sha256:dec374e05cc13ebbc0975c9f521f3db6942d27f8ccdf06b180160490eef8bdbc bash -c 'set -e; code=$(curl --silent --show-error --max-time 5 --cert /identity/cert.pem --key /identity/key.pem --cacert /public/server-ca.pem --output /dev/null --write-out "%{http_code}" https://ui:8443/); test "$code" = 403; if curl --silent --max-time 5 --cacert /public/server-ca.pem https://ui:8443/ >/dev/null; then exit 1; fi'
LAB_PROJECT=magic-shop-crl-check docker compose -f infra/compose.yaml up -d --wait gateway
LAB_PROJECT=magic-shop-crl-check ./lab pki revoke disabled-customer
LAB_PROJECT=magic-shop-crl-check docker compose -f infra/compose.yaml restart gateway
./lab reset --project magic-shop-crl-check
./lab infra up
./lab down
./lab infra up
docker compose -f infra/compose.yaml up -d --wait --wait-timeout 120 gateway
./lab db verify
docker compose -f infra/compose.yaml config --format json
```

The UI typecheck and Vite build passed in Docker; HAProxy, UI, Keycloak and
PostgreSQL became healthy. The exact shop and auth origins both returned HTTP
200 with curl TLS verification result 0 using the selected customer leaf.
Shop no-cert and wrong-server-CA requests failed, `/internal/reporting/orders`
returned 404, and `/api/catalog/items` returned 503. The private UI rejected a
different service caller with 403 and a missing client certificate at TLS.
In a disposable full infrastructure project, the disabled-customer leaf loaded
the shop before revocation (200). After container-only revocation and HAProxy
restart, a new TLS connection with that leaf failed; a different valid leaf
still received 200. `./lab reset --project magic-shop-crl-check` removed that
project's containers, networks and volumes. `./lab infra up` rebuilt from
pinned sources and completed all health dependencies for the retained default
project. No Keycloak realm-level CRL rejection was claimed. Both real browser
runner modes still rely on the separate Prompt 01 spike until promoted here.
After a full `./lab down`, the infrastructure restarted with healthy gateway,
UI, Keycloak and PostgreSQL; the database boundary checks passed again and a
fresh shop request returned HTTP 200 with TLS verification result 0. The first
bounded `./lab infra up` process was still finishing when its command session
yielded; a direct Compose `up --wait --wait-timeout 120` then exited 0 after the
gateway became healthy. The final Compose configuration listed seven services,
zero published ports, `ca-state` mounted only by `pki`, and only the gateway
client leaf mounted by `gateway` among runtime services.
Final Compose syntax and wrapper shell syntax checks exited 0. The only current
TLS-bypass-pattern match under `infra/` is `sslmode=disable` in the intentional
negative PostgreSQL test, where the connection is required to fail.

## Three-language transport continuation (2026-10-06)

Added minimal HTTPS transport placeholders in the required three business API
languages. The Node customer image builds strict TypeScript with TypeScript
5.9.3 and `@types/node` 24.10.0 under a frozen pnpm lockfile. The Go catalog
image uses a pinned Go 1.25.3 Bookworm builder digest
`sha256:4f43b271f9673eb7bd0cb3a49cc17b08d8d6ee110277e26dbacc93c43a5a7793`
and a pinned UBI9 9.6 runtime. The insights image uses pinned UBI9 Python 3.12
digest `sha256:d3a5322122fd7efd5d5a2486c8c221f4785c364199f27e50a33aced417047e6a`;
the container reported Python 3.12.14. This retains UBI9 for Go runtime and
Python, while reusing the already validated Node Bookworm base for the Node
placeholder. All containers run as UID 1000, have private `:8443` HTTPS
listeners and loopback-only health ports, and mount their own server leaf,
public trust and database password. Customer and insights mount only their
own service-client leaves for future outbound calls. None has a host port.

The customer and catalog listeners require service-CA client certificates and
check concrete caller CNs. Python requires the same transport and gateway CN.
The Go internal quote placeholder allows only `customer-api`, and Node's
internal reporting placeholder allows only `insights-api`; gateway is allowed
only on public API prefixes. HAProxy now routes `/api/catalog/*`,
`/api/customer/*` and `/api/insights/*` to these three verified private origins,
while continuing to return 404 for all public `/internal/*` paths. All business
operations deliberately return 503 `NOT_IMPLEMENTED`. These are not live
OpenAPI providers and do not count toward Playwright contract coverage.

The first direct caller test failed: the original PKI had issued service-client
CNs `customer`, `catalog` and `insights`, while the servers expected the full
service names. The PKI now issues `customer-api`, `catalog-api` and
`insights-api` for clean projects. `./lab pki migrate-service` revoked each
short-CN certificate and rotated only its service leaf in the retained project;
the signing, user and database volumes were preserved. The allowed and denied
caller test passed afterward. The service CRL was published, but these
placeholder API TLS stacks do not yet enforce service revocation; future
service-auth work must add that check rather than claiming the CRL alone closes
the path.

Exact significant commands:

```sh
docker buildx imagetools inspect golang:1.25.3-bookworm
docker buildx imagetools inspect registry.access.redhat.com/ubi9/python-312
docker run --rm registry.access.redhat.com/ubi9/python-312@sha256:d3a5322122fd7efd5d5a2486c8c221f4785c364199f27e50a33aced417047e6a python --version
docker run --rm node:24.10.0-bookworm-slim@sha256:b8d2197aff9129d16c801a3e3e1b2a873c4946480f5a310f38056df2268c38d9 npm view @types/node@24.10.0 version --fetch-timeout=30000 --fetch-retries=1
docker run --rm -v "$PWD:/work" -w /work node:24.10.0-bookworm-slim@sha256:b8d2197aff9129d16c801a3e3e1b2a873c4946480f5a310f38056df2268c38d9 npm exec --yes --package=pnpm@12.9.1 -- pnpm install --lockfile-only --ignore-scripts --fetch-timeout=30000
docker compose -f infra/compose.yaml build customer-api catalog-api insights-api gateway
./lab infra up
docker run --rm --network magic-shop-lab_front -v magic-shop-lab_public-trust:/public:ro -v magic-shop-lab_cert-customer-waterdeep:/identity:ro registry.access.redhat.com/ubi9/ubi:9.6@sha256:dec374e05cc13ebbc0975c9f521f3db6942d27f8ccdf06b180160490eef8bdbc bash -c 'set -e; for path in /api/catalog/items /api/customer/me /api/insights/regions /internal/reporting/orders; do curl --silent --show-error --max-time 5 --cert /identity/cert.pem --key /identity/key.pem --cacert /public/server-ca.pem --output /dev/null --write-out "$path %{http_code} %{ssl_verify_result}\n" "https://shop.magic.test:8443$path"; done'
docker run --rm --network magic-shop-lab_backend -v magic-shop-lab_public-trust:/public:ro -v magic-shop-lab_cert-customer-client:/customer:ro -v magic-shop-lab_cert-insights-client:/insights:ro -v magic-shop-lab_cert-gateway-client:/gateway:ro registry.access.redhat.com/ubi9/ubi:9.6@sha256:dec374e05cc13ebbc0975c9f521f3db6942d27f8ccdf06b180160490eef8bdbc bash -c 'set -e; call() { curl --silent --show-error --max-time 5 --cert "$1/cert.pem" --key "$1/key.pem" --cacert /public/server-ca.pem --output /dev/null --write-out "%{http_code}" "$2"; }; test "$(call /customer https://catalog-api:8443/internal/catalog/quotes)" = 503; test "$(call /insights https://customer-api:8443/internal/reporting/orders)" = 503; test "$(call /gateway https://catalog-api:8443/internal/catalog/quotes)" = 403; test "$(call /customer https://customer-api:8443/internal/reporting/orders)" = 403; test "$(call /customer https://insights-api:8443/api/insights/regions)" = 403; echo service-caller-allowlists-pass'
docker compose -f infra/compose.yaml build pki
./lab pki migrate-service customer-client
./lab pki migrate-service catalog-client
./lab pki migrate-service insights-client
LAB_PROJECT=magic-shop-service-check ./lab pki init
LAB_PROJECT=magic-shop-service-check docker compose -f infra/compose.yaml run --rm --entrypoint openssl pki x509 -in /out/customer-client/cert.pem -noout -subject -nameopt RFC2253
LAB_PROJECT=magic-shop-service-check docker compose -f infra/compose.yaml run --rm --entrypoint openssl pki x509 -in /out/catalog-client/cert.pem -noout -subject -nameopt RFC2253
LAB_PROJECT=magic-shop-service-check docker compose -f infra/compose.yaml run --rm --entrypoint openssl pki x509 -in /out/insights-client/cert.pem -noout -subject -nameopt RFC2253
./lab reset --project magic-shop-service-check
./lab down
./lab infra up
./lab db verify
docker compose -f infra/compose.yaml config --format json
```

The TypeScript typecheck/build, Go vet/build and Python compile check all passed
inside image builds. Compose health checks passed for all three API containers
and gateway. Each public API prefix returned 503 with TLS verification result
0; `/internal/reporting/orders` returned 404 through the shop. After targeted
certificate migration, direct private probes returned 503 for the intended
customer-to-Go and insights-to-Node transport callers, 403 for disallowed
service callers, and TLS failure with no client certificate. The unsuccessful
pre-migration probe returned 403 for all callers and was not counted as a pass.
An isolated fresh PKI project issued the expected `customer-api`,
`catalog-api` and `insights-api` CNs without migration and was explicitly reset.
After a complete shutdown and restart of the retained project, all four
database-owner checks passed, shop `/` returned 200, the three known API routes
returned 503, and public `/internal/reporting/orders` returned 404; every
successful HTTPS response reported curl TLS verification result 0. The direct
service caller allowlist matrix still passed. Compose configuration listed ten
services with zero published ports. Only `pki` mounted `ca-state`; each API
mounted its own server leaf and DB secret, and only customer/insights mounted
their respective service-client leaves. No runner mounted any user key in this
Compose stack because runner profiles are still absent.
Final Compose configuration and containerized wrapper shell syntax checks passed. The only
TLS-bypass-pattern match under current infrastructure/service source is the
intentional `sslmode=disable` negative test, which must fail. A repository file
inventory found no PEM keys, PKCS#12 bundles, `node_modules` or browser
profiles under `infra/`, `services/` or `testing/`. The workspace filesystem
reported about 40 GiB free after these builds. This is not native Linux amd64
evidence; the Docker host is still macOS arm64.

## Outstanding Prompt 03 dependencies

Runner profiles and a full-stack `./lab up` remain. Service-CRL enforcement in
the API TLS listeners also remains before Prompt 03 can exit. Keycloak
realm-level certificate/CRL behavior belongs to Prompt
04. Actual Node, Go and Python business operations, JWT/service-token checks,
database queries and Playwright OpenAPI contract coverage belong to Prompts
06–08 and 11, not to these transport placeholders.

## Final Prompt 03 continuation (2026-10-06)

The earlier "outstanding" section and interim statements above record the
state **before** this continuation. The following results supersede their
runner and service-CRL gaps. Prompt 03 is complete for the available Apple
Silicon Docker environment; native Linux amd64 remains unverified under the
separate Prompt 01 platform checkbox.

The validated spike browser recipe was promoted into `testing/container/`:
signed Google and Microsoft repository keys, the exact 310-package apt closure,
the install script, and fresh trust/native-identity/manual launch scripts.
Those source files came from this repository's own
`spikes/certificate-login/container/`; `testing/LICENSE` and `testing/NOTICE`
remain with the imported testing tree. No generated certificate, package
archive, browser profile, `node_modules`, or nested Saturday source was copied.
The runner uses pinned Node 24.10.0 Bookworm on `linux/amd64` because UBI9
browser dependencies were unavailable in Prompt 01. Google Chrome
`154.0.8037.97-1`, Microsoft Edge `154.0.4258.62-1`, and Playwright `1.61.0`
were installed/used; apt repository keys are SHA-256 checked, packages are
version pinned, and the browsers run as UID 1000. The package-install layer is
separate from changing test scripts so later edits do not reinstall browsers.

The `test` and `manual` Compose profiles share that image and use a
`selected-user` volume alias resolving to exactly one whitelisted seed-user
volume. The ordinary `./lab up` now builds the seven long-running services,
waits on completed PKI/database jobs and health checks, and preserves their
volumes. `./lab test chrome|msedge [SEED_USER]` runs an ephemeral real-browser
transport smoke job with Playwright context certificates for both exact
origins. The manual profile imports that user's generated PKCS#12 into a fresh
NSS database and writes a narrow managed selection policy for the chosen
browser. It exposes only password-protected noVNC on loopback port 6080 by
default; `LAB_VIEWER_PORT` supports another loopback port when occupied. The
manual runner has a health check for browser and viewer process readiness, and
`./lab viewer-password` retrieves its per-container random password. Browser
navigation and Playwright's Node request client use the public server CA in
their respective trust paths; neither disables TLS verification. User PKCS#12
passwords and private keys remain in user-scoped Docker volumes.

The PKI now publishes a combined service CA/CRL bundle in addition to its
signed service CRL. Node's HTTPS listener supplies the CRL to TLS, Python uses
OpenSSL's leaf-CRL check, and Go verifies CRL signature, validity window and
revoked serial in a verified TLS connection hook. `./lab pki revoke-service`
publishes a new CRL; the three API listeners reload it on restart. In a
disposable project, an unrevoked `catalog-client` certificate completed TLS to
each API and got the expected 403 caller-allowlist response. After revocation
and API restarts, all three rejected its fresh TLS connection; the valid
`gateway-client` certificate still completed TLS and got 404 on an unknown
path. The disposable project was explicitly reset. This proves transport
revocation, not service-token authorization, which remains future work.

Exact significant final commands:

```sh
./lab up
./lab pki verify
./lab db verify
./lab test chrome
./lab test msedge
LAB_PROJECT=magic-shop-revocation-check ./lab up
docker run --rm --network magic-shop-revocation-check_backend -v magic-shop-revocation-check_public-trust:/trust:ro -v magic-shop-revocation-check_cert-catalog-client:/caller:ro registry.access.redhat.com/ubi9/ubi:9.6@sha256:dec374e05cc13ebbc0975c9f521f3db6942d27f8ccdf06b180160490eef8bdbc bash -c 'set -e; for service in customer-api catalog-api insights-api; do code=$(curl --silent --show-error --max-time 6 --cert /caller/cert.pem --key /caller/key.pem --cacert /trust/server-ca.pem --output /dev/null --write-out "%{http_code}" "https://$service:8443/api/probe"); test "$code" = 403; echo "$service pre-revocation $code"; done'
LAB_PROJECT=magic-shop-revocation-check ./lab pki revoke-service catalog-client
LAB_PROJECT=magic-shop-revocation-check docker compose -f infra/compose.yaml restart customer-api catalog-api insights-api
docker run --rm --network magic-shop-revocation-check_backend -v magic-shop-revocation-check_public-trust:/trust:ro -v magic-shop-revocation-check_cert-catalog-client:/revoked:ro -v magic-shop-revocation-check_cert-gateway-client:/valid:ro registry.access.redhat.com/ubi9/ubi:9.6@sha256:dec374e05cc13ebbc0975c9f521f3db6942d27f8ccdf06b180160490eef8bdbc bash -c 'set -e; for service in customer-api catalog-api insights-api; do if curl --silent --max-time 6 --cert /revoked/cert.pem --key /revoked/key.pem --cacert /trust/server-ca.pem --output /dev/null "https://$service:8443/api/probe"; then echo "$service accepted revoked caller"; exit 1; fi; code=$(curl --silent --show-error --max-time 6 --cert /valid/cert.pem --key /valid/key.pem --cacert /trust/server-ca.pem --output /dev/null --write-out "%{http_code}" "https://$service:8443/api/probe"); test "$code" = 404; echo "$service revoked TLS rejected; valid TLS $code"; done'
./lab reset --project magic-shop-revocation-check
LAB_VIEWER_PORT=6081 ./lab manual chrome customer-waterdeep
LAB_VIEWER_PORT=6081 ./lab manual msedge shop-admin
./lab viewer-password >/dev/null
LAB_USER=shop-admin LAB_VIEWER_PORT=6081 docker compose -f infra/compose.yaml --profile manual config --format json
docker inspect magic-shop-lab-runner-manual-1 --format '{{range .Mounts}}{{.Name}}:{{.Destination}} {{end}}'
docker run --rm --network none --entrypoint sh magic-shop-runner:03 -c 'google-chrome --version; microsoft-edge --version; node --version; id -u'
docker run --rm --network none -v "$PWD:/work:ro" -w /work node:24.10.0-bookworm-slim@sha256:b8d2197aff9129d16c801a3e3e1b2a873c4946480f5a310f38056df2268c38d9 sh -c 'set -e; sh -n lab testing/container/*.sh; bash -n infra/pki/issue.sh; for script in testing/container/*.mjs; do node --check "$script"; done; echo container-source-syntax-pass'
./lab status
```

`./lab up` completed with PKI/database jobs exited successfully and the seven
services healthy. PKI chain/EKU/hostname and the four-owner database TLS/grant
checks passed. Both Chrome and Edge reported exact shop and Keycloak master
discovery origins at HTTP 200, the unfinished catalog route at 503, and
public `/internal/*` at 404; their no-certificate and wrong-hostname probes
failed as required. The first runner build accidentally selected arm64 and
could not locate amd64 Chrome/Edge packages; setting the Compose runner
platform to `linux/amd64` fixed that. The first strict Playwright request
failed on server trust; adding the public CA to Node's TLS trust fixed it
without a bypass. The first manual startup exposed an X11 socket directory
permission issue and a VNC password formatting issue; the final non-root
image and VNC-compatible random password passed its health check.

The manual Chrome NSS store contained the customer CN and policy, with the
browser process running. Recreating the profile for Edge/admin removed the
customer certificate: its store contained only the admin CN. Docker inspect
showed exactly `magic-shop-lab_cert-shop-admin:/identity` and
`magic-shop-lab_public-trust:/public` on the running Edge container. Its
viewer published `127.0.0.1:6081->6080`, because the earlier spike viewer was
already using 6080; that older container was left running. The manual profile
did not yet prove a human login in this Compose realm, since Prompt 04 has not
created it. Prompt 01 separately proved the full certificate login in the
bounded spike.

The finished runner image reported Chrome `154.0.8037.97`, Edge
`154.0.4258.62`, Node `v24.10.0` and UID 1000. A container-only source syntax
check passed. Final `./lab status` showed seven healthy long-running services,
three setup jobs exited 0, and the optional Edge manual viewer healthy on
loopback 6081. Its managed policy was checked for only the two exact origins,
the `Magic Shop user CA` issuer and the selected admin identity.

The resolved Compose inventory has only this optional loopback publication;
default/test profiles publish no host port. Only the PKI job mounts
`ca-state`. The source inventory found no PEM keys, PKCS#12 bundles,
`node_modules`, or browser profiles under `infra/`, `services/`, or `testing/`.
No authored TLS-bypass option was found; the sole `sslmode=disable` occurrence
is the expected failing database negative test. Docker image recipes copy only
public source/manifests and obtain certificate material at runtime from
volumes. The macOS arm64 host had about 36 GiB free after these builds. No
host trust store, Saturday checkout, package registry, deployment, or commit
was touched.

Next dependency: Prompt 04 must provision the magic-shop Keycloak realm,
protected certificate identities, clients, audiences, scopes and seed users,
then prove fresh and cookie-reuse browser login through this Compose stack.
Node, Go and Python business operations, OpenAPI-backed live providers,
Playwright contract tests, and full Saturday Cucumber/Playwright Test suites
remain their sequenced later prompts. Native Linux amd64 remains unverified
until an actual host or CI run is available.
