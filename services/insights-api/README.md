# Insights API

The Python service implements the seven canonical `contracts/openapi/insights.yaml`
operations. It accepts the gateway service certificate plus a signed admin token
whose `cert_identity` matches the gateway's verified header. It obtains an
`insights-reporting` client-credentials token over verified TLS, then reads
Node's bounded `/internal/reporting/orders` feed with its own service certificate.
No customer-database connection is mounted.

The service aggregates completed orders by their saved historical region over
half-open UTC intervals. It deduplicates customer subjects per selected region,
returns the packaged local GeoJSON and paginated customer/order views, and rejects
a changed feed revision with retriable HTTP 409. A report processes at most
10,000 records; upstream TLS/authorization/unavailability produces a bounded
503 without returning credentials. Follow-up notes and status live only in
`insights_db` over verified PostgreSQL TLS. No outbound messaging exists.

The pinned UBI9 Python image installs the exact dependency closure from
`requirements.txt`, runs domain and OpenAPI-equivalence tests at build, and runs
as UID 1000. `/internal/openapi.json` requires the Python service certificate
and signed reporting token and serves the packaged canonical bundle. The
browserless Playwright suite compares that digest and every business response
with the repository-expected contract.

From the repository root:

```sh
docker compose -f infra/compose.yaml build insights-api
docker compose -f infra/compose.yaml up -d --no-deps --force-recreate --wait insights-api
docker compose -f infra/compose.yaml --profile test run --rm --no-deps -e LAB_CONTRACT_REPORT_DIR=/work/artifacts -v "$PWD/artifacts:/work/artifacts" runner-contracts sh -c 'cd /work/testing && /work/testing/node_modules/.bin/playwright test api/contracts/insights.contract.spec.ts --project=contracts'
```
