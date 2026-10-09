# 06 — Go catalog API

Observed 2026-10-07 in the local Apple Silicon Docker Desktop environment,
running the pinned linux/amd64 containers under emulation. Native Linux amd64
remains unverified by the user's requested sequencing.

## Changes

- Replaced the Go transport placeholder with the six canonical catalog
  operations: browse/search/detail, item create/update/archive, and private
  batch quotes. Fourteen copied magical items are seeded idempotently into
  `catalog_db`; archived records remain stored. Search validates its 100-character
  limit as Unicode characters. The UI now displays live catalog data after
  certificate sign-in.
- Split item validation, PostgreSQL persistence, token verification and HTTPS
  transport into domain/adapters. Queries and bodies are bounded; database,
  JWKS and HTTP operations have explicit timeouts. Database and Keycloak
  connections verify server names and CA chains.
- Enforced gateway service mTLS plus selected-user token/certificate identity
  pairing for public operations, with role checks on maintenance. The private
  quote route accepts only Node's service certificate paired with its scoped
  `customer-catalog` token. Tokens require RS256, issuer, catalog audience,
  expiry and supported caller claims. Unknown JWKS keys trigger bounded
  refresh; a short negative cache is keyed to the missing key ID.
- Pinned Go 1.25.3 Bookworm for build and UBI9 9.6 for non-root runtime;
  `go.mod`/`go.sum` pin pgx/v5 5.11.0 and golang-jwt/jwt/v5 5.3.1. The image
  packages the resolved catalog OpenAPI artifact and authenticated
  `/internal/openapi.json` route. A build test compares operation IDs and Item
  fields with the canonical bundle.
- Added live browserless Playwright contracts, scoped customer/admin/Node
  credential mounts, per-service operation coverage gate and safe local report.
  Adjusted the UI search bound to the contract and fixed its locked local
  Saturday package build input. Architecture/workflow diagrams now distinguish
  observed Go behavior from planned Node/Python paths.

## Commands and observed results

Run from the repository root with the previously provisioned local lab. Docker
Compose performed every build, package fetch, database operation and test; the
host did not need Node, Go, Python, OpenSSL or an installed certificate.

```sh
docker compose -f infra/compose.yaml build catalog-api
docker compose -f infra/compose.yaml up -d --no-deps --force-recreate --wait --wait-timeout 120 catalog-api
docker compose -f infra/compose.yaml restart catalog-api
docker compose -f infra/compose.yaml up -d --no-deps --wait --wait-timeout 120 catalog-api
docker compose -f infra/compose.yaml --profile test build runner-test
docker compose -f infra/compose.yaml --profile test run --rm --no-deps -e LAB_CONTRACT_REPORT_DIR=/work/artifacts -v "$PWD/artifacts:/work/artifacts" runner-contracts sh -c 'cd /work/testing && /work/testing/node_modules/.bin/playwright test api/contracts/catalog.contract.spec.ts --project=contracts'
docker compose -f infra/compose.yaml --profile test run --rm --no-deps -v "$PWD:/repo:ro" runner-contracts node /repo/infra/check-contract-coverage.mjs --service catalog
docker compose -f infra/compose.yaml --profile test run --rm --no-deps runner-contracts sh -c 'cd /work/testing && /work/testing/node_modules/.bin/tsc --noEmit'
./lab db verify
docker compose -f infra/compose.yaml build ui
docker compose -f infra/compose.yaml up -d --no-deps --force-recreate --wait --wait-timeout 120 ui
LAB_USER=customer-waterdeep LAB_BROWSER=chrome docker compose -f infra/compose.yaml --profile test run --rm --no-deps runner-test node /work/testing/container/ui-login.mjs
LAB_USER=shop-admin LAB_BROWSER=msedge docker compose -f infra/compose.yaml --profile test run --rm --no-deps runner-test node /work/testing/container/ui-login.mjs
```

The final Go image build passed `go vet`, all Go tests (including domain,
certificate/token pairing, JWKS rotation and contract equivalence) and the
binary build. The service became healthy. The final live contract run passed
5/5 tests; the coverage gate passed all six catalog operations with required
executed success and error statuses. TypeScript typecheck, database owner and
cross-database/TLS-negative verification, UI typecheck/build, and the Chrome
customer and Edge admin live-catalog sign-in checks passed. The catalog seed
showed 14 active items on first startup. An archive persisted across a catalog
container restart while the active seed count remained 14. Contract tests
create and archive their own test items, so the total archived count increases.

The live contracts compare the authenticated deployed spec digest to the
repository bundle, validate response status/headers/body against OpenAPI, and
exercise cursor/search (including Unicode length), authoritative quote prices, malformed inputs,
unauthorized maintenance, missing/tampered tokens, user-token/certificate
mismatch, wrong private caller/token, no-certificate TLS rejection and the
gateway's `/internal/*` denial. The local coverage report contains operation
and status evidence, not tokens or private keys. Transport identity checks
and data isolation also passed via `./lab db verify` and the existing service
probe paths.

## Decisions and limits

The catalog contract is the transport authority. Go keeps explicit domain
types and checks its transport fields/operation IDs against the bundled spec;
the Playwright suite independently validates live responses against the
repository-expected bundle. Database TLS uses the catalog-only scoped
password file. That distinction mattered: an initial attempt to read the
PostgreSQL admin password failed at runtime due to UID ownership; switching
to the intended service credential made startup healthy without broadening
volume access. A first standalone Go test command lacked the copied OpenAPI
bundle; the actual pinned image build includes it and passed.

The catalog-only gate is green. The full 23-operation gate remains open until
Node customer and Python insights exist. The private quote endpoint is tested
with the Node service identity and token from the contract runner; the real
Node-to-Go checkout call is Prompt 07 work. Customer/orders, reporting,
follow-ups, complete UI journeys and native Linux amd64 are unverified or
unimplemented. No host trust store was changed, TLS verification was not
disabled, and no repository commit, deployment or package publication was
performed. Next dependency: Prompt 07 Node customer/orders/widgets provider,
including its use of the live Go quote endpoint and its own Playwright
contracts.
