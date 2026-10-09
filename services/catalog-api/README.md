# Go catalog API

This is the live owner of catalog items in `catalog_db`. It migrates and seeds 14
items on startup, preserves archived rows, and implements all six operations in
the canonical [catalog OpenAPI contract](../../contracts/openapi/catalog.yaml):
bounded browse/search, item detail, create/update/archive, and private batch
quotes with current prices. Stock is informational; checkout and reservations
belong to later work.

`internal/domain` validates item and quote rules, `internal/store` owns
PostgreSQL and bounded queries, `internal/auth` verifies Keycloak access tokens,
and `src` handles HTTPS transport. The container image runs as UID 1000 on
pinned UBI9. It packages the resolved contract at `/app/contracts/catalog.json`
and exposes its digest at authenticated `/internal/openapi.json` to the Node
service identity. A build-time equivalence test checks the operation IDs and
Item transport fields against that artifact.

Public catalog calls come only through HAProxy's service certificate and a
user token paired with the gateway's verified `X-Cert-Identity`. Writes need
shopkeeper or shop-admin role. Private quotes require the `customer-api`
service certificate paired with a `customer-catalog` token carrying catalog
audience and `catalog.quote` scope. JWKS is fetched over verified TLS with a
bounded cache and timeout. All service TLS, database TLS and trust material
remain inside Compose volumes; no backend port is published to the host.

From the repository root, build and exercise the local service with Docker:

```sh
docker compose -f infra/compose.yaml build catalog-api
docker compose -f infra/compose.yaml up -d --no-deps --force-recreate --wait --wait-timeout 120 catalog-api
docker compose -f infra/compose.yaml --profile test run --rm --no-deps -e LAB_CONTRACT_REPORT_DIR=/work/artifacts -v "$PWD/artifacts:/work/artifacts" runner-contracts sh -c 'cd /work/testing && /work/testing/node_modules/.bin/playwright test api/contracts/catalog.contract.spec.ts --project=contracts'
docker compose -f infra/compose.yaml --profile test run --rm --no-deps -v "$PWD:/repo:ro" runner-contracts node /repo/infra/check-contract-coverage.mjs --service catalog
```

See [completion 06](../../docs/completion/06-catalog-api.md) for observed results
and remaining platform and cross-service limits.
