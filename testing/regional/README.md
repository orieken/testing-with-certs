# TEST-10 — Real regional reporting boundaries

```sh
LAB_PROJECT=magic-shop-regional-example ./testing/regional/run.sh
```

All builds, installation, provisioning, fixture writes and tests happen in pinned
containers in a fresh disposable private project. PostgreSQL is accessed with
verified TLS and its scoped customer owner. The wrapper removes project containers,
networks, databases, keys, secrets and browser profiles on exit. Normal completion
also deletes the synthetic orders and restores the profile through the real API.

Nothing is mocked. Tests use real certificate-only PKCE, Keycloak, gateway, Node
reporting feed, Python insights and Vue. A separate November dataset leaves the
September oracle intact. It has 114 canonical orders: 110 completed orders inside
the window, one immediately before, one exactly at the exclusive end, and two
non-completed orders. The independently written expected result is 110 orders,
two distinct customers and 11,100 copper. UTC start is inclusive; end exclusive.

A genuine customer profile move after insertion uses PATCH through the real API,
from the seeded Neverwinter profile to Baldur's Gate. Its saved Waterdeep orders
must remain in Waterdeep. The Customers filter follows historical order membership,
while its row displays the current Baldur's Gate residence. Private reporting pages are revision-pinned; public
order/customer pagination is exhaustively walked and summed. Chrome/Edge under
Playwright/Cucumber share the same live journeys and write actual UI videos.

The browser regional order table currently shows its first 25 records and has no
regional load-more control. The journey verifies those 25 identities while the
sales summary/map and customer totals include all 110; API tests prove every page.
This does not claim the UI renders all regional orders. No app behavior is changed.

Known limitation: mixed fractional/whole-second UTC query endpoints can cause the
unchanged Node dependency's lexical range check to reject a chronologically valid
range. The required midnight boundaries use supported whole-second endpoints;
records immediately before an endpoint still have millisecond precision. The
completion note records this additional gap; no general timestamp-equivalence,
native Linux or new CI evidence is claimed.

Regional order IDs use one retrying exact-text assertion, which checks the entire
expected first-page sequence and count together while Vue replaces report tables.
The assertion-race suite runs in both browsers before the live journeys. It uses
an isolated synthetic table to expose the old count-then-snapshot gap and confirms
that incorrect IDs still fail; these checks are separate from live API evidence.
The browser evidence records only numeric report-request totals, peak concurrency,
and overlapping identical requests. No request URLs, headers, or credentials are
written. These diagnostics help investigate repeated refreshes; a passing run or
zero overlaps does not establish the cause of a historical failure.
