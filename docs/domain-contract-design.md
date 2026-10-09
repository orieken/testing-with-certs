# Domain and contract design

Status: **Prompt 02 design input**, 2026-10-05. This inventory fixes vocabulary,
ownership and intended authorization. The [authored OpenAPI 3.1
contracts](../contracts/openapi/README.md) are now canonical; neither these
documents nor the services are a running API. The
[architecture](architecture.md), [authentication](authentication.md) and
[contract requirements](api-contracts.md) remain the governing design context.

## Domain dictionary and ownership

| Term | Owner and identity | Invariants |
| --- | --- | --- |
| Human identity | Keycloak; stable `sub` plus protected, unique opaque UUID `cert_identity` | Certificate CN resolves to exactly one enabled user; display name/email are not identity keys. Roles come from the access token, not the certificate. |
| Service identity | Keycloak client plus service-client certificate | Only `customer-api` may request catalog quotes; only `insights-api` may request reporting pages. Certificate identity, token client, audience and scope must agree. |
| Item | Go; stable opaque `itemId` (seed may use slugs) | Name, category, image path, integer nonnegative `priceCopper`, active flag and informational stock. Archived items remain referenceable for historical orders but cannot be newly purchased. |
| Category | Go; stable `categoryId` | Display grouping only; no permission meaning. |
| Customer profile | Node; Keycloak `sub` | Own editable display/contact and current `regionId`; changing current region never rewrites orders. Keycloak owns login identity and roles. |
| Region | Python; stable `regionId` | Seeded nonoverlapping polygons with local GeoJSON `[longitude, latitude]`; boundaries have one deterministic membership rule to specify with fixtures. Region IDs in profiles/orders must reference this catalog. |
| Order | Node; opaque `orderId`, owner `sub`, historical `regionId` | Simulated checkout only. Status is `pending`, `completed` or `cancelled`; creation and status transition rules require explicit contract/implementation. `createdAt` and `completedAt` are UTC timestamps. |
| Order line | Node; parent `orderId` and line position | Immutable snapshot of item ID, name, unit copper price, quantity and line total. Node obtains authoritative current data from Go; client totals are ignored. |
| Checkout key | Node; `(owner sub, Idempotency-Key)` | Repeating the same payload returns the same result; reusing a key with a different payload conflicts. Persist key/result with the order transaction. |
| Widget layout | Node; owner `sub` | Ordered, unique allowlisted widget IDs. Customer and admin sets differ; API validates role when reading and writing. |
| Reporting page | Node; dataset revision and opaque cursor | Bounded, consistent read of order/profile snapshots for Python; never a direct Python database query. Revision change fails or restarts within a bounded policy, never mixes totals. |
| Sales summary | Python; region and half-open UTC interval | Sum only completed orders using the order's historical region. Customer count is distinct owner `sub` among matching orders, independent of current profile region. No partial aggregate on feed exhaustion. |
| Follow-up | Python; opaque `followUpId`, customer `sub`, region, author `sub` | Local note and status (`open`/`done`) only; no outbound email/SMS or real customer data. |

Money is always integer copper, never floating-point currency. All public IDs are
opaque to authorization decisions. Resource ownership derives from the verified
access-token `sub`, never a caller-supplied user ID. Lists use an opaque cursor and
`limit` with a finite upper bound; a first target is default 20, maximum 100,
subject to contract review. Dates are RFC 3339 UTC and filters use `[from, to)`.
Every downstream request and database query has an explicit timeout and bound.

## Planned operation inventory

The path includes the public gateway prefix. Private routes are reachable only on
the service network. Operation IDs below are proposed stable names to carry into
the canonical specs. `R` means an authenticated customer, shopkeeper or shop-admin;
`K` shopkeeper or shop-admin; `A` shop-admin. A caller also needs the correct user
certificate and a bearer token with that API's audience. The gateway identity
header must match the signed `cert_identity`. Public catalog reads are authenticated
because the shop certificate gate and token pairing apply to every business API.

| Owner | Method and path | operationId | Caller | Success intent |
| --- | --- | --- | --- | --- |
| Go | `GET /api/catalog/items` | `listItems` | R | `200` bounded page, optional category/search |
| Go | `GET /api/catalog/items/{itemId}` | `getItem` | R | `200` item; `404` absent/hidden |
| Go | `POST /api/catalog/items` | `createItem` | K | `201` item, `Location` |
| Go | `PATCH /api/catalog/items/{itemId}` | `updateItem` | K | `200` item |
| Go | `DELETE /api/catalog/items/{itemId}` | `archiveItem` | K | `204` no body; archival only |
| Go | `POST /internal/catalog/quotes` | `quoteItems` | Node service | `200` authoritative ordered item snapshots or explicit unavailable-item error |
| Node | `GET /api/customer/me` | `getMyProfile` | R | `200` own profile |
| Node | `PATCH /api/customer/me` | `updateMyProfile` | R | `200` own profile |
| Node | `GET /api/customer/orders` | `listMyOrders` | R | `200` bounded own page |
| Node | `POST /api/customer/orders` | `createOrder` | R | `201` simulated order; required `Idempotency-Key` |
| Node | `GET /api/customer/orders/{orderId}` | `getMyOrder` | R | `200` own order; `404` for another owner |
| Node | `GET /api/customer/me/widgets` | `getMyWidgets` | R | `200` own layout |
| Node | `PUT /api/customer/me/widgets` | `putMyWidgets` | R | `200` validated own layout |
| Node | `GET /api/customer/admin/users` | `listAdminUsers` | A | `200` bounded profile summaries; no certificate/key material |
| Node | `GET /api/customer/admin/orders` | `listAdminOrders` | A | `200` bounded orders with region/date/status filters |
| Node | `GET /internal/reporting/orders` | `listReportingOrders` | Python service | `200` bounded revision-pinned order/profile page |
| Python | `GET /api/insights/regions` | `listRegions` | A | `200` bounded regions with GeoJSON |
| Python | `GET /api/insights/sales` | `getSalesSummary` | A | `200` completed-order totals/counts by historical region |
| Python | `GET /api/insights/customers` | `listRegionalCustomers` | A | `200` bounded unique customers with qualifying orders |
| Python | `GET /api/insights/orders` | `listRegionalOrders` | A | `200` bounded matching orders |
| Python | `GET /api/insights/follow-ups` | `listFollowUps` | A | `200` bounded local notes/status |
| Python | `POST /api/insights/follow-ups` | `createFollowUp` | A | `201` local note, `Location` |
| Python | `PATCH /api/insights/follow-ups/{followUpId}` | `updateFollowUp` | A | `200` updated local note/status |

The follow-up update makes the existing note/status workflow explicit. No route
sends external messages.

## Authorization and data boundaries

| Caller | Catalog | Customer/orders | Insights | Internal capability |
| --- | --- | --- | --- | --- |
| Customer user | Read active items | Own profile, orders, checkout, customer widgets | None | None |
| Shopkeeper user | Read and maintain items | Own profile, orders and permitted widgets | None | None |
| Shop-admin user | Read and maintain items | Own data plus bounded admin user/order lists and admin widgets | Regions, sales, regional customers/orders, follow-ups | None |
| `customer-api` service | None through user routes | None through user routes | None | Go `quoteItems`: service cert identity + token client `customer-api`, `aud=catalog-api`, scope `catalog.quote` |
| `insights-api` service | None | None through user routes | None through user routes | Node `listReportingOrders`: service cert identity + token client `insights-api`, `aud=customer-api`, scope `customer.reporting.read` |
| HAProxy service | Transport to public APIs only | Transport to public APIs only | Transport to public APIs only | No internal business operation; strips spoofable identity headers and sets verified human cert identity |

For public APIs, the token issuer is exactly
`https://auth.magic.test:9443/realms/magic-shop`, and each service requires its own
`catalog-api`, `customer-api` or `insights-api` audience. The access token must be
signed, unexpired and contain a permitted role. An ID token is never an API token.
Service tokens cannot satisfy public human routes. An API rejects an otherwise
valid user token when the gateway's verified certificate identity differs from its
`cert_identity` claim. Keycloak operator bootstrap is separate from shop-admin.

Keycloak, Go, Node and Python each have separate database credentials and schemas.
Python has no grant on Node's database; Node has no grant on Go's database. The two
internal operations are on private listeners and are absent from HAProxy's public
route table. The UI sees only same-origin `/api/*` routes. Health, readiness and
authenticated `/openapi.json` artifacts are operational endpoints and require a
separate explicit inventory when implemented.

## Contract decisions to encode and verify

- All three specs use OpenAPI 3.1 with explicit public and private `servers`.
  Private operations override the public server. A single security requirement
  object contains certificate and bearer schemes together; role/scope and caller
  pairing are additionally described and behavior-tested.
- Common responses use a bounded error object with stable `code`, human-safe
  `message`, and optional request ID. Define exact error statuses per operation:
  `400` invalid input, `401` invalid/missing token, `403` insufficient role/scope
  or identity pairing, `404` absent/hidden resource, `409` idempotency conflict or
  revision conflict, `422` invalid domain transition/item, `429` bounded-rate
  protection where implemented, and `503` unavailable dependency. TLS handshake
  rejection occurs before HTTP and is not an API `401`.
- Lists define `limit`, `cursor`, deterministic sort and `nextCursor`; orders and
  reports filter by `regionId`, `from`, `to`, and documented status rules. The Node
  reporting feed additionally pins a dataset revision. Python must refuse an
  overlarge/unstable feed instead of returning partial totals.
- Quote request/response schemas must preserve item order and identify unavailable
  IDs. Checkout accepts item IDs and integer quantities, not prices or totals.
  Order responses include immutable line snapshots and computed totals.
- Contract authoring must settle category/item write field bounds, all transition
  rules, exact status/error matrices and pagination limits before implementing the
  transports. Live Playwright HTTP tests must then exercise every public and
  private operation, including applicable errors and semantic assertions.

The [sanitized synthetic fixtures and independent reporting oracle](../seed/README.md)
now exist and pass an offline container check. The three canonical YAML specs
are authored and statically validated. The next dependency is pinned tooling and
the Playwright contract harness. No operation in this inventory is yet claimed to
be implemented.
