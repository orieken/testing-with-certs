# Synthetic seed and reporting oracle

Status: the six identities are provisioned in Keycloak, fourteen items are loaded
in Go's catalog database, and six profiles plus nine initial orders are loaded
idempotently in Node's customer database. Python serves the four packaged local
regions and derives reporting from Node's authenticated feed. All records are fictional. These files are containerized bootstrap and
contract inputs, not an API response schema. The imported `catalog-items.json` retains its separate provenance in
[import-provenance](../docs/import-provenance.json) and applicable image notices.

| File | Intended owner | Contents |
| --- | --- | --- |
| `identities.json` | Keycloak bootstrap | Six fixed synthetic subjects, protected certificate identity UUIDs, roles, enabled flags; no passwords, keys or tokens |
| `customer-profiles.json` | Node | One profile per subject, current region and local schematic coordinates |
| `catalog-items.json` | Go | Fourteen imported illustrated items with integer copper prices |
| `regions.geojson` | Python | Four local rectangular regions matching the existing shop map's approximate branch coordinates |
| `orders.json` | Node | Nine fixed simulated orders with immutable line snapshots and historical region IDs |
| `reporting-oracle.json` | Tests | Independently recorded expected September totals, members, and boundary cases |

The certificate UUID for the first customer and shop-admin matches the bounded
Prompt 01 spike's selected-user fixture for continuity. Their `sub` values here
are explicit full-stack seed subjects. The running Keycloak realm preserves these
subjects and protected `cert_identity` values idempotently; the separate Prompt 01
spike realm should not be assumed to contain them.
The `checkoutKey` values are fixed non-secret seed idempotency references, not
authentication credentials. No certificate or private key is part of these files.

Regions are nonoverlapping rectangles in longitude/latitude order. For fixture
point assignment, west and south edges are inclusive, east and north edges are
exclusive. A point outside all rectangles has no region. Stored order `regionId`
is authoritative for historical reporting; a profile's current location or region
must never reassign an order. The local map layer remains schematic and offline.

The reporting interval is `[2026-09-01T00:00:00Z,
2026-10-01T00:00:00Z)` on `completedAt`, counting only completed orders.
Hand-calculated copper totals from the stored order snapshots:

| Region | Included orders | Copper | Distinct customers |
| --- | --- | ---: | ---: |
| Waterdeep | 001 22,000 + 002 30,000 + 009 5,000 | 57,000 | 2 |
| Baldur's Gate | 003 27,000 | 27,000 | 1 |
| Neverwinter | 007 40,000 | 40,000 | 1 |
| Empty March | none | 0 | 0 |
| All regions | five completed orders | **124,000** | **2** |

Arin's current profile region is Neverwinter, while two September orders retain
Waterdeep. Order 002 stores a 30,000-copper Cloak of Shadows snapshot although the
current catalog price is 35,000. Orders 004/005 are pending/cancelled and contribute
nothing. Order 006 completed one second before September; order 007 completed one
second before October; order 008 completed exactly at October's exclusive boundary.
The day `[September 2, September 3)` contains orders 002/003 totaling 57,000.
`[October 1, October 2)` contains only order 008 totaling 5,000.

Validate the fixture consistency in a container, without host Node or network:

```sh
docker run --rm --platform linux/amd64 --network none -v "$PWD:/work:ro" -w /work node:24.10.0-bookworm-slim node infra/validate-seed.mjs
```

The validator checks credential-like fields, identity/region links, unique IDs,
nonoverlapping geometry, line and order arithmetic, dates, and recomputed results
against the separately written oracle. Live Keycloak, Go, Node and Python behavior is
verified separately in the corresponding completion notes; the Python contract
suite independently compared its September results with this oracle.
