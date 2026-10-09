# 11 — Signed-token and certificate failure matrix increment

Observed 2026-10-08 on macOS arm64 with Docker Desktop's amd64 emulation. The certificate and live API checks used a new `magic-shop-matrix-11` Compose project with its own CA, leaf, trust, database and Keycloak volumes. The existing `magic-shop-lab` project remained healthy. Native Linux amd64 was not attempted, as requested.

## Changes

- Added an injectable JWKS loader to the Node customer API verifier while retaining the production, verified-TLS Keycloak loader. Its network adapter now opens trust and caller files when a request needs them, so verifier unit tests need no certificate mounts. In-memory RSA tests exercise genuinely signed expired, not-yet-valid, wrong-issuer and wrong-audience tokens, unknown-key rejection, published second-key acceptance and service caller/scope checks.
- Added matching in-memory signed-claim, key-publication and service-scope tests to the Python insights and Go catalog verifiers. All three provider images run their tests during container builds; test signing keys are never written to disk.
- Added test-only `negative-user` and `negative-service` PKI operations, guarded by `LAB_NEGATIVE_FIXTURE=yes`. They issue CA-signed expired or future leaves into explicitly mounted Docker volumes. The isolated service runner carries one service leaf, the catalog client secret and public trust; the isolated user runner carries public trust plus one injected negative leaf. No issuer key enters either runner.
- Added fresh-connection probes for revoked, expired and future service leaves at the live catalog TLS boundary, plus expired and future user leaves at the HAProxy shop gate and Keycloak authorization path. The catalog OpenAPI contract suite now also checks a correct caller leaf paired with the other service's signed token.
- Added a shared Saturday inventory page model and a Playwright Test shopkeeper journey. With the shopkeeper certificate, real Chrome and Edge both showed the inventory page, hid the admin link, created a synthetic item and archived it. Each browser job mounted only its selected user's credential volume.
- Extended the Vue certificate-login probe to cover the unmapped user and verify that rejected identities issue no business API request or signed-in UI state.
- Expanded the live customer ownership probe to traverse both customers' bounded order pages and inspect profile, widget, order-detail and admin responses for cross-user exposure.
- Added an allowlisted, test-only Keycloak admin fixture that unlinks one service client's required default scope only in a named disposable matrix project. Separate catalog and reporting runners each mount only their own caller leaf, service secret and public trust. Each probe checks the newly issued token's Keycloak signature, exact caller, audience and scope before making a verified-mTLS private API request.
- Added a guarded, admin-only RSA signing-key rotation fixture for a named disposable Keycloak project and a separate shop-admin certificate runner. The runner obtains real Authorization Code + PKCE tokens, verifies their Keycloak signature and three API audiences, then calls Go, Node and Python over the shop gateway with strict TLS. The admin fixture adds a higher-priority generated Keycloak key and verifies that both old and new public keys remain published.
- Updated the infrastructure and architecture Mermaid diagrams as the two negative-fixture runner boundaries were added. Their labels distinguish the probes observed here from remaining planned integration checks.

## Exact commands and observed results

All builds, package installation, certificate issuance, revocation, database setup and tests ran in containers. The host only invoked Docker and read local report files; no host certificate or trust-store operation occurred.

```sh
docker compose -f infra/compose.yaml build customer-api
docker compose -f infra/compose.yaml build insights-api
docker run --rm -v "$PWD/services/catalog-api/internal/auth:/work" -w /work golang:1.25.3-bookworm@sha256:4f43b271f9673eb7bd0cb3a49cc17b08d8d6ee110277e26dbacc93c43a5a7793 gofmt -w verifier_test.go
docker compose -f infra/compose.yaml build catalog-api
LAB_PROJECT=magic-shop-matrix-11 ./lab up
LAB_PROJECT=magic-shop-matrix-11 ./lab test --runner playwright --suite contracts
LAB_PROJECT=magic-shop-matrix-11 ./lab test --runner playwright --suite security
```

The Node build passed strict TypeScript and seven unit tests, including the three new signed-token suites. Python compiled and passed eight unit tests. Go passed `go vet`, its auth/domain/service tests and the production binary build. The isolated stack became healthy and seeded its certificate-only Keycloak realm. Its live Playwright contracts passed 17 tests and all 23 operation/status coverage entries; report `artifacts/contracts/20261008T132838Z-contracts-70354` passed the credential scan. The isolated security suite passed 11 tests.

```sh
LAB_PROJECT=magic-shop-matrix-11 ./lab pki revoke-service customer-client
LAB_PROJECT=magic-shop-matrix-11 docker compose -f infra/compose.yaml up -d --no-deps --force-recreate --wait --wait-timeout 60 catalog-api
LAB_PROJECT=magic-shop-matrix-11 docker compose -f infra/compose.yaml --profile test build runner-test
LAB_PROJECT=magic-shop-matrix-11 docker compose -f infra/compose.yaml --profile test run --rm --no-deps -e LAB_SERVICE_LEAF_FAILURE=revoked runner-service-revocation node /work/testing/container/service-leaf-failure.mjs
LAB_PROJECT=magic-shop-matrix-11 docker compose -f infra/compose.yaml build pki
LAB_PROJECT=magic-shop-matrix-11 docker compose -f infra/compose.yaml run --rm --no-deps -e LAB_NEGATIVE_FIXTURE=yes -v magic-shop-matrix-11_cert-service-expired:/out/negative pki negative-service expired
LAB_PROJECT=magic-shop-matrix-11 docker compose -f infra/compose.yaml run --rm --no-deps -e LAB_NEGATIVE_FIXTURE=yes -v magic-shop-matrix-11_cert-service-future:/out/negative pki negative-service future
LAB_PROJECT=magic-shop-matrix-11 docker compose -f infra/compose.yaml --profile test run --rm --no-deps -e LAB_SERVICE_LEAF_FAILURE=expired -v magic-shop-matrix-11_cert-service-expired:/negative:ro runner-service-revocation node /work/testing/container/service-leaf-failure.mjs
LAB_PROJECT=magic-shop-matrix-11 docker compose -f infra/compose.yaml --profile test run --rm --no-deps -e LAB_SERVICE_LEAF_FAILURE=future -v magic-shop-matrix-11_cert-service-future:/negative:ro runner-service-revocation node /work/testing/container/service-leaf-failure.mjs
```

After the isolated customer-to-catalog leaf was revoked and the catalog reloaded its CRL, the fresh request failed at TLS despite a valid scoped token. Both dated service leaves also failed OpenSSL chain/validity checks and fresh catalog TLS. The first revocation probe attempt failed because the runner image predated its new script; rebuilding the runner resolved that setup error. No TLS verification bypass was used.

```sh
LAB_PROJECT=magic-shop-matrix-11 docker compose -f infra/compose.yaml run --rm --no-deps -e LAB_NEGATIVE_FIXTURE=yes -v magic-shop-matrix-11_cert-user-expired:/out/negative pki negative-user expired
LAB_PROJECT=magic-shop-matrix-11 docker compose -f infra/compose.yaml run --rm --no-deps -e LAB_NEGATIVE_FIXTURE=yes -v magic-shop-matrix-11_cert-user-future:/out/negative pki negative-user future
LAB_PROJECT=magic-shop-matrix-11 docker compose -f infra/compose.yaml --profile test run --rm --no-deps -e LAB_USER_LEAF_FAILURE=expired -v magic-shop-matrix-11_cert-user-expired:/negative:ro runner-user-validity node /work/testing/container/user-leaf-failure.mjs
LAB_PROJECT=magic-shop-matrix-11 docker compose -f infra/compose.yaml --profile test run --rm --no-deps -e LAB_USER_LEAF_FAILURE=future -v magic-shop-matrix-11_cert-user-future:/negative:ro runner-user-validity node /work/testing/container/user-leaf-failure.mjs
./lab test --runner playwright --suite contracts
LAB_PROJECT=magic-shop-matrix-11 docker compose -f infra/compose.yaml --profile test down --volumes
docker volume rm magic-shop-matrix-11_cert-service-expired magic-shop-matrix-11_cert-service-future magic-shop-matrix-11_cert-user-expired magic-shop-matrix-11_cert-user-future
LAB_PROJECT=magic-shop-lab ./lab status
```

Both dated user leaves failed local CA validity checks and the live shop TLS gate; neither obtained a Keycloak authorization code. The main project's later contract run, which includes correct-caller/wrong-service-token checks in both directions, passed 17 tests and the 23-operation gate; report `artifacts/contracts/20261008T133750Z-contracts-74141` passed the artifact scan. The isolated stack and all four extra negative-fixture volumes were removed. The main lab's gateway, providers, database, Keycloak, UI and manual runner remained healthy.

```sh
./lab test --runner playwright --browser chrome --user shopkeeper
./lab test --runner playwright --browser msedge --user shopkeeper
```

The final Chrome and Edge runs each passed three applicable tests and skipped five customer/admin-only examples. Both recorded the ROLE-03 inventory create/archive journey and passed the artifact credential scan. Reports are `artifacts/teaching/20261008T134408Z-playwright-chrome-shopkeeper-76893` and `artifacts/teaching/20261008T134434Z-playwright-msedge-shopkeeper-77105`. An initial Chrome run created the item but failed on an ambiguous assertion because both the success and transient loading messages had `role="status"`; narrowing the success-message locator resolved this test issue. The runner build passed strict TypeScript checks.

```sh
docker compose -f infra/compose.yaml --profile test build runner-test
for browser in chrome msedge; do for user in disabled-customer unknown-user; do LAB_BROWSER="$browser" LAB_USER="$user" docker compose -f infra/compose.yaml --profile test run --rm --no-deps runner-test node /work/testing/container/ui-login.mjs || exit 1; done; done
```

All four real-browser probes passed. Each rejected sign-in stayed at the auth origin without an authorization code or password field; the page had no signed-in identity and made no business API request. This is current full-stack UI evidence for AUTH-05.

```sh
./lab test --runner playwright --suite security
```

All 12 live browserless security tests passed, including the new ROLE-02 cross-customer response check. The test follows up to 20 order-list pages with a limit of two, checks that each returned owner is the certificate-bound subject, confirms both known cross-customer order IDs are hidden, and confirms customer access to admin lists is forbidden.

```sh
LAB_PROJECT=magic-shop-matrix-scope3 ./lab up
LAB_PROJECT=magic-shop-matrix-scope3 docker compose -f infra/compose.yaml --profile test run --rm --no-deps -e LAB_PROJECT -e LAB_SCOPE_CLIENT=customer-catalog -e LAB_SCOPE_CASE=present runner-service-revocation node /work/testing/container/service-scope-negative.mjs
LAB_PROJECT=magic-shop-matrix-scope3 docker compose -f infra/compose.yaml --profile test run --rm --no-deps -e LAB_PROJECT -e LAB_SCOPE_CLIENT=insights-reporting -e LAB_SCOPE_CASE=present runner-reporting-scope node /work/testing/container/service-scope-negative.mjs
LAB_PROJECT=magic-shop-matrix-scope3 docker compose -f infra/compose.yaml --profile test run --rm --no-deps -e LAB_PROJECT -e LAB_SCOPE_FIXTURE=yes -e LAB_SCOPE_CLIENT=customer-catalog scope-fixture-admin
LAB_PROJECT=magic-shop-matrix-scope3 docker compose -f infra/compose.yaml --profile test run --rm --no-deps -e LAB_PROJECT -e LAB_SCOPE_FIXTURE=yes -e LAB_SCOPE_CLIENT=insights-reporting scope-fixture-admin
LAB_PROJECT=magic-shop-matrix-scope3 docker compose -f infra/compose.yaml --profile test run --rm --no-deps -e LAB_PROJECT -e LAB_SCOPE_CLIENT=customer-catalog -e LAB_SCOPE_CASE=missing runner-service-revocation node /work/testing/container/service-scope-negative.mjs
LAB_PROJECT=magic-shop-matrix-scope3 docker compose -f infra/compose.yaml --profile test run --rm --no-deps -e LAB_PROJECT -e LAB_SCOPE_CLIENT=insights-reporting -e LAB_SCOPE_CASE=missing runner-reporting-scope node /work/testing/container/service-scope-negative.mjs
LAB_PROJECT=magic-shop-matrix-scope3 docker compose -f infra/compose.yaml --profile test down --volumes
LAB_PROJECT=magic-shop-lab ./lab status
```

The runner image was built in the preceding isolated project with `LAB_PROJECT=magic-shop-matrix-scope2 docker compose -f infra/compose.yaml --profile test build runner-test`; no runner source changed before the final project. In this Apple Silicon project, the real-browser runner image used amd64 emulation while the admin-only fixture used the locally built Node image. The catalog and reporting paths each returned HTTP 200 with their normal scoped Keycloak token and correct service certificate. The admin-only fixture unlinked `catalog.quote` from `customer-catalog` and `reporting.read` from `insights-reporting` without changing client IDs, secrets, audience mappers or certificates. Both newly issued tokens retained a valid Keycloak RSA signature, their correct `azp` and target audience, and lacked only the required scope; the same private requests returned HTTP 403. The isolated stack and its certificate, secret and database volumes were removed. The retained `magic-shop-lab` services remained healthy. Earlier disposable projects `magic-shop-matrix-scope` and `magic-shop-matrix-scope2` proved the catalog and both paths before the admin fixture received its narrower credential mount; both were removed with `down --volumes`. The first `scope3` admin-fixture run attempted to pull an amd64 bootstrap image because its Compose service declared `linux/amd64` while the existing bootstrap image was built for arm64. Removing that unnecessary platform override let the admin-only job use the local image; both scope cases were then rerun and passed.

```sh
LAB_PROJECT=magic-shop-matrix-key-rotation ./lab up
LAB_PROJECT=magic-shop-matrix-key-rotation docker compose -f infra/compose.yaml --profile test build runner-test
LAB_PROJECT=magic-shop-matrix-key-rotation docker compose -f infra/compose.yaml --profile test run --rm --no-deps -e LAB_PROJECT key-rotation-admin inspect
LAB_PROJECT=magic-shop-matrix-key-rotation docker compose -f infra/compose.yaml --profile test run --rm --no-deps -e LAB_PROJECT -e LAB_ROTATION_PHASE=before runner-key-rotation node /work/testing/container/key-rotation.mjs
LAB_PROJECT=magic-shop-matrix-key-rotation docker compose -f infra/compose.yaml --profile test run --rm --no-deps -e LAB_PROJECT -e LAB_KEY_ROTATION=yes key-rotation-admin rotate
LAB_PROJECT=magic-shop-matrix-key-rotation docker compose -f infra/compose.yaml --profile test run --rm --no-deps -e LAB_PROJECT -e LAB_ROTATION_PHASE=after runner-key-rotation node /work/testing/container/key-rotation.mjs
LAB_PROJECT=magic-shop-matrix-key-rotation docker compose -f infra/compose.yaml --profile test down --volumes
```

Observed on macOS arm64 with the amd64 runner under Docker emulation: the original active RS256 `kid` was `DDiopS7NoE8q31Kx5Y1HzIdJScLa8ov_x4R8nbGn6mM`. A freshly issued shop-admin token with that key passed catalog `/items`, customer `/me`, and insights `/regions`, warming the long-running APIs' JWKS caches. The admin-only fixture added a higher-priority generated RSA provider; the active `kid` became `1KZdMNlLZc3kq2mL5Y_R1H9LGdXLWbV-yH2168rQYz8`, and the realm JWKS contained both old and new public keys. A fresh PKCE token signed by the new key again returned HTTP 200 from all three APIs with the same selected user certificate and no TLS bypass. The disposable project's CA, realm, signing keys, secrets and database volumes were removed afterward. The retained realm was never modified.

## Decisions, limitations and next dependency

The isolated live rotation and scope fixtures close JWT-02 and MTLS-03 at their designated integration boundaries without changing the retained Keycloak realm. The later timed user-CRL run below closes AUTH-07 on Apple Silicon emulation, and the JWT-01 continuation below closes the live signed-claim matrix. The current Compose viewer human click-through remains open. Native Linux amd64 remains deferred. No commit, external deployment or package publication occurred.

## Timed user revocation continuation, 2026-10-08

Added `testing/container/revoked-user-bound.mjs`, a disposable-project-only probe. It checks the published CRL with OpenSSL inside the runner, verifies Keycloak's server certificate on an unauthenticated discovery request, and then uses fresh Playwright request contexts with the revoked customer leaf for the exact shop and auth origins. TLS verification remains enabled. The shop must reject the leaf and Keycloak must issue no code or password form. The runner has the selected customer leaf and public trust only; no CA signing key or admin secret. The infrastructure, runner and certificate-lifecycle Mermaid diagrams now show this observed timed path.

```sh
LAB_PROJECT=magic-shop-matrix-user-crl ./lab up
LAB_PROJECT=magic-shop-matrix-user-crl docker compose -f infra/compose.yaml --profile test build runner-test
LAB_PROJECT=magic-shop-matrix-user-crl LAB_USER=customer-waterdeep LAB_BROWSER=chrome docker compose -f infra/compose.yaml --profile test run --rm --no-deps runner-test node /work/testing/container/ui-login.mjs
export LAB_PROJECT=magic-shop-matrix-user-crl
./lab pki revoke customer-waterdeep
published_seconds=$(date -u +%s)
published_ms=$((published_seconds * 1000))
docker compose -f infra/compose.yaml restart gateway keycloak
docker compose -f infra/compose.yaml up -d --no-deps --wait --wait-timeout 120 gateway keycloak
LAB_USER=customer-waterdeep docker compose -f infra/compose.yaml --profile test run --rm --no-deps -e LAB_PROJECT -e LAB_CRL_PUBLISHED_EPOCH_MS="$published_ms" runner-test node /work/testing/container/revoked-user-bound.mjs
LAB_PROJECT=magic-shop-matrix-user-crl docker compose -f infra/compose.yaml --profile test down --volumes
LAB_PROJECT=magic-shop-lab ./lab status
```

The isolated Vue login baseline passed in real Chrome for `customer-waterdeep`. CRL publication completed at `2026-10-08T17:04:05Z` (the host `date` command provided only the timestamp, not certificate operations). HAProxy and Keycloak restarted and passed health checks. The fresh shop connection rejected the revoked leaf by **31,418 ms**, and the Keycloak authorization request received no code by **31,860 ms**; both include reload, readiness wait and runner startup and are below the documented 60,000 ms target. The start timestamp has one-second resolution, so these are conservative upper-bound observations rather than subsecond latency measurements. All certificate operations, builds and tests ran in containers. The earlier direct-auth `login.mjs` baseline landed at the current shop root and failed its older callback-location assertion; the current Vue UI `ui-login.mjs` passed before revocation and is the relevant baseline. Native Linux timing is still unverified.

## Live signed JWT-01 continuation, 2026-10-08

Added a guarded Keycloak admin fixture that generates a temporary 2048-bit RSA signing key inside a disposable project, imports it as the active `RS256` realm provider, and confirms that the matching public key appears in the realm JWKS. The private key is written with mode 0600 to a project-scoped Docker volume. The admin job mounts its own secret and trust; the separate Playwright API runner mounts only that signer, the shop-admin leaf and public trust. No CA key, admin secret or host certificate store is exposed to the runner. The three business APIs retain their ordinary verified-TLS JWKS fetch and access-token verification code. [Keycloak's administration guide](https://www.keycloak.org/docs/25.0.6/server_admin/) documents import of a PEM private RSA key as a realm provider; the pinned Keycloak 26.4.0 behavior was verified in the live run.

```sh
LAB_PROJECT=magic-shop-matrix-jwt01 docker compose -f infra/compose.yaml --profile test config --quiet
LAB_PROJECT=magic-shop-matrix-jwt01 ./lab up
LAB_PROJECT=magic-shop-matrix-jwt01 docker compose -f infra/compose.yaml --profile test run --rm --no-deps -e LAB_PROJECT -e LAB_JWT_MATRIX=yes jwt-matrix-admin
LAB_PROJECT=magic-shop-matrix-jwt01 docker compose -f infra/compose.yaml --profile test build runner-test
LAB_PROJECT=magic-shop-matrix-jwt01 docker compose -f infra/compose.yaml --profile test run --rm --no-deps -e LAB_PROJECT runner-jwt-matrix node /work/testing/container/jwt-negative-live.mjs
LAB_PROJECT=magic-shop-matrix-jwt01 docker compose -f infra/compose.yaml --profile test down --volumes
LAB_PROJECT=magic-shop-lab ./lab status
```

The disposable realm became healthy with all three providers, and its imported key became the active published `RS256` key (`kid` `2acb9FkCrtAfd_DHzldV4QZHXM-rubp79nDMABAfEO0`). A fresh shop-admin certificate completed Authorization Code + PKCE. The runner checked the issued token's signature against the live JWKS and verified that the imported public key matched its private signer. Go catalog, Node customer and Python insights each returned HTTP 200 for that Keycloak access token through the shop gateway with verified server TLS and the selected user certificate.

Each API returned HTTP 401 for all nine negative cases: missing bearer, altered signature, genuinely signed expired token, genuinely signed not-yet-valid token, genuinely signed wrong issuer, genuinely signed wrong audience, genuinely signed unsupported `PS256` algorithm, Keycloak-signed ID token, and genuinely signed unknown `kid`. The runner verified every custom token's signature before sending it, including the PSS variant, so a rejection could not be attributed to an accidentally invalid fixture signature. No TLS bypass, host-side key generation, package publication or commit occurred. The disposable project, signing-key, certificate, secret and database volumes were removed; the retained `magic-shop-lab` realm was not modified. This is Apple Silicon Docker emulation evidence; native Linux amd64 remains user-deferred. The live JWT-01 matrix is complete at the three API boundaries, so the combined Prompt 11 security TODO entry is checked. The next dependency is Prompt 12 CI and handoff, with the current Compose manual viewer click-through and native Linux platform proof still deferred by the user.
