# Early Prompt 09 increment — Vue certificate sign-in

## Changes and decisions

The existing Vue shell now starts Keycloak Authorization Code + PKCE S256 from a visible **Sign in with certificate** button. Pinned `keycloak-js` 26.2.4 initializes before Vue Router, handles the exact `https://shop.magic.test:8443/callback`, keeps access and refresh tokens in memory, refreshes before protected requests or on expiry, and returns to the signed-out shop after Keycloak logout. The header shows the selected username and customer, shopkeeper or shop-admin role. A failed refresh clears identity and previously loaded item content. The catalog fetch sends the selected user's bearer token to the existing same-origin route with a ten-second timeout; the Go placeholder still returns 503. This is UI authentication, not completed catalog or account functionality.

The realm's public `shop-spa` client now registers an exact `https://shop.magic.test:8443/` post-logout redirect. The idempotent bootstrap updates that one attribute on an existing client and verifies that PKCE, login callback and web origin remain exact. The first live UI test reached Keycloak login and displayed the right role, but logout returned `Invalid redirect uri`; this client update fixed it. No password option or TLS verification bypass was introduced.

The preview cart previously used one shared localStorage key. It now stores only cart entries under the signed-in Keycloak subject, clears its display on sign-out, and never stores auth tokens. The item views clear loaded data when the identity disappears and ignore responses from an earlier identity. The old shared cart key is no longer read. The copied shop's LICENSE, NOTICE, image notices and import provenance remain in place; the Saturday checkout was untouched and no package was published.

The user requested that native Linux amd64 verification wait until the rest of the project is built. This note records Apple Silicon Docker results only. The remaining Prompt 09 business screens, Go/Node/Python providers, API enforcement, Saturday adapters and both full teaching suites remain open in `docs/TODO.md`.

## Exact significant commands and observed results

Environment: retained `magic-shop-lab` Docker Compose project on macOS arm64, `linux/amd64` real browser runner under emulation, Keycloak 26.4.0, Node 24.10.0, Playwright 1.61.0, Chrome 154.0.8037.97 and Edge 154.0.4258.62. Package installation, typechecking, builds and tests ran in containers. The host shell invoked Docker Compose only; no host certificate or runtime installation occurred.

```sh
docker run --rm node:24.10.0-bookworm-slim@sha256:b8d2197aff9129d16c801a3e3e1b2a873c4946480f5a310f38056df2268c38d9 npm view keycloak-js@26.2.4 version
docker run --rm --user 1000:1000 -e HOME=/tmp -v "$PWD:/work" -w /work node:24.10.0-bookworm-slim@sha256:b8d2197aff9129d16c801a3e3e1b2a873c4946480f5a310f38056df2268c38d9 sh -c 'npx --yes pnpm@12.9.1 add --filter @magic-shop/ui keycloak-js@26.2.4 --save-exact'
docker compose -f infra/compose.yaml build ui
./lab up
docker system df
docker builder prune --force
docker compose -f infra/compose.yaml up -d --wait --wait-timeout 120 pki
docker compose -f infra/compose.yaml ps -a pki
docker compose -f infra/compose.yaml up -d --no-deps --wait --wait-timeout 120 ui
docker compose -f infra/compose.yaml build realm-bootstrap
docker compose -f infra/compose.yaml run --rm --no-deps realm-bootstrap
docker compose -f infra/compose.yaml --profile test build runner-test
LAB_BROWSER=chrome LAB_USER=customer-waterdeep docker compose -f infra/compose.yaml --profile test run --rm --no-deps runner-test node /work/testing/container/ui-login.mjs
LAB_BROWSER=msedge LAB_USER=shop-admin docker compose -f infra/compose.yaml --profile test run --rm --no-deps runner-test node /work/testing/container/ui-login.mjs
LAB_BROWSER=chrome LAB_USER=disabled-customer docker compose -f infra/compose.yaml --profile test run --rm --no-deps runner-test node /work/testing/container/ui-login.mjs
docker compose -f infra/compose.yaml --profile manual build runner-manual
LAB_BROWSER=chrome LAB_USER=customer-waterdeep docker compose -f infra/compose.yaml --profile manual run --rm --no-deps -e LAB_UI_FLOW=1 runner-manual sh /work/testing/container/native-login.sh
LAB_BROWSER=msedge LAB_USER=shop-admin docker compose -f infra/compose.yaml --profile manual run --rm --no-deps -e LAB_UI_FLOW=1 runner-manual sh /work/testing/container/native-login.sh
docker compose -f infra/compose.yaml --profile test run --rm --no-deps -v magic-shop-lab_cert-customer-waterdeep:/customer:ro -v magic-shop-lab_cert-shop-admin:/admin:ro runner-test node /work/testing/container/ui-cart-isolation.mjs
docker compose -f infra/compose.yaml config --quiet
```

The pinned UI image typechecked and built. The first `./lab up` attempt stopped when Docker's storage filled during the idempotent PKI job's public-CA copy, leaving the new UI container unstarted. `docker system df` showed 20.37 GB of unused build cache; `docker builder prune --force` removed only that cache. The PKI rerun logged “existing leaves and serial state preserved” and exited 0, restoring the interrupted trust copy. Compose `up --wait pki` itself returned 1 because Compose treats a completed one-shot as a wait failure; `docker compose ps -a pki` confirmed exit 0. The already-built UI then started healthy. No CA, certificate, database or secret volume was reset.

Live Chrome/customer and Edge/shop-admin UI sign-in, role display, bearer propagation, memory-only token storage and sign-out passed. The disabled-customer UI path obtained no authorization code and no password fallback. Both brands passed the UI click path again in headed native NSS profiles with managed certificate-selection policy and no Playwright context certificate option. The cross-account cart test passed: a customer cart displayed for its owner, disappeared on sign-out, and stayed hidden when shop-admin signed in with a different certificate. The final UI build/typecheck and both branded browser checks passed after the item-view cleanup.

## Limits and next dependency

The Vue shell can authenticate, but the catalog, account, checkout, widgets, admin dashboard, regional map reporting and follow-up features still need their real OpenAPI-backed services. The UI's displayed role is informational; the future APIs must validate the signed JWT, gateway certificate identity and permissions themselves. This increment did not time a two-minute UI refresh in a background tab, though the pinned adapter's refresh path is wired and Prompt 04 separately tested server-side refresh rejection after disable. Prompt 05 remains the next dependency for portable Saturday adapters; Linux CI and native amd64 validation are deferred at the user's request until the rest is built.
