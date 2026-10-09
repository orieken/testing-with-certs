# 09 — Integrated Vue shop and admin journeys

Observed 2026-10-07/08 UTC on Apple Silicon Docker Desktop with real Chrome
154.0.8037.97 and Edge 154.0.4258.62 in pinned linux/amd64 runner containers
under emulation. Native Linux amd64 remains deferred at the user's request.

## Changes

- Completed the live Vue integration across Go catalog, Node customer/orders
  and Python insights. Shop search, item details, cart, simulated server-priced
  checkout, own account/orders/widgets, administrator regional reporting/map
  and local follow-up controls use same-origin `/api/*` routes and the existing
  certificate-only Keycloak Authorization Code + PKCE adapter. Tokens stay in
  memory; the browser never receives service credentials.
- Fixed a repeatable item-detail renderer crash. Its watcher returned a new
  array whenever the memory-held identity object was refreshed by a protected
  request, causing another item request and an unbounded loop. The watcher now
  tracks the subject and route item ID as separate reactive sources.
- Selecting an admin region now refreshes sales, map, customer/order tables and
  follow-ups together. Regional response handling checks the current selection
  and date range before applying an asynchronous result.
- Expanded recorded Playwright Test flows. Real customer runs toggle a
  role-allowed widget, sign in again after reload, verify persistence, restore
  the original layout, and make a direct admin API request that returns 403.
  Real admin runs select the September Waterdeep range (57,000 copper, three
  orders, two customers), create and complete a local follow-up, then confirm
  it remains done after reload. Both roles visit a live item detail and the
  local Leaflet branch map; that test saw no external host requests. The
  fixture-backed interaction remains clearly separate from live evidence.

## Exact commands and observed results

All package installation, UI builds/typechecks and browser tests ran in
containers. The host used the `lab`/Compose wrappers only; no host Node, Go,
Python, OpenSSL or certificate installation was required.

```sh
docker compose -f infra/compose.yaml build ui
docker compose -f infra/compose.yaml --profile test build runner-test
docker compose -f infra/compose.yaml up -d --no-deps --force-recreate --wait --wait-timeout 120 ui
docker compose -f infra/compose.yaml --profile test run --rm --no-deps runner-contracts sh -c 'cd /work/testing && /work/testing/node_modules/.bin/tsc --noEmit'
./lab record chrome customer-waterdeep
./lab record msedge customer-waterdeep
./lab record chrome shop-admin
./lab record msedge shop-admin
```

The Vue typecheck and Vite production build passed. The expanded Playwright
TypeScript check passed. The final four real-browser recordings passed 18
applicable tests total; six role-inapplicable cases were explicitly skipped:

| Browser / identity | Result | Local report and WebM directory |
| --- | --- | --- |
| Chrome / customer-waterdeep | 5 passed, 1 skipped | `artifacts/playwright/20261008T000237Z-chrome-customer-waterdeep-54324` |
| Edge / customer-waterdeep | 5 passed, 1 skipped | `artifacts/playwright/20261008T000306Z-msedge-customer-waterdeep-54553` |
| Chrome / shop-admin | 4 passed, 2 skipped | `artifacts/playwright/20261008T000336Z-chrome-shop-admin-54789` |
| Edge / shop-admin | 4 passed, 2 skipped | `artifacts/playwright/20261008T000401Z-msedge-shop-admin-54985` |

One intermediate Edge admin run failed after reload because its test checked
for the sign-in button before the UI had finished initializing. Waiting for and
clicking that button fixed the test. A newly added Chrome item-detail test then
repeatedly crashed the renderer; this exposed the watcher loop above. The
focused real-Chrome item-detail/map test passed after the watcher fix, and all
four final recordings passed. No arbitrary sleep was added.

## Decisions, limitations and next dependency

The regional sales test uses the independent September seed expectation and
checks the UI's visible result after changing the dropdown, rather than only
checking that an API call returned. The follow-up is a synthetic local note;
no message is sent. Widget state is restored after the customer test. The
admin note remains in `insights_db` as persistence evidence. The browser
reports contain local videos, screenshots only on failure, and no traces or
storage state uploads.

The UI's role controls are for navigation and presentation. API enforcement is
also observed: a real customer browser received 403 from a direct insights
request, and the 23-operation provider contract gate separately exercises
role/certificate/token boundaries. Prompt 11 still needs the broader shared
Saturday Playwright/Cucumber business suites and security matrix. Prompt 10
manual selected-user lifecycle remains open, as does native Linux amd64 and CI.
No host trust was changed, TLS verification was not disabled, and no commit,
deployment or package publication occurred. Next dependency: Prompt 10 manual
browser mode, then Prompt 11 teaching suites.
