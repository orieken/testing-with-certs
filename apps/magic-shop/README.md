# Magic Shop UI

Vue 3 preview imported from Saturday's Ye Olde Magic Shop. It retains the fantasy
theme, item/list views, local cart display and a Leaflet map with local schematic
background, markers, polygon and geolocation. The image assets and applicable
LICENSE/NOTICE files are retained. See [import provenance](../../docs/import-provenance.json).

The UI offers certificate-only Keycloak sign-in and sign-out using the pinned
`keycloak-js` adapter, Authorization Code + PKCE, the exact shop callback and
memory-held access/refresh tokens. It displays the selected username and role.
The removed mock password flow and localStorage bearer token are gone. Catalog
requests carry the selected user's bearer token to the same-origin, bounded
`/api/catalog/items` path. Shop search, details, cart and simulated checkout,
own account/orders/widgets, inventory maintenance, admin lists, regional sales
and map, and local follow-up controls use the canonical public API paths.
The cart preview is stored under the signed-in subject and cleared from view on
sign-out, so a different user cannot inherit its display. The Go, Node and
Python business services still return 503 placeholders. Screens report those
services as unavailable until their OpenAPI-backed implementations exist.
Item and cart prices use integer `priceCopper`, formatted as gold only for display.
The client-side cart's displayed totals are never authoritative for checkout.
