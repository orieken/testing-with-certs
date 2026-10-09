# Canonical business API contracts

Status: authored OpenAPI 3.1.0 contracts with three live providers. These three
files are the sole interface definitions for the three business APIs:

| Document | Planned implementation | Public prefix | Private operation |
| --- | --- | --- | --- |
| `catalog.yaml` | Live Go | `/api/catalog` | `POST /internal/catalog/quotes` from Node |
| `customer.yaml` | Live Node/TypeScript | `/api/customer` | `GET /internal/reporting/orders` from Python |
| `insights.yaml` | Live Python | `/api/insights` | none |

`shared/schemas.yaml` provides common bounded IDs, integer copper, UTC timestamp,
cursor, coordinate and error definitions; it has no business paths. The `.yaml`
files are deliberately JSON-formatted YAML 1.2, so they can be parsed with either
YAML or JSON tooling while retaining normal OpenAPI `$ref` semantics. Hand-edited
changes to these files are canonical; the temporary drafting script used to
create the first version is not part of the project.

Public server: `https://shop.magic.test:8443`. Private overrides:
`https://catalog-api:8443` and `https://customer-api:8443` on the Compose service
network, with matching server SANs. Neither internal path may
be routed by HAProxy. All operations require mutual TLS **and** a bearer access
token in the same OpenAPI security requirement object. `x-auth` records the exact
audience, roles or service scope, caller identity, and certificate/token pairing
rule that schema validation alone cannot enforce. Public APIs expect the gateway's
service certificate plus its verified human certificate identity header; the
browser's human certificate terminates at HAProxy. The `mutualTLS` scheme describes
the caller's entry to the trust boundary, and the service must also allowlist the
gateway identity. Private operations require the calling service's certificate
directly. The [authentication design](../../docs/authentication.md) specifies the
complete boundary.

Success and applicable error statuses are explicit for all 23 operations. Errors
use the strict shared object; TLS rejection occurs before HTTP. Request and
response objects reject unknown fields. All list `limit` values are bounded to
1–100. Reporting uses `completedAt` and a half-open UTC date range; order list
filters use `createdAt` where documented. Amounts are safe integer copper.
Checkout prohibits caller-supplied prices and totals, quotes are service-only,
and the reporting feed carries a revision on every page. Follow-up records are
local only, with `open` or `done` status and no outbound messaging.

The implemented design choice is that a repeated checkout key with an
identical body returns the original `201` response and `Location`; the same key
with a changed body returns `409`. A new order starts `pending`. Seeded completed
and cancelled orders exercise reporting and display; no public order-status
transition operation is defined yet. A follow-up starts `open` and an admin may
patch it to `done` or reopen it. These rules need business tests as providers are
implemented. The regional GeoJSON list uses `X-Next-Cursor`; other lists put
`nextCursor` in the body. The Python service must enforce a bounded feed total
and refuse mixed revisions, not return partial aggregates.

Current checks from the repository root (all run in containers):

```sh
docker build --platform linux/amd64 --target workspace -f infra/ci/Containerfile .
./lab test --runner playwright --suite contracts
```

The toolchain is now pinned in `contracts/package.json`, `testing/package.json`
and `pnpm-lock.yaml`. `infra/contracts-tooling.mjs` regenerates or byte-compares
three resolved bundles, their SHA-256 digests, and generated TypeScript declarations.
`testing/api/contracts/validator.spec.ts` has six passing offline Playwright
tests of the JSON Schema 2020-12 validator. The coverage manifest lists all 23
operations and 92 required status scenarios; the live Playwright contract gate
passed against the three providers on Apple Silicon amd64 emulation. Each provider
serves its deployed bundle digest through an authenticated internal spec route.
The CI workflow adds a conservative PR base-bundle comparison; a real committed
base and native Linux run remain unverified. Operational `/health`, `/ready` and
internal `/openapi.json` endpoints are excluded from the 23 business-operation
count and checked at their separate health/auth boundaries.
