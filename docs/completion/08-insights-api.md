# 08 — Python regional insights and follow-up records

Observed 2026-10-07 on Apple Silicon Docker Desktop. Container builds used the
pinned UBI9 Python 3.12 image; real Chrome/Edge runners remain linux/amd64
under emulation. Native Linux amd64 remains unverified under the user's requested
sequencing.

## Changes

- Replaced the Python 503 transport placeholder with all seven canonical
  insights operations. Public routes require the gateway service certificate,
  a signed shop-admin access token for the insights audience and a matching
  verified `cert_identity` header. Missing tokens, customer roles and mismatched
  certificate/token identities fail before reporting data is fetched.
- Python gets an `insights-reporting` client-credentials token over verified TLS,
  then presents its own service certificate and the `reporting.read` token to
  Node's private reporting route. The token endpoint itself does not request
  Python's service certificate. Node's `customer_db` is never mounted in Python.
  Every dependency has a five-second network timeout and a one-megabyte reply
  cap; the Node feed uses 100-record pages and a 10,000-record maximum.
- Completed orders are grouped by their immutable historical order region over
  a half-open UTC interval. Customer subjects are deduplicated per selected
  region; pending/cancelled orders do not contribute. Local four-region GeoJSON
  is packaged with the image, with pagination and `X-Next-Cursor` for the map
  collection. A changed Node dataset revision returns retriable 409; the service
  never combines different page revisions.
- Follow-up notes/status live only in `insights_db` over verified PostgreSQL TLS.
  Creation requires an observed order for that customer in the chosen historical
  region; unknown customer-region pairs return 404. No outbound message action
  exists. A private authenticated OpenAPI endpoint serves the packaged resolved
  bundle to the Python service identity and signed reporting token.
- Added domain, revision-boundary and canonical-operation equivalence tests to
  the Python image; live Playwright provider tests validate all seven operations
  against the repository's expected bundle, including the deployed digest,
  independent September oracle, empty region, pagination, mutations and common
  authorization/input failures. Updated the real Edge admin recording to show
  live sales, map and regional customer views. Updated architecture, workflow,
  credential and contract documentation as the implementation changed.

## Exact commands and observed results

All package installation, builds, database setup/queries and tests ran in
containers. The host used only the Compose/`lab` wrappers and file mounts; no
host Python, Node, Go, OpenSSL or certificate installation was required.

```sh
docker compose -f infra/compose.yaml build insights-api
docker compose -f infra/compose.yaml --profile test build runner-test
docker compose -f infra/compose.yaml up -d --no-deps --force-recreate --wait --wait-timeout 120 insights-api
docker compose -f infra/compose.yaml --profile test run --rm --no-deps -e LAB_CONTRACT_REPORT_DIR=/work/artifacts -v "$PWD/artifacts:/work/artifacts" runner-contracts sh -c 'cd /work/testing && /work/testing/node_modules/.bin/playwright test api/contracts/catalog.contract.spec.ts api/contracts/customer.contract.spec.ts api/contracts/insights.contract.spec.ts --project=contracts'
docker compose -f infra/compose.yaml --profile test run --rm --no-deps -v "$PWD:/repo:ro" runner-contracts node /repo/infra/check-contract-coverage.mjs
docker compose -f infra/compose.yaml --profile test run --rm --no-deps runner-contracts sh -c 'cd /work/testing && /work/testing/node_modules/.bin/tsc --noEmit'
./lab record msedge shop-admin
docker compose -f infra/compose.yaml run --rm --no-deps --user 1000:1000 --entrypoint bash db-bootstrap -c 'PGPASSWORD="$(cat /secrets/insights/service-password)" psql "host=postgres port=5432 dbname=insights_db user=insights_app sslmode=verify-full sslrootcert=/public/server-ca.pem" -Atc "SELECT count(*) FROM follow_ups"'
docker compose -f infra/compose.yaml restart insights-api
```

The Python build ran five meaningful unit/equivalence tests; image and health
checks passed. All three live provider suites passed 11/11 Playwright tests,
including the seven-operation Python suite (2/2). The execution-derived gate
passed all 23 canonical operations and 92 required status scenarios. The
Playwright TypeScript check passed. September `[2026-09-01, 2026-10-01)`
returned five completed orders, two distinct customers and 124,000 copper,
matching the independently written oracle, including 57,000/27,000/40,000/0
by region. The empty region returned zero; customers/orders paginated and
filtered by the saved order region. Follow-up create, update, list, 404 unknown
pair and 400/401/403 scenarios passed.

Four local contract-created follow-ups remained in `insights_db` before and
after a Python service restart, read with the scoped owner over `verify-full`
TLS. The Edge administrator recording passed its two applicable cases; the
customer checkout case was skipped for that identity. The passing local
video/HTML/JUnit report is under
`artifacts/playwright/20261007T214527Z-msedge-shop-admin-3252`.

## Decisions, limitations and next dependency

The dependency closure is exactly pinned in `requirements.txt`: PyJWT 2.15.1,
psycopg/psycopg-binary 3.2.13, cryptography 50.0.2, cffi 2.1.1,
pycparser 3.0 and typing_extensions 4.16.0. The image is pinned by digest and
runs as UID 1000. The first live contract attempt used a previously built
runner image that still contained the placeholder test; rebuilding the runner
resolved it. The first Edge recording selected the follow-up form's identically
named Region input; the selector was narrowed to the report dropdown and the
second recording passed.

Reports are bounded synchronous reads. Revision changes cause an explicit 409
for the caller to retry; there is no hidden sleep loop or partial result. A
follow-up is associated with a customer who has an observed order in that
historical region, since Node does not offer a private profile lookup. Neither
GeoJSON nor follow-ups cause outbound geocoding or messaging. The full 23-operation
contract gate is now observed locally, but Linux amd64 CI and the broader shared
Saturday browser suites remain unverified. No host trust was changed, TLS
verification was not disabled, and no commit, deployment or package publication
occurred. Next dependency: finish Prompt 09 UI wiring and Prompt 11 shared
business suites/security evidence, then native Linux amd64 and CI handoff.
