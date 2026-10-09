# Node customer API

This live service owns profiles, orders, idempotency results and widget layouts in
`customer_db`. It migrates and seeds six profiles and nine synthetic orders
idempotently, then implements the ten operations in the canonical
[customer OpenAPI contract](../../contracts/openapi/customer.yaml). Public routes
serve each user's profile, orders and role-allowed widgets, plus shop-admin
customer/order lists. The private reporting route returns bounded joined pages
with a dataset revision; a stale revision returns 409.

Checkout accepts only item IDs, quantities and a region. The service obtains a
scoped Keycloak token over verified TLS without presenting a service certificate
to the token endpoint, then presents its `customer-api` certificate and that
token to Go's private batch quote endpoint. It snapshots the quoted names and
prices with the order and idempotency hash in one database transaction. The
browser cannot submit prices or another owner's identity.

`src/domain.ts` validates business input, `src/auth.ts` verifies JWTs and caller
pairing, `src/network.ts` provides bounded verified-TLS calls, `src/store.ts`
owns PostgreSQL, and `src/server.ts` handles HTTPS. The image runs as UID 1000,
packages the resolved customer OpenAPI document and exposes an authenticated
`/internal/openapi.json` with its digest. Build tests compare operation IDs and
request-field sets to that bundle; live Playwright tests validate provider
responses against the repository-expected artifact.

From the repository root, run the local checks with Docker:

```sh
docker compose -f infra/compose.yaml build customer-api
docker compose -f infra/compose.yaml up -d --no-deps --force-recreate --wait --wait-timeout 120 customer-api
docker compose -f infra/compose.yaml --profile test run --rm --no-deps -e LAB_CONTRACT_REPORT_DIR=/work/artifacts -v "$PWD/artifacts:/work/artifacts" runner-contracts sh -c 'cd /work/testing && /work/testing/node_modules/.bin/playwright test api/contracts/catalog.contract.spec.ts api/contracts/customer.contract.spec.ts --project=contracts'
docker compose -f infra/compose.yaml --profile test run --rm --no-deps -v "$PWD:/repo:ro" runner-contracts node /repo/infra/check-contract-coverage.mjs --service customer
```

See [completion 07](../../docs/completion/07-customer-api.md) for observed
results, recorded browser videos and remaining Python/Linux work.
