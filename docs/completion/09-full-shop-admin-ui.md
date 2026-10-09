# Prompt 09 UI increment — shop, account and administration screens

## Changes and decisions

The Vue UI now has contract-shaped public adapters for Node customer/orders, Go catalog and Python insights. Requests remain on the exact shop origin, carry the selected Keycloak bearer token, have a ten-second deadline and use bounded page sizes. No browser code calls the private service paths. The UI image build copies generated OpenAPI types; the three canonical OpenAPI documents remain the source of truth. Business providers are still observed 503 transport placeholders, so each screen reports unavailable data instead of presenting the seed files as live results.

Shop search and item cards support cursor pagination. The cart sends only region, item IDs, quantities and a per-attempt idempotency key for simulated checkout; the displayed copper total is informational. The order confirmation stays visible after clearing a successful cart. Own profile, orders and widget layout screens are scoped to the signed-in subject. Inventory create, edit and archive controls are visible only to shopkeeper/admin roles. The admin view includes bounded customer/order lists, completed-sales totals, historical-order region filters, an offline Leaflet GeoJSON map with a parallel sales table, regional customer/order tables, and local follow-up note/status controls. Vue role checks are navigation and display only; server-side authorization is still required and not claimed here.

The UI keeps the copied Saturday visual theme and existing notices/provenance. No Saturday checkout files, generated secrets, host trust stores, or browser profiles were copied or changed. The new map does not request external tiles; labels are inserted as text. The architecture overview and regional reporting workflow diagram were updated with observed UI routes and observed 503 provider behavior; successful business flows remain labeled planned.

## Exact commands and observed results

Environment: macOS arm64 host, retained `magic-shop-lab` Docker Compose project, linux/amd64 real Chrome 154.0.8037.97 and Edge 154.0.4258.62 under Apple Silicon emulation, Playwright 1.61.0, pinned Node 24.10.0 UI/runner image. Builds, package installation and browser checks ran inside containers. No host Node, Python, Go, OpenSSL or certificate installation was used. Native Linux amd64 was deferred by the user until the rest of the build is complete.

```sh
docker compose -f infra/compose.yaml build ui
docker compose -f infra/compose.yaml up -d --no-deps --wait --wait-timeout 120 ui
LAB_BROWSER=chrome LAB_USER=customer-waterdeep docker compose -f infra/compose.yaml --profile test run --rm --no-deps -v "$PWD/testing/container/ui-full-smoke.mjs:/work/testing/container/ui-full-smoke.mjs:ro" runner-test node /work/testing/container/ui-full-smoke.mjs
LAB_BROWSER=msedge LAB_USER=shop-admin docker compose -f infra/compose.yaml --profile test run --rm --no-deps -v "$PWD/testing/container/ui-full-smoke.mjs:/work/testing/container/ui-full-smoke.mjs:ro" runner-test node /work/testing/container/ui-full-smoke.mjs
LAB_BROWSER=chrome LAB_USER=customer-waterdeep docker compose -f infra/compose.yaml --profile test run --rm --no-deps -v "$PWD/testing/container/ui-fixture-smoke.mjs:/work/testing/container/ui-fixture-smoke.mjs:ro" runner-test node /work/testing/container/ui-fixture-smoke.mjs
LAB_BROWSER=msedge LAB_USER=shop-admin docker compose -f infra/compose.yaml --profile test run --rm --no-deps -v "$PWD/testing/container/ui-fixture-smoke.mjs:/work/testing/container/ui-fixture-smoke.mjs:ro" runner-test node /work/testing/container/ui-fixture-smoke.mjs
```

The containerized Vue typecheck and Vite production build passed. Real Chrome/customer and Edge/admin full-route smokes exited 0: certificate login, role navigation, account/cart/admin screens, bearer requests, and honest 503 states. The Edge route check printed success before an emulation cleanup delay, then exited 0. UI-only fixture checks exited 0 in both brands: Chrome exercised catalog-to-cart checkout request shape and account/widgets; Edge exercised regional reporting controls and follow-up create/status controls. Fixture responses were Playwright route intercepts, not Go/Node/Python responses or live contract tests.

One intermediate build failed because a new Vue `v-else-if` followed a separate `v-else`; the template was corrected and rebuilt. The first fixture checkout check exposed a real confirmation-banner race after cart clearing; that was fixed with Vue's next tick and the Chrome fixture check then passed. The first Edge fixture run used the wrong Playwright locator for the region select; its locator was corrected and the rerun passed. These failures were test/build feedback, not business API failures.

## Limits and next dependency

The UI renders and issues contract-shaped requests, but catalog data, checkout persistence, profile edits, widgets, admin lists, regional results, follow-ups and API-enforced permissions are not live until prompts 06–08 implement the three OpenAPI-backed services and browserless contract tests. The Prompt 09 TODO entries that imply live business behavior remain unchecked. The fixture-backed UI checks do not substitute for provider contract, security or end-to-end tests. The next dependency is the portable Saturday package (Prompt 05) or business API providers (Prompts 06–08), followed by live Prompt 09 validation and both teaching runners. Native Linux amd64 remains unverified at the user's request.
