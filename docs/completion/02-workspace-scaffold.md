# 02 — Workspace scaffold

Date: 2026-10-05. **Partial Prompt 02 completion:** the workspace scaffold,
selected Saturday UI/data/asset/test-model import, synthetic fixtures and canonical
OpenAPI authoring are complete. Full authentication, live contract verification
and service behavior remain open. Native Linux amd64 evidence from Prompt 01 is still
unverified because no native Docker context has been supplied.

## Changes

- Created a root pnpm workspace for `apps/magic-shop`,
  `packages/saturday-keycloak`, `services/customer-api` and `testing`, with pnpm
  12.9.1 and the already exercised Node 24.10.0 recorded in the root manifest.
- Added separate Go catalog, Python insights, infrastructure, seed and local
  artifacts directories. The Python service has a minimal `pyproject.toml`; Go's
  toolchain/module pin and all service dependencies remain a later step. Every
  placeholder says which domain it will own and exposes no endpoint.
- Added placeholder-only `.env.example`, root ignore rules and a Docker build-context
  exclusion list. Credentials, browser profiles, generated artifacts and certificate
  files remain outside the workspace. No copied Saturday framework directory, mock
  authentication code or generated secret was introduced.
- Added a root README describing what is live versus scaffolded. No running component,
  origin, port, credential boundary or workflow changed, so the existing planned and
  observed Mermaid diagrams did not require a new revision for this layout item.

## Observed checks and environment

The host is macOS arm64. Workspace verification used the pinned Node 24.10.0 Debian
container under Docker Desktop; no host Node, pnpm, Go, Python or certificate tool
was used. `npm view` reported pnpm 12.9.1 with a Node `>=18.*` engine requirement.
The containerized `pnpm -r list --depth -1` command exited 0 and found the root,
Vue UI, portable package, Node customer API and testing workspace. pnpm generated
`pnpm-lock.yaml` with the exact package-manager dependency. A read-only mount first
failed because pnpm writes lockfile metadata even for `list`; allowing the source
mount to write resolved that expected tooling behavior. No `node_modules` was
copied or installed into the prototype.

Exact commands from the repository root:

```sh
docker run --rm --platform linux/amd64 node:24.10.0-bookworm-slim npm view pnpm version engines --json --fetch-timeout=30000 --fetch-retries=1
docker run --rm --platform linux/amd64 -v "$PWD:/work:ro" -w /work node:24.10.0-bookworm-slim npm exec --yes --package=pnpm@12.9.1 -- pnpm -r list --depth -1
docker run --rm --platform linux/amd64 -v "$PWD:/work" -w /work node:24.10.0-bookworm-slim npm exec --yes --package=pnpm@12.9.1 -- pnpm -r list --depth -1
```

The first list command failed with `ERR_PNPM_LOCKFILE_WRITE_FILE` on the read-only
mount; the second passed. These are workspace-discovery checks, not UI/API builds or
the full Prompt 02 exit gate.

## Decisions, limitations and next dependency

The Go and Python runtime images, language dependency sets, formatter/typechecker
commands and final package exports are intentionally not claimed as verified. Their
versions need to be pinned when their actual source is introduced and compiled in
containers. The new directories contain no fabricated business behavior.

The next item was importing reusable source and assets; its observed result appears
below. Domain and role vocabulary, the remaining sanitized users/orders/regions,
three canonical OpenAPI contracts, and contract-test scaffold are still pending.
No commit, deployment, package publication or Saturday checkout edit occurred.

## Import continuation

Copied 40 selected files from the Saturday working tree and its mock API into the
prototype. This includes the shop theme, home/item/cart display, Leaflet location
view, logo/favicon, 14 item images, three Saturday page models and three feature
files. `docs/import-provenance.json` records the Saturday HEAD
`b5d3b1e45e4e45ffd0384958c9159298ae4395ca`, source and target SHA-256 for
every file, and whether adaptation changed the target. HEAD is not treated as proof
that the Saturday working tree was clean. The shop and mock API LICENSE/NOTICE files
were copied into the relevant app, assets and testing directories.

The mock password login, auth store, browser localStorage token, mock order API,
localhost image URLs and nested Saturday framework directories were **not** copied.
The imported UI uses installed `@orieken/saturday-core@0.1.3` for its selected
site models. Shop, item and cart views now use an integer-copper model with gold
display formatting. Checkout remains visibly unavailable until authenticated,
server-computed orders exist; client cart totals are not authoritative. Catalog
requests use a same-origin `/api/catalog/items` path, a 10-second timeout and a
24-item response limit. The provider is not implemented, so the preview shows a
clear unavailable state. The Leaflet view retains markers, polygon, layers and
geolocation but uses an offline schematic background instead of external tiles.

`seed/catalog-items.json` contains 14 illustrated items. A containerized transform
selected records with local images from the source items file, replaced absolute
localhost image URLs with local paths, and multiplied source gold-piece amounts by
100 into integer `priceCopper`. This is a documented synthetic-fixture conversion.
The source users/orders were not imported because they contain passwords and legacy
identity/address data; their transformation is a separate open TODO item.

The pinned Node 24.10.0 amd64 container installed pnpm 12.9.1, resolved the
workspace lockfile, type-checked the imported Vue UI and Saturday page models,
and built the Vite bundle. The final build exited 0: 53 modules transformed, with
`dist/index.html`, CSS and JS generated inside the image. A container scan confirmed
the bundle has none of the old local token key, example password, mock API origin or
external OpenStreetMap tile URL. No host Node/pnpm, certificate installation or
browser-profile copy was used. This is build evidence, not a live provider or login
test for the imported UI.

Significant exact commands from the repository root (the selected copy paths and
per-file hashes are in `docs/import-provenance.json`):

```sh
source_root=/Users/oscarrieken/Projects/Rieken/saturday-monorepo
shop_source="$source_root/apps/ye-olde-magic-shop"
mock_source="$source_root/apps/mock-api"
mkdir -p apps/magic-shop/src/{views,components,stores,router,api} apps/magic-shop/public/images testing/site testing/cucumber/features
cp "$shop_source/index.html" apps/magic-shop/index.html
cp "$shop_source/src/main.ts" "$shop_source/src/App.vue" "$shop_source/src/styles.css" apps/magic-shop/src/
cp "$shop_source/src/router/index.ts" apps/magic-shop/src/router/index.ts
cp "$shop_source/src/views/ShopHome.vue" "$shop_source/src/views/ItemPage.vue" "$shop_source/src/views/CartView.vue" "$shop_source/src/views/LocationsView.vue" apps/magic-shop/src/views/
cp "$shop_source/src/components/ItemCard.vue" apps/magic-shop/src/components/ItemCard.vue
cp "$shop_source/src/stores/cartStore.ts" apps/magic-shop/src/stores/cartStore.ts
cp "$shop_source/public/favicon.svg" "$shop_source/public/logo.png" apps/magic-shop/public/
cp "$shop_source/LICENSE" "$shop_source/NOTICE" apps/magic-shop/
cp "$mock_source/public/images/"*.png apps/magic-shop/public/images/
cp "$mock_source/LICENSE" apps/magic-shop/public/images/LICENSE
cp "$mock_source/NOTICE" apps/magic-shop/public/images/NOTICE
cp "$shop_source/lib/site/HomePage.ts" "$shop_source/lib/site/ProductDetailsPage.ts" "$shop_source/lib/site/CartPage.ts" testing/site/
cp "$shop_source/features/inventory-list.feature" "$shop_source/features/item-details.feature" "$shop_source/features/cart.feature" testing/cucumber/features/
cp "$shop_source/LICENSE" "$shop_source/NOTICE" testing/
docker run --rm --platform linux/amd64 node:24.10.0-bookworm-slim npm view vue-tsc version engines --json --fetch-timeout=30000 --fetch-retries=1
docker run --rm --platform linux/amd64 -v "$PWD:/work" -w /work node:24.10.0-bookworm-slim npm exec --yes --package=pnpm@12.9.1 -- pnpm install --lockfile-only --ignore-scripts --fetch-timeout=30000
docker build --platform linux/amd64 -f apps/magic-shop/Containerfile -t magic-shop-ui-import:02 . > /tmp/magic-shop-ui-build.log 2>&1
docker run --rm --platform linux/amd64 -v /Users/oscarrieken/Projects/Rieken/saturday-monorepo:/source:ro -v "$PWD:/work" -w /work node:24.10.0-bookworm-slim node infra/import-catalog-items.mjs
docker run --rm --platform linux/amd64 -e SATURDAY_SOURCE_HEAD=b5d3b1e45e4e45ffd0384958c9159298ae4395ca -v /Users/oscarrieken/Projects/Rieken/saturday-monorepo:/source:ro -v "$PWD:/work" -w /work node:24.10.0-bookworm-slim node infra/record-import-provenance.mjs
docker run --rm --platform linux/amd64 magic-shop-ui-import:02 sh -c "test -f /work/apps/magic-shop/dist/index.html && ! grep -R -E 'dnd_auth_token|password123|mock-api:8001|tile.openstreetmap.org' /work/apps/magic-shop/dist"
```

The initial UI build failed because pnpm 12's strict dependency-script policy
rejected esbuild's install script. `pnpm-workspace.yaml` now allows only esbuild's
build script, and the install passed its lockfile supply-chain check. The next type
check exposed Vue deep-ref unwrapping of `L.Map`; changing that state to a shallow
ref resolved it. These failures were corrected before the final passing build.

The UI import changes a planned component but no live shop origin. The Mermaid
architecture overview and a new workflow overlay now distinguish the observed
container-built preview from the planned HAProxy/Keycloak/three-API runtime.

Next dependency: define the canonical domain dictionary, identity and region
mapping, then transform users/orders into credential-free synthetic fixtures and
author the three OpenAPI contracts. The imported UI must not be connected to a
mock password flow to make its catalog or checkout appear complete.

## Domain and operation-design continuation (2026-10-05)

Added [domain and contract design](../domain-contract-design.md): domain terms,
record ownership, invariants, an explicit 23-operation inventory across exactly
three business APIs, and a human/service role, audience and scope matrix. It
specifies historical order region reporting, immutable copper-price snapshots,
bounded revision-pinned reporting pages, checkout idempotency, certificate/token
identity pairing and database isolation. The inventory includes two private
service operations and makes a local follow-up `PATCH` explicit. Updated the
architecture route list and regional-reporting Mermaid workflow for that status
transition; the origin, ports and certificate boundaries did not change. Linked
the design from the README and contract requirements.

Observed environment: Apple Silicon host using an amd64 Node 24.10.0 Bookworm
container for a read-only inventory check. Exact passing command from the repo
root:

```sh
docker run --rm --platform linux/amd64 -v "$PWD:/work:ro" -w /work node:24.10.0-bookworm-slim node -e 'const fs=require("fs");const s=fs.readFileSync("docs/domain-contract-design.md","utf8");const rows=s.split("\n").filter(x=>/^\| (Go|Node|Python) \| `(?:GET|POST|PATCH|PUT|DELETE) /.test(x));const ids=rows.map(x=>x.split("|")[3].trim());if(rows.length!==23||new Set(ids).size!==ids.length||rows.filter(x=>x.includes("/internal/")).length!==2)process.exit(1);for(const id of ["quoteItems","listReportingOrders","updateFollowUp"])if(!ids.includes("`"+id+"`"))process.exit(2);console.log("PASS: 23 planned operations, 23 unique IDs, 2 private routes");'
```

Result: `PASS: 23 planned operations, 23 unique IDs, 2 private routes` (exit 0).
The first attempt could not access the Docker socket inside the sandbox; a
read-only Docker run with allowed socket access succeeded. The first assertion
then failed because it expected 22 rather than 23 rows; inspecting the inventory
showed 23 distinct operations, and the corrected assertion passed. These checks
establish document consistency only, not OpenAPI validity or live API behavior.

The domain matrix is a planning aid. Exact schemas, field bounds, status/error
matrices and transition rules must be settled in the canonical OpenAPI YAML; no
service endpoint or contract test is claimed as implemented. The next dependency
is credential-free synthetic identities, regions and orders with independently
calculated totals, followed by canonical specs and containerized validation.
Native Linux amd64 remains unverified. No commit, deployment, package publication,
host certificate change or Saturday checkout modification occurred.

## Synthetic seed continuation (2026-10-05)

Added six credential-free synthetic Keycloak identity definitions, one Node profile
per identity, four nonoverlapping Python GeoJSON regions, nine Node orders, and a
separately written reporting oracle under `seed/`. The catalog items remain the
14 illustrated imports already recorded above. The first customer and admin use
the spike's certificate identity UUIDs for continuity, but the full-stack `sub`
values are new fixed UUIDs and are **not** claimed to exist in the spike realm.
No passwords, tokens, private keys, certificates or browser profiles were copied.

The oracle fixes the half-open September UTC interval on `completedAt`: five
completed orders, 124,000 copper, two unique customers. Waterdeep has three
orders/57,000 copper/two customers; Baldur's Gate one/27,000/one; Neverwinter
one/40,000/one; Empty March zero. The data include a moved customer, pending and
cancelled orders, both sides of the date boundary, and an old 30,000-copper line
snapshot for an item now priced at 35,000. Region point assignment uses west/south
inclusive and east/north exclusive rectangular bounds. `seed/README.md` records
the hand arithmetic and fixture semantics.

Added `infra/validate-seed.mjs`, using only Node built-ins. It checks references,
unique identity and order IDs, credential-like fields, geometry, UTC dates, safe
integer line arithmetic, and recomputed totals/customer sets against the oracle.
Updated the planned provisioning Mermaid node labels and text while explicitly
stating that bootstrap has **not** loaded these fixtures. No origin, port,
credential boundary or running component changed. The domain and README links and
only the completed seed TODO entry were updated.

Observed environment: macOS arm64 host, Docker's `linux/amd64` emulation,
`node:24.10.0-bookworm-slim`, network disabled and repository mounted read-only.
Exact commands from the repository root:

```sh
docker run --rm --platform linux/amd64 --network none -v "$PWD:/work:ro" -w /work node:24.10.0-bookworm-slim node infra/validate-seed.mjs
docker run --rm --platform linux/amd64 --network none --tmpfs /tmp -v "$PWD:/work:ro" -w /work node:24.10.0-bookworm-slim node -e 'const fs=require("node:fs"),cp=require("node:child_process");fs.cpSync("/work/seed","/tmp/seed",{recursive:true});fs.mkdirSync("/tmp/infra");fs.copyFileSync("/work/infra/validate-seed.mjs","/tmp/infra/validate-seed.mjs");const p="/tmp/seed/reporting-oracle.json";const o=JSON.parse(fs.readFileSync(p,"utf8"));o.overall.salesCopper++;fs.writeFileSync(p,JSON.stringify(o));const r=cp.spawnSync(process.execPath,["/tmp/infra/validate-seed.mjs"],{encoding:"utf8"});if(r.status===0||!r.stderr.includes("overall salesCopper differs from oracle"))process.exit(1);console.log("PASS: one-copper oracle drift rejected");'
```

Results: `PASS: 6 identities, 4 regions, 9 orders; September 5 completed orders /
124000 copper / 2 customers` and `PASS: one-copper oracle drift rejected`, both
exit 0. These are fixture checks only. Keycloak/bootstrap, three service
databases, canonical OpenAPI schemas and live reporting remain unimplemented.
Native Linux amd64 remains unverified. The next Prompt 02 dependency is authoring
the three canonical OpenAPI YAML files and shared schemas, then pinning tooling
and building the Playwright contract harness. No commit, deployment, publication,
host certificate change or Saturday checkout modification occurred.

## Canonical OpenAPI continuation (2026-10-05)

Authored `contracts/openapi/catalog.yaml`, `customer.yaml`, `insights.yaml` and
`shared/schemas.yaml`. They are OpenAPI 3.1.0 documents in JSON-formatted YAML,
with exactly 23 unique business operations, including Node-to-Go quotes and
Python-to-Node reporting. Each operation defines method/path/operation ID, exact
success and applicable error statuses, request and response schemas/media types,
query/path/header parameters where applicable, AND-combined mutual-TLS and bearer
security, and role/audience/caller/scope metadata. The two internal operations
override the public gateway server with planned private HTTPS origins on port
8443 and declare a 10-second network timeout. Shared schemas constrain IDs,
integer money, quantities, UTC timestamps, coordinates, cursor and error shape.
Request objects reject unknown fields. Checkout prices/totals are server-owned;
regional sales use historical order regions and completedAt; the reporting feed
pins a revision. `contracts/openapi/README.md` records the decisions and live
implementation boundary.

The private origins `https://catalog-api:8443`,
`https://customer-api:8443` and `https://insights-api:8443` are now named in the
architecture and infrastructure Mermaid diagrams; no backend port is published to
the host. The contract-gate diagram distinguishes authored/static validation from
planned generation, services, Playwright checks and browser suites. The diagram
changes are planning updates, not observed new running components.

Observed environment: macOS arm64 host with amd64 container emulation,
`node:24.10.0-bookworm-slim`. An npm metadata query inside the container reported
`@redocly/cli@2.58.1` and a compatible Node engine. The CLI was used at that
exact version for this static validation but is not yet locked into the workspace
toolchain. The custom offline inventory check passed. Exact significant commands
from the repository root:

```sh
docker run --rm --platform linux/amd64 node:24.10.0-bookworm-slim npm view @redocly/cli version engines --json --fetch-timeout=30000 --fetch-retries=1
docker run --rm --platform linux/amd64 --network none -v "$PWD:/work:ro" -w /work node:24.10.0-bookworm-slim node infra/check-openapi-inventory.mjs
docker run --rm --platform linux/amd64 -v "$PWD:/work:ro" -w /work node:24.10.0-bookworm-slim npm exec --yes --package=@redocly/cli@2.58.1 -- redocly lint contracts/openapi/catalog.yaml contracts/openapi/customer.yaml contracts/openapi/insights.yaml --extends spec
docker run --rm --platform linux/amd64 -v "$PWD:/work:ro" -w /work node:24.10.0-bookworm-slim npm exec --yes --package=@redocly/cli@2.58.1 -- redocly lint contracts/openapi/catalog.yaml contracts/openapi/customer.yaml contracts/openapi/insights.yaml --extends recommended --format summary
docker run --rm --platform linux/amd64 -v "$PWD:/work:ro" -w /work node:24.10.0-bookworm-slim npm exec --yes --package=@redocly/cli@2.58.1 -- redocly bundle contracts/openapi/catalog.yaml contracts/openapi/customer.yaml contracts/openapi/insights.yaml --ext json -o /tmp/openapi-bundles
```

Final inventory result: `PASS: 23 unique operations across three OpenAPI 3.1
specs; two private mTLS-plus-bearer routes` (exit 0). Final `--extends spec` lint
passed for all three documents (exit 0). The bundle command resolved all shared
references into three temporary JSON artifacts (exit 0). Recommended lint also
passed with only three `info-license` warnings: this prototype has retained
licenses/notices for copied Saturday material but has no declared root project
license, so a license was not invented for the new contracts. The ephemeral CLI
version and these syntax/reference checks do not prove its handling of every JSON
Schema 2020-12 keyword; dialect behavior tests are the next tooling item.

The contracts describe intended behavior, not implemented providers. No service
image yet packages a spec digest or exposes authenticated `/openapi.json`; no
Playwright contract coverage or generated transport validation exists. Operational
health/readiness/spec routes need an explicit later inventory. Native Linux amd64
remains unverified. The next Prompt 02 dependency is pinning lint/bundle and
generation/equivalence tooling and scaffolding the browserless Playwright contract
validator and coverage manifest. No commit, deployment, package publication,
host certificate change or Saturday checkout modification occurred.

## Locked contract-tooling and Playwright-validator continuation (2026-10-06)

Finished the last individual Prompt 02 TODO item. Added `contracts` to the pnpm
workspace and pinned Redocly CLI 2.58.1, openapi-typescript 7.13.0, Ajv 8.20.0,
ajv-formats 3.0.1, Playwright 1.61.0 and TypeScript 5.9.3 in exact manifests and
`pnpm-lock.yaml`. `infra/contracts-tooling.mjs` regenerates or byte-compares the
three resolved JSON bundles, generated TypeScript declarations and SHA-256 digest
manifest. The generated declarations themselves compile under strict TypeScript
checks. The specs remain canonical; generated artifacts are derived outputs.
Go/Python transport validation or equivalence must be wired during their service
prompts rather than treating generated TypeScript as their runtime validator.

Added a browserless Playwright `contracts-validator` project and a separate
`contracts` project. The Ajv draft-2020-12 validator reads the repository's
expected bundles, selects operation/status/media/header/body schemas, rejects
unknown refs and fields, does not coerce response data, and bounds response size.
Five offline tests demonstrate that missing and wrong-typed fields, extra fields,
unexpected status/media, missing required headers, nonempty 204 bodies,
client-submitted checkout totals, malformed structured errors, overlong
longitude/latitude tuples and non-UTC timestamps fail. The exact-origin API
context fixture specifies client certificates, bearer token input, a 10-second
timeout and `ignoreHTTPSErrors: false`; future runner startup must load server CA
trust inside its container. It does not obtain a live token yet.

The 23-operation coverage manifest lists 92 required success/basic-error status
scenarios. A Playwright reporter can record only passed annotated tests into a
safe execution report. The strict coverage gate reads that execution report and
currently fails for all 92 required statuses. The three provider spec files fail
explicitly until real providers and selected credentials exist; no mock response
or placeholder is counted as live coverage. The Mermaid contract-gate workflow
was updated to show pinned static checks as observed and provider checks as
planned. No component, origin, port or credential boundary changed in this item,
so the architecture overview topology did not require an edge change.

Observed environment: macOS arm64 host running `linux/amd64` Node
24.10.0 Bookworm containers under Docker Desktop. Package installation, type
checking, generation and tests ran inside containers with anonymous
`node_modules` volumes; no host Node/Go/Python/OpenSSL or certificate setup was
used. pnpm's lockfile supply-chain verification passed; because Redocly 2.58.1
was newly published, pnpm added an **exact-version** minimum-release-age
exception, recorded in `pnpm-workspace.yaml`. No wildcard version was introduced.

Exact significant commands run from the repository root:

```sh
docker run --rm --platform linux/amd64 node:24.10.0-bookworm-slim npm view openapi-typescript@7.13.0 version engines --json --fetch-timeout=30000 --fetch-retries=1
docker run --rm --platform linux/amd64 node:24.10.0-bookworm-slim npm view ajv version engines --json --fetch-timeout=30000 --fetch-retries=1
docker run --rm --platform linux/amd64 node:24.10.0-bookworm-slim npm view ajv-formats version engines --json --fetch-timeout=30000 --fetch-retries=1
docker run --rm --platform linux/amd64 -v "$PWD:/work" -w /work node:24.10.0-bookworm-slim npm exec --yes --package=pnpm@12.9.1 -- pnpm install --lockfile-only --ignore-scripts --fetch-timeout=30000
docker run --rm --platform linux/amd64 -v "$PWD:/work" -v /work/node_modules -v /work/contracts/node_modules -v /work/testing/node_modules -w /work node:24.10.0-bookworm-slim sh infra/contract-tooling-container.sh generate
docker run --rm --platform linux/amd64 -v "$PWD:/work" -v /work/node_modules -v /work/contracts/node_modules -v /work/testing/node_modules -w /work node:24.10.0-bookworm-slim sh infra/contract-tooling-container.sh validator
docker run --rm --platform linux/amd64 --network none -v "$PWD:/work:ro" -w /work node:24.10.0-bookworm-slim node infra/check-contract-coverage.mjs --inventory
docker run --rm --platform linux/amd64 --network none -v "$PWD:/work:ro" -w /work node:24.10.0-bookworm-slim node infra/check-contract-coverage.mjs
```

Final observed results: OpenAPI lint passed for all three specs; deterministic
bundle/type/digest drift check passed; strict TypeScript checks passed for both
generated declarations and validator code; all five
Playwright validator tests passed in 1.5 seconds; manifest inventory passed for
23 operations/92 required statuses. The final strict live-coverage command exited
1 with `Live contract coverage incomplete (92 required statuses)`, as expected.
The initial TypeScript check failed on Ajv's NodeNext CommonJS import shape;
using its named `Ajv2020` export and the formats module's typed default resolved
that failure before the final green validator run. Docker-created empty
`contracts/node_modules` and `testing/node_modules` mount-point directories were
removed; a preexisting root `.pnpm-store` was left untouched.

This closes the tooling **scaffold**, not live contract conformance or the full
Prompt 02 exit check. Request-body prevalidation exists; request path/query/header
serialization, service-specific domain assertions and live credentials still need
implementation. The next dependency is Prompt 03 infrastructure/PKI and
Prompt 04 Keycloak setup; each business API must later implement its canonical
contract and earn actual Playwright operation/status coverage. Native Linux amd64
remains unverified. No commit, deployment, package publication, Saturday checkout
edit or host certificate change occurred.
