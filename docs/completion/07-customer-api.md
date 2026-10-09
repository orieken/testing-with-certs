# 07 — Node customer, orders and widgets API

Observed 2026-10-07 on Apple Silicon Docker Desktop with pinned linux/amd64
browser/test containers under emulation. Native Linux amd64 remains unverified
under the user's requested sequencing.

## Changes

- Replaced the Node transport placeholder with all ten canonical customer
  operations: own profile get/update, own order list/detail, simulated checkout,
  own widget get/replace, shop-admin user/order lists, and private reporting
  pages. Six profiles and nine synthetic orders seed idempotently in
  `customer_db`; new orders and widget layouts persist across restart.
- Checkout rejects browser prices and totals, obtains a `customer-catalog`
  token from Keycloak over verified TLS, then presents Node's service certificate
  and that scoped token to Go's private quote endpoint. It snapshots current
  names/prices and saves the completed order with an owner-scoped idempotency
  hash atomically. Same key/body returns the original 201 order; changed body
  returns 409. Stock remains informational and no payment occurs.
- Public routes require HAProxy's service certificate, a signed user token for
  the customer audience, role, and a signed `cert_identity` matching the
  gateway's verified header. Private reporting requires the `insights-api`
  service certificate paired with an `insights-reporting` token bearing
  `reporting.read`. Node uses verified database TLS, bounded queries, 5-second
  dependency timeouts, 10-second HTTP request bounds, and a 100-record page cap.
  Reporting joins each order to its current profile in one bounded query and
  returns a revision; stale follow-on reads fail 409.
- Packaged the resolved OpenAPI document in the image and exposed it only on
  authenticated `/internal/openapi.json`. A build test checks operation IDs and
  request-field sets against the canonical bundle; Playwright compares the
  deployed digest and live response schemas to the repository-expected bundle.
  The canonical reporting scope/token-client metadata was aligned with the
  already provisioned Keycloak client (`reporting.read`, `insights-reporting`),
  and the admin date-filter description now matches its `createdAt` behavior.
- Added scoped contract fixtures for a second customer and Python service
  identity. HAProxy now refreshes backend addresses through Docker DNS after a
  service container is recreated, while retaining CA and hostname checks.
  Updated recorded real-browser tests to cover live customer checkout and
  admin data, plus the affected architecture/workflow diagrams.

## Exact commands and observed results

All package installation, image builds, database operations, OpenAPI generation
and tests ran inside containers. The host supplied only the Compose wrapper and
filesystem mounts; no host Node, Python, Go, OpenSSL or certificate installation
was required.

```sh
docker run --rm -v "$PWD:/work" -w /work node:24.10.0-bookworm-slim@sha256:b8d2197aff9129d16c801a3e3e1b2a873c4946480f5a310f38056df2268c38d9 sh -c 'npm install --global pnpm@12.9.1 --fetch-timeout=30000 --fetch-retries=1 && pnpm install --lockfile-only --fetch-timeout=30000'
docker run --rm -v "$PWD:/work" -w /work node:24.10.0-bookworm-slim@sha256:b8d2197aff9129d16c801a3e3e1b2a873c4946480f5a310f38056df2268c38d9 sh -c 'PATH=/work/contracts/node_modules/.bin:$PATH node infra/contracts-tooling.mjs generate'
docker compose -f infra/compose.yaml build customer-api gateway ui
docker compose -f infra/compose.yaml --profile test build runner-test
docker compose -f infra/compose.yaml up -d --no-deps --force-recreate --wait --wait-timeout 120 customer-api ui gateway
docker compose -f infra/compose.yaml --profile test run --rm --no-deps -e LAB_CONTRACT_REPORT_DIR=/work/artifacts -v "$PWD/artifacts:/work/artifacts" runner-contracts sh -c 'cd /work/testing && /work/testing/node_modules/.bin/playwright test api/contracts/catalog.contract.spec.ts api/contracts/customer.contract.spec.ts --project=contracts'
docker compose -f infra/compose.yaml --profile test run --rm --no-deps -v "$PWD:/repo:ro" runner-contracts node /repo/infra/check-contract-coverage.mjs --service customer
docker compose -f infra/compose.yaml --profile test run --rm --no-deps -v "$PWD:/repo:ro" runner-contracts node /repo/infra/check-contract-coverage.mjs --service catalog
docker compose -f infra/compose.yaml --profile test run --rm --no-deps runner-contracts sh -c 'cd /work/testing && /work/testing/node_modules/.bin/tsc --noEmit'
docker run --rm -v "$PWD:/work:ro" -w /work node:24.10.0-bookworm-slim@sha256:b8d2197aff9129d16c801a3e3e1b2a873c4946480f5a310f38056df2268c38d9 sh -c 'PATH=/work/contracts/node_modules/.bin:$PATH node infra/contracts-tooling.mjs check && cd contracts && /work/contracts/node_modules/.bin/redocly lint openapi/catalog.yaml openapi/customer.yaml openapi/insights.yaml --extends spec'
./lab record chrome customer-waterdeep
./lab record msedge shop-admin
./lab db verify
docker compose -f infra/compose.yaml restart customer-api
docker compose -f infra/compose.yaml up -d --no-deps --wait --wait-timeout 120 customer-api
```

The final Node image passed strict TypeScript checks, four build-time domain and
contract-equivalence tests, and its non-root runtime health check. Go and Node
live Playwright contracts passed 9/9 tests. Separate coverage gates passed all
six Go and all ten Node operations, each with executed success, 400, 401 and
403 scenarios. The customer suite additionally checked second-user 404,
idempotent replay and 409 conflict, quoted prices, invalid browser totals,
role-scoped widgets, historical-region admin filtering, stale reporting
revision 409, wrong service caller/token/audience, tampered signature,
no-certificate TLS failure and public `/internal/*` denial. OpenAPI artifact
check, all three specification lints, Playwright TypeScript typecheck and
`./lab db verify` passed.

The Chrome customer recording passed three tests, including live certificate
login, account data, server-priced checkout and a fixture-backed UI interaction.
The Edge admin recording passed its two applicable tests; its customer checkout
case was explicitly skipped for that identity. Both runs saved local WebM video,
HTML and JUnit under:

- `artifacts/playwright/20261007T160210Z-chrome-customer-waterdeep-58072`
- `artifacts/playwright/20261007T160234Z-msedge-shop-admin-58290`

Before and after restarting Node, a containerized TLS-scoped database query
returned `6|13|2` for profiles, orders and widget layouts. The extra four orders
were created by live contract/browser checks; the nine seed orders were not
duplicated. Database verification rejected cross-database connection, plaintext,
wrong CA and wrong hostname.

## Decisions, limitations and next dependency

The Node runtime pins `pg@8.23.1`, `jose@6.2.12` and `@types/pg@8.23.1` in
`pnpm-lock.yaml`, builds on pinned Node 24.10.0 Bookworm and deploys only
production dependencies. The Keycloak token endpoint does not accept the Node
service certificate in this realm, so the token request uses the scoped secret
over verified TLS; the Go quote request uses both the service certificate and
token. This is service identity pairing, not RFC 8705 certificate-bound tokens.
The first public contract attempts returned 503 because the long-running gateway
had cached a recreated Node container's old address. The final gateway uses
HAProxy's Docker DNS resolver and the focused checkout passed after Node was
recreated without restarting HAProxy.

Python's real call to the live reporting feed, regional aggregation, map data,
follow-up persistence and its seven-operation contract gate remain Prompt 08
work. The full 23-operation gate and native Linux amd64 are still unverified.
No host trust was modified, TLS verification was not disabled, and no commit,
deployment or package publication occurred. Next dependency: Prompt 08 Python
insights provider using Node's bounded, revision-pinned reporting feed.
